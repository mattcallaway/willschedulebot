import prisma from "../lib/prisma.js";

/**
 * Write an audit log entry.
 * @param {import("express").Request} req
 * @param {string} action
 * @param {string} entityType
 * @param {string} entityId
 * @param {object|null} before
 * @param {object|null} after
 * @param {string} [reason]
 */
export async function logAudit(req, action, entityType, entityId, before = null, after = null, reason = null) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id ?? null,
                action,
                entityType,
                entityId,
                before: before ? before : undefined,
                after: after ? after : undefined,
                reason,
                ip: req.ip,
            },
        });
    } catch (e) {
        // Never block the main request due to audit failures
        console.error("Audit log failed:", e.message);
    }
}
