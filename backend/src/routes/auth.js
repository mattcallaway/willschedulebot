import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const router = Router();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
});

// POST /api/auth/register (protected — first-time or admin only in production)
router.post("/register", async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8),
    });
    const { email, name, password } = schema.parse(req.body);
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, name, password: hash } });
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
});

export default router;
