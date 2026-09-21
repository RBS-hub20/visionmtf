import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        ink: "#000000",
        card: "#111111",
        "card-2": "#0A0A0A",
        line: "#1F1F1F",
        "line-2": "#2A2A2A",
        neon: {
          DEFAULT: "#00FF88",
          dim: "#00C26A",
          deep: "#00361F",
        },
        silver: {
          DEFAULT: "#C0C0C0",
          dim: "#8A8A8A",
          deep: "#3A3A3A",
        },
        danger: "#FF4D4D",
        warn: "#FFB020",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        ultra: "0.28em",
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(0,255,136,0.35), 0 0 24px -4px rgba(0,255,136,0.45)",
        "neon-lg": "0 0 0 1px rgba(0,255,136,0.5), 0 0 60px -10px rgba(0,255,136,0.65)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -30px rgba(0,0,0,0.9)",
        lift: "0 30px 80px -40px rgba(0,0,0,1)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,255,136,0.10), transparent 70%)",
        "silver-text":
          "linear-gradient(180deg,#FFFFFF 0%,#E8E8E8 38%,#9E9E9E 62%,#EDEDED 100%)",
        "neon-text": "linear-gradient(180deg,#9DFFD0 0%,#00FF88 50%,#00A85C 100%)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "70%": { transform: "scale(1.9)", opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(320%)" },
        },
        "scan-y": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { transform: "translateY(2400%)", opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.25,0.9,0.35,1) infinite",
        shimmer: "shimmer 2.6s ease-in-out infinite",
        "scan-y": "scan-y 5s linear infinite",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 34s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        blink: "blink 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
