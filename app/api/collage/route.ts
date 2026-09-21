import { NextResponse } from "next/server";
import { buildCollage } from "@/lib/v5/charts";
import { PAIRS, type Pair } from "@/lib/v5/types";

/** Serves the 5-timeframe collage PNG used by /live and Telegram. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("pair") ?? "XAUUSD";
  const pair = (PAIRS as readonly string[]).includes(raw) ? (raw as Pair) : null;
  if (!pair) {
    return NextResponse.json({ ok: false, error: "unknown pair" }, { status: 400 });
  }

  const headline = new URL(req.url).searchParams.get("headline") ?? "Multi Timeframe Read";

  try {
    const png = await buildCollage(pair, headline);
    if (!png) {
      return NextResponse.json(
        { ok: false, error: "no charts generated yet" },
        { status: 404 }
      );
    }
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
