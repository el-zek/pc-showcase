/**
 * Business scope configuration (Administration → Settings).
 *
 * This is the business-characteristics surface — NOT roles or permissions.
 * It writes the explicit operational characteristics and the subscription plan
 * into the existing `business_settings` store, and shows the resolved module /
 * feature scope so the owner can see exactly why something applies or not.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Building2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusinessScope } from "@/components/business-scope-provider";
import {
  MODULE_REGISTRY, SCOPE_PRESETS,
} from "@/lib/business-scope";

const CARD =
  "rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl";
const HEADING =
  "flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-white/60";

export function BusinessScopePanel() {
  const {
    scope, presetKey, applyPreset,
  } = useBusinessScope();
  const characteristics = scope.characteristics;

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <h3 className={HEADING}>
          <Building2 className="h-4 w-4" /> Business characteristics
        </h3>
        <p className="mt-1 text-xs text-white/50">
          {characteristics.unconfigured
            ? "No configuration recorded yet — the full platform stays available until you configure it."
            : `${characteristics.name || "This business"} · ${characteristics.legalForm || "Legal form not set"} · ${characteristics.businessType || "Type not set"} · Tax: ${characteristics.taxRegistrations.join(", ") || "none recorded"}`}
        </p>
        <p className="mt-1 text-xs text-white/40">
          Legal form, sector, employees and tax registrations come from the existing business
          profile in Compliance → Business Profile.
        </p>

      </section>

      <section className={CARD}>
        <h3 className={HEADING}>Resolved module &amp; feature scope</h3>
        <ul className="mt-3 space-y-3">
          {MODULE_REGISTRY.map((module) => {
            const verdict = scope.modules[module.key];
            return (
              <li key={module.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{module.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      verdict?.allowed
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {verdict?.allowed ? "In scope" : verdict?.eligible ? "Plan blocked" : "Not applicable"}
                  </span>
                </div>
                {module.features.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {module.features.map((feature) => {
                      const featureVerdict = scope.features[feature.key];
                      return (
                        <span
                          key={feature.key}
                          title={featureVerdict?.reason}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            featureVerdict?.allowed
                              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                              : "border-white/10 bg-white/5 text-white/40 line-through"
                          }`}
                        >
                          {feature.name}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {import.meta.env.DEV ? (
        <section className={`${CARD} border-amber-300/30`}>
          <h3 className={HEADING}>
            <FlaskConical className="h-4 w-4" /> Test businesses (development only)
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Overlays a test business configuration on this browser only, so different scopes can be
            observed without database migrations. Authentication and data access are untouched.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCOPE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant="outline"
                className={`h-8 border-white/20 bg-white/5 text-white hover:bg-white/15 ${
                  presetKey === preset.key ? "border-amber-300/60 bg-amber-400/20" : ""
                }`}
                onClick={() => applyPreset(preset.key, preset.characteristics, preset.plan)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/15"
              onClick={() => applyPreset(null)}
            >
              Use real business configuration
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
