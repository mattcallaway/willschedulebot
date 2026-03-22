import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

// GET /api/settings
router.get("/", async (_req, res) => {
    const settings = await prisma.appSetting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    res.json(settings);
});

// PUT /api/settings/:key
router.put("/:key", async (req, res) => {
    const { value, label, group } = z.object({
        value: z.string(),
        label: z.string().optional(),
        group: z.string().optional(),
    }).parse(req.body);

    const before = await prisma.appSetting.findUnique({ where: { key: req.params.key } });
    const setting = await prisma.appSetting.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, value, label, group, updatedBy: req.user?.id },
        update: { value, updatedBy: req.user?.id, ...(label ? { label } : {}), ...(group ? { group } : {}) },
    });
    await logAudit(req, "UPDATE_SETTING", "AppSetting", setting.id, before, setting);
    res.json(setting);
});

export default router;
