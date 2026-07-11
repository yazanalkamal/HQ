/**
 * One-time login capture — run this on the DESKTOP (never in the container;
 * the VPS has no display):
 *
 *   cd xsnap && npm install && node login.mjs
 *
 * A real browser window opens on x.com. Sign in as @POGYaz (handle any
 * challenge/2FA normally), wait until the home timeline is visible, then
 * come back here and press Enter. The session is saved to x-state.json.
 *
 * Ship it to the VPS volume (from ~/hq on the VPS after `up -d xsnap`):
 *   scp x-state.json <vps>:~/hq/xsnap/
 *   docker compose cp xsnap/x-state.json xsnap:/data/x-state.json
 *   docker compose restart xsnap
 */

import readline from "node:readline/promises";
import { chromium } from "playwright";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "x-state.json";

// Prefer installed Edge locally so no browser download is needed.
let browser;
try {
  browser = await chromium.launch({ headless: false, channel: "msedge" });
} catch {
  browser = await chromium.launch({ headless: false });
}

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto("https://x.com/login");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question("Log in in the browser window, then press Enter here… ");
rl.close();

await context.storageState({ path: OUT });
await browser.close();
console.log(`Session saved to ${OUT} — copy it to the VPS xsnap volume.`);
