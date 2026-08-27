/**
 * Single access-control data layer for the Administration module.
 *
 * It uses ONLY the existing database architecture:
 *  - permission_catalog          → the capability catalog (18 permissions)
 *  - role_permissions            → permissions of the platform's system roles (app_role enum)
 *  - user_roles                  → system role assignments
 *  - user_permission_overrides   → per-user allow / deny overrides
 *  - business_settings           → key/value store used for business-defined custom roles
 *  - admin_audit_logs            → append-only activity log
 *  - has_role / has_permission   → database authorization helpers
 *
 * SCHEMA LIMITATION (no migration allowed): `user_roles.role` and
 * `role_permissions.role` are typed by the `app_role` enum, so arbitrary custom
 * role names cannot be stored in those tables. Business-defined custom roles and
 * their assignments are therefore persisted in the existing `business_settings`
 * key/value table and resolved by this same engine — there is no second RBAC model.
 */

import { supabase } from "@/integrations/supabase/client";

const client = supabase as any;

/** Platform-provided roles (the existing app_role enum values). */
export const SYSTEM_ROLES = ["admin", "manager", "cashier", "staff"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

const CUSTOM_ROLE_PREFIX = "rbac.custom_role.";
const USER_CUSTOM_ROLES_PREFIX = "rbac.user_custom_roles.";

export type PermissionDef = {
  permission_key: string;
  module: string;
  action: string;
  description: string;
  active: boolean;
};

export type RoleType = "system" | "custom";

export type RoleDefinition = {
  /** Slug used as the storage identifier (system roles use the enum value). */
  id: string;
  name: string;
  type: RoleType;
  permissions: string[];
};

export type PermissionState = "inherited" | "granted" | "revoked" | "not_assigned";

export type EffectivePermission = {
  permission_key: string;
  module: string;
  action: string;
  state: PermissionState;
  /** Human readable origin, e.g. "Sales Supervisor" or "User override". */
  source: string;
  allowed: boolean;
};

export type UserRoleAssignment = { system: SystemRole[]; custom: string[] };

export type PermissionOverride = { permission_key: string; effect: "allow" | "deny" };

/* ------------------------------- catalog ---------------------------------- */

export async function fetchPermissionCatalog(): Promise<PermissionDef[]> {
  const { data } = await client
    .from("permission_catalog")
    .select("permission_key,module,action,description,active")
    .order("module");
  return (data ?? []) as PermissionDef[];
}

/* --------------------------------- roles ---------------------------------- */

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** All roles the business can use: platform system roles + business custom roles. */
export async function fetchRoles(): Promise<RoleDefinition[]> {
  const [{ data: rolePermissions }, { data: settings }] = await Promise.all([
    client.from("role_permissions").select("role,permission_key").order("role"),
    client.from("business_settings").select("setting_key,setting_value"),
  ]);

  const roles: RoleDefinition[] = SYSTEM_ROLES.map((role) => ({
    id: role,
    name: role,
    type: "system" as const,
    permissions: (rolePermissions ?? [])
      .filter((row: any) => row.role === role)
      .map((row: any) => row.permission_key),
  }));

  for (const row of settings ?? []) {
    if (!String(row.setting_key).startsWith(CUSTOM_ROLE_PREFIX)) continue;
    const id = String(row.setting_key).slice(CUSTOM_ROLE_PREFIX.length);
    let parsed: { name?: string; permissions?: string[] } = {};
    try {
      parsed = JSON.parse(row.setting_value || "{}");
    } catch {
      parsed = {};
    }
    roles.push({
      id,
      name: parsed.name || id,
      type: "custom",
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
    });
  }

  return roles;
}

/** Creates or updates a business-defined custom role. Returns its id. */
export async function saveCustomRole(input: {
  id?: string;
  name: string;
  permissions: string[];
}): Promise<string> {
  const id = input.id || slugify(input.name);
  if (!id) throw new Error("Role name is required");
  const { error } = await client.from("business_settings").upsert(
    {
      setting_key: `${CUSTOM_ROLE_PREFIX}${id}`,
      setting_value: JSON.stringify({ name: input.name.trim(), permissions: input.permissions }),
      description: "Business-defined custom role",
    },
    { onConflict: "setting_key" },
  );
  if (error) throw new Error(error.message);
  return id;
}

export async function deleteCustomRole(id: string) {
  const { data: assignments } = await client
    .from("business_settings")
    .select("setting_key,setting_value")
    .like("setting_key", `${USER_CUSTOM_ROLES_PREFIX}%`);

  // Remove the role from every user that still carries it.
  for (const row of assignments ?? []) {
    let list: string[] = [];
    try {
      list = JSON.parse(row.setting_value || "[]");
    } catch {
      list = [];
    }
    if (!list.includes(id)) continue;
    await client
      .from("business_settings")
      .upsert(
        { setting_key: row.setting_key, setting_value: JSON.stringify(list.filter((r) => r !== id)) },
        { onConflict: "setting_key" },
      );
  }

  const { error } = await client
    .from("business_settings")
    .delete()
    .eq("setting_key", `${CUSTOM_ROLE_PREFIX}${id}`);
  if (error) throw new Error(error.message);
}

/** Replaces the permission set of a system role in role_permissions. */
export async function setSystemRolePermissions(role: SystemRole, permissions: string[]) {
  const { data: current } = await client
    .from("role_permissions")
    .select("id,permission_key")
    .eq("role", role);
  const existing = new Set((current ?? []).map((row: any) => row.permission_key));
  const next = new Set(permissions);

  const toRemove = (current ?? []).filter((row: any) => !next.has(row.permission_key));
  const toAdd = permissions.filter((key) => !existing.has(key));

  if (toRemove.length) {
    const { error } = await client
      .from("role_permissions")
      .delete()
      .in(
        "id",
        toRemove.map((row: any) => row.id),
      );
    if (error) throw new Error(error.message);
  }
  if (toAdd.length) {
    const { error } = await client
      .from("role_permissions")
      .insert(toAdd.map((permission_key) => ({ role, permission_key, scope: "ALL" })));
    if (error) throw new Error(error.message);
  }
}

/* ---------------------------- user assignments ---------------------------- */

export async function fetchUserRoles(userId: string): Promise<UserRoleAssignment> {
  const [{ data: system }, { data: setting }] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", userId),
    client
      .from("business_settings")
      .select("setting_value")
      .eq("setting_key", `${USER_CUSTOM_ROLES_PREFIX}${userId}`)
      .maybeSingle(),
  ]);
  let custom: string[] = [];
  try {
    custom = JSON.parse(setting?.setting_value || "[]");
  } catch {
    custom = [];
  }
  return {
    system: (system ?? []).map((row: any) => row.role as SystemRole),
    custom: Array.isArray(custom) ? custom : [],
  };
}

/** Fetches custom role assignments for many users at once (for list views). */
export async function fetchAllCustomRoleAssignments(): Promise<Record<string, string[]>> {
  const { data } = await client
    .from("business_settings")
    .select("setting_key,setting_value")
    .like("setting_key", `${USER_CUSTOM_ROLES_PREFIX}%`);
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const userId = String(row.setting_key).slice(USER_CUSTOM_ROLES_PREFIX.length);
    try {
      const list = JSON.parse(row.setting_value || "[]");
      result[userId] = Array.isArray(list) ? list : [];
    } catch {
      result[userId] = [];
    }
  }
  return result;
}

/** Replaces the full role assignment (system + custom) of a user. */
export async function setUserRoles(userId: string, next: UserRoleAssignment) {
  const current = await fetchUserRoles(userId);

  const removed = current.system.filter((role) => !next.system.includes(role));
  const added = next.system.filter((role) => !current.system.includes(role));

  if (removed.length) {
    const { error } = await client
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", removed);
    if (error) throw new Error(error.message);
  }
  if (added.length) {
    const { error } = await client
      .from("user_roles")
      .upsert(
        added.map((role) => ({ user_id: userId, role })),
        { onConflict: "user_id,role" },
      );
    if (error) throw new Error(error.message);
  }

  const { error: customError } = await client.from("business_settings").upsert(
    {
      setting_key: `${USER_CUSTOM_ROLES_PREFIX}${userId}`,
      setting_value: JSON.stringify(next.custom),
      description: "Custom role assignments for this user",
    },
    { onConflict: "setting_key" },
  );
  if (customError) throw new Error(customError.message);
}

/* ------------------------------- overrides -------------------------------- */

export async function fetchUserOverrides(userId: string): Promise<PermissionOverride[]> {
  const { data } = await client
    .from("user_permission_overrides")
    .select("permission_key,effect")
    .eq("user_id", userId);
  return (data ?? []) as PermissionOverride[];
}

/** Sets or clears a single user override. `effect: null` clears it (back to inherited). */
export async function setUserOverride(
  userId: string,
  permissionKey: string,
  effect: "allow" | "deny" | null,
) {
  await client
    .from("user_permission_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("permission_key", permissionKey);
  if (!effect) return;
  const { error } = await client
    .from("user_permission_overrides")
    .insert({ user_id: userId, permission_key: permissionKey, effect, scope: "ALL" });
  if (error) throw new Error(error.message);
}

/* ---------------------------- effective access ---------------------------- */

/**
 * Effective permissions = role permissions + user grants - user revocations,
 * annotated with the state and the source that explains the outcome.
 */
export function computeEffectivePermissions(input: {
  catalog: PermissionDef[];
  roles: RoleDefinition[];
  assignment: UserRoleAssignment;
  overrides: PermissionOverride[];
}): EffectivePermission[] {
  const { catalog, roles, assignment, overrides } = input;
  const assigned = roles.filter(
    (role) =>
      (role.type === "system" && assignment.system.includes(role.id as SystemRole)) ||
      (role.type === "custom" && assignment.custom.includes(role.id)),
  );

  const inheritedFrom = new Map<string, string[]>();
  for (const role of assigned) {
    for (const key of role.permissions) {
      inheritedFrom.set(key, [...(inheritedFrom.get(key) ?? []), role.name]);
    }
  }

  const overrideMap = new Map(overrides.map((row) => [row.permission_key, row.effect]));

  return catalog.map((permission) => {
    const sources = inheritedFrom.get(permission.permission_key);
    const override = overrideMap.get(permission.permission_key);

    if (override === "deny") {
      return {
        ...basics(permission),
        state: "revoked",
        allowed: false,
        source: sources?.length
          ? `Revoked by user override (was inherited from ${sources.join(", ")})`
          : "Revoked by user override",
      };
    }
    if (override === "allow" && !sources?.length) {
      return { ...basics(permission), state: "granted", allowed: true, source: "User override" };
    }
    if (sources?.length) {
      return {
        ...basics(permission),
        state: "inherited",
        allowed: true,
        source: sources.join(", "),
      };
    }
    return { ...basics(permission), state: "not_assigned", allowed: false, source: "Not assigned" };
  });
}

const basics = (permission: PermissionDef) => ({
  permission_key: permission.permission_key,
  module: permission.module,
  action: permission.action,
});

/* ------------------------------ audit trail ------------------------------- */

/** Appends an access-control change to the existing append-only activity log. */
export async function logAccessChange(input: {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  actorLabel?: string | null;
}) {
  const { data } = await client.auth.getUser();
  await client.from("admin_audit_logs").insert({
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    actor_id: data?.user?.id ?? null,
    actor_label: input.actorLabel ?? (data?.user?.user_metadata as any)?.phone ?? null,
    status: "success",
  });
}

/* --------------------------- runtime authorization ------------------------ */

/**
 * Authoritative check used by the application at runtime — it delegates to the
 * existing database helper so effective permissions (including revocations) are
 * enforced server-side, not just in the UI.
 */
export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const { data, error } = await client.rpc("has_permission", {
    _user_id: userId,
    _permission_key: permissionKey,
  });
  if (error) return false;
  return Boolean(data);
}

export async function hasRole(userId: string, role: SystemRole): Promise<boolean> {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: role });
  if (error) return false;
  return Boolean(data);
}
