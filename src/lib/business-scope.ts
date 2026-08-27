/**
 * Business-aware module & feature scope architecture.
 *
 * AUTH -> USER -> BUSINESS -> BUSINESS PROFILE -> CHARACTERISTICS
 *   -> CAPABILITY ENGINE -> MODULE SCOPE -> FEATURE SCOPE -> UI / ROUTES
 *
 * This layer is NOT a role system (roles live in `@/lib/access-control`) and it
 * is NOT tax specific — tax is only one of the domains that consumes it.
 *
 * Sources of truth (no new tables, no migrations):
 *  - `profiles`                         → the business identity (name)
 *  - compliance business profile        → legal form, sector, type, employees,
 *                                         tax registrations, import/export
 *  - `business_settings` key/value      → explicit operational characteristics
 *                                         (`business.characteristics`) and the
 *                                         subscription plan (`business.plan`)
 *
 * Final access = business eligibility AND subscription entitlement
 *                AND role/permission checks (evaluated separately).
 */

/* ============================ characteristics ============================= */

/**
 * Everything the capability engine is allowed to reason about.
 * Derived values come from the existing business profile — they are not stored twice.
 */
export type BusinessCharacteristics = {
  /** Business identity. */
  name: string;
  /** From the existing compliance business profile. */
  businessType: string;
  legalForm: string;
  sector: string;
  employeeCount: number | null;
  taxRegistrations: string[];
  doesImport: boolean;
  doesExport: boolean;
  /** Optional operational flags (sells_products, accepts_credit, ...). */
  flags?: Record<string, boolean>;
  /**
   * True when the business has never recorded any scope configuration.
   * Legacy businesses keep the full application (backward compatible).
   */
  unconfigured: boolean;
};

export const EMPTY_CHARACTERISTICS: BusinessCharacteristics = {
  name: "",
  businessType: "",
  legalForm: "",
  sector: "",
  employeeCount: null,
  taxRegistrations: [],
  doesImport: false,
  doesExport: false,
  flags: {},
  unconfigured: true,
};

/* ============================== capabilities ============================== */

export const CAPABILITIES = [
  "sales",
  "pos",
  "credit_sales",
  "products",
  "inventory",
  "stock_transfers",
  "multi_warehouse",
  "purchasing",
  "suppliers",
  "customers",
  "crm_marketing",
  "finance",
  "expenses",
  "payroll",
  "employees",
  "tax",
  "tax_vat",
  "tax_withholding",
  "tax_assets",
  "tax_import_export",
  "compliance",
  "reports",
  "advanced_analytics",
  "administration",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

type Rule = {
  /** Human readable explanation shown in the scope UI. */
  reason: string;
  evaluate: (c: BusinessCharacteristics) => boolean;
};

const hasRegistration = (c: BusinessCharacteristics, code: string) =>
  c.taxRegistrations.some((entry) => entry.trim().toLowerCase().startsWith(code.toLowerCase()));

const employees = (c: BusinessCharacteristics) =>
  (c.employeeCount ?? 0) > 0;

/** Reads an operational flag, falling back to a default when unset. */
const flag = (c: BusinessCharacteristics, key: string, fallback: boolean) =>
  c.flags?.[key] ?? fallback;

/**
 * One central rule table. Adding a future characteristic or capability means
 * adding one entry here — never a scattered `if (businessType === ...)`.
 */
const CAPABILITY_RULES: Record<Capability, Rule> = {
  sales: { reason: "Every business sells something", evaluate: () => true },
  pos: {
    reason: "Counter selling",
    evaluate: () => true,
  },
  credit_sales: { reason: "Selling on credit", evaluate: (c) => flag(c, "accepts_credit", true) },
  products: { reason: "Sells physical products", evaluate: () => true },
  inventory: {
    reason: "Keeps stock",
    evaluate: () => true,
  },
  stock_transfers: {
    reason: "Stock moved between locations",
    evaluate: () => false,
  },
  multi_warehouse: {
    reason: "More than one location",
    evaluate: () => false,
  },
  purchasing: {
    reason: "Buys goods from suppliers",
    evaluate: () => true,
  },
  suppliers: { reason: "Supplier records", evaluate: () => true },
  customers: { reason: "Customer records", evaluate: () => true },
  crm_marketing: {
    reason: "Customer relationship & marketing work",
    evaluate: () => true,
  },
  finance: { reason: "Money in and out", evaluate: () => true },
  expenses: { reason: "Business spending", evaluate: () => true },
  payroll: {
    reason: "Pays salaries",
    evaluate: (c) => employees(c),
  },
  employees: { reason: "Has staff", evaluate: (c) => employees(c) },
  tax: { reason: "Registered for at least one tax", evaluate: () => true },
  tax_vat: { reason: "VAT registered", evaluate: (c) => hasRegistration(c, "VAT") },
  tax_withholding: {
    reason: "Withholding tax applies",
    evaluate: (c) => hasRegistration(c, "Withholding") || employees(c),
  },
  tax_assets: {
    reason: "Owns depreciable assets",
    evaluate: (c) => c.legalForm !== "Sole Proprietor" || (c.employeeCount ?? 0) > 0,
  },
  tax_import_export: {
    reason: "Imports or exports goods",
    evaluate: (c) => c.doesImport || c.doesExport,
  },
  compliance: { reason: "Licences, permits and filings", evaluate: () => true },
  reports: { reason: "Operational reporting", evaluate: () => true },
  advanced_analytics: {
    reason: "Advanced analytics requested",
    evaluate: () => true,
  },
  administration: { reason: "Business administration", evaluate: () => true },
};

export type CapabilityVerdict = { capability: Capability; eligible: boolean; reason: string };

/** Central capability evaluation — the only place characteristics are interpreted. */
export function evaluateCapabilities(
  characteristics: BusinessCharacteristics,
): Record<Capability, CapabilityVerdict> {
  const result = {} as Record<Capability, CapabilityVerdict>;
  for (const capability of CAPABILITIES) {
    const rule = CAPABILITY_RULES[capability];
    // Legacy / unconfigured businesses keep everything they already had.
    const eligible = characteristics.unconfigured ? true : rule.evaluate(characteristics);
    result[capability] = {
      capability,
      eligible,
      reason: characteristics.unconfigured
        ? "Business scope not configured — full platform kept available"
        : eligible
          ? rule.reason
          : `Not applicable: ${rule.reason.toLowerCase()}`,
    };
  }
  return result;
}

/* =========================== subscription plans ========================== */

/**
 * Entitlement layer. It is deliberately separate from eligibility.
 * The default plan entitles everything so no existing business loses access.
 */
export type PlanKey = "full" | "standard" | "starter";

export const PLANS: Record<PlanKey, { name: string; entitlements: Capability[] | "all" }> = {
  full: { name: "Full", entitlements: "all" },
  standard: {
    name: "Standard",
    entitlements: [
      "sales", "pos", "credit_sales", "products", "inventory", "purchasing", "suppliers",
      "customers", "crm_marketing", "finance", "expenses", "employees", "tax", "tax_vat",
      "tax_withholding", "tax_assets", "compliance", "reports", "administration",
    ],
  },
  starter: {
    name: "Starter",
    entitlements: [
      "sales", "pos", "products", "inventory", "customers", "finance", "expenses",
      "tax", "compliance", "reports", "administration",
    ],
  },
};

export const isEntitled = (plan: PlanKey, capability: Capability) => {
  const entitlements = PLANS[plan]?.entitlements ?? "all";
  return entitlements === "all" || entitlements.includes(capability);
};

/* ============================= module registry ============================ */

export type FeatureDef = {
  key: string;
  name: string;
  /** Route this feature owns, when it has one. */
  route?: string;
  capability: Capability;
};

export type ModuleDef = {
  key: string;
  name: string;
  /** Base route of the module (matched as prefix for route protection). */
  route: string;
  capability: Capability;
  features: FeatureDef[];
};

/**
 * Code-based registry of the modules that actually exist in this application.
 * A new module joins the scope system by adding one entry here.
 */
export const MODULE_REGISTRY: ModuleDef[] = [
  {
    key: "dashboard", name: "Dashboard", route: "/dashboard", capability: "reports",
    features: [],
  },
  {
    key: "sales", name: "Sales", route: "/m/sales", capability: "sales",
    features: [
      { key: "sales.new", name: "New sale", route: "/m/sales/new", capability: "pos" },
      { key: "sales.invoices", name: "Invoices", route: "/m/sales/invoices", capability: "sales" },
      { key: "sales.quotations", name: "Quotations", route: "/m/sales/quotations", capability: "sales" },
      { key: "sales.orders", name: "Sales orders", route: "/m/sales/orders", capability: "sales" },
      { key: "sales.drafts", name: "Draft orders", route: "/m/sales/drafts", capability: "sales" },
      { key: "sales.history", name: "Sales history", route: "/m/sales/history", capability: "sales" },
      { key: "sales.returns", name: "Returns", route: "/m/sales/returns", capability: "sales" },
      { key: "sales.payments", name: "Payments", route: "/m/sales/payments", capability: "credit_sales" },
      { key: "sales.reports", name: "Sales reports", route: "/m/sales/reports", capability: "reports" },
    ],
  },
  {
    key: "crm", name: "Customers & CRM", route: "/m/crm", capability: "customers",
    features: [
      { key: "crm.customers", name: "Customers", route: "/m/crm/customers", capability: "customers" },
      { key: "crm.campaigns", name: "Campaigns", route: "/m/crm/campaigns", capability: "crm_marketing" },
      { key: "crm.channels", name: "Channels", route: "/m/crm/channels", capability: "crm_marketing" },
      { key: "crm.market", name: "Market intelligence", route: "/m/crm/market", capability: "advanced_analytics" },
      { key: "crm.analytics", name: "CRM analytics", route: "/m/crm/analytics", capability: "advanced_analytics" },
    ],
  },
  {
    key: "inventory", name: "Inventory", route: "/m/inventory", capability: "inventory",
    features: [
      { key: "inventory.products", name: "Products", route: "/m/inventory/products", capability: "products" },
      { key: "inventory.categories", name: "Categories", route: "/m/inventory/categories", capability: "products" },
      { key: "inventory.stock", name: "Stock levels", route: "/m/inventory/stock", capability: "inventory" },
      { key: "inventory.movements", name: "Stock movements", route: "/m/inventory/movements", capability: "inventory" },
      { key: "inventory.overview", name: "Overview", route: "/m/inventory/overview", capability: "inventory" },
      { key: "inventory.purchases", name: "Purchases", route: "/m/inventory/purchases", capability: "purchasing" },
      { key: "inventory.suppliers", name: "Suppliers", route: "/m/inventory/suppliers", capability: "suppliers" },
      { key: "inventory.warehouses", name: "Warehouses", route: "/m/inventory/warehouses", capability: "multi_warehouse" },
      { key: "inventory.transfers", name: "Stock transfers", route: "/m/inventory/transfers", capability: "stock_transfers" },
    ],
  },
  {
    key: "finance", name: "Finance", route: "/m/finance", capability: "finance",
    features: [
      { key: "finance.accounts", name: "Accounts", route: "/m/finance/accounts", capability: "finance" },
      { key: "finance.payments", name: "Payments", route: "/m/finance/payments", capability: "finance" },
      { key: "finance.expenses", name: "Expenses", route: "/m/finance/expenses", capability: "expenses" },
      { key: "finance.transfers", name: "Transfers", route: "/m/finance/transfers", capability: "finance" },
      { key: "finance.reports", name: "Finance reports", route: "/m/finance/reports", capability: "reports" },
    ],
  },
  {
    key: "compliance", name: "Compliance", route: "/m/compliance", capability: "compliance",
    features: [
      { key: "compliance.profile", name: "Business profile", route: "/m/compliance/profile", capability: "compliance" },
      { key: "compliance.licences", name: "Licences", route: "/m/compliance/licences", capability: "compliance" },
      { key: "compliance.calendar", name: "Calendar", route: "/m/compliance/calendar", capability: "compliance" },
      { key: "compliance.reports", name: "Reports", route: "/m/compliance/reports", capability: "reports" },
    ],
  },
  {
    key: "tax", name: "Tax Management", route: "/m/tax", capability: "tax",
    features: [
      { key: "tax.sales", name: "EFD sales", route: "/m/tax/sales", capability: "tax" },
      { key: "tax.purchases", name: "Purchases", route: "/m/tax/purchases", capability: "tax" },
      { key: "tax.expenses", name: "Expenses", route: "/m/tax/expenses", capability: "tax" },
      { key: "tax.calendar", name: "Tax calendar", route: "/m/tax/calendar", capability: "tax" },
      { key: "tax.income", name: "Income tax", route: "/m/tax/income", capability: "tax" },
      { key: "tax.documents", name: "Documents", route: "/m/tax/documents", capability: "tax" },
      { key: "tax.reports", name: "Tax reports", route: "/m/tax/reports", capability: "reports" },
      { key: "tax.vat", name: "VAT", route: "/m/tax/vat", capability: "tax_vat" },
      { key: "tax.withholding", name: "Withholding tax", route: "/m/tax/withholding", capability: "tax_withholding" },
      { key: "tax.assets", name: "Capital assets", route: "/m/tax/assets", capability: "tax_assets" },
    ],
  },
  {
    key: "employees", name: "Employees", route: "/m/employees", capability: "employees",
    features: [
      { key: "employees.staff", name: "Staff", route: "/m/employees/staff", capability: "employees" },
      { key: "employees.departments", name: "Departments", route: "/m/employees/departments", capability: "employees" },
      { key: "employees.attendance", name: "Attendance", route: "/m/employees/attendance", capability: "employees" },
      { key: "employees.leave", name: "Leave", route: "/m/employees/leave", capability: "employees" },
      { key: "employees.contracts", name: "Contracts", route: "/m/employees/contracts", capability: "employees" },
      { key: "employees.recruitment", name: "Recruitment", route: "/m/employees/recruitment", capability: "employees" },
      { key: "employees.performance", name: "Performance", route: "/m/employees/performance", capability: "employees" },
      { key: "employees.payroll", name: "Payroll", route: "/m/employees/payroll", capability: "payroll" },
      { key: "employees.payslips", name: "Payslips", route: "/m/employees/payslips", capability: "payroll" },
    ],
  },
  {
    key: "reports", name: "Reports", route: "/m/reports", capability: "reports",
    features: [],
  },
  {
    key: "admin", name: "Administration", route: "/m/admin", capability: "administration",
    features: [],
  },
];

/* ============================== scope resolution ========================== */

export type AccessVerdict = {
  /** Final answer used by UI and route guards. */
  allowed: boolean;
  eligible: boolean;
  entitled: boolean;
  reason: string;
};

export type BusinessScope = {
  characteristics: BusinessCharacteristics;
  plan: PlanKey;
  capabilities: Record<Capability, AccessVerdict>;
  /** Module key → verdict. */
  modules: Record<string, AccessVerdict>;
  /** Feature key → verdict. */
  features: Record<string, AccessVerdict>;
};

/** Business eligibility AND subscription entitlement. */
export function resolveScope(
  characteristics: BusinessCharacteristics,
  plan: PlanKey,
): BusinessScope {
  const eligibility = evaluateCapabilities(characteristics);
  const capabilities = {} as Record<Capability, AccessVerdict>;

  for (const capability of CAPABILITIES) {
    const eligible = eligibility[capability].eligible;
    const entitled = isEntitled(plan, capability);
    capabilities[capability] = {
      allowed: eligible && entitled,
      eligible,
      entitled,
      reason: !eligible
        ? eligibility[capability].reason
        : !entitled
          ? `Not included in the ${PLANS[plan].name} plan`
          : eligibility[capability].reason,
    };
  }

  const modules: Record<string, AccessVerdict> = {};
  const features: Record<string, AccessVerdict> = {};

  for (const module of MODULE_REGISTRY) {
    const own = capabilities[module.capability];
    const featureVerdicts = module.features.map((feature) => {
      const verdict = capabilities[feature.capability];
      features[feature.key] = verdict;
      return verdict;
    });
    // A module stays in scope when its own capability applies, or when at least
    // one of its features still applies (e.g. Tax without VAT).
    const allowed = own.allowed || featureVerdicts.some((verdict) => verdict.allowed);
    modules[module.key] = allowed ? { ...own, allowed: true } : own;
  }

  return { characteristics, plan, capabilities, modules, features };
}

/** Longest-prefix route lookup used by navigation filters and route guards. */
export function findRouteScope(scope: BusinessScope, pathname: string): {
  module?: ModuleDef;
  feature?: FeatureDef;
  verdict: AccessVerdict | null;
} {
  const matchesRoute = (route: string) => pathname === route || pathname.startsWith(route + "/");

  const module = MODULE_REGISTRY.find((entry) => matchesRoute(entry.route));
  if (!module) return { verdict: null };

  const feature = module.features
    .filter((entry) => entry.route && matchesRoute(entry.route))
    .sort((a, b) => (b.route?.length ?? 0) - (a.route?.length ?? 0))[0];

  if (feature) return { module, feature, verdict: scope.features[feature.key] ?? null };
  return { module, verdict: scope.modules[module.key] ?? null };
}

/* ============================ test presets (dev) ========================= */

/**
 * Development-only presets so different business configurations can be observed
 * without database migrations. They only overlay the local scope resolution —
 * authentication, RLS and data access are untouched.
 */
export type ScopePreset = {
  key: string;
  label: string;
  plan: PlanKey;
  characteristics: Partial<BusinessCharacteristics>;
};

export const SCOPE_PRESETS: ScopePreset[] = [
  {
    key: "retail-company",
    label: "Test A — Retail company, VAT, employees",
    plan: "full",
    characteristics: {
      name: "Test Retail Co.", businessType: "Retail", legalForm: "Limited Company",
      sector: "General Trade", employeeCount: 12, taxRegistrations: ["TIN", "VAT", "PAYE"],
      doesImport: true, doesExport: false, unconfigured: false,
    },
  },
  {
    key: "solo-service",
    label: "Test B — Individual service provider, no VAT, no staff",
    plan: "full",
    characteristics: {
      name: "Test Consultant", businessType: "Services", legalForm: "Sole Proprietor",
      sector: "Professional Services", employeeCount: 0, taxRegistrations: ["TIN"],
      doesImport: false, doesExport: false, unconfigured: false,
    },
  },
  {
    key: "restaurant",
    label: "Test C — Restaurant, VAT, single location",
    plan: "standard",
    characteristics: {
      name: "Test Restaurant", businessType: "Restaurant", legalForm: "Partnership",
      sector: "Food & Beverage", employeeCount: 6, taxRegistrations: ["TIN", "VAT"],
      doesImport: false, doesExport: false, unconfigured: false,
    },
  },
  {
    key: "starter-plan",
    label: "Test D — Eligible business on the Starter plan",
    plan: "starter",
    characteristics: {
      name: "Test Starter Shop", businessType: "Retail", legalForm: "Sole Proprietor",
      sector: "General Trade", employeeCount: 3, taxRegistrations: ["TIN", "VAT", "Withholding Tax"],
      doesImport: false, doesExport: false, unconfigured: false,
    },
  },
  {
    key: "legacy",
    label: "Test E — Legacy business with no scope configuration",
    plan: "full",
    characteristics: { ...EMPTY_CHARACTERISTICS },
  },
];
