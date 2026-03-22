# WillScheduleBot

**Employee Scheduling & Leave Management System**

A production-ready full-stack web application for security officer / employee workforce management. Handles employee profiles, recurring schedules, PTO and sick accruals, overtime tracking, NBOT tracking, outage handling, and intelligent coverage recommendations based on contracted hours and seniority rules.

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **PostgreSQL** 14+ (or use Docker Compose below)

### 1. Clone the repository

```bash
git clone https://github.com/mattcallaway/willschedulebot.git
cd willschedulebot
```

### 2. Start PostgreSQL (Docker)

If you don't have a local PostgreSQL instance:

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- User: `postgres`
- Password: `postgres`
- Database: `willschedulebot`

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret (generate with `openssl rand -base64 64`) |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `8h`, `24h`) |
| `PORT` | Backend port (default: `4000`) |
| `VITE_API_URL` | Backend URL seen by the frontend (default: `http://localhost:4000/api`) |

> **Note**: In development with Vite's proxy, `VITE_API_URL` is not needed — the proxy handles it.

### 4. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Run database migrations

```bash
cd backend
npm run migrate:dev
```

This creates all database tables.

### 6. Seed demo data

```bash
cd backend
npm run seed
```

This creates:
- **1 admin user**: `admin@willschedulebot.local` / `Admin1234!`
- **12 demo employees** (mixed 32hr / 40hr, multiple ranks and shifts)
- Sample credentials, leave requests, PTO/sick ledger entries, NBOT and overtime entries
- App settings (OT thresholds, accrual rates)
- Shifts for the current week

### 7. Start the servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
API runs at `http://localhost:4000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
UI runs at `http://localhost:5173`

Open `http://localhost:5173` and log in with the seeded admin credentials.

---

## Roster Import

Import an existing employee roster from an Excel (`.xlsx`) or CSV file:

### Via the UI
1. Go to **Employee Directory**
2. Click **Import Roster**
3. Select your `.xlsx` or `.csv` file

### Via CLI
```bash
cd backend
node scripts/import-roster.js --file=path/to/roster.xlsx
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars if using custom credentials.

### Supported Column Names

The import script recognizes many column name variations. Key mappings:

| Spreadsheet Column | Profile Field |
|---|---|
| Name / Full Name / Employee Name | name |
| NUID / Employee ID / Emp ID | nuid |
| Rank / Title / Position | rank |
| Phone / Cell | phone |
| Email / Work Email | email |
| KP Email | kpEmail |
| Shift / Shift Type | shift |
| Status / Emp Status | status |
| Hire Date / Date of Hire / Start Date | hireDate |
| Last 4 / SSN Last 4 | last4 |
| BCI # / BCI | bciNumber |
| Badge # / Badge | badgeNumber |
| BWC Issued / BWC | bwcIssued |
| CED Issued / CED | cedIssued |
| Notes | notes |
| License # / License Number / License/Guard Card # | licenseNumber |
| License Expiry / License Exp / Expiry | licenseExpiry |
| Guard Card # | guardCardNumber |
| FARM Card # / Farm Card | farmCardNumber |
| Firearm Info / Firearm | firearmInfo |
| Firearm Serial # / Firearm Serial | firearmSerial |

Missing columns are gracefully skipped. Rows without a `Name` are skipped.

---

## Running Tests

```bash
cd backend
npm test
```

Tests use [Vitest](https://vitest.dev/) and cover:
- **Recommendation engine** — 32hr priority, seniority ordering, unavailability filtering, overtime flagging
- **Accrual logic** — PTO and sick accrual rates, negative balance prevention
- **Overtime logic** — threshold detection, period accumulation
- **NBOT logic** — summation, grouping, period filtering, partial-shift validation

---

## Application Screens

| Route | Screen |
|---|---|
| `/` | Dashboard (stats, week overview, upcoming leave, OT summary) |
| `/employees` | Employee Directory (search, filter, import) |
| `/employees/:id` | Employee Profile (all fields, credentials, quick ledger view) |
| `/scheduler` | Weekly Scheduler (7-column grid, coverage recommendations) |
| `/schedules/recurring` | Recurring Schedule Manager (pattern builder, generate to week) |
| `/leave` | Leave & Outage Manager |
| `/ledger/:employeeId` | PTO & Sick Ledger (full history, manual adjustments) |
| `/overtime` | Overtime & NBOT Review |
| `/reports` | Reports (hours, PTO, sick, OT, NBOT, seniority, credential expiry) |
| `/settings` | Settings & Business Rules |

---

## Architecture

```
willschedulebot/
├── backend/               # Node.js + Express API
│   ├── prisma/
│   │   └── schema.prisma  # All database models
│   ├── src/
│   │   ├── routes/        # Express route handlers
│   │   ├── services/      # Business logic (recommendation, leave, audit)
│   │   ├── middleware/    # Auth (JWT), error handler
│   │   └── lib/           # Prisma client singleton
│   ├── seeds/             # Demo data seeder
│   ├── scripts/           # Roster import CLI
│   └── tests/             # Vitest unit tests
├── frontend/              # React + Vite admin UI
│   └── src/
│       ├── pages/         # Route-level page components
│       ├── components/    # Shared components (Layout, Sidebar)
│       └── api/           # Axios client + typed API helpers
├── docker-compose.yml     # Local PostgreSQL
└── .env.example           # Environment variable template
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| ORM / DB | Prisma + PostgreSQL |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data fetching | TanStack React Query |
| Auth | JWT (jsonwebtoken + bcrypt) |
| Testing | Vitest |
| Spreadsheet import | SheetJS (xlsx) |

---

## Business Logic Summary

### Coverage Recommendation Priority
1. Employees on leave, outage, or blackout dates are **excluded**
2. **32-hour contracted employees are preferred** over 40-hour employees
3. Within the same contracted-hours tier: **earlier hire date = more senior = preferred**
4. Projects weekly hours — **warns if assignment creates overtime**
5. Returns ranked list with **human-readable reason strings** for each recommendation

### PTO / Sick Accrual
- Default: **3.08 hrs PTO per 80 hrs worked** (~10 days/year)
- Default: **1.54 hrs sick per 80 hrs worked** (~5 days/year)
- Negative balances are **blocked** by the API
- All adjustments require a reason and are **audit-logged**

### Overtime Thresholds
- 40-hour employees: OT after **40 hrs/week**
- 32-hour employees: OT after **32 hrs/week**
- Thresholds are **configurable** in Settings

### NBOT (Non-Benefit Overtime)
- Tracked separately from regular overtime
- Supports **partial-shift NBOT** (e.g., 2 of 8 hrs marked NBOT)
- Accumulated by employee and pay period

---

## Deployment

### Environment Variables (Production)

```env
DATABASE_URL=postgresql://user:password@host:5432/willschedulebot
JWT_SECRET=<random 64-char secret>
JWT_EXPIRES_IN=8h
PORT=4000
NODE_ENV=production
```

### Production Build

```bash
# Frontend
cd frontend
npm run build
# Serve the dist/ folder with nginx or a static host

# Backend
cd backend
npm run migrate      # Run migrations against production DB
npm run seed         # Optional: seed initial admin user
npm start
```

### Running Migrations (Production)

```bash
cd backend
npx prisma migrate deploy
```

---

## Assumptions & Notes

- **Single-tenant**: One organization per deployment
- **All users are admin-level** in this initial version (role expansion is a future enhancement)
- **Pay period = 14 days** (configurable in Settings)
- **Drag-and-drop UX**: The scheduler grid supports click-to-select and recommendation-driven assignment. Full DnD (using `@dnd-kit`) can be layered in as an enhancement using the existing infrastructure.
- **Roster import**: Designed to handle messy real-world spreadsheets gracefully — unknown columns are skipped, missing values default to null
- **Audit log**: Every schedule edit, leave approval, balance adjustment, and settings change is recorded in the `audit_logs` table

---

## Next Steps

- [ ] Add drag-and-drop to the scheduler grid
- [ ] Add employee self-service leave request portal
- [ ] Add email notifications for leave approvals and coverage alerts
- [ ] Add role-based access control (admin vs. viewer)
- [ ] Add pay period accrual batch job (cron)
- [ ] Add mobile-responsive scheduler view
