# Master Dashboard (CATBUS Kit)

## Context

The user has mocked up a "CATBUS Kit" in Claude Design — a consolidated admin dashboard that reflects five existing CATBUS tools (Queue, Volunteers, Schedule, Coverage, Stats) in one tabbed interface. The new `master_dashboard.html` is a **view-and-act overlay**: it calls the same backends the standalone dashboards already call, and the standalone dashboards **remain unchanged and fully functional for redundancy**. The only visual change to existing pages is a shared TopBar (see "Shared TopBar rollout" below).

Scoped adjustments from the design kit:
- Queue: **drop** "+ Add walk-in"; **add** a Reassign action (backend already exists).
- Volunteers: **drop** add/edit/message; **replace right side of each card with that volunteer's active return(s)** — client ID, filing years, situations, minutes on client. Exact wording isn't prescriptive; the point is showing active-return data.
- Schedule + Coverage: ported as-designed.
- Stats: **drop** "Returns by volunteer role" chart.
- Intake: **not included.**

Routing change per user: `?app=admin` → the new master dashboard; the existing stats dashboard moves to `?app=stats` (preserved verbatim).

## Shared TopBar rollout

Extract the design kit's TopBar (logo + `CATBUS` title + `Client And Tax Booking Utility System` subtitle + dark-mode toggle) into a new include file [catbus_scripts/shared_topbar.html](../catbus_scripts/shared_topbar.html). **Omit the user/role/avatar block** — CATBUS has no login. The toggle reuses the existing dark-mode class (`html.dark`) already honored by `shared_styles.html`.

Include `<?!= include('shared_topbar') ?>` at the top of `<body>` in:
- [catbus_scripts/catbus_intake_form.html](../catbus_scripts/catbus_intake_form.html)
- [catbus_scripts/queue_dashboard.html](../catbus_scripts/queue_dashboard.html)
- [catbus_scripts/control_sheet_form.html](../catbus_scripts/control_sheet_form.html)
- [catbus_scripts/alert_dashboard.html](../catbus_scripts/alert_dashboard.html)
- [catbus_scripts/stats_dashboard.html](../catbus_scripts/stats_dashboard.html)
- [catbus_scripts/master_dashboard.html](../catbus_scripts/master_dashboard.html) (new)

Scope guard: touch only the `<body>` opener in each file — don't alter existing page markup, styles, or scripts.

## Files to modify / create

**New:**
- [catbus_scripts/master_dashboard.html](../catbus_scripts/master_dashboard.html) — single-page tabbed dashboard with five sections.
- [catbus_scripts/shared_topbar.html](../catbus_scripts/shared_topbar.html) — reusable TopBar include (no login/user block).

**Modify:**
- [catbus_scripts/Router.gs:93-94](../catbus_scripts/Router.gs#L93-L94) — change `case 'admin'` to `master_dashboard`; add `case 'stats'` pointing at `stats_dashboard`.
- [catbus_scripts/AdminDashboard.gs](../catbus_scripts/AdminDashboard.gs) — add thin aggregator `getMasterDashboardData()` that fans out to existing functions in one `google.script.run` call. No changes to existing logic.
- Five existing HTML files get one line added: `<?!= include('shared_topbar') ?>` inside `<body>` (see "Shared TopBar rollout"). No other changes.

**No behavioral changes to:**
- Standalone pages (`queue_dashboard`, `stats_dashboard`, `schedule_dashboard`, `volunteer_management`, etc.) — remain **fully functional and routed as before** (`?app=queue`, `?app=schedule`, `?app=volunteermgmt`, `?app=stats`) for redundancy.

## Backend wiring (all functions already exist)

| Section | Reuses |
|---|---|
| Queue | [QueueManagement.gs:335 `getQueueData()`](../catbus_scripts/QueueManagement.gs#L335), [L487 `reassignClientToVolunteer()`](../catbus_scripts/QueueManagement.gs#L487), [L226 `getAvailableVolunteers()`](../catbus_scripts/QueueManagement.gs#L226) |
| Volunteers (signed-in + active) | [ControlSheet.gs:41 `getVolunteersAndClients()`](../catbus_scripts/ControlSheet.gs#L41), [AdminDashboard.gs:196 `getActiveReturns()`](../catbus_scripts/AdminDashboard.gs#L196) |
| Schedule | [ScheduleAutomation.gs:1112 `generateScheduleFromDashboard()`](../catbus_scripts/ScheduleAutomation.gs#L1112), [L639 `outputScheduleToSheet()`](../catbus_scripts/ScheduleAutomation.gs#L639) |
| Coverage | [ScheduleAutomation.gs:1178 `getVolunteerDistribution()`](../catbus_scripts/ScheduleAutomation.gs#L1178) — returns `shiftRoleCounts` keyed `D{1-4}{A-C}`; render as a day×slot heatmap client-side. No new server fn. |
| Stats | [AdminDashboard.gs:424 `getAdminDashboardData()`](../catbus_scripts/AdminDashboard.gs#L424) — pull `returnSummary`, `performanceMetrics.topVolunteers`, `performanceMetrics.todayVolunteers`; **skip** the role-bucketed bar chart. |

New `getMasterDashboardData()` in AdminDashboard.gs: returns `{ queue: getQueueData(), signedIn: getVolunteersAndClients(), activeReturns: getActiveReturns(stationMap_), stats: getAdminDashboardData(today) }`. Read-only; no new writes.

## Frontend structure (master_dashboard.html)

Tabs: `📋 Queue · 👥 Volunteers · 🗓️ Schedule · 🔥 Coverage · 📊 Stats` (no Intake).

- **Shell**: `<?!= include('shared_styles') ?>` then a `<style>` block porting the kit's `catbus.css` tokens (`--accent: rgb(142,0,0)`, stat cards, `.data-table` with `.warn`/`.danger` severity rows, `.vol-card` grid, role pills, modals, toast, theme toggle). Respect existing dark-mode class (`html.dark`).
- **TopBar**: via `<?!= include('shared_topbar') ?>`. **Tabs + Footer**: mirror the kit's `components.jsx` structure in vanilla JS / innerHTML (no React) — this codebase doesn't use React.
- **Queue tab**: stat cards (In Queue / Avg Wait / Longest Wait / Volunteers on Floor) + `.data-table` with severity rows (≥15m warn, ≥30m danger). Per-row actions: **Assign to me** (when unassigned) and **Reassign** (when assigned) → opens a Modal with a volunteer `<select>` populated from `getAvailableVolunteers()`, confirms via `reassignClientToVolunteer()`. **No "+ Add walk-in" button.**
- **Volunteers tab**: `card-grid` of `vol-card`s for every signed-in volunteer (from `getVolunteersAndClients()`). Each card: name, program, role pill, status (On floor / Break / Off-site). The right side of each card surfaces that volunteer's **active return(s)** from `getActiveReturns()` — client ID, filing years, situations, `minutesOnClient`. Volunteers with no active return show an idle indicator. **No add/edit/message buttons** and no TopBar "add volunteer" CTA.
- **Schedule tab**: port the kit's Schedule page — Day Labels form, Update Mode checkboxes (lockPast / partial / notify), Generate button calling `generateScheduleFromDashboard()`, then the results block (StatCards, role breakdown, shortfalls, shift distribution bars). Schedule Editor form at bottom.
- **Coverage tab**: 3 shifts × 4 days heatmap table. Cells coloured by target thresholds from the kit (`≥12 green · ≥9 yellow · <9 red`). Data from `getVolunteerDistribution()` — sum role counts per shift for total.
- **Stats tab**: stat cards (Returns filed YTD, Refund processed, T2202 students, Newcomer ITNs) + "Client situations served" bar chart. **Omit "Returns by volunteer role".**

All data calls go through `google.script.run.withSuccessHandler(...)`. Tabs lazy-load on first activation; Queue tab auto-refreshes every 20s with visibility-gated polling per CLAUDE.md guidance.

## Router change

[catbus_scripts/Router.gs:93-94](../catbus_scripts/Router.gs#L93-L94):

```js
case 'admin':
  return loadPage('master_dashboard', 'Master Dashboard', { vars: { baseUrl, adminWebsiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/admin' } });
case 'stats':
  return loadPage('stats_dashboard', 'Stats Dashboard', { vars: { baseUrl, adminWebsiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/admin' } });
```

## Verification

1. `/push` to Apps Script, then `/deploy` (uses correct `--deploymentId` — never bare `clasp deploy`).
2. Open `?app=admin` → master dashboard loads; all five tabs render; dark-mode toggle flips theme.
3. Queue tab: unassigned row shows "Assign to me"; assigned row shows "Reassign" → modal volunteer picker → confirms write to sheet.
4. Volunteers tab: every signed-in volunteer appears once; those with active clients show client ID + minutes.
5. Schedule tab: Generate produces stat cards + role breakdown + shortfalls; editor saves a volunteer's shifts.
6. Coverage tab: heatmap renders 3×4 with correct red/yellow/green thresholds vs. live `getVolunteerDistribution()`.
7. Stats tab: YTD/today metrics populated; no "Returns by volunteer role" chart present.
8. `?app=stats` still loads the original stats dashboard unchanged.
9. `?app=queue`, `?app=schedule`, `?app=volunteermgmt` — existing pages untouched and functional.
10. Shared TopBar appears on intake, queue, control sheet, alert, stats, and master dashboards; no user/login block is rendered; dark-mode toggle in the TopBar flips the theme consistently across all six pages.
