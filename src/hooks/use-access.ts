/**
 * Single authorization hook for the application.
 *
 * It resolves the signed-in user's effective permissions through the one
 * access-control engine in `@/lib/access-control` (role permissions + user
 * grants - user revocations). Use `can("sales.create")` to gate capabilities.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computeEffectivePermissions,
  fetchPermissionCatalog,
  fetchRoles,
  fetchUserOverrides,
  fetchUserRoles,
  type EffectivePermission,
} from "@/lib/access-control";

export function useAccess() {
  const { data, isLoading } = useQuery({
    queryKey: ["effective-access"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return { userId: null, permissions: [] as EffectivePermission[] };
      const [catalog, roles, assignment, overrides] = await Promise.all([
        fetchPermissionCatalog(),
        fetchRoles(),
        fetchUserRoles(userId),
        fetchUserOverrides(userId),
      ]);
      return {
        userId,
        permissions: computeEffectivePermissions({ catalog, roles, assignment, overrides }),
      };
    },
    staleTime: 60_000,
  });

  const allowed = new Set(
    (data?.permissions ?? []).filter((row) => row.allowed).map((row) => row.permission_key),
  );

  return {
    isLoading,
    userId: data?.userId ?? null,
    permissions: data?.permissions ?? [],
    can: (permissionKey: string) => allowed.has(permissionKey),
  };
}
