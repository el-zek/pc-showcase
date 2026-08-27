import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type Tone = "emerald" | "amber" | "violet" | "blue" | "rose" | "slate";

const toneClasses: Record<Tone, { badge: string; panel: string; bar: string; text: string }> = {
  emerald: {
    badge: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
    panel: "border-emerald-400/25 bg-emerald-400/10",
    bar: "from-emerald-400 to-emerald-300",
    text: "text-emerald-200",
  },
  amber: {
    badge: "bg-amber-400/15 text-amber-200 border-amber-400/30",
    panel: "border-amber-400/25 bg-amber-400/10",
    bar: "from-amber-400 to-amber-300",
    text: "text-amber-200",
  },
  violet: {
    badge: "bg-violet-400/15 text-violet-200 border-violet-400/30",
    panel: "border-violet-400/25 bg-violet-400/10",
    bar: "from-violet-400 to-violet-300",
    text: "text-violet-200",
  },
  blue: {
    badge: "bg-sky-400/15 text-sky-200 border-sky-400/30",
    panel: "border-sky-400/25 bg-sky-400/10",
    bar: "from-sky-400 to-sky-300",
    text: "text-sky-200",
  },
  rose: {
    badge: "bg-rose-400/15 text-rose-200 border-rose-400/30",
    panel: "border-rose-400/25 bg-rose-400/10",
    bar: "from-rose-400 to-rose-300",
    text: "text-rose-200",
  },
  slate: {
    badge: "bg-white/15 text-white/80 border-white/20",
    panel: "border-white/15 bg-white/10",
    bar: "from-white/70 to-white/30",
    text: "text-white/70",
  },
};

export function MetricCard({ label, value, hint, tone = "slate" }: { label: string; value: string; hint?: string; tone?: Tone }) {
  const style = toneClasses[tone];
  return (
    <div className={`rounded-2xl border p-4 ${style.panel}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold text-white">{value}</p>
      {hint ? <p className={`mt-1 text-sm ${style.text}`}>{hint}</p> : null}
    </div>
  );
}

export function InsightPanel({ title, icon: Icon, children, tone = "slate", action }: { title: string; icon: LucideIcon; children: ReactNode; tone?: Tone; action?: ReactNode }) {
  const style = toneClasses[tone];
  return (
    <section className={`rounded-3xl border p-5 ${style.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`grid h-9 w-9 place-items-center rounded-xl border ${style.badge}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-display text-base font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  const style = toneClasses[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}>{label}</span>;
}

export function ProgressBar({ label, value, tone = "emerald" }: { label: string; value: number; tone?: Tone }) {
  const style = toneClasses[tone];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-white/70">
        <span>{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10">
        <div className={`h-2.5 rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon, action }: { title: string; description: string; icon: LucideIcon; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/20 bg-black/20 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10">
        <Icon className="h-6 w-6 text-white/80" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/65">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function TimelineItem({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-400" />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">{status}</span>
        </div>
        <p className="mt-1 text-sm text-white/65">{detail}</p>
      </div>
    </div>
  );
}
