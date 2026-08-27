import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, Landmark, BadgeCheck, CalendarDays, BarChart3, Building2,
  ChevronRight, AlertTriangle, FolderArchive,
} from "lucide-react";
import { StatusBadge } from "@/components/tax/tax-workspace";
import { useCompliance, deriveStatus, nextAction } from "@/components/compliance/compliance-provider";


export const Route = createFileRoute("/_authenticated/m/compliance/")({
  head: () => ({
    meta: [
      { title: "Compliance — Bizz Automators" },
      { name: "description", content: "Track tax, licences, permits and regulatory obligations for your business." },
      { property: "og:title", content: "Compliance — Bizz Automators" },
      { property: "og:description", content: "Business compliance position: obligations, filings, payments, renewals." },
    ],
  }),
  component: ComplianceOverview,
});

const CARDS = [
  { label: "Tax", icon: Landmark, to: "/m/tax" },
  { label: "Licences", icon: BadgeCheck, to: "/m/compliance/licences" },
  { label: "Calendar", icon: CalendarDays, to: "/m/compliance/calendar" },
  { label: "Profile", icon: Building2, to: "/m/compliance/profile" },
];


const MORE = [
  { label: "Compliance Reports", icon: BarChart3, to: "/m/compliance/reports" },
  { label: "Documents & Evidence", icon: FolderArchive, to: "/m/tax/documents" },
];

function ComplianceOverview() {
  const { metrics, obligations } = useCompliance();
  const attention = obligations
    .map((row) => ({ row, status: deriveStatus(row) }))
    .filter((item) => ["Overdue", "Due Soon", "Expired"].includes(item.status))
    .sort((a, b) => (a.row.dueDate || a.row.expiryDate || "9999").localeCompare(b.row.dueDate || b.row.expiryDate || "9999"))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6 text-white md:max-w-6xl md:px-10 md:pb-12 md:pt-10">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-sm text-white/80">Tax, licences, permits and regulatory obligations</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-4 gap-4 md:mt-12 md:gap-8">
        {CARDS.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group flex flex-col items-center gap-3 transition hover:scale-110 md:gap-4"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20 md:h-28 md:w-28 md:rounded-3xl">
              <c.icon className="h-6 w-6 text-amber-400 md:h-10 md:w-10" />
            </div>
            <span className="text-center text-[11px] font-semibold text-white md:text-sm">{c.label}</span>
          </Link>
        ))}
      </div>


      <Link to="/m/compliance/calendar" className="mt-8 block rounded-3xl border border-amber-300/30 bg-amber-400/10 p-5 backdrop-blur-xl transition hover:bg-amber-400/15">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-300" />
          <h2 className="font-display text-lg font-bold text-white">Needs Action</h2>
          <span className="ml-auto text-xs text-white/70">{metrics.overdue} overdue · {metrics.dueSoon} due soon</span>
        </div>
        <ul className="mt-3 space-y-2">
          {attention.length === 0 ? (
            <li className="text-sm text-white/60">Nothing overdue or expiring based on current obligation data.</li>
          ) : (
            attention.map(({ row, status }) => (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-2xl bg-black/20 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-white">{row.name}</span>
                <span className="hidden text-xs text-white/60 sm:block">{nextAction(row)}</span>
                <StatusBadge value={status} />
              </li>
            ))
          )}
        </ul>
      </Link>

      <div className="mt-4 rounded-3xl border border-white/30 bg-white/10 p-5 backdrop-blur-xl">

        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-lg font-bold text-white">More Options</h2>
        </div>
        <div className="mt-3 h-px bg-white/20" />
        <ul className="mt-2 divide-y divide-white/20">
          {MORE.map((item) => (
            <li key={item.label}>
              <Link to={item.to} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                  <item.icon className="h-4 w-4 text-amber-400" />
                </div>
                <span className="flex-1 text-[15px] font-medium text-white">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-white/60" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {metrics.profileCompleteness < 100 ? (
        <Link to="/m/compliance/profile" className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/30 bg-white/15 p-5 text-left transition hover:bg-white/25">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 backdrop-blur">
            <Building2 className="h-6 w-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-white">Complete your business profile</h3>
            <p className="text-xs text-white/70">{metrics.profileCompleteness}% complete — applicable obligations are determined from this profile</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/60" />
        </Link>
      ) : null}
    </div>
  );
}
