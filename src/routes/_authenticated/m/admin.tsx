import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Users,
  Shield,

  Settings as SettingsIcon,
  Activity,
  ChevronRight,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/m/admin")({ component: AdminHub });

function AdminHub() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isNested = pathname !== "/m/admin" && pathname.startsWith("/m/admin/");

  if (isNested) {
    return <Outlet />;
  }

  const cards = [
    { label: "Users", icon: Users, to: "/m/admin/users" },
    { label: "Roles", icon: Shield, to: "/m/admin/roles" },
    { label: "Settings", icon: SettingsIcon, to: "/m/admin/settings" },
  ];

  const moreItems = [
    { label: "Activity Logs", icon: Activity, to: "/m/admin/activity-logs" },
    { label: "Security", icon: Lock, to: "/m/admin/security" },
  ];

  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden text-white">
      <div className="mx-auto max-w-md md:max-w-6xl px-5 md:px-10 pb-28 md:pb-12 pt-6 md:pt-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Administration</h1>
            <p className="text-sm text-white/80">System configuration</p>
          </div>
        </div>

        {/* Main Cards - Icon Only - Glass Effect */}
        <div className="mt-8 md:mt-12 grid grid-cols-3 gap-4 md:gap-8">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="group flex flex-col items-center gap-3 md:gap-4 transition hover:scale-110"
            >
              <div className="grid h-16 w-16 md:h-28 md:w-28 place-items-center rounded-2xl md:rounded-3xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20">
                <c.icon className="h-6 w-6 md:h-10 md:w-10 text-amber-400" />
              </div>
              <span className="text-center text-[11px] md:text-sm font-semibold text-white">
                {c.label}
              </span>
            </Link>
          ))}
        </div>

        {/* More Items Section - Glass */}
        <div className="mt-8 rounded-3xl border border-white/30 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">More</h2>
          </div>
          <div className="mt-3 h-px bg-white/20" />
          <ul className="mt-2 divide-y divide-white/20">
            {moreItems.map((t) => (
              <li key={t.label}>
                <Link
                  to={t.to}
                  className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                    <t.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="flex-1 text-[15px] text-white font-medium">{t.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
