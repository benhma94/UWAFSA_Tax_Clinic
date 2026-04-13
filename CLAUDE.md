# CATBUS Development Guidance

## Graphify Knowledge Graph

**Always use graphify before exploring code** — reads wiki instead of raw files (5-10K vs 100K+ tokens).

1. Read `Obsidian - Tax Clinic Website/GRAPH_REPORT.md` (god nodes, clusters, risks)
2. Navigate `Obsidian - Tax Clinic Website/wiki/nodes/` for components
3. Navigate `Obsidian - Tax Clinic Website/wiki/workflows/` for 20 pre-documented workflows
4. Only open raw `.gs` files for implementation details

**Python** — always use venv, never bare `python`/`python3`:
```bash
.venv/Scripts/python -m graphify query "what calls AdminDashboard.gs?"
.venv/Scripts/python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

## Architecture

CATBUS is a Google Apps Script tax clinic system. Backend: `catbus_scripts/*.gs`. Frontend: `catbus_scripts/*.html` via HtmlService. Database: Google Sheets. Email: Gmail/MailApp. Account: Google Workspace (1,500 emails/day, 6 hrs runtime/day).

## Commands

Run all `clasp` from `catbus_scripts/` directory. Use skills:
- `/push` — push to Apps Script
- `/deploy` — deploy with correct `--deploymentId` (bare `clasp deploy` creates new URL, breaks 7 files)
- `/sync` — pull from Apps Script
- `/check-config` — verify Config.gs ↔ appointment_screening.html sync

## Key Files

| File | Role |
|---|---|
| `Config.gs` | All config: `CONFIG`, `SCHEDULE_CONFIG`, `ELIGIBILITY_CONFIG`, `APPOINTMENT_CONFIG` |
| `Router.gs` | Dispatches `?app=` → intake/queue/control/admin/alerts |
| `_Secrets.gs` | Instance secrets (gitignored, `_` prefix ensures load before Config.gs) |
| `shared_styles.html` | Shared stylesheet for all HTML pages |
| `appointment_screening.html` | Mirrors `ELIGIBILITY_CONFIG` — **update both** |

## Gotchas

- **Income limits:** Update `ELIGIBILITY_CONFIG` in `Config.gs` AND `appointment_screening.html`
- **Married returns:** Count as 2 in all metrics (column 6, Tax Return Tracker)
- **Deployment URL:** Use `google.script.run.getWebAppUrl()` — never hardcode
- **`webpage/config.js`:** Gitignored — upload to server with each redeploy
- **Polling:** Control sheet uses single endpoint `getVolunteerPollingStatus()` — don't add separate calls
- **HTML charts:** Use HTML/CSS only (not Google Sheets embedded)
- **Role CSS:** `.replace(/\s+/g, '')` — "internal services" → "internalservices"
- **Auto-refresh:** Pause when tab hidden, resume visible (add 0–2s jitter)
