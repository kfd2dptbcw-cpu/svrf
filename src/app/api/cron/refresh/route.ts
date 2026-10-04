import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runScheduledRefresh } from "@/lib/forecast/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled refresh endpoint, called at 06:00 and 18:00 UTC by Vercel Cron
 * (vercel.json), GitHub Actions or any external scheduler.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this
 * automatically when CRON_SECRET is set). Add `?force=1` to refresh even if the
 * cache is already fresh for the current slot.
 */
async function handle(request: NextRequest) {
  const secret = env.cronSecret;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledRefresh({ force: request.nextUrl.searchParams.get("force") === "1" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron] refresh failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
