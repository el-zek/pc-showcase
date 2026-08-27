import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlarmClock, BellOff, BellRing, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Download, LayoutGrid, List, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTaxModule, formatCurrency, daysUntil,
  type TaxObligation, type ObligationStatus,
} from "@/components/tax-module-provider";
import { DetailsDrawer, StatusBadge, TaxEmptyState, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/calendar")({ component: TaxCalendarPage });

const STATUSES: ObligationStatus[] = ["Upcoming", "Pending", "Paid", "Overdue"];
const TAX_TYPES = ["VAT", "Income Tax", "Withholding Tax", "PAYE"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function reminderLabel(row: TaxObligation) {
  if (!row.reminderOn) return "Reminders off";
  if (row.status === "Paid") return "Settled";
  if (row.status === "Overdue") return `Overdue by ${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? "" : "s"}`;
  if (row.reminderStage) return `${row.reminderStage}-day reminder active`;
  return `Due in ${row.daysLeft} days`;
}

function TaxCalendarPage() {
  const { obligations, toggleReminder, markObligationPaid, dueSoonDays, setDueSoonDays } = useTaxModule();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ObligationStatus>("all");
  const [taxType, setTaxType] = useState<"all" | (typeof TAX_TYPES)[number]>("all");
  const [detail, setDetail] = useState<TaxObligation | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return obligations
      .filter((row) => (status === "all" ? true : row.status === status))
      .filter((row) => (taxType === "all" ? true : row.taxType === taxType))
      .filter((row) => (q ? `${row.taxType} ${row.reference} ${row.period}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [obligations, query, status, taxType]);

  const alerts = obligations.filter((row) => row.reminderOn && row.reminderStage !== null);
  const overdue = obligations.filter((row) => row.status === "Overdue");
  const dueSoon = obligations.filter((row) => row.status === "Pending");
  const payable = obligations.filter((row) => row.status !== "Paid").reduce((sum, row) => sum + row.amount, 0);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: { date: string | null; items: TaxObligation[] }[] = [];
    for (let i = 0; i < startPad; i += 1) cells.push({ date: null, items: [] });
    for (let day = 1; day <= days; day += 1) {
      const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, items: filtered.filter((row) => row.dueDate === date) });
    }
    return cells;
  }, [cursor, filtered]);

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <TaxWorkspace
      title="Tax Calendar"
      subtitle="Every filing deadline, generated from your tax records"
      icon={CalendarDays}
      actions={
        <>
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
          <Button
            size="sm"
            variant="outline"
            className="h-9 border-white/15 bg-white/5 text-white hover:bg-white/15"
            onClick={() =>
              exportCsv(
                "tax-calendar.csv",
                ["Tax type", "Reference", "Period", "Due date", "Amount", "Status", "Reminder"],
                filtered.map((row) => [row.taxType, row.reference, row.period, row.dueDate, row.amount, row.status, row.reminderOn ? "On" : "Off"]),
              )
            }
          >
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </>
      }
    >
      {alerts.length > 0 && (
        <section className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <AlarmClock className="h-4 w-4" /> Automatic reminders
          </div>
          <ul className="mt-3 space-y-2">
            {alerts.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/20 px-3 py-2 text-sm">
                <span className="text-white">{row.taxType} · {row.period}</span>
                <span className="text-amber-200">{row.reminderStage}-day reminder — due {row.dueDate}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tax type, reference or period"
            className="h-10 border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/70">
            Due soon within
            <select
              value={dueSoonDays}
              onChange={(event) => setDueSoonDays(Number(event.target.value))}
              className="bg-transparent text-white outline-none"
            >
              {[3, 7, 14, 30, 60, 90].map((days) => (
                <option key={days} value={days} className="bg-neutral-900">{days} days</option>
              ))}
            </select>
          </label>
          <select
            value={taxType}
            onChange={(event) => setTaxType(event.target.value as typeof taxType)}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="all" className="bg-neutral-900">All tax types</option>
            {TAX_TYPES.map((item) => <option key={item} value={item} className="bg-neutral-900">{item}</option>)}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
          >
            <option value="all" className="bg-neutral-900">All statuses</option>
            {STATUSES.map((item) => <option key={item} value={item} className="bg-neutral-900">{item}</option>)}
          </select>
        </div>
      </section>

      {filtered.length === 0 ? (
        <TaxEmptyState
          title="No obligations found"
          description="Tax deadlines appear here automatically once VAT returns, PAYE, withholding certificates or income tax installments are recorded."
          icon={CalendarDays}
        />
      ) : view === "list" ? (
        <section className="overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-xl">
          <ul className="divide-y divide-white/10">
            {filtered.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <button type="button" onClick={() => setDetail(row)} className="min-w-[9rem] flex-1 text-left">
                  <div className="text-sm font-semibold text-white">{row.taxType}</div>
                  <div className="text-xs text-white/50">{row.reference} · Period {row.period}</div>
                </button>
                <div className="hidden min-w-[7rem] text-sm text-white/70 sm:block">{row.dueDate}</div>
                <div className="min-w-[7rem] text-sm text-white/80">{formatCurrency(row.amount)}</div>
                <StatusBadge value={row.status} />
                <button
                  type="button"
                  title={reminderLabel(row)}
                  onClick={() => { toggleReminder(row.id, !row.reminderOn); toast.success(row.reminderOn ? "Reminders off" : "Reminders on"); }}
                  className={`grid h-9 w-9 place-items-center rounded-xl border transition ${row.reminderOn ? "border-amber-300/30 bg-amber-400/15 text-amber-300" : "border-white/10 bg-white/5 text-white/40"}`}
                >
                  {row.reminderOn ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
                <Button size="sm" variant="outline" className="h-9 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => setDetail(row)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-base font-semibold text-white">{MONTHS[cursor.month]} {cursor.year}</h2>
            <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-white/40">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid.map((cell, index) => (
              <button
                key={cell.date ?? `pad-${index}`}
                type="button"
                disabled={!cell.date || cell.items.length === 0}
                onClick={() => { if (cell.items[0]) setDetail(cell.items[0]); }}
                className={`flex min-h-[52px] flex-col items-center justify-start rounded-xl border p-1.5 md:min-h-[76px] ${
                  cell.date === todayIso ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"
                } ${cell.date ? "" : "invisible"} ${cell.items.length > 0 ? "hover:bg-white/10" : ""}`}
              >
                <span className="text-[11px] text-white/60">{cell.date ? Number(cell.date.slice(8)) : ""}</span>
                <span className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                  {cell.items.map((row) => (
                    <span
                      key={row.id}
                      title={`${row.taxType} · ${row.status}`}
                      className={`block h-1.5 w-1.5 rounded-full md:h-2 md:w-2 ${
                        row.status === "Overdue" ? "bg-rose-400"
                          : row.status === "Paid" ? "bg-emerald-400"
                          : row.status === "Pending" ? "bg-amber-400"
                          : "bg-sky-400"
                      }`}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
            {[["bg-rose-400", "Overdue"], ["bg-amber-400", "Pending"], ["bg-sky-400", "Upcoming"], ["bg-emerald-400", "Paid"]].map(([dot, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
              </span>
            ))}
          </div>
        </section>
      )}

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.taxType} · ${detail.period}` : ""}
        description="Obligation generated from your tax records"
        rows={
          detail
            ? [
                { label: "Reference", value: detail.reference },
                { label: "Tax period", value: detail.period },
                { label: "Due date", value: detail.dueDate },
                { label: "Amount", value: formatCurrency(detail.amount) },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
                { label: "Filing status", value: <StatusBadge value={detail.filingStatus} /> },
                { label: "Reminder", value: reminderLabel(detail) },
                {
                  label: "Time left",
                  value: detail.status === "Paid" ? "Settled" : `${daysUntil(detail.dueDate)} days`,
                },
                {
                  label: "Source",
                  value: <Link to={detail.sourceRoute} className="text-amber-300 underline-offset-4 hover:underline">{detail.sourceLabel}</Link>,
                },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/15"
                onClick={() => { toggleReminder(detail.id, !detail.reminderOn); setDetail({ ...detail, reminderOn: !detail.reminderOn }); }}
              >
                {detail.reminderOn ? "Turn reminders off" : "Turn reminders on"}
              </Button>
              {detail.status !== "Paid" && (
                <Button
                  className="bg-emerald-500 text-white hover:bg-emerald-400"
                  onClick={() => { markObligationPaid(detail); setDetail(null); toast.success("Marked as paid"); }}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark as paid
                </Button>
              )}
            </>
          ) : null
        }
      />
    </TaxWorkspace>
  );
}
