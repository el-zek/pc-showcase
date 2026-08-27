import { useEffect, useRef, useState } from "react";
import { Loader2, PartyPopper } from "lucide-react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: "rect" | "circle";
};

const COLORS = ["#fbbf24", "#f59e0b", "#fb923c", "#f472b6", "#a78bfa", "#34d399", "#fde68a", "#ffffff"];

/**
 * Full-screen celebration: a gift box pops open, showering confetti,
 * followed by new-year style firework bursts.
 */
export function Celebration({
  title = "Congratulations!",
  message = "Your account is ready.",
  actionLabel = "Continue",
  autoDoneMs = 4200,
  onDone,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  autoDoneMs?: number;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [burst, setBurst] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => setBurst(true), 520);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!autoDoneMs) return;
    const t = window.setTimeout(() => doneRef.current(), autoDoneMs);
    return () => window.clearTimeout(t);
  }, [autoDoneMs]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const spawn = (x: number, y: number, count: number, power: number, upward: boolean) => {
      for (let i = 0; i < count; i++) {
        const angle = upward ? rand(-Math.PI * 0.9, -Math.PI * 0.1) : rand(0, Math.PI * 2);
        const speed = rand(power * 0.35, power);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: rand(70, 150),
          size: rand(4, 10),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.25, 0.25),
          shape: Math.random() > 0.45 ? "rect" : "circle",
        });
      }
    };

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    // Gift box explosion from the centre.
    const timers: number[] = [];
    timers.push(window.setTimeout(() => spawn(w() / 2, h() * 0.48, 180, 17, true), 520));
    timers.push(window.setTimeout(() => spawn(w() / 2, h() * 0.48, 90, 11, false), 640));

    // Ongoing fireworks, new-year style.
    const firework = window.setInterval(() => {
      spawn(rand(w() * 0.15, w() * 0.85), rand(h() * 0.12, h() * 0.5), 70, 13, false);
    }, 850);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w(), h());
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0 || p.y > h() + 60) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(firework);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#0b0705]/92 px-6 backdrop-blur-md">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      <div className="relative flex flex-col items-center text-center">
        {/* Gift box */}
        <div className="relative h-28 w-28">
          <div
            className="absolute inset-x-0 bottom-0 h-20 rounded-b-2xl rounded-t-md border border-amber-200/40 shadow-[0_20px_60px_-20px_rgba(251,191,36,0.7)]"
            style={{
              background: "linear-gradient(160deg, #b45309, #7c2d12)",
              transform: burst ? "scale(1.04)" : "scale(1)",
              transition: "transform 400ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-gradient-to-b from-amber-300 to-amber-500" />
          </div>
          <div
            className="absolute inset-x-[-6px] top-2 h-8 rounded-lg border border-amber-200/50 bg-gradient-to-b from-amber-300 to-amber-500"
            style={{
              transform: burst
                ? "translate3d(0,-120px,0) rotate(-24deg)"
                : "translate3d(0,0,0) rotate(0deg)",
              opacity: burst ? 0 : 1,
              transition: "transform 900ms cubic-bezier(0.16,1,0.3,1), opacity 900ms ease",
            }}
          >
            <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-amber-200/70" />
          </div>
        </div>

        <div
          className="mt-8 flex flex-col items-center"
          style={{
            opacity: burst ? 1 : 0,
            transform: burst ? "translate3d(0,0,0)" : "translate3d(0,16px,0)",
            transition: "opacity 600ms ease 260ms, transform 600ms cubic-bezier(0.22,1,0.36,1) 260ms",
          }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/10 text-amber-300">
            <PartyPopper className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-white">{title}</h2>
          <p className="mt-2 max-w-xs text-sm text-white/60">{message}</p>
          <button
            onClick={onDone}
            className="mt-7 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-6 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {actionLabel}
          </button>

        </div>
      </div>
    </div>
  );
}
