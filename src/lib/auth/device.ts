import "server-only";
import { createHash, randomInt } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { deviceLinkCodes, users } from "@/db/schema";

/**
 * Device linking — how the desktop shell gets a session without running
 * Google OAuth inside a webview (Google blocks that). /admin mints a
 * short-lived one-time code; the desktop app navigates its webview to
 * /api/device/claim?code=…, which exchanges it for a normal session.
 */

/** No ambiguous glyphs (0/O, 1/I/L) — the code is typed by hand. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 5 * 60 * 1000;

function hashCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

/** Uppercase and strip separators/spaces: "abcd-efgh " → "ABCDEFGH". */
export function normalizeDeviceCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateDeviceCode(): string {
  const chars = Array.from(
    { length: 8 },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function createDeviceLinkCode(
  userId: string,
): Promise<{ code: string; expiresAt: Date }> {
  // lazy cleanup — expired codes (used ones included) have no value
  await db.delete(deviceLinkCodes).where(lt(deviceLinkCodes.expiresAt, new Date()));

  const code = generateDeviceCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.insert(deviceLinkCodes).values({
    id: hashCode(normalizeDeviceCode(code)),
    userId,
    expiresAt,
  });
  return { code, expiresAt };
}

/**
 * Atomically consume a code: valid + unused + unexpired → marks it used
 * and returns its owner; anything else → null.
 */
export async function claimDeviceLinkCode(
  input: string,
): Promise<{ userId: string; email: string } | null> {
  const normalized = normalizeDeviceCode(input);
  if (normalized.length === 0) return null;

  const [claimed] = await db
    .update(deviceLinkCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(deviceLinkCodes.id, hashCode(normalized)),
        isNull(deviceLinkCodes.usedAt),
        gt(deviceLinkCodes.expiresAt, new Date()),
      ),
    )
    .returning({ userId: deviceLinkCodes.userId });
  if (!claimed) return null;

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, claimed.userId));
  return user ? { userId: claimed.userId, email: user.email } : null;
}
