# To-Do List — Design Spec

**Date:** 2026-04-12  
**Status:** Approved  
**Route:** `?app=todo`

---

## Context

CATBUS clinic coordinators need a centralized place to track key action items (clinic preparation tasks, volunteer management deadlines) with automatic escalating email reminders. Currently there is no structured way to manage these deadlines — they are tracked ad hoc. This tool gives coordinators a form-driven dashboard inside CATBUS to create, assign, and track tasks, with automated reminders sent to a fixed coordinator list at 14, 7, and 1 day(s) before each deadline.

---

## Data Model

### Sheet: "Coordinators"

| Column | Type | Notes |
|---|---|---|
| Name | String | Display name |
| Email | String | Email address for reminders |

Populated and managed via the To-Do List UI. Drives both the Responsible Individuals multi-select and the reminder email recipient list.

### Sheet: "Action Items"

| Column | Type | Notes |
|---|---|---|
| Title | String | Short task name |
| Description | String | Optional detail |
| Category | String | `Clinic Prep` or `Volunteer Management` |
| Due Date | Date | Target completion date |
| Responsible Individuals | String | Comma-separated names from coordinator list |
| Status | String | `Not Started`, `In Progress`, `Done` |
| Reminders Sent | String | Comma-separated thresholds already emailed, e.g. `14,7` |
| Created At | Timestamp | Set on creation |
| Updated At | Timestamp | Updated on every save |

---

## Configuration (`Config.gs`)

New `ACTION_ITEM_CONFIG` object added to `Config.gs`:

```js
const ACTION_ITEM_CONFIG = {
  REMINDER_THRESHOLDS: [14, 7, 1],  // days before due date
  SHEET_NAME: "Action Items",
  COORDINATORS_SHEET_NAME: "Coordinators"
};
```

Coordinator data is managed dynamically via the UI and stored in the **"Coordinators"** sheet (see below) — not hardcoded in config.

---

## UI — Dashboard (`todo_list.html`)

### Main View
- Table of all tasks with columns: Title, Category, Due Date, Responsible Individuals, Status, Days Until Due
- Color-coded urgency rows:
  - Red: ≤1 day until due (or overdue, not Done)
  - Orange: ≤7 days
  - Yellow: ≤14 days
  - Green: Done or >14 days out
- Filter buttons: by Category (`All`, `Clinic Prep`, `Volunteer Management`) and Status (`All`, `Not Started`, `In Progress`, `Done`)
- "Add Task" button opens modal form
- "Manage People" toggle expands the collapsible coordinator section below the task table

### Collapsible "Manage People" Section
Collapsed by default. Toggled by a "Manage People" button. Contains:
- List of existing coordinators: Name and Email in a simple table, with a Delete button per row
- "Add Person" inline form at the bottom: Name input, Email input, Add button
- Changes take effect immediately (no page reload needed)

### Modal Form (Create & Edit)
- **Title** — text input, required
- **Description** — textarea, optional
- **Category** — dropdown: `Clinic Prep` / `Volunteer Management`
- **Due Date** — date picker, required
- **Responsible Individuals** — multi-select checkboxes, populated from `ACTION_ITEM_CONFIG.COORDINATORS`
- **Status** — dropdown: `Not Started` / `In Progress` / `Done`
- Buttons: **Save**, **Cancel**, **Delete** (Delete only shown when editing an existing task)

---

## Backend

### New Files

**`TodoList.gs`** — data + reminder logic:
- `getTodoItems()` — reads all rows from Action Items sheet, returns array of objects
- `createTodoItem(data)` — appends new row
- `updateTodoItem(rowIndex, data)` — updates row by 1-based sheet row index, sets Updated At
- `deleteTodoItem(rowIndex)` — removes row by 1-based sheet row index
- `getCoordinators()` — reads all rows from Coordinators sheet
- `addCoordinator(data)` — appends a new coordinator row
- `deleteCoordinator(rowIndex)` — removes a coordinator row by 1-based sheet row index
- `sendTaskReminders()` — daily trigger function (see Reminders section)
- `setupTodoReminderTrigger()` — one-time setup, creates daily 9 AM trigger; checks for duplicates before creating

**`TodoListApp.gs`** — page server:
- `doGetTodoList()` — serves `todo_list.html` via `HtmlService.createTemplateFromFile()`

### Modified Files

**`Router.gs`** — add case:
```js
case 'todo': return doGetTodoList();
```

**`Config.gs`** — add `ACTION_ITEM_CONFIG` (see above)

**`webpage/admin.html`** — add a new `tool-card` tile:
```html
<a class="tool-card" href="...?app=todo">
    <div class="tool-card-title">To-Do List</div>
    <p class="tool-card-desc">Track key action items and deadlines for clinic coordinators.</p>
</a>
```

---

## Email Reminders

A daily time-based trigger calls `sendTaskReminders()` each morning at 9 AM.

### Algorithm
1. Read all rows from Action Items sheet where Status ≠ `Done`
2. For each task, compute `daysUntil = dueDate - today`
3. For each threshold in `[14, 7, 1]` (calendar days, not business days):
   - If `daysUntil === threshold` AND threshold not already in Reminders Sent column:
     - Add task to "tasks to remind" list for this run
     - Append threshold to Reminders Sent column for that row
4. If any tasks to remind: send one consolidated email to all coordinators
5. If no tasks hit a threshold: no email sent

### Email Format
- **To:** All addresses in `ACTION_ITEM_CONFIG.COORDINATORS`
- **Subject:** `[CATBUS] Task Reminders — X task(s) due soon`
- **Body:** HTML table (built via `buildHtmlEmail()` from `EmailService.gs`) listing:
  - Title, Category, Due Date, Responsible Individuals, Days Until Due
- Grouped by urgency (1-day tasks listed first, then 7-day, then 14-day)

### Overdue Handling
Tasks past their due date with Status ≠ `Done` are highlighted red in the dashboard but receive no additional emails beyond the 1-day threshold.

---

## Trigger Setup

`setupTodoReminderTrigger()` is called once by an admin (via Apps Script editor or a setup button). It follows the same duplicate-check pattern as `AppointmentBooking.gs`:
1. List existing triggers
2. If a trigger for `sendTaskReminders` already exists, skip
3. Otherwise create a new daily clock trigger at 9 AM

---

## Verification

1. Add `ACTION_ITEM_CONFIG` to `Config.gs` with at least one coordinator
2. Run `setupTodoReminderTrigger()` once from the Apps Script editor
3. Navigate to `?app=todo` — confirm dashboard loads with empty state
4. Create a task via the modal — confirm it appears in the sheet and dashboard
5. Edit the task — confirm changes persist
6. Delete the task — confirm row removed from sheet
7. Manually set a task's due date to today+1 and run `sendTaskReminders()` — confirm reminder email arrives with correct content and `1` is recorded in Reminders Sent
8. Run `sendTaskReminders()` again — confirm no duplicate email sent (threshold already recorded)
