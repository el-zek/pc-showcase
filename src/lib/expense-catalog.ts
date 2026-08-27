/**
 * Built-in expense classification used across Expenses, Finance and Reports.
 * Businesses can add their own categories/items on top of this (expense_categories table),
 * so this catalog is a starting point — never a hard limit.
 */

export type ExpenseGroup = {
  category: string;
  items: string[];
};

export const EXPENSE_CATALOG: ExpenseGroup[] = [
  {
    category: "Staff & Payroll",
    items: ["Salaries", "Wages", "Bonuses & commission", "Allowances", "Overtime", "Staff welfare", "Training", "Recruitment", "PAYE contribution", "Social security (NSSF)", "Workers compensation (WCF)", "Skills levy (SDL)"],
  },
  {
    category: "Rent & Premises",
    items: ["Shop / office rent", "Warehouse rent", "Service charge", "Security", "Cleaning", "Repairs & maintenance", "Renovation"],
  },
  {
    category: "Utilities",
    items: ["Electricity", "Water", "Internet", "Airtime & data", "Gas / fuel for premises", "Waste collection"],
  },
  {
    category: "Marketing & Advertising",
    items: ["Social media ads", "Google ads", "Radio / TV", "Printed materials (flyers, banners)", "Branding & design", "Photography & video", "Influencer / promoter", "Exhibitions & events", "Sponsorship", "Promotional giveaways", "Website & landing pages", "SMS / bulk messaging"],
  },
  {
    category: "Transport & Logistics",
    items: ["Fuel", "Vehicle maintenance", "Delivery & courier", "Public transport", "Vehicle insurance", "Parking & tolls", "Freight & clearing"],
  },
  {
    category: "Stock & Production",
    items: ["Raw materials", "Packaging", "Production supplies", "Casual labour", "Spoilage & wastage", "Machinery maintenance"],
  },
  {
    category: "Professional Services",
    items: ["Accounting & audit", "Legal fees", "Consultancy", "IT support", "Bookkeeping software", "Bank charges", "Mobile money charges"],
  },
  {
    category: "Licences & Compliance",
    items: ["Business licence", "Sector permit", "TRA fees & penalties", "Local government levy", "Fire & safety certificate", "Health certificate", "Association fees"],
  },
  {
    category: "Office & Administration",
    items: ["Stationery", "Printing & photocopy", "Postage", "Subscriptions", "Furniture", "Small equipment", "Refreshments"],
  },
  {
    category: "Equipment & Assets",
    items: ["Equipment purchase", "Computers & phones", "Tools", "Software licences", "Depreciation", "Leasing"],
  },
  {
    category: "Finance & Loans",
    items: ["Loan interest", "Loan repayment", "Overdraft charges", "Insurance premium", "Forex loss"],
  },
  { category: "Other", items: ["Miscellaneous", "Donations", "Fines & penalties", "Owner drawings"] },
];

export const EXPENSE_CATEGORIES = EXPENSE_CATALOG.map((g) => g.category);

export const itemsForCategory = (category: string, custom: { name: string; parent_name: string | null }[] = []) => {
  const base = EXPENSE_CATALOG.find((g) => g.category === category)?.items ?? [];
  const extra = custom.filter((c) => c.parent_name === category).map((c) => c.name);
  return Array.from(new Set([...base, ...extra]));
};

export const EXPENSE_FREQUENCIES = [
  { value: "one_time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Every 6 months" },
  { value: "annual", label: "Yearly" },
] as const;

export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number]["value"];

export const frequencyLabel = (value: string) =>
  EXPENSE_FREQUENCIES.find((f) => f.value === value)?.label ?? "One-time";

export const PAYMENT_METHODS = ["Cash", "Mobile money", "Bank transfer", "Cheque", "Card", "Credit / on account"];

/** Next occurrence of a recurring expense, starting from `from`. */
export function advanceDate(from: string, frequency: string): string {
  const base = new Date(from);
  if (Number.isNaN(base.getTime())) return from;
  const d = new Date(base);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "biannual": d.setMonth(d.getMonth() + 6); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
    default: return from;
  }
  return d.toISOString().slice(0, 10);
}

export const isoToday = () => new Date().toISOString().slice(0, 10);

/** Days until a due date — negative means overdue. */
export const daysUntil = (date: string) => {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};
