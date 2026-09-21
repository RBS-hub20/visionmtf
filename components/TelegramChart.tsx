"use client";

import { motion } from "framer-motion";

/**
 * The chart image that ships inside the WAIT alert:
 * price parked in premium, the 4H discount order block marked below,
 * and a projected path into the zone the AI is waiting for.
 */

type Candle = [open: number, high: number, low: number, close: number];

const CANDLES: Candle[] = [
  [2634, 2638, 2632, 2637],
  [2637, 2641, 2635, 2640],
  [2640, 2643, 2638, 2639],
  [2639, 2645, 2638, 2644],
  [2644, 2648, 2643, 2647],
  [2647, 2649, 2644, 2645],
  [2645, 2651, 2644, 2650],
  [2650, 2654, 2649, 2653],
  [2653, 2656, 2651, 2652],
  [2652, 2658, 2651, 2657],
  [2657, 2660, 2655, 2656],
  [2656, 2659, 2653, 2654],
  [2654, 2658, 2653, 2657],
  [2657, 2659, 2654, 2655],
  [2655, 2658, 2653, 2656],
  [2656, 2657, 2652, 2654],
  [2654, 2657, 2653, 2656],
  [2656, 2658, 2654, 2655],
];

const LOW = 2625;
const HIGH = 2665;
const TOP_Y = 16;
const BOT_Y = 160;

const y = (p: number) => BOT_Y - ((p - LOW) / (HIGH - LOW)) * (BOT_Y - TOP_Y);

const X0 = 16;
const STEP = 13;
const BODY_W = 7;

export function TelegramChart() {
  return (
    <svg
      viewBox="0 0 320 180"
      className="w-full"
      role="img"
      aria-label="XAUUSD 4 hour chart: price in the premium zone at 2655 with the discount order block marked at 2635"
    >
      <defs>
        <linearGradient id="tg-ob" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00FF88" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#00FF88" stopOpacity="0.10" />
        </linearGradient>
        <marker id="tg-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 1 L9 5 L0 9 z" fill="#FFB020" />
        </marker>
      </defs>

      <rect x="0" y="0" width="320" height="180" rx="10" fill="#060606" />

      {/* grid */}
      <g stroke="#141414" strokeWidth="1">
        {[40, 76, 112, 148].map((gy) => (
          <line key={gy} x1="8" y1={gy} x2="312" y2={gy} />
        ))}
      </g>

      {/* premium zone */}
      <rect x="8" y={y(2665)} width="304" height={y(2652) - y(2665)} fill="#FF4D4D" opacity="0.06" />
      <line x1="8" y1={y(2652)} x2="312" y2={y(2652)} stroke="#FF4D4D" strokeWidth="1" strokeDasharray="3 5" opacity="0.4" />
      <text x="12" y={y(2665) + 11} fontSize="7.5" fontWeight="700" fill="#FF6B6B" letterSpacing="1.4">
        PREMIUM
      </text>

      {/* equilibrium */}
      <line x1="8" y1={y(2645)} x2="312" y2={y(2645)} stroke="#2A2A2A" strokeWidth="1" strokeDasharray="2 6" />
      <text x="312" y={y(2645) - 4} textAnchor="end" fontSize="6.5" fill="#5A5A5A" letterSpacing="1.2">
        EQUILIBRIUM 50%
      </text>

      {/* 4H order block — the zone being waited for */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <rect x="8" y={y(2638)} width="304" height={y(2632) - y(2638)} fill="url(#tg-ob)" stroke="#00FF88" strokeOpacity="0.55" strokeWidth="1" />
        <rect x="10" y={y(2638) + 2} width="74" height="13" rx="3" fill="#00190F" stroke="#0C4A2E" />
        <text x="47" y={y(2638) + 11.5} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#00FF88" letterSpacing="0.9">
          4H OB · DISCOUNT
        </text>
        <text x="312" y={y(2635) + 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#00FF88" className="font-mono">
          2635.00
        </text>
      </motion.g>

      {/* candles */}
      {CANDLES.map((c, i) => {
        const [o, h, l, cl] = c;
        const up = cl >= o;
        const color = up ? "#00FF88" : "#FF5C5C";
        const cx = X0 + i * STEP;
        const top = y(Math.max(o, cl));
        const bh = Math.max(1.6, Math.abs(y(o) - y(cl)));
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.028 }}
          >
            <line x1={cx} y1={y(h)} x2={cx} y2={y(l)} stroke={color} strokeWidth="1" opacity="0.85" />
            <rect
              x={cx - BODY_W / 2}
              y={top}
              width={BODY_W}
              height={bh}
              fill={up ? color : "#0B0B0B"}
              stroke={color}
              strokeWidth="1"
              rx="0.8"
            />
          </motion.g>
        );
      })}

      {/* current price */}
      <line x1="8" y1={y(2655)} x2="312" y2={y(2655)} stroke="#FFB020" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
      <rect x="258" y={y(2655) - 8} width="54" height="16" rx="4" fill="#FFB020" />
      <text x="285" y={y(2655) + 3.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#000" className="font-mono">
        2655.40
      </text>

      {/* projection into the OB */}
      <motion.path
        d={`M ${X0 + 17 * STEP} ${y(2655)} C 262 ${y(2652)}, 268 ${y(2642)}, 278 ${y(2637)}`}
        fill="none"
        stroke="#FFB020"
        strokeWidth="1.4"
        strokeDasharray="3 4"
        markerEnd="url(#tg-arrow)"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.9 }}
      />

      {/* waiting stamp */}
      <g opacity="0.9">
        <rect x="112" y="6" width="96" height="17" rx="5" fill="#161000" stroke="#4A3708" />
        <circle cx="124" cy="14.5" r="3" fill="#FFB020">
          <animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <text x="133" y="18" fontSize="8.5" fontWeight="700" fill="#FFB020" letterSpacing="1.2">
          WAITING · 68%
        </text>
      </g>

      {/* footer meta */}
      <text x="12" y="174" fontSize="7" fill="#4A4A4A" letterSpacing="1">
        XAUUSD · 4H
      </text>
      <text x="312" y="174" textAnchor="end" fontSize="7" fill="#4A4A4A" letterSpacing="1">
        VISION MTF ENGINE
      </text>
    </svg>
  );
}
