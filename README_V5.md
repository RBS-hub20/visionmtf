# VISION MTF V5.3 — Vision AI Engine (Claude + live market data)

An **add-only** layer on top of the V4 landing page. The landing page design is
unchanged; only two hrefs now point at the new `/live` tab.

> **Landing page lock.** `app/page.tsx` was not modified. The only landing edits
> are two links:
> - `lib/site.ts` — nav "Live Status" → `/live`
> - `components/Hero.tsx` — "View Live Track Record" → `/live`

---

## What it does

Every hour a GitHub Actions job hits `/api/cron/analyze`, which:

1. Loads the five chart PNGs per pair from `public/charts/latest/`
2. Sends them to **Claude Vision** with the SMC prop-trader prompt, read
   top-down (W → D → 4H → H1 → 15M)
3. Parses the JSON verdict and scores confluence out of 100
   (W 25, D 25, 4H 20, H1 15, 15M 15)
4. Appends the result to `data/signals.json`
5. Decides what — if anything — to broadcast (see below)

## V5.2 anti-spam

The engine analyses hourly but stays quiet most of the time. Three modes:

| Mode | Trigger | Telegram |
|---|---|---|
| **1. SIGNAL** | `action != WAIT` and XAUUSD ≥ **85** / BTCUSD ≥ **90** | Fires **immediately, any hour**. Bypasses the chart budget. |
| **2. CHART UPDATE** | No signal, confidence ≥ **60**, ≥ **2.4h** since the last chart post, and it's this pair's turn | `⏳ MARKET WATCH` + collage. Capped at **10/day**. |
| **3. QUIET** | Everything else | **Nothing sent.** Analysis still lands in `data/signals.json` and on `/live`. ~80% of runs. |

Chart-budget rules, in `lib/v5/chart_budget.ts`:

- **2.4h spacing** (`8_640_000` ms) → at most 10 posts per 24h
- **Alternates pairs** — whichever posted last yields to the other, unless the
  other is not a candidate (so one quiet pair can't starve the other)
- **Skips below 60 confidence** — an ugly setup is not worth a notification
- **One slot per run**, even when both pairs qualify
- A failed send does **not** consume the slot

State lives in `data/last_chart_post.json` locally, `/tmp/last_chart_post.json`
on Vercel: `{ "lastPost": "<ISO>", "lastPair": "XAUUSD" }`.

> Because `/tmp` is per-instance and ephemeral, a cold start resets the budget.
> The real guarantee is "at most 10/day **per warm instance**", not a hard global
> cap. Swap `readBudget`/`writeBudget` for Vercel KV to make it strict.

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
lib/v5/analyst.ts             Claude Vision call, prompt, mock fallback
lib/v5/chart_budget.ts        10-a-day chart-post rate limiter
lib/v5/market_data.ts         live candles + spot (Binance / Yahoo / gold-api)
lib/v5/render.ts              SVG candlestick renderer -> PNG via sharp

data/signals.json             signal history (seed)
vercel.json                   cron schedule
```

---

## Setup

### 1. Environment

Add to `.env.local` (and to the Vercel dashboard for production):

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_VISION_MODEL=claude-sonnet-5   # optional

TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHANNEL_ID=-1001234567890

CRON_SECRET=                        # optional; protects the cron route

MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=
```

The existing `NEXT_PUBLIC_*` FREE BETA variables are unchanged.

**Everything degrades gracefully.** No `ANTHROPIC_API_KEY` → deterministic mock
analysis. No Telegram credentials → sends are skipped, not failed. No charts →
the model is told, and mock output is returned. The route always returns 200
with valid JSON.

## V5.3 live market data

Charts are rendered **server-side from live feeds on every request** — the
committed PNGs in `public/charts/latest/` are now only a last-resort fallback.

| Pair | Candles | Live price |
|---|---|---|
| **BTCUSD** | Binance `BTCUSDT` klines — `1w/1d/4h/1h/15m` all native | Binance ticker |
| **XAUUSD** | Yahoo Finance **COMEX `GC=F`** — `1wk/1d/1h/15m` native, **4H aggregated from 1h** | `gold-api.com` XAU/USD **spot** |

No API keys needed. Set `TWELVEDATA_API_KEY` to use true XAU/USD spot OHLC
instead of gold futures.

**Why two sources for gold:** Yahoo has no `XAUUSD=X` series, and TwelveData's
`demo` key returns 401. `GC=F` is COMEX gold futures, which trades at a small
premium to spot (~$30 at time of writing). The collage banner shows true spot
and labels the candle source explicitly, so the gap is visible rather than
hidden.

Each collage carries a live banner:

```
● XAUUSD LIVE: $4,352.20                              VISION MTF V5
  2026-09-21 12:08 Dubai · candles: COMEX GC=F · spot: gold-api XAU/USD spot
```

The live price is also injected into the Claude prompt, so SL/TP are computed
off the current level instead of read off a stale chart axis:

> Current live price: XAUUSD $4,352.20 (gold-api XAU/USD spot). Use THIS price
> for SL/TP calculation — do not read entry levels off the chart axis.

Per-timeframe response caching (5 min on 15M up to 3h on Weekly) keeps the
upstream calls modest. A failed fetch falls back to the last cached value, then
to the disk PNGs, which the banner then labels `CACHED MOCK CANDLES`.

Rendering is `lib/v5/render.ts` — hand-built SVG rasterised by sharp. No
headless browser, no chart library.

### 2. Generate charts (fallback only)

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

### Cron frequency on the Hobby plan

Vercel's Hobby plan caps cron jobs at **once per day**, and a sub-daily schedule
in `vercel.json` does not just get throttled — it makes the **entire deployment
fail**:

```
Hobby accounts are limited to daily cron jobs. This cron expression
(*/30 * * * *) would run more than once per day.
```

So the setup is split:

| | Schedule | Where |
|---|---|---|
| Vercel Cron | `0 9 * * *` (daily) | `vercel.json` |
| **Main runner** | `0 * * * *` (hourly) | `.github/workflows/analyze.yml` |

V5.2 dropped the cadence from every 30 min to hourly: 24 Claude calls a day
instead of 48, roughly halving the bill. The 10-a-day chart cap is enforced in
the route, so a faster cadence would not produce more Telegram traffic anyway.

The GitHub Actions workflow calls `/api/cron/analyze` every 30 minutes for free.
Optional repo secrets: `ANALYZE_URL` (defaults to the production alias) and
`CRON_SECRET` (must match the Vercel env var).

**On Vercel Pro**, move the schedule into `vercel.json` and disable the workflow
(Actions → Analyze → Disable workflow).

Note: GitHub's scheduled runs are best-effort and can be delayed during peak
load, and Actions schedules are suspended after 60 days of repo inactivity.

---

## ⚠️ Model choice

The V5.2 spec asked for `claude-3-5-sonnet-20241022`. **That model was retired
on 2025-10-28** — every request to it now fails, which would have left this
integration permanently falling back to mock output.

`lib/v5/analyst.ts` uses **`claude-sonnet-5`** instead: the documented successor
in the same tier, and cheaper ($2/$10 per MTok). Override with
`ANTHROPIC_VISION_MODEL`.

Two API constraints on this model, both enforced in the code:

- `temperature` / `top_p` / `top_k` are **rejected with a 400** — the old
  `temperature: 0.2` from the GPT-4o version is gone.
- `thinking.budget_tokens` is rejected too. Thinking runs adaptively; the call
  uses `output_config: { effort: "low" }` to keep it shallow and cheap, with
  `max_tokens: 2000` so thinking plus the JSON verdict both fit. The spec's
  `max_tokens: 1000` would have truncated the response on most runs.

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

**Market watch** (max 10/day)

```
⏳ VISION MTF - MARKET WATCH

XAUUSD | Score: 68/100 | London
Status: Waiting for Discount/BOS

AI: <2 sentences Taglish>

Next signal check: 60 mins
```

`sendNoTradeUpdate()` (the V5.0 format) is kept but **deprecated** — V5.2 uses
`sendMarketWatch()`, which is subject to the chart budget.

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
