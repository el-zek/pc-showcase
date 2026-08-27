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
    category: "Payroll and Benefits",
    items: ["Salaries", "Wages", "Transport allowance", "Food allowance", "Overtime", "Bonuses", "Commission", "Staff welfare", "Training", "Recruitment", "Employer contributions", "PAYE contribution", "Social security (NSSF)", "Workers compensation (WCF)", "Skills levy (SDL)"],
  },
  {
    category: "Office and Operational Costs",
    items: ["Equipment purchases", "Office furniture", "Computers and accessories", "Software and licenses", "ERP / system costs", "Security", "Cleaning", "Office maintenance"],
  },
  {
    category: "Rent",
    items: ["Office rent", "Shop rent", "Warehouse rent", "Land / property rent", "Service charge", "Renovation"],
  },
  {
    category: "Utilities and Bills",
    items: ["Electricity", "Water", "Internet", "Phone / airtime", "Security", "Waste collection", "Gas / fuel for premises", "Other utilities"],
  },
  {
    category: "Office Supplies",
    items: ["Printing", "Stationery", "Toner / ink", "Packaging materials", "Cleaning supplies", "Consumables", "Postage", "Refreshments"],
  },
  {
    category: "Maintenance and Repair",
    items: ["Equipment repair", "Vehicle repair", "Building repair", "Computer / IT repair", "Furniture repair", "Machinery maintenance"],
  },
  {
    category: "Marketing",
    items: ["Instagram ads", "Facebook ads", "Google ads", "YouTube ads", "TikTok ads", "WhatsApp marketing", "SMS / bulk messaging", "Influencers", "Photography", "Video production", "Posters", "Flyers", "Events / exhibitions", "Sponsorship", "Promotional materials", "Branding & design", "Website & landing pages"],
  },
  {
    category: "Legal and Compliance",
    items: ["Business license", "Tax compliance", "Legal fees", "Accounting fees", "Audit fees", "Registration fees", "Permits", "Professional services", "TRA fees & penalties", "Local government levy", "Fire & safety certificate", "Health certificate", "Association fees"],
  },
  {
    category: "Financial and Banking",
    items: ["Bank charges", "Mobile money charges", "Transaction fees", "Loan interest", "Loan repayment", "Payment gateway fees", "Currency / exchange charges", "Overdraft charges", "Insurance premium"],
  },
  {
    category: "Logistics",
    items: ["Transport charges", "Fuel", "Courier services", "Delivery", "Business trips", "Accommodation", "Parking", "Tolls", "Vehicle maintenance", "Vehicle insurance", "Freight & clearing", "Public transport"],
  },
  {
    category: "Platform Development",
    items: ["Website development", "App development", "Hosting", "Domain", "Cloud services", "API services", "SMS services", "Software development", "Technical support", "IT support"],
  },
  {
    category: "Stock and Production",
    items: ["Raw materials", "Packaging", "Production supplies", "Casual labour", "Spoilage & wastage", "Machinery maintenance"],
  },
  {
    category: "Equipment and Assets",
    items: ["Equipment purchase", "Computers & phones", "Tools", "Software licences", "Depreciation", "Leasing"],
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
