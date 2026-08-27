import { Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import sunsetBg from "@/assets/sunset-bg.jpg";
import {
  Home, ShoppingCart, Scan, Package, MoreHorizontal, ChevronRight, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

export type TaxCard = { label: string; icon: LucideIcon; onClick?: () => void; to?: string };
export type TaxListItem = { label: string; icon: LucideIcon; onClick?: () => void; to?: string };

export function TaxLayout({
  title,
  subtitle,
  headerIcon: HeaderIcon,
  cards = [],
  sections = [],
  children,
  backTo,
  onBack,
  showBottomNav = true,
}: {
  title: string;
  subtitle: string;
  headerIcon: LucideIcon;
  cards?: TaxCard[];
  sections?: { title: string; icon: LucideIcon; items: TaxListItem[] }[];
  children?: React.ReactNode;
  backTo?: string;
  onBack?: () => void;
  showBottomNav?: boolean;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (backTo) {
      navigate({ to: backTo });
    }
  };

  return (
    <div
      className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden text-white"
    >
      <div className="mx-auto max-w-md md:max-w-6xl px-5 md:px-10 pb-28 md:pb-12 pt-6 md:pt-10">
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/20 bg-black/25 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:px-8"
          style={{ backgroundImage: `url(${sunsetBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
          <div className="relative flex items-center gap-3">
          {(backTo || onBack) && (
            <button
              type="button"
              onClick={handleBack}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20">
            <HeaderIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-white/80">{subtitle}</p>
          </div>
          </div>
        </div>

        {cards.length > 0 && (
          <div className="mt-8 md:mt-12 grid grid-cols-4 gap-4 md:gap-8">
            {cards.map((c) => {
              const cardContent = (
                <>
                  <div className="grid h-16 w-16 md:h-28 md:w-28 place-items-center rounded-2xl md:rounded-3xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20">
                    <c.icon className="h-6 w-6 md:h-10 md:w-10 text-amber-400" />
                  </div>
                  <span className="text-center text-[11px] md:text-sm font-semibold text-white">{c.label}</span>
                </>
              );

              if (c.to) {
                return (
                  <Link
                    key={c.label}
                    to={c.to}
                    className="group flex flex-col items-center gap-3 md:gap-4 transition hover:scale-110"
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <button
                  key={c.label}
                  onClick={() => (c.onClick ? c.onClick() : toast.info(`${c.label} — coming soon`))}
                  className="group flex flex-col items-center gap-3 md:gap-4 transition hover:scale-110"
                >
                  {cardContent}
                </button>
              );
            })}
          </div>
        )}

        {sections.map((sec) => (
          <div
            key={sec.title}
            className="mt-8 rounded-3xl border border-white/30 bg-white/10 backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
                <sec.icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">{sec.title}</h2>
            </div>
            <div className="mt-3 h-px bg-white/20" />
            <ul className="mt-2 divide-y divide-white/20">
              {sec.items.map((t) => {
                const content = (
                  <>
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                      <t.icon className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="flex-1 text-[15px] text-white font-medium">{t.label}</span>
                    <ChevronRight className="h-4 w-4 text-white/60" />
                  </>
                );

                if (t.to) {
                  return (
                    <li key={t.label}>
                      <Link to={t.to} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10">
                        {content}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={t.label}>
                    <button
                      onClick={() => (t.onClick ? t.onClick() : toast.info(`${t.label} — coming soon`))}
                      className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10"
                    >
                      {content}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {children}
      </div>

    </div>
  );
}

