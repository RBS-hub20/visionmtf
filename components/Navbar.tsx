"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { nav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Logo } from "./ui/Logo";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // lock body scroll while the mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "transition-all duration-300",
          scrolled
            ? "border-b border-line bg-black/70 backdrop-blur-xl supports-[backdrop-filter]:bg-black/55"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <nav className="container flex h-[68px] items-center justify-between gap-4">
          {/* Left — logo */}
          <Logo priority />

          {/* Center — links */}
          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group relative rounded-lg px-3.5 py-2 text-sm font-medium text-silver transition-colors hover:text-white"
                >
                  {item.label}
                  <span className="absolute inset-x-3.5 -bottom-px h-px scale-x-0 bg-gradient-to-r from-transparent via-neon to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Right — CTA */}
          <div className="flex items-center gap-2">
            <Link href="#pricing" className="btn-neon hidden text-sm sm:inline-flex">
              Join Private Access
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-silver transition-colors hover:text-white lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden"
          >
            <div className="border-b border-line bg-black/95 px-5 pb-6 pt-3 backdrop-blur-xl">
              <ul className="flex flex-col">
                {nav.map((item) => (
                  <li key={item.href} className="border-b border-line/70 last:border-0">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between py-4 text-base font-medium text-silver transition-colors hover:text-neon"
                    >
                      {item.label}
                      <ArrowUpRight className="h-4 w-4 opacity-50" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="#pricing"
                onClick={() => setOpen(false)}
                className="btn-neon mt-5 w-full"
              >
                Join Private Access
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
