import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, X, LogIn, UserPlus } from "lucide-react";
import welcomeBg from "@/assets/welcome-sunset.jpg";
import bizzLogo from "@/assets/bizz-logo.png";
import { WelcomeScreen, WELCOME_SEEN_KEY } from "@/components/auth/welcome-screen";
import { Celebration } from "@/components/auth/celebration";

import { BusinessProfileStep } from "@/components/auth/signup-scope-steps";
import { savePendingScope } from "@/lib/onboarding-scope";
import { EMPTY_CHARACTERISTICS, type BusinessCharacteristics } from "@/lib/business-scope";
import { formatPhone, isValidPhone, normalizePhone, phoneIdentity } from "@/lib/phone-auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Bizz Automators" },
      { name: "description", content: "Sign in to Bizz Automators to manage sales, customers, inventory and tax compliance in one place." },
      { property: "og:title", content: "Sign in · Bizz Automators" },
      { property: "og:description", content: "Access your Bizz Automators business workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-amber-400/60";

type Mode = "signin" | "signup" | null;

function AuthDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
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
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#0b0d12]/95 text-white shadow-[0_-30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 ease-out sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88vh] sm:-translate-x-1/2 sm:rounded-3xl sm:shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)] ${
          open
            ? "translate-y-0 sm:-translate-y-1/2 sm:scale-100 sm:opacity-100"
            : "translate-y-full sm:translate-y-[-46%] sm:scale-95 sm:opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/10 text-amber-300">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold leading-tight">{title}</h2>
            <p className="mt-0.5 text-sm text-white/55">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupStep, setSignupStep] = useState(1);
  const [characteristics, setCharacteristics] = useState<BusinessCharacteristics>({
    ...EMPTY_CHARACTERISTICS,
    flags: {},
  });
  const [busy, setBusy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const celebratingRef = useRef(false);
  const hasSessionRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      // First launch only: returning users go straight to sign in.
      if (window.localStorage.getItem(WELCOME_SEEN_KEY) !== "1") {
        setShowWelcome(true);
        setRevealed(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !celebratingRef.current) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && signupStep < 2) {
      if (signupStep === 1 && (!fullName.trim() || !isValidPhone(phone) || password.length < 6)) {
        toast.error("Enter your name, a valid phone number, and a password of at least 6 characters");
        return;
      }
      if (
        signupStep === 2 &&
        (!characteristics.name.trim() ||
          !characteristics.legalForm.trim() ||
          !characteristics.businessType.trim() ||
          !characteristics.sector.trim() ||
          characteristics.employeeCount === null ||
          characteristics.employeeCount < 0)
      ) {
        toast.error("Complete the required business profile fields");
        return;
      }
      setSignupStep((step) => step + 1);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        savePendingScope({ phone: normalizePhone(phone), characteristics, plan: "full" });
        celebratingRef.current = true;
        const { data, error } = await supabase.auth.signUp({
          email: phoneIdentity(phone),
          password,
          options: {
            data: {
              full_name: fullName,
              phone: normalizePhone(phone),
              business_name: characteristics.name,
              business_type: characteristics.businessType,
              legal_form: characteristics.legalForm,
              sector: characteristics.sector,
              employee_count: String(characteristics.employeeCount ?? ""),
              does_import: characteristics.doesImport,
              does_export: characteristics.doesExport,
              tax_registrations: characteristics.taxRegistrations,
            },
          },
        });
        if (error) {
          celebratingRef.current = false;
          throw error;
        }
        hasSessionRef.current = Boolean(data.session);
        setMode(null);
        setSignupStep(1);
        setCelebrate(true);
      } else {
        if (!isValidPhone(phone)) throw new Error("Enter a valid phone number");
        const { error } = await supabase.auth.signInWithPassword({
          email: phoneIdentity(phone),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div className="mb-5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            {["Account", "Business Profile"].map((label, index) => (
              <span key={label} className={signupStep === index + 1 ? "text-amber-300" : undefined}>
                {index + 1}. {label}
              </span>
            ))}
          </div>
        )}
        {mode === "signup" && signupStep === 1 && (
          <>
            <input
              className={inputCls}
              required
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className={inputCls}
              type="tel"
              inputMode="tel"
              required
              placeholder="Phone number (07XX XXX XXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className={inputCls}
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
        {mode === "signup" && signupStep === 2 && (
          <BusinessProfileStep
            value={characteristics}
            onChange={(patch) => setCharacteristics((current) => ({ ...current, ...patch }))}
          />
        )}
        {mode === "signin" && (
          <>
            <input
              className={inputCls}
              type="tel"
              inputMode="tel"
              required
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className={inputCls}
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
        {mode === "signup" && (
          <div className="flex gap-2 pt-2">
            {signupStep > 1 && (
              <button
                type="button"
                onClick={() => setSignupStep((step) => step - 1)}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {signupStep === 2 ? "Create account" : "Next"}
            </button>
          </div>
        )}
        {mode === "signin" && (
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        )}
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setSignupStep(1);
        }}
        className="mt-5 w-full text-center text-xs text-white/60 transition hover:text-white"
      >
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </>
  );

  return (
    <main className="relative grid min-h-screen place-items-end justify-center px-5 text-white sm:place-items-center">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${welcomeBg})`, transform: "scale(1.05)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(18,12,8,0.45) 0%, rgba(16,10,6,0.66) 55%, rgba(12,8,5,0.94) 100%)",
        }}
      />

      <div
        className="relative w-full max-w-[430px]"
        style={{
          paddingBottom: "calc(2.25rem + env(safe-area-inset-bottom))",
          paddingTop: "2rem",
          transform: revealed ? "translate3d(0,0,0)" : "translate3d(0, 24px, 0)",
          opacity: revealed ? 1 : 0,
          transition: "transform 620ms cubic-bezier(0.22,1,0.36,1), opacity 520ms ease",
        }}
      >
        <img
          src={bizzLogo}
          alt="Bizz Automators"
          className="h-11 w-auto opacity-95 drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
        />
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-white">
          Welcome
        </h1>
        <p className="mt-2 text-sm text-white/55">Simplify your business.</p>

        <div className="mt-7 space-y-3">
          <button
            onClick={() => setMode("signup")}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-200/25 bg-[rgba(46,29,16,0.55)] p-4 text-left backdrop-blur-xl transition hover:border-amber-200/45 hover:bg-[rgba(58,36,19,0.6)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-[#1a1005]">
              <UserPlus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Sign up</span>
              <span className="block text-xs text-white/50">Create your account</span>
            </span>
          </button>
          <button
            onClick={() => setMode("signin")}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-[rgba(24,16,11,0.5)] p-4 text-left backdrop-blur-xl transition hover:border-white/25 hover:bg-[rgba(32,21,14,0.6)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.07] text-amber-200">
              <LogIn className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Sign in</span>
              <span className="block text-xs text-white/50">Welcome back</span>
            </span>
          </button>
        </div>

        <p className="mt-7 text-center text-[11px] uppercase tracking-[0.28em] text-white/30">
          Bizz Automators
        </p>
      </div>

      <AuthDrawer
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "signup" ? "Create account" : "Sign in"}
        subtitle={mode === "signup" ? "Set up your business workspace" : "Welcome back to your workspace"}
        icon={mode === "signup" ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
      >
        {form}
      </AuthDrawer>

      {showWelcome && (
        <WelcomeScreen
          onComplete={() => {
            window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
            setShowWelcome(false);
            setRevealed(true);
          }}
        />
      )}

      {celebrate && (
        <Celebration
          title="Congratulations!"
          message={
            hasSessionRef.current
              ? "Your business account is ready. Let's get started."
              : "Your business account has been created. Sign in to continue."
          }
          actionLabel={hasSessionRef.current ? "Taking you to your dashboard…" : "Taking you to sign in…"}
          onDone={() => {
            celebratingRef.current = false;
            setCelebrate(false);
            if (hasSessionRef.current) {
              navigate({ to: "/dashboard", replace: true });
            } else {
              setPassword("");
              setMode("signin");
            }
          }}
        />
      )}
    </main>
  );

}
