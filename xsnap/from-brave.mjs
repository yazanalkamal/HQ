/**
 * Build xsnap's session file from cookies you're ALREADY logged in with
 * (Brave, Chrome, whatever) — no automated login, so nothing for X to
 * throttle. Run on the desktop:
 *
 *   cd xsnap && npm install && node from-brave.mjs
 *
 * It asks for two cookie values, verifies them against X live, and only
 * writes x-state.json if they actually work. Get them from Brave:
 *   1. Open x.com in Brave (while logged in as @POGYaz)
 *   2. F12 → Application tab → Storage → Cookies → https://x.com
 *   3. Copy the "Value" of  auth_token  and  ct0
 *      (auth_token is the session; ct0 is the CSRF token. Both are shown
 *       in that panel even though they're httpOnly.)
 */

import fs from "node:fs";
import readline from "node:readline/promises";
import { chromium } from "playwright";

const HANDLE = process.env.X_HANDLE || "POGYaz";
const OUT = process.env.X_STATE_FILE || "x-state.json";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const authToken = (await rl.question("Paste auth_token: ")).trim();
const ct0 = (await rl.question("Paste ct0: ")).trim();
rl.close();

if (!authToken) {
  console.error("auth_token is required — that's the session cookie.");
  process.exit(1);
}

const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
const cookie = (name, value) => ({
  name,
  value,
  domain: ".x.com",
  path: "/",
  expires: oneYear,
  httpOnly: name === "auth_token",
  secure: true,
  sameSite: "None",
});

const state = {
  cookies: [cookie("auth_token", authToken), ...(ct0 ? [cookie("ct0", ct0)] : [])],
  origins: [],
};

// Verify before we trust it — a session that can't read the profile is
// worse than no session (it would look "healthy" but return nothing).
console.log(`\nVerifying against @${HANDLE}…`);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    storageState: state,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const userResp = page.waitForResponse(
    (r) => r.url().includes("UserByScreenName") && r.status() === 200,
    { timeout: 45_000 },
  );
  await page.goto(`https://x.com/${HANDLE}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const body = await (await userResp).json();
  const legacy = body?.data?.user?.result?.legacy ?? {};
  const followers = Number(legacy.followers_count);
  if (!Number.isFinite(followers)) throw new Error("no followers_count — cookies rejected?");

  fs.writeFileSync(OUT, JSON.stringify(state, null, 2));
  console.log(
    `✓ session works — @${HANDLE}: ${followers} followers, ${legacy.statuses_count} posts`,
  );
  console.log(`✓ wrote ${OUT} — tell Claude it exists and it'll ship it to the VPS.`);
} catch (err) {
  console.error(`✗ verification FAILED: ${String(err).slice(0, 200)}`);
  console.error("  Re-copy auth_token/ct0 from Brave (they may have refreshed).");
  process.exit(1);
} finally {
  await browser.close();
}
