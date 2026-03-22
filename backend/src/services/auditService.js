import prisma from "../lib/prisma.js";

/**
 * Write an audit log entry.
 * Accepts two calling conventions:
 *   1. auditLog({ userId, action, entityType, entityId, before, after, reason })
 *   2. logAudit(req, action, entityType, entityId, before, after, reason)  [legacy]
 */
export async function auditLog({ userId, action, entityType, entityId, before = null, after = null, reason = null } = {}) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: userId ?? null,
                action,
                entityType,
                entityId,
                before: before ? JSON.stringify(before) : null,
                after: after ? JSON.stringify(after) : null,
                reason: reason ?? null,
                ip: null,
            },
        });
    } catch (e) {
        console.error("Audit log failed:", e.message);
    }
}

/** Legacy compat alias — some routes call logAudit(req, action, …) */
export async function logAudit(req, action, entityType, entityId, before = null, after = null, reason = null) {
    return auditLog({
        userId: req?.user?.id ?? null,
        action,
        entityType,
        entityId,
        before,
        after,
        reason,
    });
}
