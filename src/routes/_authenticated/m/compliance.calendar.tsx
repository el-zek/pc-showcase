import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { useCompliance, deriveStatus, nextAction, type ComplianceObligation } from "@/components/compliance/compliance-provider";

export const Route = createFileRoute("/_authenticated/m/compliance/calendar")({
  head: () => ({
    meta: [
      { title: "Compliance Calendar — Bizz Automators" },
      { name: "description", content: "Upcoming filings, payments and renewals across tax, licences and permits." },
      { property: "og:title", content: "Compliance Calendar" },
      { property: "og:description", content: "One deadline view for every compliance obligation." },
    ],
  }),
  component: CalendarPage,
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dotClass(status: string) {
  if (status === "Overdue" || status === "Expired") return "bg-rose-400";
  if (status === "Due Soon") return "bg-amber-400";
  if (status === "Compliant") return "bg-emerald-400";
  return "bg-sky-400";
}

function CalendarPage() {
  const { obligations, metrics } = useCompliance();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const dated = obligations
    .filter((row) => row.applicability !== "not_applicable" && (row.dueDate || row.expiryDate))
    .sort((a, b) => (a.dueDate || a.expiryDate).localeCompare(b.dueDate || b.expiryDate));

  const monthGrid = useMemo(() => {
    const startPad = new Date(cursor.year, cursor.month, 1).getDay();
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: { date: string | null; items: ComplianceObligation[] }[] = [];
    for (let i = 0; i < startPad; i += 1) cells.push({ date: null, items: [] });
    for (let day = 1; day <= days; day += 1) {
      const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, items: dated.filter((row) => (row.dueDate || row.expiryDate) === date) });
    }
    return cells;
  }, [cursor, dated]);

  const shiftMonth = (delta: number) =>
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <TaxWorkspace
      title="Compliance Calendar"
      subtitle="Deadlines only appear once a due or expiry date is recorded"
      icon={CalendarDays}
      backTo="/m/compliance"
      backLabel="Back to Compliance"
      actions={
        <div className="flex rounded-xl border border-white/15 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${view === "list" ? "bg-amber-400 text-black" : "text-white/70 hover:text-white"}`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${view === "calendar" ? "bg-amber-400 text-black" : "text-white/70 hover:text-white"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>
      }
    >
      <SummaryStrip
        items={[
          { label: "Scheduled", value: String(dated.length) },
          { label: "Due soon", value: String(metrics.dueSoon), tone: "warning" },
          { label: "Overdue", value: String(metrics.overdue), tone: "danger" },
        ]}
      />

      {view === "list" ? (
        <TaxTable
          rows={dated}
          columns={[
            { key: "date", label: "Date", render: (row) => row.dueDate || row.expiryDate },
            { key: "name", label: "Obligation", render: (row) => (
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{row.name}</div>
                <div className="truncate text-xs text-white/50">{row.category} · {row.period || "Not periodic"}</div>
              </div>
            ) },
            { key: "action", label: "Next action", hideOnMobile: true, render: (row) => nextAction(row) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={deriveStatus(row)} /> },
          ]}
          searchKeys={(row) => `${row.name} ${row.category} ${row.period}`}
          onExport={(rows) => exportCsv("compliance-calendar.csv", ["Date", "Obligation", "Category", "Period", "Next action", "Status"],
            rows.map((row) => [row.dueDate || row.expiryDate, row.name, row.category, row.period, nextAction(row), deriveStatus(row)]))}
          empty={{ title: "No dated obligations", description: "Record due or expiry dates on obligations and licences to build the calendar.", icon: CalendarDays }}
        />
      ) : (
        <section className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/15"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-base font-semibold text-white">{MONTHS[cursor.month]} {cursor.year}</h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/15"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-white/40">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid.map((cell, index) => (
              <div
                key={cell.date ?? `pad-${index}`}
                title={cell.items.map((row) => `${row.name} · ${deriveStatus(row)}`).join("\n")}
                className={`flex min-h-[52px] flex-col items-center justify-start rounded-xl border p-1.5 md:min-h-[76px] ${
                  cell.date === todayIso ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"
                } ${cell.date ? "" : "invisible"}`}
              >
                <span className="text-[11px] text-white/60">{cell.date ? Number(cell.date.slice(8)) : ""}</span>
                <span className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                  {cell.items.map((row) => (
                    <span key={row.id} className={`block h-1.5 w-1.5 rounded-full md:h-2 md:w-2 ${dotClass(deriveStatus(row))}`} />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
            {[["bg-rose-400", "Overdue / Expired"], ["bg-amber-400", "Due soon"], ["bg-sky-400", "Pending"], ["bg-emerald-400", "Compliant"]].map(([dot, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
              </span>
            ))}
          </div>
        </section>
      )}
    </TaxWorkspace>
  );
}
