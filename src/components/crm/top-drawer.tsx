import { Users, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function TopDrawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[100] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute inset-x-0 top-0 mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-3xl border border-white/10 bg-[#0b0d12] text-white shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/10">
            <Users className="h-5 w-5 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-bold leading-tight">{title}</h3>
            <p className="mt-0.5 text-sm text-white/55">Fill in the details below</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] bg-black/40 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder-white/35 outline-none focus:border-amber-300/50";
