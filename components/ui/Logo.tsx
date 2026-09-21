import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  variant = "mark",
  className,
  href = "#top",
  priority = false,
}: {
  variant?: "mark" | "full";
  className?: string;
  href?: string | null;
  priority?: boolean;
}) {
  const img =
    variant === "full" ? (
      <Image
        src="/logo-full.png"
        alt="VISION MTF — Multi Timeframe Trading"
        width={900}
        height={455}
        priority={priority}
        className={cn("h-auto w-full object-contain", className)}
      />
    ) : (
      <span className={cn("flex items-center gap-2.5", className)}>
        <Image
          src="/logo-mark.png"
          alt=""
          width={640}
          height={261}
          priority={priority}
          className="h-7 w-auto object-contain sm:h-8"
        />
        <span className="flex flex-col leading-none">
          <span className="text-[0.95rem] font-bold tracking-tight text-white sm:text-base">
            VISION<span className="text-neon"> MTF</span>
          </span>
          <span className="mt-0.5 text-[0.5rem] font-medium uppercase tracking-[0.22em] text-silver-dim">
            Multi Timeframe
          </span>
        </span>
      </span>
    );

  if (!href) return img;

  return (
    <Link
      href={href}
      aria-label="VISION MTF home"
      className="inline-flex shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/70"
    >
      {img}
    </Link>
  );
}
