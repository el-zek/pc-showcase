import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import welcomeBg from "@/assets/welcome-sunset.jpg";
import bizzLogo from "@/assets/bizz-logo.png";

export const WELCOME_SEEN_KEY = "bizz.welcome.seen";

/**
 * First-launch welcome layer. Sits above the auth screen as a physical card:
 * swiping the handle past ~85% pushes the card forward and reveals the
 * authentication layer behind it. Only transforms/opacity are animated.
 */
export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const update = () => {
      const track = trackRef.current;
      if (track) setSpan(Math.max(0, track.clientWidth - 56 - 8));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);


  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    setProgress(1);
    window.setTimeout(onComplete, 520);
  }, [done, onComplete]);

  const measure = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const handle = 56;
    const span = Math.max(1, rect.width - handle - 8);
    return Math.min(1, Math.max(0, (clientX - rect.left - handle / 2 - 4) / span));
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setProgress(measure(e.clientX));
    const up = (e: PointerEvent) => {
      setDragging(false);
      const p = measure(e.clientX);
      if (p >= 0.85) finish();
      else setProgress(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, finish]);

  const lift = done ? 1 : progress * 0.35;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden bg-[#120c08]"
      style={{
        transform: `translate3d(0, ${done ? "-8%" : "0"}, 0) scale(${1 + lift * 0.06})`,
        opacity: done ? 0 : 1,
        transition: dragging ? "none" : "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 460ms ease",
        willChange: "transform, opacity",
      }}
    >
      {/* Photograph */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${welcomeBg})`,
          transform: `translate3d(0, ${-progress * 14}px, 0) scale(${1.04 + progress * 0.03})`,
          transition: dragging ? "none" : "transform 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
      {/* Cinematic gradient overlay: light at top, deep at the bottom */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(18,12,8,0.30) 0%, rgba(18,12,8,0.22) 28%, rgba(16,10,6,0.62) 62%, rgba(12,8,5,0.92) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: "radial-gradient(120% 80% at 50% 120%, rgba(180,105,40,0.20), transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative flex h-full w-full items-end justify-center">
        <div
          className="flex w-full max-w-[430px] flex-col px-7"
          style={{
            paddingBottom: "calc(2.25rem + env(safe-area-inset-bottom))",
            transform: `translate3d(0, ${-progress * 10}px, 0)`,
            transition: dragging ? "none" : "transform 520ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <img
            src={bizzLogo}
            alt="Bizz Automators"
            className="h-12 w-auto opacity-95 drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
          />
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
            Simplify your
            <br />
            business.
          </h1>
          <p className="mt-4 max-w-[19rem] text-sm leading-relaxed text-white/60">
            Manage your business, customers and operations from one place.
          </p>

          {/* Swipe track */}
          <div
            ref={trackRef}
            className="relative mt-10 h-16 w-full rounded-full border border-white/12 bg-[rgba(32,20,12,0.45)] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            style={{ touchAction: "none" }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, rgba(190,120,45,0.10), rgba(214,158,74,0.28))",
                transition: dragging ? "none" : "width 420ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
            <span
              className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium tracking-wide text-white/70"
              style={{ opacity: 1 - progress * 0.9 }}
            >
              Slide to continue
            </span>
            <button
              type="button"
              aria-label="Slide to continue"
              onPointerDown={(e) => {
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                setDragging(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") finish();
              }}
              className="absolute grid h-14 w-14 cursor-grab place-items-center rounded-full border border-amber-200/40 bg-gradient-to-b from-amber-300 to-amber-500 text-[#1a1005] active:cursor-grabbing"
              style={{
                left: 4,
                top: 4,
                transform: `translate3d(${progress * span}px, 0, 0)`,
                boxShadow: `0 8px 26px -8px rgba(214,158,74,${0.45 + progress * 0.45})`,
                transition: dragging ? "none" : "transform 420ms cubic-bezier(0.22,1,0.36,1), box-shadow 300ms ease",
              }}


            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] uppercase tracking-[0.28em] text-white/30">
            Bizz Automators
          </p>
        </div>
      </div>
    </div>
  );
}
