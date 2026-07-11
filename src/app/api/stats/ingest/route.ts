import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { platformLive, platformStats } from "@/db/schema";
import { todayISO } from "@/lib/dates";

/**
 * Machine-to-machine ingest for نبض المنصات — called by StreamBot's stats
 * jobs and the X scraper, never by a browser. Auth is a shared bearer
 * secret, not a session; these writes are telemetry, so they are the one
 * deliberate exception to the audit(...) rule (a 3-minute live ping would
 * drown the audit log).
 */

const PLATFORMS = new Set(["twitch", "discord", "x"]);

function authorized(request: Request): boolean {
  const secret = process.env.STATS_INGEST_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { platform, kind, metrics, day } = (body ?? {}) as {
    platform?: string;
    kind?: string;
    metrics?: unknown;
    day?: string;
  };

  if (!platform || !PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 400 });
  }
  if (kind !== "snapshot" && kind !== "live") {
    return NextResponse.json({ error: "kind must be snapshot|live" }, { status: 400 });
  }
  if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) {
    return NextResponse.json({ error: "metrics must be an object" }, { status: 400 });
  }

  if (kind === "snapshot") {
    const snapDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayISO();
    await db
      .insert(platformStats)
      .values({ platform, day: snapDay, metrics })
      .onConflictDoUpdate({
        target: [platformStats.platform, platformStats.day],
        set: { metrics },
      });
  } else {
    await db
      .insert(platformLive)
      .values({ platform, metrics, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformLive.platform,
        set: { metrics, updatedAt: new Date() },
      });
  }

  return NextResponse.json({ ok: true });
}
