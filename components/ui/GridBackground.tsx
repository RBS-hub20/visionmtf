import { cn } from "@/lib/utils";

/** Fixed page-wide grid + radial glow. Sits behind everything. */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
    >
      {/* base grid */}
      <div className="grid-bg absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_90%_70%_at_50%_0%,#000_20%,transparent_85%)]" />
      {/* horizon glow */}
      <div className="absolute left-1/2 top-[-22rem] h-[44rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.16),transparent)] blur-[10px]" />
      {/* side ambience */}
      <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.07),transparent)]" />
      <div className="absolute -right-40 top-2/3 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(192,192,192,0.06),transparent)]" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_40%,transparent_40%,rgba(0,0,0,0.85))]" />
    </div>
  );
}
