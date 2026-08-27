import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Clock } from "lucide-react";

export type HubItem = {
  label: string;
  desc: string;
  icon: LucideIcon;
  to?: string;
  comingSoon?: boolean;
};

export function ModuleHub({
  items,
}: {
  items: HubItem[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/20 backdrop-blur border border-white/30 text-white">
                <Icon className="h-5 w-5" />
              </div>
              {item.comingSoon ? (
                <span className="flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70 border border-white/20">
                  <Clock className="h-3 w-3" /> Soon
                </span>
              ) : (
                <ArrowRight className="h-4 w-4 text-white/60 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
            <h3 className="mt-4 font-display text-base font-semibold text-white">{item.label}</h3>
            <p className="mt-1 text-xs text-white/70">{item.desc}</p>
          </>
        );

        const cls =
          "group relative block rounded-xl border border-white/30 bg-white/10 backdrop-blur-xl p-5 text-left transition-all hover:bg-white/20 hover:border-white/40 hover:shadow-lg hover:shadow-white/10";

        if (item.comingSoon || !item.to) {
          return (
            <button
              key={item.label}
              onClick={() => toast.info(`${item.label} — coming soon`)}
              className={`${cls} cursor-pointer`}
            >
              {content}
            </button>
          );
        }
        return (
          <Link key={item.label} to={item.to} className={cls}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
