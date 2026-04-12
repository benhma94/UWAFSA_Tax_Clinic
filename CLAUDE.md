# CATBUS Development Guidance

## 🔍 Graphify Knowledge Graph (Token Reduction)

This project uses **graphify** to automatically extract and organize architecture knowledge.

**Location**: `Obsidian - Tax Clinic Website/`

### How it Reduces Tokens

Instead of reading raw files:
- **Old way**: Search 31 code files → parse imports → trace calls (100K+ tokens)
- **New way**: Read GRAPH_REPORT.md + wiki markdown (5-10K tokens)

### For Architecture Questions

1. **First**: Read `Obsidian - Tax Clinic Website/GRAPH_REPORT.md` (god nodes, clusters, risks)
2. **Then**: Navigate `Obsidian - Tax Clinic Website/wiki/nodes/` for specific components
3. **Skip raw files** unless you need implementation details

### God Nodes (Critical Hubs)

From GRAPH_REPORT.md:
- **Config.gs** — Central configuration (45+ connections)
- **Router.gs** — Web app dispatcher (38+ connections)
- **AdminDashboard.gs** — Analytics hub (28+ connections)
- **ControlSheet.gs** — Workflow orchestrator (24+ connections)
- **Google Sheets** (Client Intake, Assignment, Tracker) — Core data

### Key Workflows (Pre-Documented)

All major flows documented in `Obsidian - Tax Clinic Website/wiki/workflows/`:
1. Day-of Clinic Operations
2. Appointment Booking Pathway
3. Volunteer Scheduling
4. Admin Analytics Pipeline
5. Control Sheet Polling Pattern

**Don't ask me to explain them — read the wiki!**

### Keeping Graph Updated

After modifying code, rebuild the graph:

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

Or use the graphify CLI:

```bash
graphify query "what calls AdminDashboard.gs?"
```

---

## 📚 Obsidian Vault Integration

The knowledge graph is available as an **Obsidian vault** for visual exploration (optional).

### Setup

Folder structure in your Obsidian vault:
```
YourVault/
├── .obsidian/                   (Obsidian config - auto-created)
├── wiki/                        (Knowledge graph)
│   ├── _index.md               (Start here!)
│   ├── nodes/                  (235 component files)
│   └── workflows/              (20 architecture patterns)
├── graph.json                  (For visualization plugins)
└── GRAPH_REPORT.md            (Analysis summary)
```

### Quick Start

1. Wiki files are already in `Obsidian - Tax Clinic Website/` (no copy needed)
2. Point your Obsidian vault to `Obsidian - Tax Clinic Website/` as the vault root
3. Open `wiki/_index.md` as navigation hub
4. Click blue wikilinks to explore relationships
5. (Optional) Install **Graph View** or **Force-Directed Graph** plugin for visualization

Install plugins:
- Open Obsidian Settings → Community Plugins → Browse
- Search for "Graph View" (enable) or install "Force-Directed Graph"

---

# CATBUS System Architecture

CATBUS (Client Appointment Tracking and Booking Unified System) is a tax clinic management system built on Google Apps Script with HTML frontends. Backend logic lives in `catbus_scripts/*.gs`, HTML UIs are served via `HtmlService`, Google Sheets is the database, and Gmail/`MailApp` handles email.

**Account type:** Google Workspace (not consumer). Higher quota limits apply: 1,500 emails/day, 6 hrs/day total script runtime.

## Deployment

**Note:** All `clasp` commands must be run from the `catbus_scripts/` directory (where `.clasp.json` lives).

```bash
clasp push          # Upload changes to Apps Script
clasp push --force  # Force upload (overwrites remote)
clasp pull          # Download from Apps Script
clasp deploy        # !! NEVER run bare — always use --deploymentId (see below)
```

**Web app deployment ID:** stored in `_Secrets.gs` as `WEBAPP_URL` (gitignored — never hardcode in docs)

Always deploy using:
```bash
clasp deploy --deploymentId <your-deployment-id> --description "..."
```

Running `clasp deploy` without `--deploymentId` creates a NEW deployment with a different URL, which breaks all hardcoded links across 7 files.

All web app pages are served through a **single deployed URL** via `Router.gs`. The `doGet(e)` function dispatches by the `?app=` query parameter (e.g., `?app=intake`, `?app=queue`). Each `*App.gs` file contains an individual `doGet*()` function that Router.gs calls.

## Key Components

### Secrets (`_Secrets.gs`)

Instance-specific values are in `_Secrets.gs` (gitignored — copy from `_Secrets.example.gs`). It defines a single `SECRETS` constant read by `Config.gs`:

- `SPREADSHEET_ID`, `CONSOLIDATED_VOLUNTEERS_SHEET_ID`, `RESUME_FOLDER_ID`
- `CLINIC_EMAIL`, `CLINIC_WEBSITE_URL`, `BOOKING_FORM_URL`, `WEBAPP_URL`

**Load order:** The `_` prefix ensures `_Secrets.gs` sorts before `Config.gs` alphabetically.

### Configuration (`Config.gs`)

All non-secret configuration lives in `Config.gs`. Key objects:

- **`CONFIG`** — Main config: spreadsheet ID, sheet name constants, column mappings, status codes
- **`SCHEDULE_CONFIG`** — Shift structure, time slots (A/B/C), day labels
- **`ELIGIBILITY_CONFIG`** — Income limits, complexity thresholds, clinic dates/locations
  - **⚠️ WARNING**: Also mirrored in `appointment_screening.html` — update both!
- **`APPOINTMENT_CONFIG`** — Sheet/column mappings for appointment bookings
- **`PRODUCT_CODE_CONFIG`** — UFILE key distribution settings

### Routing (`Router.gs`)

Single deployed URL dispatches by `?app=` parameter:

| `?app=` value | Page |
|---|---|
| `intake` | Client intake form |
| `queue` | Queue dashboard (doorman) |
| `control` | Control sheet (volunteer filing) |
| `admin` | Admin dashboard |
| `alerts` | Alert dashboard (help + review requests) |
| Use `getWebAppUrl()` in Config.gs for other references |

### Google Sheets Database

| Sheet | Purpose |
|---|---|
| Client Intake | Walk-in client records |
| Client Assignment | Volunteer-client pairings |
| Tax Return Tracker | Filed return details (married = column 6, counts as 2 in metrics) |
| Help Requests | Active help requests from volunteers |
| Review Requests | Review request status (Requested → Approved/Returned → Completed) |
| Volunteer List | Currently signed-in volunteers |
| SignOut | Sign-out audit log |
| Shift Schedule | Generated schedule output |
| Schedule Availability | Form responses for volunteer availability |

## Core Workflows

### Day-of Clinic Operations

```
Volunteer sign-in → Receptionist eligibility check → Doorman assigns client → 
Volunteer files return via control sheet → Mentor reviews/approves → Receipt email
```

Single polling endpoint: `getVolunteerPollingStatus(volunteer)` returns both help and review status.

### Appointment Booking (Complex/Priority Cases)

```
appointment_screening.html
  → ELIGIBILITY_CONFIG check (income, self-employment, etc.)
  → COMPLEXITY screening (5+ years, childcare, foreign income, etc.)
  → Google Form → AppointmentBooking.gs → Priority Client ID (P001) + confirmation email
```

Config is mirrored in `appointment_screening.html` — **update both**.

### Volunteer Scheduling (Pre-Clinic)

```
Availability submission → ScheduleAutomation.gs generates schedule + mentor teams →
Product codes distributed (ProductCodeDistribution.gs) → Volunteers view schedule
```

Shift ID system: `D{day}{slot}` — Days D1–D4, Slots A/B/C for times.

### Control Sheet Polling Pattern

```
ControlSheet.gs single polling endpoint calls:
  → getVolunteerPollingStatus() → returns help + review status
  → getHelpStatus() (from HelpRequests.gs) + getReviewApprovalResult() (from ReviewRequests.gs)
  → getmentorlist() — concurrent mentor availability
```

Eliminates multiple polling calls by bundling help + review status in one request, reducing frontend refresh latency.

### Admin Analytics Pipeline

```
AdminDashboard.gs data aggregation:
  → getAdminDashboardData() → coordinates multiple data reads
  → readTrackerData() → Tax Return Tracker (married = counts as 2)
  → getReturnSummary() → Filed return metrics
  → getVolunteerPerformanceMetrics() → Returns per volunteer, completion rates
  → getReviewerLeaderboard() → Top reviewers by volume
  → getConcurrentReturnTimeSeries() → Timeline of active returns
```

On-demand dashboard data bundled to minimize Sheets API calls and maintain fast refresh for analytics view.

## Key Development Notes

- **Changing clinic dates/times:** Update `SCHEDULE_CONFIG` + `ELIGIBILITY_CONFIG` in `Config.gs`
- **Changing income limits:** Update `ELIGIBILITY_CONFIG` in `Config.gs` AND `appointment_screening.html`
- **HTML charts:** Use HTML/CSS charts (not Google Sheets embedded)
- **Role CSS classes:** Use `.replace(/\s+/g, '')` to convert "internal services" → "internalservices"
- **Secrets file load order:** `_Secrets.gs` must keep `_` prefix
- **`webpage/config.js` is gitignored:** Upload to server with each redeploy
- **Deployment URL in HtmlService:** Use `google.script.run.getWebAppUrl()` — don't hardcode
- **Visibility-based auto-refresh:** Pause when tab hidden, resume when visible (add jitter 0–2s)
- **Consolidated polling:** Control sheet uses single endpoint (don't add separate calls)
- **Married returns:** Counted as 2 in all dashboard metrics (column 6 in Tax Return Tracker)
