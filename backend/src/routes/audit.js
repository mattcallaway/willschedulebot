import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /api/audit?entityType=...&entityId=...&limit=50
router.get("/", async (req, res) => {
    const { entityType, entityId, userId, limit } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit ? parseInt(limit) : 100,
    });
    res.json(logs);
});

export default router;
