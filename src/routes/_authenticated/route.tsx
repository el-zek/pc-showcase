import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, Users, BarChart3, Settings,
  Bell, ShieldCheck, UserRound, LogOut, Building2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import desertSunsetBg from "@/assets/desert-sunset-bg.jpg";
import { MobileNav } from "@/components/mobile-nav";
import { BusinessScopeProvider, useBusinessScope } from "@/components/business-scope-provider";
import { ScopeGuard } from "@/components/scope-guard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedRoot,
});

const MODULES = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "sales", to: "/m/sales", label: "Sales", icon: ShoppingCart },
  { key: "crm", to: "/m/crm", label: "Customers & CRM", icon: UserRound },
  { key: "inventory", to: "/m/inventory", label: "Inventory", icon: Package },
  { key: "finance", to: "/m/finance", label: "Finance", icon: Wallet },
  { key: "compliance", to: "/m/compliance", label: "Compliance", icon: ShieldCheck },
  { key: "employees", to: "/m/employees", label: "Employees", icon: Users },
  { key: "reports", to: "/m/reports", label: "Reports", icon: BarChart3 },
  { key: "admin", to: "/m/admin", label: "Administration", icon: Settings },
] as const;

/** The authenticated shell is wrapped so navigation, pages and routes share one scope. */
function AuthedRoot() {
  return (
    <BusinessScopeProvider>
      <AuthedLayout />
    </BusinessScopeProvider>
  );
}

const HEADINGS: { match: string; title: string; subtitle: string }[] = [
  { match: "/dashboard", title: "Dashboard", subtitle: "Simplify your business." },
  { match: "/m/sales", title: "Sales", subtitle: "Simplify your business." },
  { match: "/m/crm", title: "Customers & CRM", subtitle: "Simplify your business." },
  { match: "/m/inventory", title: "Inventory", subtitle: "Simplify your business." },
  { match: "/m/finance", title: "Finance", subtitle: "Simplify your business." },
  { match: "/m/compliance", title: "Compliance", subtitle: "Simplify your business." },
  { match: "/m/tax", title: "Tax Management", subtitle: "Simplify your business." },
  { match: "/m/employees", title: "Employees", subtitle: "Simplify your business." },
  { match: "/m/reports", title: "Reports", subtitle: "Simplify your business." },
  { match: "/m/admin", title: "Administration", subtitle: "Simplify your business." },
];

function useHeading(pathname: string) {
  return (
    HEADINGS.find((h) => pathname === h.match || pathname.startsWith(h.match + "/")) ?? {
      title: "Workspace",
      subtitle: "Simplify your business.",
    }
  );
}


function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const heading = useHeading(pathname);
  const { moduleAllowed } = useBusinessScope();
  const modules = MODULES.filter((item) => moduleAllowed(item.key));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ["current-account"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("business_name, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      return {
        businessName: data?.business_name || data?.full_name || "My Business",
        owner: data?.full_name || "",
        phone: data?.phone || user.phone || "",
      };
    },
    staleTime: 60000,
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }


  const { data: alerts } = useQuery({
    queryKey: ["low-stock-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .lt("stock_quantity", 5);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });



  return (
    <div className="relative flex min-h-screen text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 left-0 z-0 bg-cover bg-[center_left] bg-no-repeat lg:left-72 xl:left-96"
        style={{
          backgroundImage: `url(${desertSunsetBg})`,
          backgroundAttachment: "scroll",
          filter: "brightness(0.72) saturate(0.92)",
        }}
      />
      {/* Tames the sun glare specifically */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 left-0 z-0 lg:left-72 xl:left-96"
        style={{
          background:
            "radial-gradient(60% 45% at 30% 42%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 75%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-y-0 right-0 left-0 z-0 bg-gradient-to-b from-black/40 via-black/45 to-black/65 lg:left-72 xl:left-96" />

      <aside className="relative z-10 sticky top-0 hidden h-screen w-72 xl:w-96 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl lg:flex">

        <div className="flex h-40 items-center justify-center border-b border-sidebar-border px-8 py-8">
          <img
            src="/logo.png"
            alt="BIZZ AUTOMATORS logo"
            className="h-55 w-45 rounded-3xl object-contain"
          />
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4 pb-4">
          {modules.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/dashboard" && pathname.startsWith(item.to)) ||
              (item.to === "/m/admin" && false);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-200 ease-out ${
                  active
                    ? "border-white/20 bg-white/15 text-foreground shadow-[0_10px_35px_rgba(255,255,255,0.12)] backdrop-blur-xl"
                    : "border-transparent bg-transparent text-sidebar-foreground/80 hover:border-white/10 hover:bg-white/10 hover:text-foreground hover:shadow-[0_8px_24px_rgba(255,255,255,0.08)] hover:backdrop-blur-md"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                    active
                      ? "bg-white/20 text-primary shadow-inner"
                      : "bg-white/5 text-sidebar-foreground/80 group-hover:bg-white/15 group-hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-400">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {account?.businessName ?? "Loading…"}
              </p>
              {account?.phone ? (
                <p className="truncate text-xs text-sidebar-foreground/70">{account.phone}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition hover:border-white/10 hover:bg-white/10 hover:text-foreground"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5">
              <LogOut className="h-4 w-4" />
            </span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div id="app-scroll" className="relative z-10 flex h-screen flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-50 overflow-hidden border-b border-white/5 px-4 py-4 backdrop-blur-xl md:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url(/header.png)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/45 to-black/60" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white md:text-base">
                {account?.businessName ?? heading.title}
              </p>
              <p className="truncate text-xs text-white/70">{heading.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button className="relative grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/80 transition hover:bg-white/10">
                <Bell className="h-4 w-4" />
                {alerts && alerts > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">{alerts}</span>
                ) : null}
              </button>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/80 transition hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-3 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-6">
          <div key={pathname} className="page-transition">
            <ScopeGuard>
              <Outlet />
            </ScopeGuard>
          </div>
        </main>

      </div>
      <MobileNav />
    </div>
  );
}
