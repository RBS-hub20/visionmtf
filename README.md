# VISION MTF

**MULTI TIMEFRAME TRADING** — *The AI Prop Trader That Reads Like a Human*

Production one-page marketing site for VISION MTF. Dark-mode only, built to sit
somewhere between a prop firm and an AI SaaS product page.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run build && npm start   # production
npm run lint                 # eslint
```

Requires Node 18.17+.

---

## Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS 3 |
| Motion | Framer Motion 11 |
| Icons | Lucide React |
| Fonts | Inter + JetBrains Mono (`next/font`) |
| Language | TypeScript (strict) |

---

## Wiring up Stripe

Payment buttons read their URLs from the environment. Create three
**Payment Links** in the Stripe dashboard, then:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_STRIPE_STARTER_URL=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_PRO_URL=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_FUNDED_URL=https://buy.stripe.com/...
NEXT_PUBLIC_TELEGRAM_URL=https://t.me/your_channel
NEXT_PUBLIC_SITE_URL=https://visionmtf.com
```

Until these are set the buttons fall back to `#` so the page still builds and
runs. Restart the dev server after editing `.env.local`.

---

## Editing content

**Almost everything lives in [`lib/site.ts`](lib/site.ts)** — brand strings, nav
items, the five-timeframe stack, live AI status per asset, pricing tiers and
feature lists, the stat strip and the marquee. Change copy there rather than in
the components.

To update the live status block, edit the `liveStatus` array:

```ts
{
  symbol: "XAUUSD",
  state: "WAITING",      // "WAITING" | "EXECUTE" | "STAND DOWN"
  confidence: 68,
  price: "$2,655.40",
  target: "$2,635.00",
  note: "...",
  biases: [{ tf: "W", state: "bullish" }, ...],
}
```

---

## Structure

```
app/
  layout.tsx          metadata, fonts, OG tags
  page.tsx            section composition
  globals.css         design tokens, buttons, glass, grid utilities
  icon.png            favicon (generated from the logo)
  apple-icon.png      touch icon
  robots.ts
  sitemap.ts
components/
  Navbar.tsx          sticky, blur-on-scroll, mobile sheet
  Hero.tsx            badge, headline, CTAs, stat strip, marquee
  HeroVisual.tsx      5 timeframes converging into the V at 92% confidence
  WhyMTF.tsx          single-timeframe failure vs 5-timeframe confluence
  HowItWorks.tsx      W/D → 4H/1H → 15M, plus the 85% confidence gate
  WaitFeature.tsx     the WAIT vs EXECUTE Telegram mockups (main section)
  TelegramPhone.tsx   device frame + message bubble
  TelegramChart.tsx   the candlestick chart inside the WAIT alert
  LiveStatus.tsx      live engine feed for XAUUSD / BTCUSD
  Pricing.tsx         Starter / Pro / Funded + Stripe buttons
  Footer.tsx          CTA band, links, risk disclaimer
  ui/                 Logo, SectionHeading, Reveal, GridBackground
lib/
  site.ts             all content and config
  utils.ts            cn(), sparkline helper
public/
  logo-full.png       wordmark + mark
  logo-mark.png       V mark only
  og-image.png        1200×630 social card
```

---

## Brand tokens

Defined in `tailwind.config.ts` and `app/globals.css`.

| Token | Value | Tailwind |
|---|---|---|
| Black | `#000000` | `bg-ink` |
| Card | `#111111` | `bg-card` |
| Border | `#1F1F1F` | `border-line` |
| Neon green | `#00FF88` | `text-neon` |
| Silver | `#C0C0C0` | `text-silver` |
| White | `#FFFFFF` | `text-white` |

Useful classes: `.glass`, `.card`, `.btn-neon`, `.btn-ghost`, `.chip`,
`.chip-neon`, `.grid-bg`, `.noise`, `.text-silver-metal`, `.text-neon-metal`,
`.num` (tabular mono figures).

---

## Deploying

Push to a Git repo and import it on Vercel — no configuration needed. Add the
`NEXT_PUBLIC_*` variables in the project's environment settings, and set
`NEXT_PUBLIC_SITE_URL` to the live domain so OG tags and the sitemap resolve
correctly.

---

## Notes

- Dark mode only by design; there is no light theme.
- Fully responsive from 360px up. `prefers-reduced-motion` is respected —
  animations collapse instead of being removed.
- The live status figures and Telegram mockups are illustrative sample output,
  labelled as such on the page.
- The footer carries the required risk disclaimer: VISION MTF is an educational
  tool, not financial advice.

VISION MTF © 2026 by GFXA TRADERS.
