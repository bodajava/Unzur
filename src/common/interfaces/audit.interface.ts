/** Who made an admin change (stored in audit_logs). */
export interface AuditContext {
  actorId: string;
  ipAddress?: string;
}
