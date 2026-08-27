/**
 * Signup scope handoff.
 *
 * The business scope answered during "Create account" cannot always be written
 * to `business_settings` immediately (sign-up may not
 * not produce a session). So it is parked locally and flushed by the
 * BusinessScopeProvider the first time the new account loads the app.
 *
 * It uses the SAME shape and the SAME storage keys as the existing capability
 * engine — no second scope system, no schema change.
 */

import { EMPTY_CHARACTERISTICS, type BusinessCharacteristics, type PlanKey } from "@/lib/business-scope";

export const PENDING_SCOPE_KEY = "bizz.scope.pending";

export type PendingScope = {
  phone: string;
  characteristics: BusinessCharacteristics;
  plan: PlanKey;
};

export function savePendingScope(value: PendingScope) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_SCOPE_KEY, JSON.stringify(value));
}

export function readPendingScope(): PendingScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScope;
    if (!parsed?.characteristics) return null;
    return {
      phone: String(parsed.phone ?? ""),
      plan: (parsed.plan ?? "full") as PlanKey,
      characteristics: { ...EMPTY_CHARACTERISTICS, ...parsed.characteristics, unconfigured: false },
    };
  } catch {
    return null;
  }
}

export function clearPendingScope() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_SCOPE_KEY);
}
