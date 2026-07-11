import "server-only";
import { asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { platformLive, platformStats } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";

export type Platform = "twitch" | "discord" | "x";

/** The headline number per platform — what the sparkline tracks. */
const MAIN_METRIC: Record<Platform, string> = {
  twitch: "followers",
  discord: "members",
  x: "followers",
};

/** Live rows older than this are treated as absent (bot down, scraper down). */
const LIVE_FRESH_MS = 10 * 60 * 1000;

export type PlatformPulse = {
  platform: Platform;
  /** newest snapshot, or null before the first one lands */
  latest: { day: string; metrics: Record<string, unknown> } | null;
  /** headline metric over the last 30 days, oldest → newest */
  series: number[];
  /** headline now − headline ~7 days ago; null until a week of history */
  weeklyDelta: number | null;
  /** fresh live state (viewers now / online now / X session health) */
  live: Record<string, unknown> | null;
};

export async function platformPulse(): Promise<PlatformPulse[]> {
  const today = todayISO();
  const since = addDaysISO(today, -29);

  const [statRows, liveRows] = await Promise.all([
    db
      .select()
      .from(platformStats)
      .where(gte(platformStats.day, since))
      .orderBy(asc(platformStats.day)),
    db.select().from(platformLive),
  ]);

  const now = Date.now();

  return (["twitch", "discord", "x"] as const).map((platform) => {
    const rows = statRows.filter((r) => r.platform === platform);
    const main = MAIN_METRIC[platform];
    const series = rows
      .map((r) => Number((r.metrics as Record<string, unknown>)[main]))
      .filter((n) => Number.isFinite(n));

    const newest = rows.at(-1) ?? null;
    const weekAgoCutoff = addDaysISO(today, -7);
    const weekAgo = [...rows].reverse().find((r) => r.day <= weekAgoCutoff);
    const newestMain = newest
      ? Number((newest.metrics as Record<string, unknown>)[main])
      : NaN;
    const weekAgoMain = weekAgo
      ? Number((weekAgo.metrics as Record<string, unknown>)[main])
      : NaN;

    const liveRow = liveRows.find((r) => r.platform === platform);
    const liveFresh =
      liveRow && now - liveRow.updatedAt.getTime() < LIVE_FRESH_MS
        ? (liveRow.metrics as Record<string, unknown>)
        : null;

    return {
      platform,
      latest: newest
        ? { day: newest.day, metrics: newest.metrics as Record<string, unknown> }
        : null,
      series,
      weeklyDelta:
        Number.isFinite(newestMain) && Number.isFinite(weekAgoMain)
          ? newestMain - weekAgoMain
          : null,
      live: liveFresh,
    };
  });
}

/**
 * X session health is judged from the live row regardless of freshness —
 * a dead session should stay visible until re-login, not fade after 10 min.
 */
export async function xSessionBroken(): Promise<boolean> {
  const rows = await db
    .select()
    .from(platformLive)
    .where(eq(platformLive.platform, "x"));
  const m = rows[0]?.metrics as Record<string, unknown> | undefined;
  return m?.sessionOk === false;
}

/** Latest snapshot day per platform — the «آخر لقطة» stamp (newest wins). */
export async function latestSnapshotDay(): Promise<string | null> {
  const rows = await db
    .select({ day: platformStats.day })
    .from(platformStats)
    .orderBy(desc(platformStats.day))
    .limit(1);
  return rows[0]?.day ?? null;
}
