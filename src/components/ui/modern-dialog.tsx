import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogClose } from "@radix-ui/react-dialog";

/* Shared visual language for every drawer/dialog in the app. */

export const panelLabelCls = "text-[11px] font-medium uppercase tracking-[0.16em] text-white/55";

export const panelControlCls =
  "mt-1.5 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-amber-300/50 focus-visible:ring-0";

export const panelSectionCls = "rounded-2xl border border-white/10 bg-white/[0.03] p-4";

export function ModernDialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  size = "xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "xl" | "2xl";
}) {
  const width = size === "sm" ? "sm:max-w-md" : size === "2xl" ? "sm:max-w-2xl" : "sm:max-w-xl";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={`flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d12] p-0 text-white shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] [&>button:last-child]:hidden ${width}`}
      >
        <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4 text-left">
          {Icon ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/10">
              <Icon className="h-5 w-5 text-amber-300" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-bold leading-tight tracking-tight text-white">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-0.5 text-sm text-white/55">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
          <DialogClose className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/15 hover:text-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] bg-black/40 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
