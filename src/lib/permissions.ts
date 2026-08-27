/**
 * Role-based access control primitives.
 *
 * Permissions are aggregated across ALL roles assigned to a user (union / logical OR):
 * if any role allows an action, it is permitted. The effective scope is the broadest
 * scope granted for that action across roles.
 */

export type PermissionAction = "view" | "create" | "update" | "delete" | "approve" | "export";

export type AccessScope = "ALL" | "BRANCH" | "DEPARTMENT" | "TEAM" | "OWN";

/** Higher number = broader access. */
const SCOPE_RANK: Record<AccessScope, number> = {
  OWN: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  BRANCH: 4,
  ALL: 5,
};

export interface Permission {
  module: string;
  resource: string;
  action: PermissionAction;
  scope: AccessScope;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface PermissionUser {
  id: string;
  roles: Role[];
  assignedBranchIds?: string[];
  assignedDeptIds?: string[];
  assignedTeamIds?: string[];
}

export interface CheckPermissionParams {
  module: string;
  resource: string;
  action: PermissionAction;
  recordOwnerId?: string;
  recordBranchId?: string;
  recordDeptId?: string;
  recordTeamId?: string;
}

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const matches = (permission: Permission, params: CheckPermissionParams) =>
  (permission.module === "*" || eq(permission.module, params.module)) &&
  (permission.resource === "*" || eq(permission.resource, params.resource)) &&
  permission.action === params.action;

/**
 * Broadest scope granted for the requested module/resource/action across every role,
 * or null when no role grants the action at all.
 */
export function effectiveScope(
  user: PermissionUser | null | undefined,
  params: CheckPermissionParams,
): AccessScope | null {
  if (!user) return null;
  let best: AccessScope | null = null;
  for (const role of user.roles ?? []) {
    for (const permission of role.permissions ?? []) {
      if (!matches(permission, params)) continue;
      if (!best || SCOPE_RANK[permission.scope] > SCOPE_RANK[best]) best = permission.scope;
    }
  }
  return best;
}

/** Validates a record's context against a granted scope. */
export function scopeAllowsRecord(
  scope: AccessScope,
  user: PermissionUser,
  params: CheckPermissionParams,
): boolean {
  switch (scope) {
    case "ALL":
      return true;
    case "BRANCH":
      return Boolean(params.recordBranchId) && (user.assignedBranchIds ?? []).includes(params.recordBranchId!);
    case "DEPARTMENT":
      return Boolean(params.recordDeptId) && (user.assignedDeptIds ?? []).includes(params.recordDeptId!);
    case "TEAM":
      return Boolean(params.recordTeamId) && (user.assignedTeamIds ?? []).includes(params.recordTeamId!);
    case "OWN":
      return Boolean(params.recordOwnerId) && user.id === params.recordOwnerId;
    default:
      return false;
  }
}

/**
 * True when any assigned role permits the action, and the record context (when supplied)
 * satisfies the broadest granted scope.
 */
export function checkPermission(
  user: PermissionUser | null | undefined,
  params: CheckPermissionParams,
): boolean {
  const scope = effectiveScope(user, params);
  if (!scope || !user) return false;

  const hasRecordContext =
    params.recordOwnerId !== undefined ||
    params.recordBranchId !== undefined ||
    params.recordDeptId !== undefined ||
    params.recordTeamId !== undefined;

  // No record supplied => this is a capability check (e.g. "can this user create?").
  if (!hasRecordContext) return true;

  return scopeAllowsRecord(scope, user, params);
}

/** Convenience filter: keeps only records the user may act on. */
export function filterByPermission<T>(
  user: PermissionUser | null | undefined,
  rows: T[],
  params: Omit<CheckPermissionParams, "recordOwnerId" | "recordBranchId" | "recordDeptId" | "recordTeamId">,
  context: (row: T) => Pick<CheckPermissionParams, "recordOwnerId" | "recordBranchId" | "recordDeptId" | "recordTeamId">,
): T[] {
  return rows.filter((row) => checkPermission(user, { ...params, ...context(row) }));
}
