/**
 * xsnap — X (@POGYaz) profile stats without the paid API.
 *
 * Uses a logged-in browser session (storage state seeded once via
 * login.mjs, persisted in /data) to open the profile page and read the
 * numbers from X's own UserByScreenName GraphQL response — DOM-agnostic,
 * so cosmetic redesigns don't break it; only auth changes do.
 *
 * On success:  POST snapshot {followers, following, posts}
 *              POST live     {sessionOk: true}
 * On failure:  POST live     {sessionOk: false, error}
 *              → HQ shows the red «انقطعت جلسة X» card until re-login.
 *
 * Runs at boot, then every INTERVAL_H hours (default 12) with jitter —
 * once-or-twice a day for one's own profile is deliberately gentle.
 */

import fs from "node:fs";
import { chromium } from "playwright";

const HANDLE = process.env.X_HANDLE || "POGYaz";
const HQ_URL = (process.env.HQ_STATS_URL || "").replace(/\/$/, "");
const SECRET = process.env.STATS_INGEST_SECRET || "";
const STATE_FILE = process.env.X_STATE_FILE || "/data/x-state.json";
const INTERVAL_H = Number(process.env.INTERVAL_H || 12);

if (!HQ_URL || !SECRET) {
  console.error("xsnap: HQ_STATS_URL and STATS_INGEST_SECRET are required");
  process.exit(1);
}

async function post(kind, metrics) {
  try {
    const res = await fetch(`${HQ_URL}/api/stats/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ platform: "x", kind, metrics }),
    });
    if (!res.ok) console.error(`xsnap: ingest ${kind} rejected: ${res.status}`);
  } catch (err) {
    console.error(`xsnap: ingest ${kind} failed:`, String(err));
  }
}

async function scrapeOnce() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`xsnap: no session at ${STATE_FILE} — run login.mjs and seed the volume`);
    await post("live", { sessionOk: false, error: "no session file" });
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      storageState: STATE_FILE,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();

    const userResp = page.waitForResponse(
      (r) => r.url().includes("UserByScreenName") && r.status() === 200,
      { timeout: 45_000 },
    );
    await page.goto(`https://x.com/${HANDLE}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const body = await (await userResp).json();

    const legacy = body?.data?.user?.result?.legacy ?? {};
    const followers = Number(legacy.followers_count);
    const following = Number(legacy.friends_count);
    const posts = Number(legacy.statuses_count);
    if (!Number.isFinite(followers)) {
      throw new Error("UserByScreenName response had no followers_count");
    }

    // X rotates cookies as you browse — persist them or the session
    // quietly dies in weeks instead of months.
    await context.storageState({ path: STATE_FILE });

    await post("snapshot", { followers, following, posts });
    await post("live", { sessionOk: true });
    console.log(
      `xsnap: @${HANDLE} followers=${followers} following=${following} posts=${posts}`,
    );
  } catch (err) {
    console.error("xsnap: scrape failed:", String(err));
    await post("live", { sessionOk: false, error: String(err).slice(0, 200) });
  } finally {
    await browser.close();
  }
}

const jitterMs = () => Math.floor(Math.random() * 20 * 60_000); // 0–20 min

await scrapeOnce();
setTimeout(function loop() {
  scrapeOnce().finally(() => setTimeout(loop, INTERVAL_H * 3_600_000 + jitterMs()));
}, INTERVAL_H * 3_600_000 + jitterMs());
