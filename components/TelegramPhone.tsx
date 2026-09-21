"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Check, CheckCheck, Eye, Signal, Wifi, BatteryFull, Paperclip, Smile, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/** Telegram-style device frame used for the WAIT / EXECUTE mockups. */
export function TelegramPhone({
  children,
  status,
  accent = "neon",
  className,
}: {
  children: ReactNode;
  status: string;
  accent?: "neon" | "warn";
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[400px]", className)}>
      {/* device glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-6 rounded-[3rem] blur-2xl",
          accent === "neon"
            ? "bg-[radial-gradient(closest-side,rgba(0,255,136,0.18),transparent)]"
            : "bg-[radial-gradient(closest-side,rgba(255,176,32,0.14),transparent)]"
        )}
      />

      <div className="relative rounded-[2.4rem] border border-line-2 bg-gradient-to-b from-[#181818] to-[#0A0A0A] p-[10px] shadow-[0_50px_100px_-40px_rgba(0,0,0,1),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <div className="relative overflow-hidden rounded-[1.95rem] border border-black bg-[#080808]">
          {/* ---- status bar ---- */}
          <div className="relative flex items-center justify-between px-5 pb-1 pt-2.5 text-[0.62rem] font-semibold text-white/80">
            <span className="num">9:41</span>
            <span className="absolute left-1/2 top-1.5 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <Signal className="h-3 w-3" strokeWidth={2.5} />
              <Wifi className="h-3 w-3" strokeWidth={2.5} />
              <BatteryFull className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>

          {/* ---- channel header ---- */}
          <div className="flex items-center gap-3 border-b border-line bg-[#0D0D0D]/90 px-4 py-2.5 backdrop-blur">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-2 bg-black">
              <Image src="/logo-mark.png" alt="" width={640} height={261} className="h-4 w-auto object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[0.82rem] font-semibold text-white">VISION MTF · SIGNALS</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-neon" aria-hidden>
                  <path d="M12 2l2.4 1.8 3 .1.9 2.9 2.4 1.8-1 2.9 1 2.9-2.4 1.8-.9 2.9-3 .1L12 22l-2.4-1.8-3-.1-.9-2.9L3.3 15.4l1-2.9-1-2.9 2.4-1.8.9-2.9 3-.1L12 2z" />
                  <path d="M10.6 15.2l-2.8-2.8 1.1-1.1 1.7 1.7 4-4 1.1 1.1-5.1 5.1z" fill="#000" />
                </svg>
              </div>
              <p
                className={cn(
                  "truncate text-[0.62rem]",
                  accent === "neon" ? "text-neon" : "text-warn"
                )}
              >
                {status}
              </p>
            </div>
            <span className="num shrink-0 rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 text-[0.55rem] text-silver-dim">
              12.4K
            </span>
          </div>

          {/* ---- messages ---- */}
          <div className="dot-bg relative space-y-2.5 bg-[#050505] px-3 py-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.05),transparent_60%)]" />
            {children}
          </div>

          {/* ---- composer ---- */}
          <div className="flex items-center gap-2.5 border-t border-line bg-[#0D0D0D] px-4 py-2.5">
            <Paperclip className="h-4 w-4 text-silver-deep" strokeWidth={2} />
            <span className="flex-1 text-[0.7rem] text-silver-deep">Channel · broadcast only</span>
            <Smile className="h-4 w-4 text-silver-deep" strokeWidth={2} />
            <Mic className="h-4 w-4 text-silver-deep" strokeWidth={2} />
          </div>

          {/* home indicator */}
          <div className="flex justify-center bg-[#0D0D0D] pb-1.5">
            <span className="h-[3px] w-24 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single broadcast bubble. */
export function Bubble({
  children,
  time,
  views = "11.2K",
  accent = "neon",
  className,
}: {
  children: ReactNode;
  time: string;
  views?: string;
  accent?: "neon" | "warn";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl rounded-tl-md border bg-[#101010]/95 p-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,1)] backdrop-blur-sm",
        accent === "neon" ? "border-neon/25" : "border-warn/25",
        className
      )}
    >
      {children}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[0.58rem] text-silver-deep">
        <Eye className="h-2.5 w-2.5" strokeWidth={2.5} />
        <span className="num">{views}</span>
        <span className="num">{time}</span>
        <CheckCheck className="h-3 w-3 text-neon/70" strokeWidth={2.5} />
      </div>
    </div>
  );
}

export { Check };
