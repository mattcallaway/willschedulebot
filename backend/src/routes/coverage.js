import { Router } from "express";
import prisma from "../lib/prisma.js";
import { recommendCoverage } from "../services/recommendationEngine.js";

const router = Router();

/**
 * GET /api/coverage/recommend
 * Query params:
 *   date       YYYY-MM-DD  — date of shift needing coverage
 *   shiftId    string      — optional, for context
 *   startTime  HH:MM       — shift start
 *   endTime    HH:MM       — shift end
 *   durationHrs number     — shift length in hours
 *   location   string      — optional
 */
router.get("/recommend", async (req, res) => {
    const { date, shiftId, startTime, endTime, durationHrs, location } = req.query;
    if (!date) return res.status(400).json({ error: "date query param required" });

    const recommendations = await recommendCoverage({
        date: new Date(date),
        shiftId,
        startTime,
        endTime,
        durationHrs: durationHrs ? parseFloat(durationHrs) : 8,
        location,
    });

    res.json(recommendations);
});

export default router;
