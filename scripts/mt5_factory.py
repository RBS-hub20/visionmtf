#!/usr/bin/env python3
"""
VISION MTF V5.0 — chart factory.

Renders CLEAN Smart-Money-Concepts charts (candles + wicks + order-block boxes
+ fair-value-gap boxes only, NO indicators) for the vision model to read.

    XAUUSD / BTCUSD  x  W, D, H4, H1, M15  ->  public/charts/latest/PAIR_TF.png

MetaTrader5 is Windows-only. When it is unavailable or the login fails the
script falls back to deterministic MOCK candles so the build never breaks.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/mt5_factory.py            # all pairs / all timeframes
    python scripts/mt5_factory.py --mock     # force mock data
    python scripts/mt5_factory.py --pair XAUUSD --tf W D

Env:
    MT5_LOGIN, MT5_PASSWORD, MT5_SERVER
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import mplfinance as mpf  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "charts" / "latest"

PAIRS = ["XAUUSD", "BTCUSD"]
TIMEFRAMES = ["W", "D", "H4", "H1", "M15"]

# Bars to render per timeframe — enough context, not so many the candles blur.
BARS = {"W": 80, "D": 120, "H4": 150, "H1": 150, "M15": 150}

BG = "#000000"
UP = "#00FF88"
DOWN = "#FF4D4D"
GRID = "#141414"
TEXT = "#C0C0C0"
OB_COLOR = "#00FF88"
FVG_COLOR = "#FFB020"

# Rough starting prices for mock series
MOCK_BASE = {"XAUUSD": 2650.0, "BTCUSD": 67000.0}
MOCK_VOL = {"XAUUSD": 0.0035, "BTCUSD": 0.012}

TF_MINUTES = {"W": 60 * 24 * 7, "D": 60 * 24, "H4": 240, "H1": 60, "M15": 15}


# --------------------------------------------------------------------------
# MetaTrader 5
# --------------------------------------------------------------------------

def mt5_timeframe(mt5, tf: str):
    return {
        "W": mt5.TIMEFRAME_W1,
        "D": mt5.TIMEFRAME_D1,
        "H4": mt5.TIMEFRAME_H4,
        "H1": mt5.TIMEFRAME_H1,
        "M15": mt5.TIMEFRAME_M15,
    }[tf]


def connect_mt5():
    """Return an initialised MetaTrader5 module, or None."""
    try:
        import MetaTrader5 as mt5  # type: ignore
    except Exception as exc:  # pragma: no cover - platform dependent
        print(f"  MetaTrader5 unavailable ({exc.__class__.__name__}) - using mock data")
        return None

    login = os.getenv("MT5_LOGIN")
    password = os.getenv("MT5_PASSWORD")
    server = os.getenv("MT5_SERVER")

    try:
        if login and password and server:
            ok = mt5.initialize(login=int(login), password=password, server=server)
        else:
            print("  MT5_LOGIN / MT5_PASSWORD / MT5_SERVER not set - trying local terminal")
            ok = mt5.initialize()
        if not ok:
            print(f"  MT5 initialize failed: {mt5.last_error()} - using mock data")
            return None
    except Exception as exc:
        print(f"  MT5 initialize raised {exc} - using mock data")
        return None

    print(f"  MT5 connected ({mt5.terminal_info().name if mt5.terminal_info() else 'terminal'})")
    return mt5


def fetch_mt5(mt5, symbol: str, tf: str, bars: int) -> pd.DataFrame | None:
    try:
        if not mt5.symbol_select(symbol, True):
            print(f"    {symbol}: symbol_select failed")
            return None
        rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe(mt5, tf), 0, bars)
        if rates is None or len(rates) == 0:
            print(f"    {symbol} {tf}: no rates returned")
            return None
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        df = df.set_index("time")
        df = df.rename(columns={"tick_volume": "Volume"})
        df = df.rename(columns={c: c.capitalize() for c in ["open", "high", "low", "close"]})
        return df[["Open", "High", "Low", "Close"]]
    except Exception as exc:
        print(f"    {symbol} {tf}: fetch error {exc}")
        return None


# --------------------------------------------------------------------------
# Mock data
# --------------------------------------------------------------------------

def mock_frame(symbol: str, tf: str, bars: int) -> pd.DataFrame:
    """Deterministic random walk with realistic OHLC relationships."""
    seed = abs(hash(f"{symbol}{tf}")) % (2**32)
    rng = np.random.default_rng(seed)

    base = MOCK_BASE[symbol]
    vol = MOCK_VOL[symbol] * {"W": 2.6, "D": 1.6, "H4": 1.0, "H1": 0.6, "M15": 0.35}[tf]

    drift = rng.normal(0.0004, vol, bars).cumsum()
    close = base * (1 + drift)

    open_ = np.empty(bars)
    open_[0] = close[0] * (1 - rng.normal(0, vol / 3))
    open_[1:] = close[:-1]

    spread = np.abs(rng.normal(0, vol / 2, bars)) * close
    high = np.maximum(open_, close) + spread
    low = np.minimum(open_, close) - spread

    end = pd.Timestamp.now("UTC").tz_localize(None).floor("min")
    idx = pd.date_range(end=end, periods=bars,
                        freq=pd.Timedelta(minutes=TF_MINUTES[tf]))

    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close}, index=idx)


# --------------------------------------------------------------------------
# Smart Money zones
# --------------------------------------------------------------------------

@dataclass
class Zone:
    start: int
    end: int
    low: float
    high: float
    kind: str  # "OB" | "FVG"


def find_order_blocks(df: pd.DataFrame, lookback: int = 60, max_zones: int = 2) -> list[Zone]:
    """
    Last opposing candle before a strong displacement move.
    Bullish OB = last down candle before an impulsive up leg (and vice versa).
    """
    zones: list[Zone] = []
    n = len(df)
    o, h, l, c = df["Open"].values, df["High"].values, df["Low"].values, df["Close"].values
    body = np.abs(c - o)
    avg_body = body[-lookback:].mean() if n >= lookback else body.mean()
    if not np.isfinite(avg_body) or avg_body == 0:
        return zones

    start = max(1, n - lookback)
    for i in range(n - 2, start, -1):
        if len(zones) >= max_zones:
            break
        # impulsive candle at i+1
        if body[i + 1] < avg_body * 1.8:
            continue
        bullish_move = c[i + 1] > o[i + 1]
        opposing = (c[i] < o[i]) if bullish_move else (c[i] > o[i])
        if not opposing:
            continue
        zones.append(Zone(start=i, end=n - 1, low=float(l[i]), high=float(h[i]), kind="OB"))
    return zones


def find_fvgs(df: pd.DataFrame, lookback: int = 60, max_zones: int = 2) -> list[Zone]:
    """Three-candle imbalance: gap between candle i-1 high and candle i+1 low."""
    zones: list[Zone] = []
    n = len(df)
    h, l = df["High"].values, df["Low"].values
    rng = (h - l)
    avg_range = rng[-lookback:].mean() if n >= lookback else rng.mean()
    if not np.isfinite(avg_range) or avg_range == 0:
        return zones

    start = max(1, n - lookback)
    for i in range(n - 2, start, -1):
        if len(zones) >= max_zones:
            break
        # bullish FVG
        if l[i + 1] > h[i - 1] and (l[i + 1] - h[i - 1]) > avg_range * 0.35:
            zones.append(Zone(i - 1, n - 1, float(h[i - 1]), float(l[i + 1]), "FVG"))
            continue
        # bearish FVG
        if h[i + 1] < l[i - 1] and (l[i - 1] - h[i + 1]) > avg_range * 0.35:
            zones.append(Zone(i - 1, n - 1, float(h[i + 1]), float(l[i - 1]), "FVG"))
    return zones


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

def render(df: pd.DataFrame, symbol: str, tf: str, out: Path, mocked: bool) -> None:
    mc = mpf.make_marketcolors(
        up=UP, down=DOWN,
        edge={"up": UP, "down": DOWN},
        wick={"up": UP, "down": DOWN},
        volume="#1F1F1F",
    )
    style = mpf.make_mpf_style(
        base_mpf_style="nightclouds",
        marketcolors=mc,
        facecolor=BG,
        figcolor=BG,
        edgecolor=GRID,
        gridcolor=GRID,
        gridstyle="-",
        rc={
            "axes.labelcolor": TEXT,
            "xtick.color": TEXT,
            "ytick.color": TEXT,
            "axes.edgecolor": GRID,
            "font.size": 9,
        },
    )

    zones = find_order_blocks(df) + find_fvgs(df)

    fig, axes = mpf.plot(
        df,
        type="candle",
        style=style,
        volume=False,
        returnfig=True,
        figsize=(12.8, 7.2),
        tight_layout=True,
        xrotation=0,
        datetime_format="%m-%d %H:%M" if tf in ("H1", "M15") else "%Y-%m-%d",
        ylabel="",
        scale_padding={"left": 0.3, "right": 0.9, "top": 0.55, "bottom": 0.5},
    )
    ax = axes[0]

    # SMC zones — boxes only, no indicators
    for z in zones:
        color = OB_COLOR if z.kind == "OB" else FVG_COLOR
        ax.axhspan(
            z.low, z.high,
            xmin=max(0.0, z.start / len(df)), xmax=1.0,
            facecolor=color, alpha=0.13, edgecolor=color, linewidth=1.0, zorder=0,
        )
        ax.text(
            len(df) - 1, z.high, f" {z.kind} ",
            color=color, fontsize=8, fontweight="bold",
            va="bottom", ha="right", zorder=5,
        )

    title = f"{symbol}  {tf}" + ("   [MOCK DATA]" if mocked else "")
    ax.set_title(title, color="#FFFFFF", fontsize=13, fontweight="bold", loc="left", pad=10)

    last = float(df["Close"].iloc[-1])
    ax.axhline(last, color=FVG_COLOR, linewidth=0.9, linestyle="--", alpha=0.8, zorder=4)
    ax.text(
        len(df) - 1, last, f" {last:,.2f} ",
        color="#000000", fontsize=8.5, fontweight="bold",
        va="center", ha="left",
        bbox=dict(facecolor=FVG_COLOR, edgecolor="none", pad=1.6), zorder=6,
    )

    fig.text(0.99, 0.015, "VISION MTF ENGINE", color="#3A3A3A",
             fontsize=8, ha="right", fontweight="bold")

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=100, facecolor=BG, bbox_inches="tight", pad_inches=0.18)
    import matplotlib.pyplot as plt
    plt.close(fig)


# --------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="VISION MTF V5 chart factory")
    ap.add_argument("--mock", action="store_true", help="force mock data, skip MT5")
    ap.add_argument("--pair", nargs="*", default=PAIRS, choices=PAIRS)
    ap.add_argument("--tf", nargs="*", default=TIMEFRAMES, choices=TIMEFRAMES)
    ap.add_argument("--out", default=str(OUT_DIR))
    args = ap.parse_args()

    out_dir = Path(args.out)
    print(f"VISION MTF V5 chart factory -> {out_dir}")

    mt5 = None if args.mock else connect_mt5()
    used_mock = False
    written = 0

    for symbol in args.pair:
        for tf in args.tf:
            bars = BARS[tf]
            df = fetch_mt5(mt5, symbol, tf, bars) if mt5 else None
            mocked = df is None
            if mocked:
                df = mock_frame(symbol, tf, bars)
                used_mock = True

            out = out_dir / f"{symbol}_{tf}.png"
            try:
                render(df, symbol, tf, out, mocked)
                written += 1
                print(f"  {'[mock] ' if mocked else '[live] '}{out.name}")
            except Exception as exc:
                print(f"  FAILED {symbol} {tf}: {exc}")

    if mt5:
        try:
            mt5.shutdown()
        except Exception:
            pass

    print(f"\nDone: {written} chart(s){' (mock data used)' if used_mock else ''}")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
