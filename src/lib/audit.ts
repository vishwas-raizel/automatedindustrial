import { db } from "@/lib/db"

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "INSPECTION_RUN"
  | "INSPECTION_VIEW"
  | "REPORT_GENERATED"
  | "EXPORT"
  | "CONFIG_CHANGE"
  | "USER_CREATE"
  | "ALERT_ACK"
  | "DATA_DELETE"
  | "SEED_RUN"

export async function logAudit(opts: {
  userId?: string
  userName?: string
  action: AuditAction
  resource: string
  resourceId?: string
  details?: string
  ipAddress?: string
  severity?: "INFO" | "WARN" | "CRITICAL"
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        userName: opts.userName ?? "system",
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        details: opts.details ?? null,
        ipAddress: opts.ipAddress ?? "10.0.4.18",
        severity: opts.severity ?? "INFO",
      },
    })
  } catch (e) {
    // audit logging must never break the main flow
    console.error("[audit] failed to log:", e)
  }
}
