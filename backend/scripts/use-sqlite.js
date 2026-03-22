#!/usr/bin/env node
/**
 * Patch the Prisma schema to use SQLite for local dev (no Docker needed).
 * Run: node scripts/use-sqlite.js
 * Reverts to PostgreSQL: node scripts/use-postgres.js
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../prisma/schema.prisma");
let schema = readFileSync(schemaPath, "utf8");
schema = schema
    .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
    .replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url      = env("DATABASE_URL")');
writeFileSync(schemaPath, schema);
console.log("✅ schema.prisma → sqlite");
