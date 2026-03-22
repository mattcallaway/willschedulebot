#!/usr/bin/env node
/**
 * Roster Import CLI
 * Usage: node scripts/import-roster.js --file=path/to/roster.xlsx [--sheet=0]
 *
 * Reads a spreadsheet (XLSX or CSV) and posts it to the running API.
 * Requires: API running at http://localhost:4000 and valid admin credentials.
 *
 * Env vars: API_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 */

import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v];
    })
);

if (!args.file) {
    console.error("Usage: node scripts/import-roster.js --file=roster.xlsx");
    process.exit(1);
}

const API_URL = process.env.API_URL || "http://localhost:4000";
const email = process.env.ADMIN_EMAIL || "admin@willschedulebot.local";
const password = process.env.ADMIN_PASSWORD || "Admin1234!";
const filePath = path.resolve(args.file);

async function run() {
    // 1. Login
    console.log("Logging in...");
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
        const err = await loginRes.json().catch(() => ({}));
        throw new Error(`Login failed: ${err.error || loginRes.statusText}`);
    }
    const { token } = await loginRes.json();
    console.log("✓ Logged in");

    // 2. Upload file
    const fileBuffer = readFileSync(filePath);
    const filename = path.basename(filePath);
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), filename);

    console.log(`Uploading ${filename}...`);
    const importRes = await fetch(`${API_URL}/api/import/roster`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const result = await importRes.json();
    if (!importRes.ok) {
        throw new Error(`Import failed: ${result.error || importRes.statusText}`);
    }

    console.log("\n✅ Import complete:");
    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Skipped: ${result.skipped}`);
    if (result.errors?.length > 0) {
        console.log(`  ⚠️  Errors (${result.errors.length}):`);
        result.errors.forEach((e) => console.log(`    Row ${e.row}: ${e.message}`));
    }
}

run().catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
});
