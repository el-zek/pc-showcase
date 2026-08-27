import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Key, Lock, Settings, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { BusinessScopePanel } from "@/components/admin/business-scope-panel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog, RecordDialog, str, type FieldValue } from "@/components/tax/record-dialog";
import { ModernDialog, panelLabelCls, panelSectionCls } from "@/components/ui/modern-dialog";
import { dateTimeFmt } from "@/lib/format";
import {
  SYSTEM_ROLES,
  computeEffectivePermissions,
  deleteCustomRole,
  fetchAllCustomRoleAssignments,
  fetchPermissionCatalog,
  fetchRoles,
  fetchUserOverrides,
  fetchUserRoles,
  logAccessChange,
  saveCustomRole,
  setSystemRolePermissions,
  setUserOverride,
  setUserRoles,
  type EffectivePermission,
  type PermissionDef,
  type RoleDefinition,
  type SystemRole,
  type UserRoleAssignment,
} from "@/lib/access-control";
import {
  DetailsDrawer,
  StatusBadge,
  SummaryStrip,
  TaxTable,
  TaxWorkspace,
} from "@/components/tax/tax-workspace";

const client = supabase as any;

export type Section = "users" | "roles" | "settings" | "activity" | "security";
const sectionMeta: Record<Section, { title: string; subtitle: string; icon: typeof Users }> = {
  users: { title: "Users", subtitle: "Review users and their effective access", icon: Users },
  roles: {
    title: "Roles",
    subtitle: "System roles and the roles this business defines itself",
    icon: Shield,
  },
  settings: {
    title: "Settings",
    subtitle: "Configure supported business behavior",
    icon: Settings,
  },
  activity: {
    title: "Activity Logs",
    subtitle: "Trace administrative and security changes",
    icon: Activity,
  },
  security: {
    title: "Security",
    subtitle: "Review authorization controls and account protection",
    icon: Lock,
  },
};

function AdminShell({ section, children }: { section: Section; children: ReactNode }) {
  const meta = sectionMeta[section];
  return (
    <TaxWorkspace
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      backTo="/m/admin"
      backLabel="Back to Administration"
    >
      {children}
    </TaxWorkspace>
  );
}

export function AdminPage({ section }: { section: Section }) {
  if (section === "users") return <UsersPage />;
  if (section === "roles") return <RolesPage />;
  
  if (section === "settings") return <SettingsPage />;
  if (section === "activity") return <ActivityPage />;
  return <SecurityPage />;
}

/* ---------------------------- shared building blocks ---------------------- */

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

/** Splits a permission key into its module, submodule and action parts. */
function permissionParts(permission: PermissionDef) {
  const parts = permission.permission_key.split(".");
  const submodule = parts.length >= 3 ? parts.slice(1, -1).join(" · ") : "General";
  return { submodule: titleCase(submodule), action: titleCase(permission.action) };
}

/**
 * Groups the permission catalog by module and then by submodule, so a business
 * owner sees "Sales → Invoices → Create" instead of one flat list per module.
 */
function PermissionPicker({
  catalog,
  selected,
  onToggle,
}: {
  catalog: PermissionDef[];
  selected: string[];
  onToggle: (permissionKey: string, next: boolean) => void;
}) {
  const grouped = useMemo(() => {
    const modules = new Map<string, Map<string, PermissionDef[]>>();
    for (const permission of catalog) {
      const { submodule } = permissionParts(permission);
      const subs = modules.get(permission.module) ?? new Map<string, PermissionDef[]>();
      subs.set(submodule, [...(subs.get(submodule) ?? []), permission]);
      modules.set(permission.module, subs);
    }
    return [...modules.entries()].map(([module, subs]) => ({
      module,
      keys: [...subs.values()].flat().map((permission) => permission.permission_key),
      submodules: [...subs.entries()].map(([submodule, permissions]) => ({
        submodule,
        permissions,
      })),
    }));
  }, [catalog]);

  if (!catalog.length) {
    return <p className="text-sm text-white/60">Loading the permission catalog…</p>;
  }

  return (
    <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
      {grouped.map(({ module, keys, submodules }) => {
        const chosen = keys.filter((key) => selected.includes(key)).length;
        const allChosen = chosen === keys.length;
        return (
          <div key={module} className={panelSectionCls}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allChosen}
                  onCheckedChange={(checked) =>
                    keys.forEach((key) => onToggle(key, checked === true))
                  }
                />
                <p className={panelLabelCls}>{titleCase(module)} module</p>
              </div>
              <span className="text-xs text-white/45">
                {chosen}/{keys.length} selected
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {submodules.map(({ submodule, permissions }) => {
                const subKeys = permissions.map((permission) => permission.permission_key);
                const subAll = subKeys.every((key) => selected.includes(key));
                return (
                  <div
                    key={submodule}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={subAll}
                        onCheckedChange={(checked) =>
                          subKeys.forEach((key) => onToggle(key, checked === true))
                        }
                      />
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
                        {submodule}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {permissions.map((permission) => (
                        <label
                          key={permission.permission_key}
                          className="flex items-start gap-2 rounded-lg px-1 py-1 text-sm text-white/80"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.includes(permission.permission_key)}
                            onCheckedChange={(checked) =>
                              onToggle(permission.permission_key, checked === true)
                            }
                          />
                          <span>
                            <span className="text-white">
                              {permissionParts(permission).action}
                            </span>
                            <span className="block text-xs text-white/45">
                              {permission.description || permission.permission_key}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


const stateLabel: Record<EffectivePermission["state"], string> = {
  inherited: "Inherited",
  granted: "Granted",
  revoked: "Revoked",
  not_assigned: "Not assigned",
};

/* --------------------------------- users ---------------------------------- */

function UsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [effective, setEffective] = useState<EffectivePermission[]>([]);
  const [roleEditing, setRoleEditing] = useState<any | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRoleAssignment>({ system: [], custom: [] });
  const [accessEditing, setAccessEditing] = useState<any | null>(null);
  const [accessRows, setAccessRows] = useState<EffectivePermission[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profileError }, { data: userRoles }, customAssignments, roleDefs, catalogRows] =
        await Promise.all([
          client.from("profiles").select("id,full_name,phone,status,last_seen_at,created_at"),
          client.from("user_roles").select("user_id,role"),
          fetchAllCustomRoleAssignments(),
          fetchRoles(),
          fetchPermissionCatalog(),
        ]);
      if (profileError) throw new Error(profileError.message);
      setRoles(roleDefs);
      setCatalog(catalogRows);
      const nameOf = (id: string) => roleDefs.find((role) => role.id === id)?.name ?? id;
      setRows(
        (profiles ?? []).map((profile: any) => {
          const system = (userRoles ?? [])
            .filter((row: any) => row.user_id === profile.id)
            .map((row: any) => row.role as SystemRole);
          const custom = customAssignments[profile.id] ?? [];
          return {
            ...profile,
            systemRoles: system,
            customRoles: custom,
            roles: [...system, ...custom.map(nameOf)].join(", ") || "No role assigned",
          };
        }),
      );
      setError(null);
    } catch (caught: any) {
      setError(caught?.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const loadEffective = async (user: any) => {
    const [assignment, overrides] = await Promise.all([
      fetchUserRoles(user.id),
      fetchUserOverrides(user.id),
    ]);
    return computeEffectivePermissions({ catalog, roles, assignment, overrides });
  };

  useEffect(() => {
    if (!selected) return;
    void loadEffective(selected).then(setEffective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const openRoleEditor = (row: any) => {
    setRoleDraft({ system: row.systemRoles ?? [], custom: row.customRoles ?? [] });
    setRoleEditing(row);
  };

  const saveRoles = async () => {
    try {
      const previous = await fetchUserRoles(roleEditing.id);
      await setUserRoles(roleEditing.id, roleDraft);
      await logAccessChange({
        action: "user.roles.updated",
        resourceType: "user_roles",
        resourceId: roleEditing.id,
        previousValue: [...previous.system, ...previous.custom].join(", ") || "none",
        newValue: [...roleDraft.system, ...roleDraft.custom].join(", ") || "none",
      });
      toast.success("Roles updated");
      setRoleEditing(null);
      await refresh();
    } catch (caught: any) {
      toast.error(caught?.message || "Could not update roles");
    }
  };

  const openAccessEditor = async (row: any) => {
    setAccessEditing(row);
    setAccessRows(await loadEffective(row));
  };

  const changeAccess = async (permission: EffectivePermission, next: PermissionState) => {
    try {
      const effect = next === "granted" ? "allow" : next === "revoked" ? "deny" : null;
      await setUserOverride(accessEditing.id, permission.permission_key, effect);
      await logAccessChange({
        action:
          effect === "allow"
            ? "user.permission.granted"
            : effect === "deny"
              ? "user.permission.revoked"
              : "user.permission.override_cleared",
        resourceType: "user_permission_overrides",
        resourceId: accessEditing.id,
        previousValue: `${permission.permission_key}: ${stateLabel[permission.state]}`,
        newValue: `${permission.permission_key}: ${stateLabel[next]}`,
      });
      setAccessRows(await loadEffective(accessEditing));
      if (selected?.id === accessEditing.id) setEffective(await loadEffective(accessEditing));
    } catch (caught: any) {
      toast.error(caught?.message || "Could not update permission");
    }
  };

  const toggleStatus = async (row: any) => {
    const next = row.status === "active" ? "inactive" : "active";
    const { error: updateError } = await client
      .from("profiles")
      .update({ status: next })
      .eq("id", row.id);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    await logAccessChange({
      action: "user.status.changed",
      resourceType: "profiles",
      resourceId: row.id,
      previousValue: row.status || "active",
      newValue: next,
    });
    toast.success(next === "active" ? "User activated" : "User deactivated");
    await refresh();
  };

  const activeCount = rows.filter((row) => (row.status || "active") === "active").length;
  const grouped = useMemo(() => {
    const map = new Map<string, EffectivePermission[]>();
    for (const permission of effective) {
      map.set(permission.module, [...(map.get(permission.module) ?? []), permission]);
    }
    return [...map.entries()];
  }, [effective]);

  return (
    <AdminShell section="users">
      <SummaryStrip
        items={[
          { label: "Users", value: loading ? "…" : String(rows.length), accent: true },
          { label: "Active", value: loading ? "…" : String(activeCount) },
          { label: "Roles available", value: loading ? "…" : String(roles.length) },
        ]}
      />
      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.full_name} ${row.phone} ${row.status} ${row.roles}`}
        filter={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ],
          match: (row, value) => (row.status || "active") === value,
        }}
        columns={[
          {
            key: "full_name",
            label: "Name",
            render: (row) => (
              <span className="font-medium text-white">{row.full_name || "Unnamed user"}</span>
            ),
          },
          {
            key: "phone",
            label: "Phone",
            render: (row) => <span className="text-white/70">{row.phone || "—"}</span>,
          },
          { key: "roles", label: "Role", render: (row) => <StatusBadge value={row.roles} /> },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusBadge value={row.status || "active"} />,
          },
          {
            key: "last_seen_at",
            label: "Last seen",
            hideOnMobile: true,
            render: (row) =>
              row.last_seen_at ? dateTimeFmt.format(new Date(row.last_seen_at)) : "Never",
          },
          {
            key: "assign",
            label: "Role assignment",
            render: (row) => (
              <Button
                className="h-8 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-black hover:bg-amber-300"
                onClick={(event) => {
                  event.stopPropagation();
                  openRoleEditor(row);
                }}
              >
                Assign role
              </Button>
            ),
          },
        ]}
        onEdit={openRoleEditor}
        onRowClick={setSelected}
        rowActions={(row) => [
          { label: "Assign roles", onSelect: () => openRoleEditor(row) },
          { label: "Customize permissions", onSelect: () => void openAccessEditor(row) },
          {
            label: (row.status || "active") === "active" ? "Deactivate user" : "Activate user",
            onSelect: () => void toggleStatus(row),
            danger: (row.status || "active") === "active",
          },
        ]}
        empty={{
          title: loading ? "Loading users…" : "No users found",
          description: loading
            ? "Fetching user profiles and role assignments."
            : "Users appear here after they create an account.",
          icon: Users,
        }}
      />

      <DetailsDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.full_name || selected?.phone || "User details"}
        description="Profile, assigned roles and effective access with the source of each permission."
        icon={Users}
        rows={[
          { label: "Phone", value: selected?.phone || "Not provided" },
          { label: "Status", value: selected?.status || "active" },
          {
            label: "Last seen",
            value: selected?.last_seen_at
              ? dateTimeFmt.format(new Date(selected.last_seen_at))
              : "Never",
          },
          { label: "Assigned roles", value: selected?.roles || "No role assigned" },
          {
            label: "Effective access",
            value: (
              <div className="space-y-2">
                {grouped.length === 0 ? (
                  <span className="text-white/60">No permissions resolved</span>
                ) : (
                  grouped.map(([module, permissions]) => (
                    <div key={module}>
                      <p className="text-xs uppercase tracking-wider text-white/45">{module}</p>
                      {permissions.map((permission) => (
                        <p key={permission.permission_key} className="text-sm">
                          <span className={permission.allowed ? "text-emerald-300" : "text-white/40"}>
                            {permission.allowed ? "✓" : "✗"} {permission.action}
                          </span>
                          <span className="ml-2 text-xs text-white/45">
                            {stateLabel[permission.state]} · {permission.source}
                          </span>
                        </p>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ),
          },
        ]}
        footer={
          selected ? (
            <Button
              className="h-11 w-full rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
              onClick={() => void openAccessEditor(selected)}
            >
              Customize permissions
            </Button>
          ) : null
        }
      />

      {/* Role assignment: system roles + business custom roles */}
      <ModernDialog
        open={Boolean(roleEditing)}
        onClose={() => setRoleEditing(null)}
        title="Assign roles"
        description={`Choose the roles that apply to ${roleEditing?.full_name || roleEditing?.phone || "this user"}.`}
        icon={Shield}
        footer={
          <>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
              onClick={() => setRoleEditing(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
              onClick={() => void saveRoles()}
            >
              Save roles
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className={panelSectionCls}>
            <p className={panelLabelCls}>System roles</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {roles
                .filter((role) => role.type === "system")
                .map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm text-white/80">
                    <Checkbox
                      checked={roleDraft.system.includes(role.id as SystemRole)}
                      onCheckedChange={(checked) =>
                        setRoleDraft((current) => ({
                          ...current,
                          system:
                            checked === true
                              ? [...current.system, role.id as SystemRole]
                              : current.system.filter((value) => value !== role.id),
                        }))
                      }
                    />
                    <span className="capitalize text-white">{role.name}</span>
                    <span className="text-xs text-white/45">{role.permissions.length} perms</span>
                  </label>
                ))}
            </div>
          </div>
          <div className={panelSectionCls}>
            <p className={panelLabelCls}>Custom roles</p>
            {roles.some((role) => role.type === "custom") ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {roles
                  .filter((role) => role.type === "custom")
                  .map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-white/80">
                      <Checkbox
                        checked={roleDraft.custom.includes(role.id)}
                        onCheckedChange={(checked) =>
                          setRoleDraft((current) => ({
                            ...current,
                            custom:
                              checked === true
                                ? [...current.custom, role.id]
                                : current.custom.filter((value) => value !== role.id),
                          }))
                        }
                      />
                      <span className="text-white">{role.name}</span>
                      <span className="text-xs text-white/45">{role.permissions.length} perms</span>
                    </label>
                  ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/55">
                No custom roles yet — create them in Administration → Roles.
              </p>
            )}
          </div>
        </div>
      </ModernDialog>

      {/* Per-user permission overrides */}
      <ModernDialog
        open={Boolean(accessEditing)}
        onClose={() => setAccessEditing(null)}
        title="Customize permissions"
        description={`Grant or revoke individual capabilities for ${accessEditing?.full_name || accessEditing?.phone || "this user"}. Role permissions are only defaults.`}
        icon={Key}
        size="2xl"
        footer={
          <Button
            className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
            onClick={() => setAccessEditing(null)}
          >
            Done
          </Button>
        }
      >
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {accessRows.length === 0 ? (
            <p className="text-sm text-white/60">Loading permissions…</p>
          ) : (
            accessRows.map((permission) => (
              <div
                key={permission.permission_key}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{permission.permission_key}</p>
                  <p className="text-xs text-white/45">
                    {stateLabel[permission.state]} · {permission.source}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(["inherited", "granted", "revoked"] as PermissionState[]).map((state) => {
                    const isCurrent =
                      permission.state === state ||
                      (state === "inherited" &&
                        (permission.state === "inherited" || permission.state === "not_assigned"));
                    return (
                      <Button
                        key={state}
                        variant="outline"
                        className={`h-8 rounded-lg border-white/10 px-3 text-xs ${
                          isCurrent
                            ? "bg-amber-400/20 text-amber-200"
                            : "bg-white/[0.04] text-white/70 hover:bg-white/15"
                        }`}
                        onClick={() => void changeAccess(permission, state)}
                      >
                        {state === "inherited" ? "Use role" : stateLabel[state]}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ModernDialog>
    </AdminShell>
  );
}

type PermissionState = EffectivePermission["state"];

/* --------------------------------- roles ---------------------------------- */

function RolesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ role: RoleDefinition | null } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<RoleDefinition | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [roleDefs, catalogRows, { data: assignments }, customAssignments] = await Promise.all([
        fetchRoles(),
        fetchPermissionCatalog(),
        client.from("user_roles").select("user_id,role"),
        fetchAllCustomRoleAssignments(),
      ]);
      setCatalog(catalogRows);
      const customCounts: Record<string, number> = {};
      for (const list of Object.values(customAssignments)) {
        for (const roleId of list) customCounts[roleId] = (customCounts[roleId] ?? 0) + 1;
      }
      setRows(
        roleDefs.map((role) => ({
          ...role,
          users:
            role.type === "system"
              ? (assignments ?? []).filter((row: any) => row.role === role.id).length
              : (customCounts[role.id] ?? 0),
        })),
      );
      setError(null);
    } catch (caught: any) {
      setError(caught?.message || "Unable to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const openEditor = (role: RoleDefinition | null) => {
    setDraftName(role?.name ?? "");
    setDraftPermissions(role?.permissions ?? []);
    setEditing({ role });
  };

  const save = async () => {
    const role = editing?.role ?? null;
    try {
      if (role?.type === "system") {
        await setSystemRolePermissions(role.id as SystemRole, draftPermissions);
        await logAccessChange({
          action: "role.permissions.updated",
          resourceType: "role_permissions",
          resourceId: role.id,
          previousValue: role.permissions.join(", ") || "none",
          newValue: draftPermissions.join(", ") || "none",
        });
      } else {
        if (!draftName.trim()) {
          toast.error("Role name is required");
          return;
        }
        const id = await saveCustomRole({
          id: role?.id,
          name: draftName,
          permissions: draftPermissions,
        });
        await logAccessChange({
          action: role ? "role.updated" : "role.created",
          resourceType: "custom_role",
          resourceId: id,
          previousValue: role ? `${role.name}: ${role.permissions.join(", ") || "none"}` : null,
          newValue: `${draftName}: ${draftPermissions.join(", ") || "none"}`,
        });
      }
      toast.success("Role saved");
      setEditing(null);
      await refresh();
    } catch (caught: any) {
      toast.error(caught?.message || "Could not save role");
    }
  };

  const remove = async (role: RoleDefinition) => {
    try {
      await deleteCustomRole(role.id);
      await logAccessChange({
        action: "role.deleted",
        resourceType: "custom_role",
        resourceId: role.id,
        previousValue: `${role.name}: ${role.permissions.join(", ") || "none"}`,
      });
      toast.success("Custom role deleted");
      await refresh();
    } catch (caught: any) {
      toast.error(caught?.message || "Could not delete role");
    }
  };

  return (
    <AdminShell section="roles">
      <SummaryStrip
        items={[
          { label: "Roles", value: loading ? "…" : String(rows.length), accent: true },
          {
            label: "Custom roles",
            value: loading ? "…" : String(rows.filter((row) => row.type === "custom").length),
          },
          {
            label: "Assigned users",
            value: loading ? "…" : String(rows.reduce((total, row) => total + row.users, 0)),
          },
        ]}
      />
      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.name} ${row.type} ${row.permissions.join(" ")}`}
        filter={{
          label: "Type",
          options: [
            { value: "system", label: "System" },
            { value: "custom", label: "Custom" },
          ],
          match: (row, value) => row.type === value,
        }}
        columns={[
          {
            key: "name",
            label: "Role",
            render: (row) => <span className="font-medium capitalize text-white">{row.name}</span>,
          },
          {
            key: "type",
            label: "Type",
            render: (row) => <StatusBadge value={row.type === "system" ? "System" : "Custom"} />,
          },
          {
            key: "users",
            label: "Users",
            render: (row) => <span className="text-white/70">{row.users}</span>,
          },
          {
            key: "permission_count",
            label: "Permissions",
            render: (row) => <span className="text-white/70">{row.permissions.length}</span>,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <StatusBadge value={row.permissions.length ? "Configured" : "Unconfigured"} />
            ),
          },
        ]}
        onEdit={(row) => openEditor(row as RoleDefinition)}
        rowActions={(row) => {
          const actions = [
            { label: "Configure permissions", onSelect: () => openEditor(row as RoleDefinition) },
          ];
          if (row.type === "custom") {
            actions.push({
              label: "Delete role",
              onSelect: () => setDeleting(row as RoleDefinition),
              danger: true,
            } as any);
          }
          return actions;
        }}
        addLabel="Create role"
        onAdd={() => openEditor(null)}
        empty={{
          title: loading ? "Loading roles…" : "No roles available",
          description: loading
            ? "Fetching system roles and business custom roles."
            : "Create a custom role that matches how this business works.",
          icon: Shield,
        }}
      />

      <ModernDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={
          editing?.role
            ? editing.role.type === "system"
              ? `Configure ${editing.role.name}`
              : `Edit ${editing.role.name}`
            : "Create role"
        }
        description={
          editing?.role?.type === "system"
            ? "This is a platform system role. Its name is protected, but the business decides what it means."
            : "Name the role however this business names it, then choose the capabilities it grants."
        }
        icon={Shield}
        size="2xl"
        footer={
          <>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
              onClick={() => void save()}
            >
              Save role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editing?.role?.type === "system" ? (
            <div className={panelSectionCls}>
              <p className={panelLabelCls}>Role</p>
              <p className="mt-1 text-sm capitalize text-white">{editing.role.name} · System role</p>
            </div>
          ) : (
            <div>
              <Label className={panelLabelCls}>Role name</Label>
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="e.g. Wholesale Supervisor"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
              />
            </div>
          )}
          <div>
            <Label className={panelLabelCls}>Permissions ({draftPermissions.length})</Label>
            <div className="mt-2">
              <PermissionPicker
                catalog={catalog}
                selected={draftPermissions}
                onToggle={(key, next) =>
                  setDraftPermissions((current) =>
                    next
                      ? current.includes(key)
                        ? current
                        : [...current, key]
                      : current.filter((value) => value !== key),
                  )
                }
              />
            </div>
          </div>
        </div>
      </ModernDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "role"}?`}
        description="Users assigned this custom role will lose the permissions it granted."
        onConfirm={() => deleting && void remove(deleting)}
      />
    </AdminShell>
  );
}


function SettingsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const refresh = async () => {
    const { data } = await client
      .from("business_settings")
      .select("setting_key,setting_value,description,updated_at")
      .order("setting_key");
    setRows((data ?? []).map((row: any) => ({ ...row, id: row.setting_key })));
  };
  useEffect(() => {
    void refresh();
  }, []);
  const save = async (value: Record<string, FieldValue>) => {
    const { error } = await client.from("business_settings").upsert({
      setting_key: str(value.key),
      setting_value: str(value.value),
      description: str(value.description) || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Setting saved");
      setEditing(null);
      await refresh();
    }
  };
  return (
    <AdminShell section="settings">
      <BusinessScopePanel />
      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.setting_key} ${row.description || ""}`}
        columns={[
          {
            key: "setting_key",
            label: "Setting",
            render: (row) => <span className="font-medium text-white">{row.setting_key}</span>,
          },
          { key: "setting_value", label: "Value" },
          { key: "description", label: "Description", hideOnMobile: true },
          {
            key: "updated_at",
            label: "Updated",
            render: (row) => new Date(row.updated_at).toLocaleDateString(),
          },
        ]}
        onEdit={setEditing}
        onAdd={() => setEditing({})}
        addLabel="Add setting"
        empty={{
          title: "No business settings",
          description: "Add supported configuration values for this business.",
          icon: Settings,
        }}
      />
      <RecordDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.setting_key ? "Edit setting" : "Add setting"}
        description="Settings are persisted and can be consumed by business logic."
        icon={Settings}
        submitLabel="Save setting"
        initialValue={
          editing
            ? {
                key: editing.setting_key || "",
                value: editing.setting_value || "",
                description: editing.description || "",
              }
            : null
        }
        fields={[
          { name: "key", label: "Setting key", type: "text", required: true },
          { name: "value", label: "Value", type: "text", required: true },
          { name: "description", label: "Description", type: "text" },
        ]}
        onSubmit={(value) => void save(value)}
      />
    </AdminShell>
  );
}

function ActivityPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  useEffect(() => {
    void client
      .from("admin_audit_logs")
      .select("id,actor_id,action,resource_type,resource_id,previous_value,new_value,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }: any) => setRows(data ?? []));
  }, []);
  return (
    <AdminShell section="activity">
      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.action} ${row.resource_type} ${row.resource_id || ""}`}
        columns={[
          {
            key: "action",
            label: "Action",
            render: (row) => <span className="font-medium text-white">{row.action}</span>,
          },
          { key: "resource_type", label: "Resource" },
          { key: "previous_value", label: "Previous", render: (row) => row.previous_value || "—" },
          { key: "new_value", label: "New", render: (row) => row.new_value || "—" },
          {
            key: "created_at",
            label: "Timestamp",
            render: (row) => new Date(row.created_at).toLocaleString(),
          },
        ]}
        onRowClick={setSelected}
        empty={{
          title: "No activity recorded",
          description: "Administrative changes will appear here as they occur.",
          icon: Activity,
        }}
      />
      <DetailsDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.action || "Activity details"}
        description="Append-only administrative audit record."
        icon={Activity}
        rows={[
          { label: "Actor", value: selected?.actor_id || "Not available" },
          { label: "Resource", value: selected?.resource_type || "Not available" },
          { label: "Resource ID", value: selected?.resource_id || "Not available" },
          {
            label: "Timestamp",
            value: selected?.created_at
              ? new Date(selected.created_at).toLocaleString()
              : "Not available",
          },
          { label: "Previous value", value: selected?.previous_value || "—" },
          { label: "New value", value: selected?.new_value || "—" },
        ]}
      />
    </AdminShell>
  );
}

function SecurityPage() {
  return (
    <AdminShell section="security">
      <SummaryStrip
        items={[
          { label: "Authorization", value: "RLS enforced", accent: true },
          { label: "Audit trail", value: "Append-only" },
          { label: "Access model", value: "Role permissions" },
        ]}
      />
      <div className="rounded-2xl border border-white/15 bg-black/20 p-5 text-sm text-white/70">
        <p className="font-medium text-white">Security controls</p>
        <p className="mt-2">
          Administrative writes are restricted by the database authorization policies. Users receive
          only explicitly assigned role permissions, and changes are recorded in the Activity Logs
          module.
        </p>
      </div>
    </AdminShell>
  );
}
