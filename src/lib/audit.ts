import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Append-only audit trail — call on EVERY state-changing action.
 * Never throws: auditing must not take the app down.
 */
export async function audit(entry: {
  actor: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity ?? "",
      entityId: entry.entityId ?? "",
      detail: entry.detail ?? {},
      ip: entry.ip ?? "",
    });
  } catch (err) {
    console.error("audit_write_failed", entry.action, err);
  }
}
