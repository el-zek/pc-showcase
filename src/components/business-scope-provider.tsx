/**
 * Business scope provider.
 *
 * Loads the business characteristics from the EXISTING sources of truth
 * (`profiles`, the compliance business profile, and the `business_settings`
 * key/value store), resolves the scope through the single capability engine in
 * `@/lib/business-scope`, and exposes it to navigation, pages and route guards.
 *
 * It never changes authentication, subscriptions, RLS or module logic — it only
 * answers "is this module/feature part of this business's scope?".
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_CHARACTERISTICS, MODULE_REGISTRY, PLANS, findRouteScope, resolveScope,
  type AccessVerdict, type BusinessCharacteristics, type BusinessScope, type Capability,
  type PlanKey,
} from "@/lib/business-scope";
import { clearPendingScope, readPendingScope } from "@/lib/onboarding-scope";

/** business_settings keys owned by this layer. */
const CHARACTERISTICS_KEY = "business.characteristics";
const PLAN_KEY = "business.plan";
/** Existing compliance business profile store (localStorage today). */
const COMPLIANCE_KEY = "bizz.compliance.v1";
/** Development-only preset overlay. */
const PRESET_KEY = "bizz.scope.preset";

const client = supabase as any;

type ScopeContextValue = {
  loading: boolean;
  scope: BusinessScope;
  /** Capability check — the single question the application should ask. */
  can: (capability: Capability) => boolean;
  verdictFor: (capability: Capability) => AccessVerdict;
  moduleAllowed: (moduleKey: string) => boolean;
  featureAllowed: (featureKey: string) => boolean;
  routeVerdict: (pathname: string) => ReturnType<typeof findRouteScope>;
  /** Persists explicit operational characteristics into business_settings. */
  saveCharacteristics: (patch: Partial<BusinessCharacteristics>) => Promise<void>;
  savePlan: (plan: PlanKey) => Promise<void>;
  /** Dev-only preset overlay (isolated from production data). */
  presetKey: string | null;
  applyPreset: (key: string | null, value?: Partial<BusinessCharacteristics>, plan?: PlanKey) => void;
  refresh: () => Promise<void>;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);

const parse = <T,>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** Reads the compliance business profile without duplicating its storage. */
function readComplianceProfile(): Partial<BusinessCharacteristics> {
  if (typeof window === "undefined") return {};
  const stored = parse<any>(window.localStorage.getItem(COMPLIANCE_KEY), null);
  const profile = stored?.profile;
  if (!profile) return {};
  return {
    name: String(profile.name ?? ""),
    businessType: String(profile.businessType ?? ""),
    legalForm: String(profile.legalForm ?? ""),
    sector: String(profile.sector ?? ""),
    employeeCount:
      profile.employeeCount === null || profile.employeeCount === undefined
        ? null
        : Number(profile.employeeCount),
    taxRegistrations: Array.isArray(profile.taxRegistrations) ? profile.taxRegistrations : [],
    doesImport: Boolean(profile.doesImport),
    doesExport: Boolean(profile.doesExport),
  };
}

const hasProfileSignal = (value: Partial<BusinessCharacteristics>) =>
  Boolean(
    value.businessType ||
      value.legalForm ||
      value.sector ||
      (value.taxRegistrations?.length ?? 0) > 0 ||
      value.employeeCount !== null,
  );

export function BusinessScopeProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [characteristics, setCharacteristics] =
    useState<BusinessCharacteristics>(EMPTY_CHARACTERISTICS);
  const [plan, setPlan] = useState<PlanKey>("full");
  const [presetKey, setPresetKey] = useState<string | null>(
    typeof window === "undefined" ? null : window.localStorage.getItem(PRESET_KEY),
  );

  const load = useCallback(async () => {
    // 1. Business identity (existing profiles table).
    let name = "";
    try {
      const { data } = await client
        .from("profiles")
        .select("business_name, full_name")
        .limit(1)
        .maybeSingle();
      name = String(data?.business_name ?? data?.full_name ?? "");
    } catch {
      name = "";
    }

    // 2. Explicit characteristics + plan (existing business_settings store).
    let stored: Partial<BusinessCharacteristics> = {};
    let storedPlan: PlanKey = "full";
    let configured = false;
    let hasStoredPlan = false;
    try {
      const { data } = await client
        .from("business_settings")
        .select("setting_key,setting_value")
        .in("setting_key", [CHARACTERISTICS_KEY, PLAN_KEY]);
      for (const row of data ?? []) {
        if (row.setting_key === CHARACTERISTICS_KEY) {
          stored = parse<Partial<BusinessCharacteristics>>(row.setting_value, {});
          configured = Object.keys(stored).length > 0;
        }
        if (row.setting_key === PLAN_KEY) {
          const value = String(row.setting_value ?? "").trim() as PlanKey;
          if (PLANS[value]) {
            storedPlan = value;
            hasStoredPlan = true;
          }
        }
      }
    } catch {
      stored = {};
    }

    // 3. Derived characteristics from the existing compliance business profile.
    const derived = readComplianceProfile();

    const merged: BusinessCharacteristics = {
      ...EMPTY_CHARACTERISTICS,
      ...derived,
      ...stored,
      name: stored.name || derived.name || name,
      // Legacy safety: a business with no configuration at all keeps everything.
      unconfigured: !(configured || hasProfileSignal(derived)),
    };

    // A confirmed signup may not have had a session when it saved its scope.
    // Consume it on the first authenticated load without replacing configured data.
    const pending = !configured ? readPendingScope() : null;
    if (pending) {
      try {
        const { error: characteristicsError } = await client.from("business_settings").upsert(
          {
            setting_key: CHARACTERISTICS_KEY,
            setting_value: JSON.stringify(pending.characteristics),
            description: "Business characteristics used by the capability/scope engine",
          },
          { onConflict: "user_id,setting_key" },
        );
        if (characteristicsError) throw new Error(characteristicsError.message);

        if (!hasStoredPlan && PLANS[pending.plan]) {
          const { error: planError } = await client.from("business_settings").upsert(
            {
              setting_key: PLAN_KEY,
              setting_value: pending.plan,
              description: "Subscription plan (entitlement layer)",
            },
            { onConflict: "user_id,setting_key" },
          );
          if (planError) throw new Error(planError.message);
        }

        merged.name = pending.characteristics.name || merged.name;
        Object.assign(merged, pending.characteristics, { unconfigured: false });
        if (!hasStoredPlan && PLANS[pending.plan]) storedPlan = pending.plan;
        setCharacteristics(merged);
        setPlan(storedPlan);
        clearPendingScope();
        setLoading(false);
        return;
      } catch {
        // Keep the pending value for a later authenticated retry.
      }
    }

    setCharacteristics(merged);
    setPlan(storedPlan);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Dev preset overlay, applied on top of the loaded configuration. */
  const preset = useMemo(() => {
    if (!presetKey || typeof window === "undefined") return null;
    return parse<{ characteristics: Partial<BusinessCharacteristics>; plan: PlanKey } | null>(
      window.localStorage.getItem(`${PRESET_KEY}.value`),
      null,
    );
  }, [presetKey]);

  const effective = useMemo<BusinessCharacteristics>(
    () =>
      preset
        ? {
            ...characteristics,
            ...preset.characteristics,
            flags: { ...(preset.characteristics.flags ?? {}) },
          }
        : characteristics,
    [characteristics, preset],
  );

  const effectivePlan = preset?.plan ?? plan;

  const scope = useMemo(() => resolveScope(effective, effectivePlan), [effective, effectivePlan]);

  const saveCharacteristics = useCallback(
    async (patch: Partial<BusinessCharacteristics>) => {
      const next: BusinessCharacteristics = {
        ...characteristics,
        ...patch,
        unconfigured: false,
      };
      setCharacteristics(next);
      const { error } = await client.from("business_settings").upsert(
        {
          setting_key: CHARACTERISTICS_KEY,
          setting_value: JSON.stringify(next),
          description: "Business characteristics used by the capability/scope engine",
        },
        { onConflict: "user_id,setting_key" },
      );
      if (error) throw new Error(error.message);
    },
    [characteristics],
  );

  const savePlan = useCallback(async (next: PlanKey) => {
    setPlan(next);
    const { error } = await client.from("business_settings").upsert(
      {
        setting_key: PLAN_KEY,
        setting_value: next,
        description: "Subscription plan (entitlement layer)",
      },
      { onConflict: "user_id,setting_key" },
    );
    if (error) throw new Error(error.message);
  }, []);

  const applyPreset = useCallback(
    (key: string | null, value?: Partial<BusinessCharacteristics>, presetPlan?: PlanKey) => {
      if (typeof window === "undefined") return;
      if (!key) {
        window.localStorage.removeItem(PRESET_KEY);
        window.localStorage.removeItem(`${PRESET_KEY}.value`);
        setPresetKey(null);
        return;
      }
      window.localStorage.setItem(PRESET_KEY, key);
      window.localStorage.setItem(
        `${PRESET_KEY}.value`,
        JSON.stringify({ characteristics: value ?? {}, plan: presetPlan ?? "full" }),
      );
      setPresetKey(key);
    },
    [],
  );

  const value = useMemo<ScopeContextValue>(
    () => ({
      loading,
      scope,
      can: (capability) => scope.capabilities[capability]?.allowed ?? true,
      verdictFor: (capability) =>
        scope.capabilities[capability] ?? {
          allowed: true, eligible: true, entitled: true, reason: "Unknown capability",
        },
      moduleAllowed: (moduleKey) => scope.modules[moduleKey]?.allowed ?? true,
      featureAllowed: (featureKey) => scope.features[featureKey]?.allowed ?? true,
      routeVerdict: (pathname) => findRouteScope(scope, pathname),
      saveCharacteristics,
      savePlan,
      presetKey,
      applyPreset,
      refresh: load,
    }),
    [loading, scope, saveCharacteristics, savePlan, presetKey, applyPreset, load],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useBusinessScope() {
  const context = useContext(ScopeContext);
  if (!context) {
    // Outside the provider (e.g. public routes) nothing is scoped out.
    const fallback = resolveScope(EMPTY_CHARACTERISTICS, "full");
    return {
      loading: false,
      scope: fallback,
      can: () => true,
      verdictFor: () => ({ allowed: true, eligible: true, entitled: true, reason: "Unscoped" }),
      moduleAllowed: () => true,
      featureAllowed: () => true,
      routeVerdict: (pathname: string) => findRouteScope(fallback, pathname),
      saveCharacteristics: async () => {},
      savePlan: async () => {},
      presetKey: null,
      applyPreset: () => {},
      refresh: async () => {},
    } satisfies ScopeContextValue;
  }
  return context;
}

/** Convenience hook for a single capability. */
export function useCapability(capability: Capability) {
  return useBusinessScope().verdictFor(capability);
}

/** Modules currently in this business's scope, in registry order. */
export function useScopedModules() {
  const { scope } = useBusinessScope();
  return MODULE_REGISTRY.filter((module) => scope.modules[module.key]?.allowed !== false);
}
