"use client";

import { motion, useReducedMotion } from "framer-motion";
import { timeframes } from "@/lib/site";
import { sparkPoints } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

const CARD_X = 4;
const CARD_W = 208;
const CARD_H = 96;
const CARD_YS = [34, 148, 262, 376, 490];

const HUB_X = 472;
const HUB_Y = 310;
const R_OUTER = 102;
const R_PROG = 88;
const R_INNER = 74;

const CONFIDENCE = 92;
const PROG_C = 2 * Math.PI * R_PROG;

/** Where each connector lands on the hub circle (degrees). */
const LAND_ANGLES = [215, 195, 180, 165, 145];

const STATE_COLOR: Record<string, string> = {
  bullish: "#00FF88",
  neutral: "#FFB020",
  bearish: "#FF4D4D",
};

function landing(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: HUB_X + R_OUTER * Math.cos(rad),
    y: HUB_Y + R_OUTER * Math.sin(rad),
  };
}

const connectors = CARD_YS.map((y, i) => {
  const startX = CARD_X + CARD_W;
  const startY = y + CARD_H / 2;
  const end = landing(LAND_ANGLES[i]);
  return {
    id: `vmtf-path-${i}`,
    d: `M ${startX} ${startY} C ${startX + 92} ${startY}, ${end.x - 58} ${end.y}, ${end.x} ${end.y}`,
    color: STATE_COLOR[timeframes[i].state],
  };
});

/* ------------------------------------------------------------------ */

export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative">
      {/* ambient glow behind the hub */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[4%] top-1/2 h-[58%] w-[58%] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.20),transparent)] blur-2xl"
      />

      <svg
        viewBox="0 0 640 620"
        role="img"
        aria-label="Five timeframes — Weekly, Daily, 4 Hour, 1 Hour and 15 Minute — converging into the VISION MTF engine at 92 percent confidence"
        className="relative w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
      >
        <defs>
          <linearGradient id="vmtf-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#141414" />
            <stop offset="100%" stopColor="#0A0A0A" />
          </linearGradient>

          <linearGradient id="vmtf-hub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151515" />
            <stop offset="100%" stopColor="#050505" />
          </linearGradient>

          <linearGradient id="vmtf-prog" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="55%" stopColor="#5CFFB9" />
            <stop offset="100%" stopColor="#00A85C" />
          </linearGradient>

          <linearGradient id="vmtf-spark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00FF88" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00FF88" stopOpacity="1" />
          </linearGradient>

          <filter id="vmtf-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="vmtf-glow-sm" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id="vmtf-hub-clip">
            <circle cx={HUB_X} cy={HUB_Y} r={R_INNER} />
          </clipPath>
        </defs>

        {/* ---------------- connectors ---------------- */}
        <g>
          {connectors.map((c, i) => (
            <g key={c.id}>
              <motion.path
                id={c.id}
                d={c.d}
                fill="none"
                stroke={c.color}
                strokeOpacity={0.22}
                strokeWidth={1.4}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: reduce ? 0 : 1.1,
                  delay: reduce ? 0 : 0.5 + i * 0.12,
                  ease: "easeOut",
                }}
              />
              {!reduce && (
                <circle r={2.6} fill={c.color} filter="url(#vmtf-glow-sm)">
                  <animateMotion
                    dur={`${2.6 + i * 0.35}s`}
                    begin={`${i * 0.45}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1"
                  >
                    <mpath href={`#${c.id}`} />
                  </animateMotion>
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.8;1"
                    dur={`${2.6 + i * 0.35}s`}
                    begin={`${i * 0.45}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          ))}
        </g>

        {/* ---------------- timeframe cards ---------------- */}
        {timeframes.map((tf, i) => {
          const y = CARD_YS[i];
          const color = STATE_COLOR[tf.state];
          return (
            <motion.g
              key={tf.key}
              initial={{ opacity: 0, x: -26 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: reduce ? 0 : 0.6,
                delay: reduce ? 0 : 0.15 + i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <rect
                x={CARD_X}
                y={y}
                width={CARD_W}
                height={CARD_H}
                rx={14}
                fill="url(#vmtf-card)"
                stroke="#1F1F1F"
              />
              {/* left accent bar */}
              <rect x={CARD_X} y={y + 22} width={2.5} height={CARD_H - 44} rx={2} fill={color} opacity={0.75} />

              {/* timeframe badge */}
              <rect x={CARD_X + 16} y={y + 15} width={40} height={26} rx={7} fill="#000" stroke="#242424" />
              <text
                x={CARD_X + 36}
                y={y + 32.5}
                textAnchor="middle"
                className="fill-white font-mono"
                fontSize="12.5"
                fontWeight="700"
              >
                {tf.key}
              </text>

              {/* label + role */}
              <text x={CARD_X + 66} y={y + 27} fontSize="10.5" fontWeight="600" fill="#C0C0C0" letterSpacing="1.6">
                {tf.label}
              </text>
              <text x={CARD_X + 66} y={y + 39.5} fontSize="9" fill="#6E6E6E" letterSpacing="0.4">
                {tf.role}
              </text>

              {/* sparkline */}
              <g transform={`translate(${CARD_X + 16}, ${y + 50})`}>
                <motion.polyline
                  points={sparkPoints(tf.spark, 104, 34, 3)}
                  fill="none"
                  stroke="url(#vmtf-spark)"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: reduce ? 0 : 1.2,
                    delay: reduce ? 0 : 0.5 + i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              </g>

              {/* read-out */}
              <circle cx={CARD_X + 136} cy={y + 68} r={2.8} fill={color}>
                {!reduce && (
                  <animate
                    attributeName="opacity"
                    values="1;0.25;1"
                    dur="2s"
                    begin={`${i * 0.3}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
              <text
                x={CARD_X + 145}
                y={y + 71.5}
                fontSize="9"
                fontWeight="700"
                fill={color}
                letterSpacing="0.6"
              >
                {tf.read}
              </text>
            </motion.g>
          );
        })}

        {/* ---------------- hub ---------------- */}
        <motion.g
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduce ? 0 : 0.8,
            delay: reduce ? 0 : 0.85,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ transformOrigin: `${HUB_X}px ${HUB_Y}px` }}
        >
          {/* rotating dashed ring */}
          <g style={{ transformOrigin: `${HUB_X}px ${HUB_Y}px` }}>
            <motion.circle
              cx={HUB_X}
              cy={HUB_Y}
              r={R_OUTER}
              fill="none"
              stroke="#1F1F1F"
              strokeWidth={1}
              strokeDasharray="3 9"
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${HUB_X}px ${HUB_Y}px` }}
            />
          </g>

          {/* progress track + value */}
          <circle cx={HUB_X} cy={HUB_Y} r={R_PROG} fill="none" stroke="#161616" strokeWidth={5} />
          <motion.circle
            cx={HUB_X}
            cy={HUB_Y}
            r={R_PROG}
            fill="none"
            stroke="url(#vmtf-prog)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={PROG_C}
            filter="url(#vmtf-glow)"
            transform={`rotate(-90 ${HUB_X} ${HUB_Y})`}
            initial={{ strokeDashoffset: PROG_C }}
            animate={{ strokeDashoffset: PROG_C * (1 - CONFIDENCE / 100) }}
            transition={{
              duration: reduce ? 0 : 1.6,
              delay: reduce ? 0 : 1.1,
              ease: [0.22, 1, 0.36, 1],
            }}
          />

          {/* inner disc */}
          <circle cx={HUB_X} cy={HUB_Y} r={R_INNER} fill="url(#vmtf-hub)" stroke="#1F1F1F" />
          <g clipPath="url(#vmtf-hub-clip)" opacity={0.5}>
            <circle cx={HUB_X} cy={HUB_Y + 62} r={62} fill="#00FF88" opacity={0.10} />
          </g>

          {/* logo mark */}
          <image
            href="/logo-mark.png"
            x={HUB_X - 48}
            y={HUB_Y - 54}
            width={96}
            height={39}
            preserveAspectRatio="xMidYMid meet"
          />

          <text
            x={HUB_X}
            y={HUB_Y + 16}
            textAnchor="middle"
            fontSize="34"
            fontWeight="700"
            fill="#FFFFFF"
            className="font-mono"
          >
            {CONFIDENCE}
            <tspan fontSize="18" fill="#00FF88">
              %
            </tspan>
          </text>
          <text
            x={HUB_X}
            y={HUB_Y + 36}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="600"
            fill="#6E6E6E"
            letterSpacing="3"
          >
            CONFIDENCE
          </text>
          <line x1={HUB_X - 26} y1={HUB_Y + 46} x2={HUB_X + 26} y2={HUB_Y + 46} stroke="#1F1F1F" />
          <text
            x={HUB_X}
            y={HUB_Y + 59}
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="#00FF88"
            letterSpacing="1.4"
          >
            5 / 5 TIMEFRAMES
          </text>
        </motion.g>

        {/* ---------------- hub caption ---------------- */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 1.5 }}
        >
          <rect x={HUB_X - 112} y={HUB_Y + 128} width={224} height={34} rx={10} fill="#0A0A0A" stroke="#1F1F1F" />
          <circle cx={HUB_X - 92} cy={HUB_Y + 145} r={3.2} fill="#00FF88">
            {!reduce && (
              <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
            )}
          </circle>
          <text
            x={HUB_X - 80}
            y={HUB_Y + 148.5}
            fontSize="9.5"
            fontWeight="600"
            fill="#C0C0C0"
            letterSpacing="1.1"
          >
            CONFLUENCE LOCKED · 15M ARMED
          </text>
        </motion.g>

        {/* ---------------- engine label ---------------- */}
        <text
          x={HUB_X}
          y={HUB_Y - 132}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="600"
          fill="#4A4A4A"
          letterSpacing="4"
        >
          VISION MTF ENGINE
        </text>
      </svg>
    </div>
  );
}
