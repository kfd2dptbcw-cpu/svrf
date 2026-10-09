import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getRefreshStatus } from "@/lib/forecast/refresh";

export const dynamic = "force-dynamic";

/**
 * Refresh status. This endpoint NEVER calls the data providers: forecasts are
 * refreshed by `npm run refresh` in GitHub Actions
 * (.github/workflows/scheduled-refresh.yml), which writes to the shared cache.
 * Calling it afterwards regenerates the statically rendered pages from that
 * cache straight away instead of within the hour.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: NextRequest) {
  const secret = env.cronSecret;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json(await getRefreshStatus(), { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
