import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_10px_2px_rgba(0,255,136,0.7)]" />
            <span className="eyebrow text-silver">{eyebrow}</span>
          </span>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2
          className={cn(
            "balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-[3.25rem]",
            align === "center" ? "mx-auto max-w-4xl" : "max-w-3xl"
          )}
        >
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={0.1}>
          <p
            className={cn(
              "pretty text-base leading-relaxed text-silver-dim sm:text-lg",
              align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"
            )}
          >
            {subtitle}
          </p>
        </Reveal>
      )}
    </div>
  );
}
