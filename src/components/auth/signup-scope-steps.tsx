/**
 * Business scope questions rendered inside the "Create account" drawer.
 *
 * Pure presentation over the existing capability engine: it collects the same
 * BusinessCharacteristics + plan the Administration → Settings panel edits.
 */

import {
  type BusinessCharacteristics,
} from "@/lib/business-scope";
import {
  BUSINESS_TYPES,
  LEGAL_FORMS,
  SECTORS,
  TAX_REGISTRATIONS,
} from "@/components/compliance/compliance-provider";

export { TAX_REGISTRATIONS };

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-amber-400/60";
const labelCls = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/55";

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-amber-300/60 bg-amber-400/20 text-amber-200"
      : "border-white/15 bg-white/[0.05] text-white/70 hover:bg-white/10"
  }`;

export function BusinessProfileStep({
  value,
  onChange,
}: {
  value: BusinessCharacteristics;
  onChange: (patch: Partial<BusinessCharacteristics>) => void;
}) {
  const toggleReg = (reg: string) => {
    const list = value.taxRegistrations.includes(reg)
      ? value.taxRegistrations.filter((r) => r !== reg)
      : [...value.taxRegistrations, reg];
    onChange({ taxRegistrations: list });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/55">
        This decides which modules your workspace will include. You can change it later in
        Administration → Settings.
      </p>

      <div>
        <span className={labelCls}>Business name</span>
        <input
          className={inputCls}
          placeholder="e.g. Kambona Traders"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Legal form</span>
          <select
            className={inputCls}
            value={value.legalForm}
            onChange={(e) => onChange({ legalForm: e.target.value })}
          >
            <option value="">Select…</option>
            {LEGAL_FORMS.map((item) => (
              <option key={item} value={item} className="bg-neutral-900">
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>Business type</span>
          <select
            className={inputCls}
            value={value.businessType}
            onChange={(e) => onChange({ businessType: e.target.value })}
          >
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((item) => (
              <option key={item} value={item} className="bg-neutral-900">
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>Sector</span>
          <select
            className={inputCls}
            value={value.sector}
            onChange={(e) => onChange({ sector: e.target.value })}
          >
            <option value="">Select…</option>
            {SECTORS.map((item) => (
              <option key={item} value={item} className="bg-neutral-900">
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>Employees</span>
          <input
            className={inputCls}
            type="number"
            min={0}
            placeholder="0"
            value={value.employeeCount ?? ""}
            onChange={(e) =>
              onChange({ employeeCount: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>

      <div>
        <span className={labelCls}>Tax registrations</span>
        <div className="flex flex-wrap gap-2">
          {TAX_REGISTRATIONS.map((reg) => (
            <button
              key={reg}
              type="button"
              className={chip(value.taxRegistrations.includes(reg))}
              onClick={() => toggleReg(reg)}
            >
              {reg}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(value.doesImport)}
          onClick={() => onChange({ doesImport: !value.doesImport })}
        >
          Imports goods
        </button>
        <button
          type="button"
          className={chip(value.doesExport)}
          onClick={() => onChange({ doesExport: !value.doesExport })}
        >
          Exports goods
        </button>
      </div>
    </div>
  );
}

