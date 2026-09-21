# VISION MTF V5.0 — Vision AI Engine

An **add-only** layer on top of the V4 landing page. The landing page design is
unchanged; only two hrefs now point at the new `/live` tab.

> **Landing page lock.** `app/page.tsx` was not modified. The only landing edits
> are two links:
> - `lib/site.ts` — nav "Live Status" → `/live`
> - `components/Hero.tsx` — "View Live Track Record" → `/live`

---

## What it does

Every 30 minutes a Vercel Cron hits `/api/cron/analyze`, which:

1. Loads the five chart PNGs per pair from `public/charts/latest/`
2. Sends them to **GPT-4o Vision** with the SMC prop-trader prompt, read
   top-down (W → D → 4H → H1 → 15M)
3. Parses the JSON verdict and scores confluence out of 100
   (W 25, D 25, 4H 20, H1 15, 15M 15)
4. Appends the result to `data/signals.json`
5. Broadcasts to Telegram:
   - **XAUUSD** at **≥ 85** → SIGNAL
   - **BTCUSD** at **≥ 90** → SIGNAL
   - otherwise a **WAIT update**, at most once every **2 hours** per pair

`/live` renders the latest run publicly — no password during FREE BETA.

---

## New files

```
scripts/mt5_factory.py        MT5 → clean SMC charts (candles + OB + FVG, no indicators)
scripts/requirements.txt      MetaTrader5, mplfinance, pandas, numpy, pillow

app/api/cron/analyze/route.ts the 30-minute analysis cron
app/api/collage/route.ts      serves the 5-timeframe collage PNG
app/live/page.tsx             the public live-status tab
components/live/parts.tsx     score cards, confidence bar, history table, CTA

lib/telegram_v5.ts            sendSignal() / sendNoTradeUpdate() + collage upload
lib/v5/types.ts               shared types, weights, thresholds
lib/v5/store.ts               signals.json read/write
lib/v5/charts.ts              chart loading + sharp collage
lib/v5/analyst.ts             GPT-4o Vision call, prompt, mock fallback

data/signals.json             signal history (seed)
vercel.json                   cron schedule
```

---

## Setup

### 1. Environment

Add to `.env.local` (and to the Vercel dashboard for production):

```env
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o          # optional

TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHANNEL_ID=-1001234567890

CRON_SECRET=                        # optional; protects the cron route

MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=
```

The existing `NEXT_PUBLIC_*` FREE BETA variables are unchanged.

**Everything degrades gracefully.** No `OPENAI_API_KEY` → deterministic mock
analysis. No Telegram credentials → sends are skipped, not failed. No charts →
the model is told, and mock output is returned. The route always returns 200
with valid JSON.

### 2. Generate charts

```bash
pip install -r scripts/requirements.txt
python scripts/mt5_factory.py
```

Writes `public/charts/latest/{XAUUSD,BTCUSD}_{W,D,H4,H1,M15}.png`.

`MetaTrader5` is **Windows-only**. On macOS/Linux, or when login fails, the
script renders deterministic **mock** candles instead and labels them
`[MOCK DATA]`, so nothing downstream breaks.

```bash
python scripts/mt5_factory.py --mock              # force mock
python scripts/mt5_factory.py --pair XAUUSD --tf W D
```

Charts are intentionally **clean**: candles, wicks, order-block boxes (green),
fair-value-gap boxes (amber), last price. No moving averages, no oscillators —
the vision model reads structure, not indicators.

### 3. Run

```bash
npm run dev
```

- <http://localhost:3000/live> — live status tab
- <http://localhost:3000/api/cron/analyze> — trigger a run manually
- <http://localhost:3000/api/collage?pair=XAUUSD> — collage PNG

---

## ⚠️ Two production caveats

### Filesystem is read-only on Vercel

Serverless functions can only write to `/tmp`, which is per-instance and
ephemeral. So on Vercel:

- `data/signals.json` in the repo is the **committed seed** (always readable)
- new runs are written to `/tmp` and read back in preference
- **history does not reliably survive** between instances or deployments

Locally (`npm run dev`) it writes `data/signals.json` directly and history does
accumulate properly.

`readSignals()` and `writeSignals()` in `lib/v5/store.ts` are the only two
functions that touch storage — swap them for Vercel KV, Blob or Postgres to get
durable history.

The same applies to charts: `scripts/mt5_factory.py` cannot run on Vercel and
cannot write into a deployment. Charts must be generated somewhere with MT5
(a Windows box or VPS) and **committed**, or uploaded to blob storage.

### Cron frequency needs a paid plan

`vercel.json` requests `*/30 * * * *`. **Vercel's Hobby plan only runs cron jobs
once per day** — the deployment succeeds but the schedule is throttled. Pro is
required for true 30-minute execution. Until then, trigger manually or drive it
from an external scheduler hitting `/api/cron/analyze`.

---

## Message formats

**Signal**

```
🚀 VISION MTF V5 SIGNAL - XAUUSD

BUY XAUUSD @ 2635.00
SL: 2628.00   TP1: 2655.00   TP2: 2672.00
SCORE: 92/100 🟢
MTF: W:24 D:23 4H:19 H1:14 15M:12
Session: London

AI: <2 sentences Taglish>
```

**No trade**

```
⏳ VISION MTF - NO TRADE UPDATE

XAUUSD | Score: 68/100 🟡 WAIT
Session: London

Bakit walang signal? <2 sentences Taglish>
Breakdown: W:22 D:21 4H:14 H1:7 15M:4

Next check 30 mins
```

Both post the five-timeframe collage as a photo with the message as caption
(Telegram caps captions at 1024 chars), falling back to a text message if no
charts exist.

---

## Scoring

| Timeframe | Max | Reads |
|---|---|---|
| W  | 25 | Macro trend, BOS/CHoCH |
| D  | 25 | Directional bias, alignment with W |
| 4H | 20 | Premium/Discount, order block validity |
| H1 | 15 | Fair value gap, liquidity sweep |
| 15M| 15 | BOS/CHoCH entry trigger |

**W and D not aligned = WAIT**, regardless of what the lower timeframes show.
`lib/v5/analyst.ts` also re-derives confidence from the breakdown and clamps
each timeframe to its maximum, so a model that returns an inflated headline
number cannot push a signal over the threshold.

VISION MTF is an educational tool, not financial advice.
