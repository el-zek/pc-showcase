import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTaxModule, daysUntil, type TaxObligation } from "@/components/tax-module-provider";

/* ==========================================================================
 * Compliance Management
 * --------------------------------------------------------------------------
 * Business Profile -> Applicable Requirements -> Compliance Obligations
 *   -> Filing / Renewal / Payment / Evidence -> Deadline / Expiry
 *   -> Current Status -> Required Action
 *
 * Tax is ONE category of obligation. Tax records themselves stay in
 * TaxModuleProvider (unchanged); this layer reads them read-only.
 *
 * Persistence: the compliance tables are prepared as a migration but the
 * database is not deployed yet, so records are kept locally and the reader
 * transparently upgrades to the tables once they exist.
 * ========================================================================== */

export type ObligationCategory =
  | "Tax" | "Licence" | "Permit" | "Filing" | "Payment" | "Registration" | "Other";

export type RuleBasis = "profile" | "conditional" | "transaction";

export type Frequency =
  | "Monthly" | "Quarterly" | "Annual" | "Periodic" | "One-time" | "Event-based" | "Non-renewable";

export type Applicability = "applicable" | "requires_review" | "not_applicable";

export type RegistrationState = "registered" | "not_registered" | "not_required";

export type ComplianceStatus =
  | "Compliant" | "Due Soon" | "Overdue" | "Pending" | "Expired" | "Not Applicable" | "Requires Review";

export type ConditionOperator =
  | "equals" | "not_equals" | "includes" | "gte" | "lte" | "is_true" | "is_false" | "present";

export type ProfileField =
  | "businessType" | "legalForm" | "sector" | "activities" | "region" | "sizeCategory"
  | "annualTurnover" | "employeeCount" | "doesImport" | "doesExport" | "taxRegistrations";

export type RuleCondition = {
  field: ProfileField;
  operator: ConditionOperator;
  value?: string | number | boolean;
};

export type ComplianceRule = {
  id: string;
  name: string;
  category: ObligationCategory;
  authority: string;
  description: string;
  basis: RuleBasis;
  conditions: RuleCondition[];
  frequency: Frequency;
  requiresFiling: boolean;
  requiresPayment: boolean;
  requiresRenewal: boolean;
  requiresEvidence: boolean;
  /** Official due/renewal rule. `null` means it still needs official configuration. */
  dueRule: { type: "day_of_month" | "day_of_year" | "months_after_issue"; value: number } | null;
  /** True only when the official requirement has been verified and configured. */
  configured: boolean;
  notes: string;
  active: boolean;
};

export type ComplianceObligation = {
  id: string;
  ruleId: string | null;
  name: string;
  category: ObligationCategory;
  authority: string;
  description: string;
  applicability: Applicability;
  applicabilityReason: string;
  registrationState: RegistrationState;
  frequency: Frequency | "";
  period: string;
  dueDate: string;
  expiryDate: string;
  filingRequired: boolean;
  filingStatus: "not_required" | "outstanding" | "filed";
  paymentRequired: boolean;
  amountDue: number | null;
  paymentStatus: "not_required" | "unpaid" | "partial" | "paid";
  evidenceRequired: boolean;
  documentId: string;
  reminderOn: boolean;
  notes: string;
  /** Read-only obligations are derived from the tax module. */
  source: "compliance" | "tax";
  sourceRoute: string;
  sourceLabel: string;
};

export type ComplianceLicence = {
  id: string;
  name: string;
  licenceType: "Licence" | "Permit" | "Registration" | "Certificate";
  authority: string;
  reference: string;
  issueDate: string;
  expiryDate: string;
  renewalRequired: boolean;
  renewalFrequency: Frequency;
  feeAmount: number | null;
  paymentStatus: "not_required" | "unpaid" | "partial" | "paid";
  status: "Active" | "Pending" | "Expired" | "Suspended";
  documentId: string;
  /** Optional photo / scan of the licence, stored as a data URL. */
  imageUrl: string;
  notes: string;
};

export type BusinessProfile = {
  name: string;
  businessType: string;
  legalForm: string;
  sector: string;
  activities: string[];
  region: string;
  sizeCategory: string;
  annualTurnover: number | null;
  employeeCount: number | null;
  doesImport: boolean;
  doesExport: boolean;
  taxRegistrations: string[];
};

/* ------------------------------ option lists ------------------------------ */

export const BUSINESS_TYPES = ["Retail", "Wholesale", "Pharmacy", "Restaurant", "Manufacturing", "Services", "Transport", "Construction", "Agriculture", "Other"];
export const LEGAL_FORMS = ["Sole Proprietor", "Partnership", "Limited Company", "NGO / Association", "Cooperative", "Other"];
export const SECTORS = ["General Trade", "Health & Pharmaceuticals", "Food & Beverage", "Manufacturing", "Professional Services", "Transport & Logistics", "Construction", "Agriculture", "Financial Services", "Other"];
export const SIZE_CATEGORIES = ["Micro", "Small", "Medium", "Large", "Not set"];
export const TAX_REGISTRATIONS = ["TIN", "VAT", "PAYE", "Withholding Tax", "Excise", "Customs (TIN/EFD)"];
export const FREQUENCIES: Frequency[] = ["Monthly", "Quarterly", "Annual", "Periodic", "One-time", "Event-based", "Non-renewable"];
export const CATEGORIES: ObligationCategory[] = ["Tax", "Licence", "Permit", "Filing", "Payment", "Registration", "Other"];

/* ------------------------------ rule catalogue ---------------------------- */
/**
 * Starter catalogue. Deliberately contains NO rates, thresholds, fees or
 * statutory filing dates — every entry starts `configured: false` so the UI
 * flags it as "requires official rule configuration" until a verified rule
 * is entered by the business/administrator.
 */
const DEFAULT_RULES: ComplianceRule[] = [
  {
    id: "rule-tin",
    name: "Taxpayer registration (TIN)",
    category: "Registration",
    authority: "Revenue authority",
    description: "Every business must hold a valid taxpayer identification registration.",
    basis: "profile",
    conditions: [],
    frequency: "One-time",
    requiresFiling: false, requiresPayment: false, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Evidence: registration certificate.",
    active: true,
  },
  {
    id: "rule-vat",
    name: "VAT registration and periodic VAT return",
    category: "Tax",
    authority: "Revenue authority",
    description: "Applies where the business meets the VAT registration conditions, or is already VAT registered.",
    basis: "conditional",
    conditions: [{ field: "taxRegistrations", operator: "includes", value: "VAT" }],
    frequency: "Monthly",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Registration threshold and filing deadline must be configured from the official rule.",
    active: true,
  },
  {
    id: "rule-income-tax",
    name: "Annual income tax return",
    category: "Tax",
    authority: "Revenue authority",
    description: "Annual return of income for the business.",
    basis: "profile",
    conditions: [],
    frequency: "Annual",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Rate, instalments and filing date require official configuration.",
    active: true,
  },
  {
    id: "rule-paye",
    name: "Employer payroll tax obligations (PAYE)",
    category: "Tax",
    authority: "Revenue authority",
    description: "Becomes relevant once the business employs staff.",
    basis: "conditional",
    conditions: [{ field: "employeeCount", operator: "gte", value: 1 }],
    frequency: "Monthly",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Applicability follows the employee count on the business profile.",
    active: true,
  },
  {
    id: "rule-wht",
    name: "Withholding tax on qualifying payments",
    category: "Tax",
    authority: "Revenue authority",
    description: "Transaction-triggered: arises when the business makes a payment of a withholding type.",
    basis: "transaction",
    conditions: [{ field: "taxRegistrations", operator: "includes", value: "Withholding Tax" }],
    frequency: "Event-based",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Triggered per qualifying transaction, not a permanent flag.",
    active: true,
  },
  {
    id: "rule-business-licence",
    name: "Business licence",
    category: "Licence",
    authority: "Local government authority",
    description: "Trading licence for the business premises and activity.",
    basis: "profile",
    conditions: [],
    frequency: "Annual",
    requiresFiling: false, requiresPayment: true, requiresRenewal: true, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Fee and renewal cycle depend on activity and location — configure officially.",
    active: true,
  },
  {
    id: "rule-pharmacy-permit",
    name: "Pharmaceutical premises permit",
    category: "Permit",
    authority: "Medicines regulator",
    description: "Sector permit for businesses handling medicines or medical products.",
    basis: "conditional",
    conditions: [{ field: "sector", operator: "equals", value: "Health & Pharmaceuticals" }],
    frequency: "Annual",
    requiresFiling: false, requiresPayment: true, requiresRenewal: true, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Example of a sector-specific requirement: a pharmacy is not treated like an ordinary retail shop.",
    active: true,
  },
  {
    id: "rule-food-permit",
    name: "Food handling / health permit",
    category: "Permit",
    authority: "Public health authority",
    description: "Applies to businesses preparing or selling food and beverages.",
    basis: "conditional",
    conditions: [{ field: "sector", operator: "equals", value: "Food & Beverage" }],
    frequency: "Annual",
    requiresFiling: false, requiresPayment: true, requiresRenewal: true, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "",
    active: true,
  },
  {
    id: "rule-customs",
    name: "Import / export compliance",
    category: "Filing",
    authority: "Customs authority",
    description: "Becomes relevant when the business imports or exports goods.",
    basis: "conditional",
    conditions: [{ field: "doesImport", operator: "is_true" }],
    frequency: "Event-based",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Declaration and duty requirements are transaction driven.",
    active: true,
  },
  {
    id: "rule-social-security",
    name: "Employee social security contributions",
    category: "Payment",
    authority: "Social security fund",
    description: "Contribution obligation that arises once staff are employed.",
    basis: "conditional",
    conditions: [{ field: "employeeCount", operator: "gte", value: 1 }],
    frequency: "Monthly",
    requiresFiling: true, requiresPayment: true, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "Contribution rate requires official configuration.",
    active: true,
  },
  {
    id: "rule-annual-return",
    name: "Company annual return / filing",
    category: "Filing",
    authority: "Business registration authority",
    description: "Applies to incorporated entities.",
    basis: "conditional",
    conditions: [{ field: "legalForm", operator: "equals", value: "Limited Company" }],
    frequency: "Annual",
    requiresFiling: true, requiresPayment: false, requiresRenewal: false, requiresEvidence: true,
    dueRule: null, configured: false,
    notes: "",
    active: true,
  },
];

const EMPTY_PROFILE: BusinessProfile = {
  name: "", businessType: "", legalForm: "", sector: "", activities: [], region: "",
  sizeCategory: "Not set", annualTurnover: null, employeeCount: null,
  doesImport: false, doesExport: false, taxRegistrations: [],
};

/* ----------------------------- local storage ------------------------------ */

const KEY = "bizz.compliance.v1";

type Persisted = {
  profile: BusinessProfile;
  rules: ComplianceRule[];
  instances: Record<string, StoredInstance>;
  licences: ComplianceLicence[];
  extra: ComplianceObligation[];
};

type StoredInstance = {
  period?: string;
  dueDate?: string;
  expiryDate?: string;
  filingStatus?: ComplianceObligation["filingStatus"];
  paymentStatus?: ComplianceObligation["paymentStatus"];
  amountDue?: number | null;
  documentId?: string;
  reminderOn?: boolean;
  notes?: string;
  registrationState?: RegistrationState;
};

function load(): Persisted {
  if (typeof window === "undefined") {
    return { profile: EMPTY_PROFILE, rules: DEFAULT_RULES, instances: {}, licences: [], extra: [] };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const rules = parsed.rules?.length ? parsed.rules : DEFAULT_RULES;
    // keep newly shipped catalogue entries without overwriting user edits
    const merged = [...rules];
    for (const seed of DEFAULT_RULES) if (!merged.some((r) => r.id === seed.id)) merged.push(seed);
    return {
      profile: { ...EMPTY_PROFILE, ...(parsed.profile ?? {}) },
      rules: merged,
      instances: parsed.instances ?? {},
      licences: parsed.licences ?? [],
      extra: parsed.extra ?? [],
    };
  } catch {
    return { profile: EMPTY_PROFILE, rules: DEFAULT_RULES, instances: {}, licences: [], extra: [] };
  }
}

function save(state: Persisted) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota */ }
}

/* -------------------------- applicability engine -------------------------- */

const FIELD_LABELS: Record<ProfileField, string> = {
  businessType: "business type", legalForm: "legal form", sector: "sector",
  activities: "business activities", region: "location", sizeCategory: "business size",
  annualTurnover: "turnover", employeeCount: "number of employees",
  doesImport: "import activity", doesExport: "export activity",
  taxRegistrations: "existing tax registrations",
};

function fieldValue(profile: BusinessProfile, field: ProfileField): unknown {
  return (profile as unknown as Record<string, unknown>)[field];
}

/**
 * A field counts as "missing" only when the business never answered it.
 * An empty list (e.g. no tax registrations selected at sign up) IS an answer,
 * so the rule resolves to not applicable instead of asking again.
 */
function isMissing(value: unknown) {
  if (Array.isArray(value)) return false;
  if (value === null || value === undefined || value === "") return true;
  if (value === "Not set") return true;
  return false;
}

type Evaluated = { state: Applicability; reason: string };

export function evaluateRule(rule: ComplianceRule, profile: BusinessProfile): Evaluated {
  if (!rule.active) return { state: "not_applicable", reason: "Rule is switched off in the catalogue." };

  const unknowns: string[] = [];
  for (const condition of rule.conditions) {
    const value = fieldValue(profile, condition.field);
    const label = FIELD_LABELS[condition.field];

    if (condition.operator === "is_true") {
      if (value !== true) return { state: "not_applicable", reason: `Business profile does not record ${label}.` };
      continue;
    }
    if (condition.operator === "is_false") {
      if (value === true) return { state: "not_applicable", reason: `Business profile records ${label}.` };
      continue;
    }
    if (isMissing(value)) { unknowns.push(label); continue; }

    let pass = false;
    switch (condition.operator) {
      case "equals": pass = String(value) === String(condition.value); break;
      case "not_equals": pass = String(value) !== String(condition.value); break;
      case "includes": pass = Array.isArray(value) && value.map(String).includes(String(condition.value)); break;
      case "gte": pass = Number(value) >= Number(condition.value); break;
      case "lte": pass = Number(value) <= Number(condition.value); break;
      case "present": pass = true; break;
    }
    if (!pass) return { state: "not_applicable", reason: `Does not meet the condition on ${label}.` };
  }

  if (unknowns.length > 0) {
    return {
      state: "requires_review",
      reason: `Business profile is missing ${unknowns.join(", ")} — confirm before treating this as applicable.`,
    };
  }
  if (rule.basis === "transaction") {
    return {
      state: "requires_review",
      reason: "Transaction-triggered: becomes relevant only when a qualifying transaction occurs.",
    };
  }
  if (!rule.configured) {
    return {
      state: "requires_review",
      reason: "Official rule (threshold, deadline or fee) has not been configured yet.",
    };
  }
  return { state: "applicable", reason: "Conditions met from the business profile." };
}

/* ---------------------------- status derivation --------------------------- */

let DUE_SOON_DAYS = 30;

/** Keeps the compliance "due soon" window in sync with the tax module setting. */
export function setComplianceDueSoonWindow(days: number) {
  if (Number.isFinite(days) && days > 0) DUE_SOON_DAYS = Math.round(days);
}

export function deriveStatus(o: ComplianceObligation): ComplianceStatus {
  if (o.applicability === "not_applicable") return "Not Applicable";
  if (o.applicability === "requires_review") return "Requires Review";

  if (o.expiryDate && daysUntil(o.expiryDate) < 0) return "Expired";

  const filingOutstanding = o.filingRequired && o.filingStatus !== "filed";
  const paymentOutstanding = o.paymentRequired && o.paymentStatus !== "paid";
  const evidenceOutstanding = o.evidenceRequired && !o.documentId;
  const outstanding = filingOutstanding || paymentOutstanding || evidenceOutstanding;

  if (!outstanding) return "Compliant";

  const deadline = o.dueDate || o.expiryDate;
  if (!deadline) return "Pending";
  const left = daysUntil(deadline);
  if (left < 0) return "Overdue";
  if (left <= DUE_SOON_DAYS) return "Due Soon";
  return "Pending";
}

export function nextAction(o: ComplianceObligation): string {
  const status = deriveStatus(o);
  if (status === "Not Applicable") return "No action required";
  if (status === "Requires Review") return "Review applicability / configure official rule";
  if (status === "Expired") return "Renew — validity has expired";
  if (o.filingRequired && o.filingStatus !== "filed") return "Submit the required filing";
  if (o.paymentRequired && o.paymentStatus !== "paid") return "Settle the amount due";
  if (o.evidenceRequired && !o.documentId) return "Attach supporting document";
  return "Up to date";
}

/* ------------------------------ tax bridging ------------------------------ */

function fromTaxObligation(row: TaxObligation): ComplianceObligation {
  const paid = row.status === "Paid";
  return {
    id: `tax:${row.id}`,
    ruleId: null,
    name: `${row.taxType} — ${row.reference}`,
    category: "Tax",
    authority: "Revenue authority",
    description: "Generated from your tax records in Tax Management.",
    applicability: "applicable",
    applicabilityReason: "Derived from a recorded tax transaction.",
    registrationState: "registered",
    frequency: "Periodic",
    period: row.period,
    dueDate: row.dueDate,
    expiryDate: "",
    filingRequired: true,
    filingStatus: /filed|paid/i.test(row.filingStatus) || paid ? "filed" : "outstanding",
    paymentRequired: row.amount > 0,
    amountDue: row.amount,
    paymentStatus: paid ? "paid" : "unpaid",
    evidenceRequired: false,
    documentId: "",
    reminderOn: row.reminderOn,
    notes: "",
    source: "tax",
    sourceRoute: row.sourceRoute,
    sourceLabel: row.sourceLabel,
  };
}

/* -------------------------------- context -------------------------------- */

export type ComplianceContextValue = {
  profile: BusinessProfile;
  saveProfile: (patch: Partial<BusinessProfile>) => void;
  rules: ComplianceRule[];
  saveRule: (rule: ComplianceRule) => void;
  deleteRule: (id: string) => void;
  /** rule id -> applicability evaluation */
  applicability: Record<string, Evaluated>;
  /** rule-derived + manual obligations + read-only tax obligations */
  obligations: ComplianceObligation[];
  ruleObligations: ComplianceObligation[];
  taxObligations: ComplianceObligation[];
  updateObligation: (id: string, patch: StoredInstance) => void;
  addObligation: (row: Omit<ComplianceObligation, "id" | "source" | "sourceRoute" | "sourceLabel">) => void;
  deleteObligation: (id: string) => void;
  licences: ComplianceLicence[];
  saveLicence: (row: Omit<ComplianceLicence, "id">, id?: string) => void;
  deleteLicence: (id: string) => void;
  metrics: {
    total: number; applicable: number; compliant: number; dueSoon: number; overdue: number;
    pending: number; expired: number; review: number; notApplicable: number;
    outstandingFilings: number; outstandingPayments: number; amountOutstanding: number;
    expiringLicences: number; unconfiguredRules: number; profileCompleteness: number;
  };
  statusOf: (o: ComplianceObligation) => ComplianceStatus;
};

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => load());
  const tax = useTaxModule();

  useEffect(() => { save(state); }, [state]);

  useEffect(() => { setComplianceDueSoonWindow(tax.dueSoonDays); }, [tax.dueSoonDays]);

  // The business profile IS the registration record: it is read from and
  // written back to the signed-in user's `profiles` row. Local storage only
  // acts as an offline cache of that row.
  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!data) return;
      const row = data as unknown as Record<string, unknown>;
      const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
      setState((current) => ({
        ...current,
        profile: {
          name: String(row["business_name"] ?? row["full_name"] ?? ""),
          businessType: String(row["business_type"] ?? ""),
          legalForm: String(row["legal_form"] ?? ""),
          sector: String(row["sector"] ?? ""),
          region: String(row["region"] ?? ""),
          sizeCategory: String(row["size_category"] ?? "Not set") || "Not set",
          activities: list(row["activities"]),
          taxRegistrations: list(row["tax_registrations"]),
          annualTurnover: row["annual_turnover"] === null || row["annual_turnover"] === undefined
            ? null
            : Number(row["annual_turnover"]),
          employeeCount: row["employee_count"] === null || row["employee_count"] === undefined
            ? null
            : Number(row["employee_count"]),
          doesImport: Boolean(row["does_import"]),
          doesExport: Boolean(row["does_export"]),
        },
      }));
    })();
  }, []);

  const saveProfile = useCallback((patch: Partial<BusinessProfile>) => {
    setState((current) => {
      const next = { ...current.profile, ...patch };
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        await supabase
          .from("profiles")
          .update({
            business_name: next.name,
            business_type: next.businessType,
            legal_form: next.legalForm,
            sector: next.sector,
            region: next.region,
            size_category: next.sizeCategory,
            activities: next.activities,
            tax_registrations: next.taxRegistrations,
            annual_turnover: next.annualTurnover,
            employee_count: next.employeeCount,
            does_import: next.doesImport,
            does_export: next.doesExport,
          })
          .eq("id", userId);
      })();
      return { ...current, profile: next };
    });
  }, []);

  const saveRule = useCallback((rule: ComplianceRule) => {
    setState((current) => ({
      ...current,
      rules: current.rules.some((r) => r.id === rule.id)
        ? current.rules.map((r) => (r.id === rule.id ? rule : r))
        : [...current.rules, rule],
    }));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setState((current) => ({ ...current, rules: current.rules.filter((r) => r.id !== id) }));
  }, []);

  const updateObligation = useCallback((id: string, patch: StoredInstance) => {
    setState((current) => {
      if (id.startsWith("manual:")) {
        return {
          ...current,
          extra: current.extra.map((row) => (row.id === id ? { ...row, ...patch } as ComplianceObligation : row)),
        };
      }
      return { ...current, instances: { ...current.instances, [id]: { ...current.instances[id], ...patch } } };
    });
  }, []);

  const addObligation = useCallback<ComplianceContextValue["addObligation"]>((row) => {
    setState((current) => ({
      ...current,
      extra: [
        ...current.extra,
        { ...row, id: `manual:${crypto.randomUUID()}`, source: "compliance", sourceRoute: "/m/compliance/obligations", sourceLabel: "Compliance obligation" },
      ],
    }));
  }, []);

  const deleteObligation = useCallback((id: string) => {
    setState((current) => ({ ...current, extra: current.extra.filter((row) => row.id !== id) }));
  }, []);

  const saveLicence = useCallback((row: Omit<ComplianceLicence, "id">, id?: string) => {
    setState((current) => ({
      ...current,
      licences: id
        ? current.licences.map((item) => (item.id === id ? { ...row, id } : item))
        : [...current.licences, { ...row, id: crypto.randomUUID() }],
    }));
  }, []);

  const deleteLicence = useCallback((id: string) => {
    setState((current) => ({ ...current, licences: current.licences.filter((item) => item.id !== id) }));
  }, []);

  const applicability = useMemo(() => {
    const map: Record<string, Evaluated> = {};
    for (const rule of state.rules) map[rule.id] = evaluateRule(rule, state.profile);
    return map;
  }, [state.rules, state.profile]);

  const ruleObligations = useMemo<ComplianceObligation[]>(() => {
    return state.rules.map((rule) => {
      const evaluated = applicability[rule.id];
      const instance = state.instances[rule.id] ?? {};
      const licence = state.licences.find((item) => item.name === rule.name);
      return {
        id: rule.id,
        ruleId: rule.id,
        name: rule.name,
        category: rule.category,
        authority: rule.authority,
        description: rule.description,
        applicability: evaluated.state,
        applicabilityReason: evaluated.reason,
        registrationState:
          instance.registrationState ??
          (state.profile.taxRegistrations.some((reg) => rule.name.toLowerCase().includes(reg.toLowerCase()))
            ? "registered"
            : rule.category === "Tax" || rule.category === "Registration"
              ? "not_registered"
              : "not_required"),
        frequency: rule.frequency,
        period: instance.period ?? "",
        dueDate: instance.dueDate ?? "",
        expiryDate: instance.expiryDate ?? licence?.expiryDate ?? "",
        filingRequired: rule.requiresFiling,
        filingStatus: instance.filingStatus ?? (rule.requiresFiling ? "outstanding" : "not_required"),
        paymentRequired: rule.requiresPayment,
        amountDue: instance.amountDue ?? null,
        paymentStatus: instance.paymentStatus ?? (rule.requiresPayment ? "unpaid" : "not_required"),
        evidenceRequired: rule.requiresEvidence,
        documentId: instance.documentId ?? licence?.documentId ?? "",
        reminderOn: instance.reminderOn ?? true,
        notes: instance.notes ?? rule.notes,
        source: "compliance",
        sourceRoute: rule.category === "Tax" ? "/m/tax" : "/m/compliance/obligations",
        sourceLabel: rule.category === "Tax" ? "Tax Management" : "Compliance obligations",
      };
    });
  }, [state.rules, state.instances, state.licences, state.profile.taxRegistrations, applicability]);

  const taxObligations = useMemo(() => tax.obligations.map(fromTaxObligation), [tax.obligations]);

  const obligations = useMemo(
    () => [...ruleObligations, ...state.extra, ...taxObligations],
    [ruleObligations, state.extra, taxObligations],
  );

  const metrics = useMemo(() => {
    const counted = obligations.map((row) => ({ row, status: deriveStatus(row) }));
    const applicableRows = counted.filter((item) => item.row.applicability === "applicable");
    const outstandingRows = applicableRows.filter((item) => item.status !== "Compliant" && item.status !== "Not Applicable");
    // Completeness is measured against the fields the business actually
    // answers when registering (sign up), not against optional extras.
    const profileFields = [
      state.profile.name,
      state.profile.businessType,
      state.profile.legalForm,
      state.profile.sector,
      state.profile.employeeCount === null ? "" : "x",
    ];
    return {
      total: counted.length,
      applicable: applicableRows.length,
      compliant: counted.filter((i) => i.status === "Compliant").length,
      dueSoon: counted.filter((i) => i.status === "Due Soon").length,
      overdue: counted.filter((i) => i.status === "Overdue").length,
      pending: counted.filter((i) => i.status === "Pending").length,
      expired: counted.filter((i) => i.status === "Expired").length,
      review: counted.filter((i) => i.status === "Requires Review").length,
      notApplicable: counted.filter((i) => i.status === "Not Applicable").length,
      outstandingFilings: outstandingRows.filter((i) => i.row.filingRequired && i.row.filingStatus !== "filed").length,
      outstandingPayments: outstandingRows.filter((i) => i.row.paymentRequired && i.row.paymentStatus !== "paid").length,
      amountOutstanding: outstandingRows
        .filter((i) => i.row.paymentRequired && i.row.paymentStatus !== "paid")
        .reduce((sum, i) => sum + (i.row.amountDue ?? 0), 0),
      expiringLicences: state.licences.filter((item) => {
        if (!item.expiryDate) return false;
        const left = daysUntil(item.expiryDate);
        return left <= DUE_SOON_DAYS;
      }).length,
      unconfiguredRules: state.rules.filter((rule) => !rule.configured).length,
      profileCompleteness: Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100),
    };
  }, [obligations, state.licences, state.rules, state.profile]);

  const value = useMemo<ComplianceContextValue>(() => ({
    profile: state.profile, saveProfile,
    rules: state.rules, saveRule, deleteRule,
    applicability,
    obligations, ruleObligations, taxObligations,
    updateObligation, addObligation, deleteObligation,
    licences: state.licences, saveLicence, deleteLicence,
    metrics, statusOf: deriveStatus,
  }), [
    state.profile, state.rules, state.licences, saveProfile, saveRule, deleteRule, applicability,
    obligations, ruleObligations, taxObligations, updateObligation, addObligation, deleteObligation,
    saveLicence, deleteLicence, metrics,
  ]);

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance() {
  const context = useContext(ComplianceContext);
  if (!context) throw new Error("useCompliance must be used inside ComplianceProvider");
  return context;
}

export const APPLICABILITY_LABEL: Record<Applicability, string> = {
  applicable: "Applicable",
  requires_review: "Requires Review",
  not_applicable: "Not Applicable",
};

export const REGISTRATION_LABEL: Record<RegistrationState, string> = {
  registered: "Registered",
  not_registered: "Not Registered",
  not_required: "Not Required",
};
