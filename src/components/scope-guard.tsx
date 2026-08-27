/**
 * Route-level business scope protection.
 *
 * Hiding a navigation item is not enough: entering a route directly must also be
 * checked. This guard wraps the authenticated outlet, looks the current pathname
 * up in the module/feature registry and blocks routes that are outside the
 * business's scope. Authentication and permission checks are unaffected.
 */

import { useMemo, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useBusinessScope } from "@/components/business-scope-provider";

export function ScopeGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { loading, routeVerdict } = useBusinessScope();
  const match = useMemo(() => routeVerdict(pathname), [routeVerdict, pathname]);

  // Unknown routes and still-loading scope never block the application.
  if (loading || !match.verdict || match.verdict.allowed) return <>{children}</>;

  const label = match.feature?.name ?? match.module?.name ?? "This area";
  const verdict = match.verdict;

  return (
    <div className="mx-auto max-w-xl py-16 text-center text-white">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl">
        <Lock className="h-6 w-6 text-amber-300" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">{label} is not in your business scope</h1>
      <p className="mt-2 text-sm text-white/70">{verdict.reason}</p>
      <p className="mt-1 text-xs text-white/50">
        {verdict.eligible
          ? "Your plan does not include this capability."
          : "This capability does not apply to your business configuration."}{" "}
        Nothing has been removed — update the business profile or plan in
        Administration → Settings to activate it.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/m/admin/settings"
          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
        >
          Business scope settings
        </Link>
        <Link
          to="/dashboard"
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Filters navigation entries (hub cards, lists, tabs) by business scope.
 * Entries without a `to` are always kept.
 */
export function useScopedItems<T extends { to?: string | null }>(items: T[]): T[] {
  const { routeVerdict, loading } = useBusinessScope();
  return useMemo(() => {
    if (loading) return items;
    return items.filter((item) => {
      if (!item.to) return true;
      const match = routeVerdict(item.to);
      return match.verdict ? match.verdict.allowed : true;
    });
  }, [items, routeVerdict, loading]);
}
