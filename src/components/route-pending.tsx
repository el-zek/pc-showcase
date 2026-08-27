export function RoutePending() {
  return (
    <div className="mx-auto max-w-md animate-pulse space-y-4 md:max-w-6xl" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded-lg bg-white/10" />
          <div className="h-3 w-28 rounded-lg bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-white/8 bg-white/[0.04]" />
        ))}
      </div>
      <div className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-xl bg-white/[0.05]" />
        ))}
      </div>
    </div>
  );
}
