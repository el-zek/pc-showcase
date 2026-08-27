import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MoreVertical, RefreshCw, FileDown, FileSpreadsheet, FileText } from "lucide-react";

import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportReportCsv, exportReportExcel, exportReportPdf, type ReportPayload } from "@/lib/report-export";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "365 days", days: 365 },
];

export type AnalyticsMetric = { label: string; value: string; icon: LucideIcon; delta?: number | null };
export type AnalyticsSeries = { key: string; label: string; color: string; axis?: "left" | "right" };
export type TrendPoint = { label: string } & Record<string, string | number>;

type Props = {
  title: string;
  subtitle?: string;
  backTo: string;
  days: number;
  metrics: AnalyticsMetric[];
  series: AnalyticsSeries[];
  trend: TrendPoint[];
  summary: AnalyticsMetric[];
  report?: ReportPayload;
  children?: ReactNode;
};

function Delta({ delta }: { delta?: number | null }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return <p className="mt-1 text-[11px] text-white/35">— 0%</p>;
  }
  const up = delta >= 0;
  return (
    <p className={`mt-1 text-[11px] ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
    </p>
  );
}

export function AnalyticsWorkspace({
  title, subtitle, backTo, days, metrics, series, trend, summary, report, children,
}: Props) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const hasTrendData = useMemo(
    () => trend.some((point) => series.some((s) => Number(point[s.key] ?? 0) !== 0)),
    [trend, series],
  );

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 450);
    return () => clearTimeout(t);
  }, [pending, days]);

  const changeRange = (value: number) => {
    if (value === days) return;
    setPending(true);
    void queryClient.invalidateQueries();
    void navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, days: value }) });
  };


  const refresh = () => {
    void queryClient.invalidateQueries();
    void router.invalidate();
    toast.success("Data refreshed");
  };


  const runExport = (kind: "csv" | "excel" | "pdf") => {
    if (!report) return;
    try {
      if (kind === "csv") exportReportCsv(report);
      if (kind === "excel") exportReportExcel(report);
      if (kind === "pdf") exportReportPdf(report);
      toast.success(`Exported ${kind.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="relative -mx-3 -mt-6 min-h-[calc(100vh-4.5rem)] px-3 pb-12 pt-4 text-white sm:-mx-6 sm:px-4 md:px-8 md:pt-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate({ to: backTo })}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 transition hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-[26px]">{title}</h2>
            <p className="mt-0.5 text-xs text-white/55 md:text-sm">{subtitle ?? `Last ${days} days performance`}</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-white/[0.04] p-1 md:ml-auto">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => changeRange(r.days)}
              className={`flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition md:flex-none ${
                days === r.days ? "bg-amber-400 text-black" : "text-white/65 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {pending ? (
        <div className="mt-5 space-y-5">
          <div className="h-40 animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]" />
          <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="h-80 animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]" />
            <div className="h-80 animate-pulse rounded-2xl border border-white/8 bg-white/[0.04]" />
          </div>
        </div>
      ) : (
      <div key={days} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Metrics panel */}
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:p-6">

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-8">
          {metrics.map((c, i) => (
            <div
              key={c.label}
              className={`flex min-w-0 items-start gap-2.5 md:px-2 ${i % 4 !== 0 ? "md:border-l md:border-white/8 md:pl-6" : ""}`}
            >
              <c.icon className="mt-1 h-4 w-4 shrink-0 text-amber-400/90 md:h-5 md:w-5" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-[10px] uppercase leading-tight tracking-wider text-white/50">{c.label}</p>
                <p className="mt-1 font-display text-base font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-lg md:text-xl">
                  {c.value}
                </p>
                <Delta delta={c.delta} />
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Trend + Summary */}
      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-white">Performance Trend</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/70">
                {days > 90 ? "Monthly" : days > 30 ? "Weekly" : "Daily"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/10" aria-label="Options">
                    <MoreVertical className="h-4 w-4 text-white/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Options</DropdownMenuLabel>
                  <DropdownMenuItem onClick={refresh}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh data
                  </DropdownMenuItem>
                  {report ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => runExport("pdf")}>
                        <FileText className="mr-2 h-4 w-4" /> Export PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => runExport("excel")}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => runExport("csv")}>
                        <FileDown className="mr-2 h-4 w-4" /> Export CSV
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-4 text-xs text-white/65">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>

          <div className="mt-4 h-56 w-full">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" width={54} />
                  <Tooltip
                    contentStyle={{ background: "rgba(17,17,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 12 }}
                    formatter={(value: any) => Math.round(Number(value)).toLocaleString()}
                  />
                  {series.map((s) => (
                    <Line
                      key={s.key}
                      yAxisId={s.axis ?? "left"}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center text-xs text-white/40">
                No activity recorded in the last {days} days.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="font-display text-base font-bold text-white">Summary</h3>
          <div className="mt-4 space-y-3">
            {summary.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400/10">
                  <s.icon className="h-4 w-4 text-amber-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs leading-tight text-white/60">{s.label}</p>
                  <p className="font-display text-base font-bold leading-tight text-white [overflow-wrap:anywhere] md:text-lg">
                    {s.value}
                  </p>
                </div>
                <span className="shrink-0 self-start">
                  <Delta delta={s.delta} />
                </span>
              </div>

            ))}
          </div>
        </div>
      </div>

      {children}
      </div>
      )}
    </div>

  );
}

/** Bucket date-stamped records into chart points across the selected range. */
export function buildBuckets<T>(
  records: T[],
  days: number,
  getDate: (row: T) => string | number | Date | null | undefined,
  accumulate: (point: Record<string, number>, row: T) => void,
  keys: string[],
): TrendPoint[] {
  const bucketCount = days > 90 ? 12 : days > 30 ? 13 : 15;
  const spanMs = days * 86400_000;
  const now = Date.now();
  const start = now - spanMs;
  const step = spanMs / bucketCount;

  const points = Array.from({ length: bucketCount }, (_, i) => {
    const at = new Date(start + step * (i + 1));
    const base: Record<string, number> = {};
    keys.forEach((k) => { base[k] = 0; });
    return {
      label: days > 90
        ? at.toLocaleDateString("en-GB", { month: "short" })
        : at.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      ...base,
    } as TrendPoint;
  });

  records.forEach((row) => {
    const raw = getDate(row);
    if (!raw) return;
    const time = new Date(raw).getTime();
    if (!Number.isFinite(time) || time < start || time > now) return;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((time - start) / step)));
    accumulate(points[index] as unknown as Record<string, number>, row);
  });

  return points;
}

/** Percentage change between a current and prior period value. */
export function pctChange(current: number, prior: number) {
  if (prior === 0) return current > 0 ? 100 : null;
  return ((current - prior) / prior) * 100;
}
