import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Column name aliases — map various spreadsheet header spellings to canonical field names
const COL_MAP = {
    // Name
    "name": "name",
    "full name": "name",
    "employee name": "name",
    // NUID
    "nuid": "nuid",
    "employee id": "nuid",
    "emp id": "nuid",
    // Rank
    "rank": "rank",
    "title": "rank",
    "position": "rank",
    // Phone
    "phone": "phone",
    "phone number": "phone",
    "cell": "phone",
    // Email
    "email": "email",
    "work email": "email",
    // KP Email
    "kp email": "kpEmail",
    "kpemail": "kpEmail",
    // Shift
    "shift": "shift",
    "shift type": "shift",
    // Status
    "status": "status",
    "emp status": "status",
    // Hire Date
    "hire date": "hireDate",
    "date of hire": "hireDate",
    "start date": "hireDate",
    // Last 4
    "last 4": "last4",
    "last4": "last4",
    "ssn last 4": "last4",
    // BCI
    "bci #": "bciNumber",
    "bci": "bciNumber",
    // Badge
    "badge #": "badgeNumber",
    "badge": "badgeNumber",
    // BWC
    "bwc issued": "bwcIssued",
    "bwc": "bwcIssued",
    // CED
    "ced issued": "cedIssued",
    "ced": "cedIssued",
    // Notes
    "notes": "notes",
    "note": "notes",
    // Credentials
    "license #": "licenseNumber",
    "license number": "licenseNumber",
    "guard card #": "guardCardNumber",
    "guard card": "guardCardNumber",
    "license/guard card #": "licenseNumber",
    "license expiry": "licenseExpiry",
    "license exp": "licenseExpiry",
    "expiry": "licenseExpiry",
    "firearm info": "firearmInfo",
    "firearm": "firearmInfo",
    "firearm serial #": "firearmSerial",
    "firearm serial": "firearmSerial",
    "farm card #": "farmCardNumber",
    "farm card": "farmCardNumber",
};

const CREDENTIAL_FIELDS = new Set(["licenseNumber", "licenseExpiry", "guardCardNumber", "farmCardNumber", "firearmInfo", "firearmSerial"]);

// POST /api/import/roster
router.post("/roster", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    if (rows.length === 0) return res.status(422).json({ error: "Spreadsheet is empty" });

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            // Normalize column headers
            const data = {};
            const credData = {};
            for (const [rawKey, value] of Object.entries(row)) {
                const canonical = COL_MAP[rawKey.toLowerCase().trim()];
                if (!canonical) continue;
                if (CREDENTIAL_FIELDS.has(canonical)) {
                    credData[canonical] = normalizeValue(canonical, value);
                } else {
                    data[canonical] = normalizeValue(canonical, value);
                }
            }

            if (!data.name) {
                results.skipped++;
                continue;
            }

            // Upsert employee by NUID if present, otherwise by name
            const where = data.nuid ? { nuid: data.nuid } : undefined;
            let employee;
            if (where) {
                employee = await prisma.employee.upsert({
                    where,
                    create: buildEmployeeData(data),
                    update: buildEmployeeData(data),
                });
                results.updated++;
            } else {
                employee = await prisma.employee.create({ data: buildEmployeeData(data) });
                results.created++;
            }

            // Upsert credentials if any credential fields present
            if (Object.keys(credData).length > 0) {
                await prisma.employeeCredential.upsert({
                    where: { employeeId: employee.id },
                    create: { employeeId: employee.id, ...credData },
                    update: credData,
                });
            }
        } catch (err) {
            results.errors.push({ row: i + 2, message: err.message });
        }
    }

    await logAudit(req, "IMPORT_ROSTER", "Employee", "bulk", null, results);
    res.json({ message: "Import complete", ...results });
});

function buildEmployeeData(data) {
    const hireDate = data.hireDate ? new Date(data.hireDate) : null;
    return {
        name: data.name,
        nuid: data.nuid || null,
        rank: data.rank || null,
        phone: data.phone || null,
        email: data.email || null,
        kpEmail: data.kpEmail || null,
        shift: data.shift || null,
        status: data.status || null,
        hireDate,
        seniorityKey: hireDate,
        last4: data.last4 || null,
        bciNumber: data.bciNumber || null,
        badgeNumber: data.badgeNumber || null,
        bwcIssued: !!data.bwcIssued,
        cedIssued: !!data.cedIssued,
        notes: data.notes || null,
    };
}

function normalizeValue(field, value) {
    if (value === null || value === undefined || value === "") return null;
    if (field === "bwcIssued" || field === "cedIssued") {
        return ["yes", "true", "1", "y"].includes(String(value).toLowerCase().trim());
    }
    if (field === "hireDate" || field === "licenseExpiry") {
        if (value instanceof Date) return value;
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return String(value).trim();
}

export default router;
