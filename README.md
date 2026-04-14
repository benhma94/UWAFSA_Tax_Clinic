# CATBUS - Client And Tax Booking Utility System

A Google Apps Script-based volunteer coordination and client management platform for the UW AFSA Tax Clinic. CATBUS manages the full workflow from volunteer scheduling through client intake, queue management, and tax return completion.

**Users:** ~100 volunteers (filers, mentors, frontline, internal services), queue masters, and administrators.

---

## Project Structure

```
catbus_scripts/                    # Google Apps Script backend
├── _Secrets.gs                    # Instance-specific secrets (gitignored — copy from _Secrets.example.gs)
├── _Secrets.example.gs            # Secrets template for new deployments
├── .clasp.example.json            # Clasp config template (copy to .clasp.json and add Script ID)
├── Config.gs                      # Central configuration (reads from _Secrets.gs)
├── Router.gs                      # Web app URL routing
│
├── # Volunteer Management
├── AvailabilityForm.gs            # Volunteer availability submission
├── ScheduleAutomation.gs          # Automated schedule generation
├── ScheduleEditor.gs              # Manual shift editing per volunteer
├── ScheduleNotifications.gs       # Email alerts when schedules change
├── VolunteerScheduleViewer.gs     # Schedule viewing
├── VolunteerSignInOut.gs          # Sign in/out tracking
├── VolunteerApplications.gs       # Volunteer application form processing
├── VolunteerManagement.gs         # Volunteer data management & operations
├── VolunteerFeedbackForm.gs       # Volunteer feedback collection
├── FeedbackForm.gs                # General feedback form handling
│
├── # Client Management
├── ClientIntake.gs                # Client intake and eligibility
├── QueueManagement.gs             # Client queue operations
├── AppointmentBooking.gs          # Appointment booking + confirmation emails
├── ReviewRequests.gs              # Senior review requests (remote approve/return)
├── EmailReceipt.gs                # Post-filing email receipts
│
├── # Communication & Distribution
├── EmailService.gs                # Email sending wrapper
├── ProductCodeDistribution.gs     # UFILE product code distribution to volunteers
│
├── # Admin & Support Tools
├── AdminDashboard.gs              # Analytics and monitoring
├── ControlSheet.gs                # Volunteer dashboard
├── HelpRequests.gs                # Help request handling
├── ExpenseTracking.gs             # Volunteer expense and reimbursement tracking
├── RaffleDraw.gs                  # Raffle entry and winner selection
├── TodoList.gs                    # To-do list task management backend
├── QuizSubmission.gs              # Volunteer training quiz submission processing
├── ArchiveRollforward.gs          # Archive and rollforward functionality
├── Utils.gs                       # Shared utilities
├── CacheManager.gs                # Cache management
├── RequestHandler.gs              # Request routing and processing
│
├── # Frontend UI - Dashboards & Admin
├── shared_styles.html             # Shared CSS (theme vars, role colours, dark mode)
├── shared_scripts.html            # Shared JavaScript utilities
├── alert_dashboard.html           # System alerts and notifications
├── stats_dashboard.html           # Statistics and metrics dashboard
├── control_sheet_form.html        # Volunteer control sheet interface
├── volunteer_dashboard.html       # Volunteer main dashboard
├── volunteer_management.html      # Volunteer management interface
├── volunteer_schedule_dashboard.html  # Volunteer schedule view
├── volunteer_signinout.html       # Sign in/out interface
│
├── # Frontend UI - Operations & Forms
├── application_review.html        # Application review interface
├── catbus_intake_form.html        # Client intake form
├── appointment_screening.html     # Eligibility screening form
├── availability_form.html         # Volunteer availability submission form
├── product_code_dashboard.html    # Product code distribution UI
├── expense_tracker.html          # Expense tracking interface
├── raffle_draw.html              # Raffle draw interface
├── todo_list.html                # To-do list UI
├── quiz_review.html              # Quiz review interface
├── archive_rollforward.html      # Archive/rollforward operations UI
├── mass_email.html               # Mass email sending interface
├── queue_dashboard.html          # Client queue management
├── schedule_dashboard.html       # Schedule management
│
├── *App.gs                        # Web app entry points (doGet)
├── *.bat                          # Clasp upload/download/deploy scripts
└── appsscript.json                # Apps Script manifest

webpage/                           # Public-facing website pages
├── config.js                      # Deployment URL config (gitignored — copy from config.example.js)
├── config.example.js              # Config template for new deployments
├── index.html                     # Main landing page
├── about.html                     # About Us page
├── appointment_screening.html     # Eligibility + complexity screening
├── FAQ.html                       # FAQ
├── PostFiling.html                # Post-filing info
├── catbus.html                    # CATBUS info portal
├── admin.html                     # Admin links
├── volunteerapplications.html     # Volunteer application info
├── shared.css                     # Shared public site stylesheet (header, nav, footer)
└── shared.js                      # Injects shared header/nav/footer into all pages
```

---

## System Workflows

### Volunteer Scheduling

1. Volunteers submit availability via the availability form
2. Admin generates schedule using `ScheduleAutomation.gs`
3. Volunteers view their assigned shifts on the schedule dashboard
4. Day-of: volunteers sign in/out at their station

**Schedule:** 4 days x 3 shifts = 12 total shifts

| Shift | Time |
|-------|------|
| Morning | 9:45 AM – 1:15 PM |
| Afternoon | 1:00 PM – 4:45 PM |
| Evening | 4:30 PM – 8:15 PM |

Shift IDs use format `D{day}{shift}` (e.g., D1A = Day 1 Morning, D3C = Day 3 Evening).

### Walk-in Client Intake

1. Receptionist screens eligibility and registers client via intake form
2. System generates a Client ID (A001-Z999)
3. Client enters the queue
4. Queue master assigns client to an available volunteer
5. Volunteer prepares tax return with mentor support
6. System sends email receipt on completion

### Appointment Booking (Complex Cases)

1. Client completes eligibility screening on `appointment_screening.html`
2. If eligible, complexity screening determines if they need an appointment
3. Complex cases (5+ tax years, childcare expenses, foreign co-op income) book an appointment via Google Form
4. System generates a priority Client ID (P001, P002...) and sends a confirmation email with situation-specific document requirements

**Eligibility limits:** $40k individual / $55k couple (+$5k per dependent), waived with tuition credits (T2202).

### Schedule Editing & Notifications

1. Admin manually adjusts individual shifts using `ScheduleEditor.gs` (add/remove shifts per volunteer)
2. `ScheduleNotifications.gs` sends an HTML email to affected volunteers showing their before/after shift assignments

### Product Code Distribution (UFILE)

1. Admin opens the product code dashboard (`ProductCodeDistributionApp.gs`)
2. Preview mode shows which volunteers will receive codes (filers prioritized over mentors; frontline excluded)
3. Codes are distributed in pairs; a log sheet prevents duplicate distribution
4. Individual codes can also be sent manually from the dashboard

### Internal Messaging

1. Manager opens `messaging_admin.html` and selects a volunteer from the list
2. Messages are sent and received in a two-panel chat interface with unread badge counts
3. Supports alert and chat message types; auto-refreshes every 5–15 seconds

### Remote Review

1. Reviewer opens `reviewer_page.html` and selects their identity
2. Cards display pending review requests: volunteer name, client ID, tax year, and wait time
3. Reviewer approves or returns the submission with optional correction notes
4. Client intake details are expandable inline; dashboard auto-refreshes every 15 seconds

### Volunteer Applications & Feedback

1. Prospective volunteers complete the application form via `volunteerapplications.html`
2. Applications are processed and tracked in `VolunteerApplications.gs`
3. Existing volunteers provide feedback via `VolunteerFeedbackForm.gs`
4. Admin reviews feedback and manages volunteer records via `VolunteerManagement.gs`

### Expense Tracking & Reimbursement

1. Volunteers submit expense reports via `expense_tracker.html`
2. `ExpenseTracking.gs` processes expense entries and generates reimbursement summaries
3. Admin reviews and approves expenses through the expense dashboard
4. Reimbursement records are maintained for accounting integration

### Training Quiz System

1. Volunteers complete training quizzes via `quiz_review.html`
2. `QuizSubmission.gs` validates and grades quiz responses
3. Admin reviews quiz results and tracks volunteer certification status
4. Completion status is recorded for volunteer management

### Volunteer Raffle & Incentives

1. Admin opens the raffle dashboard via `raffle_draw.html`
2. `RaffleDraw.gs` manages raffle entries and winner selection
3. Raffle draws can be conducted with configurable settings for participant groups
4. Winner notifications are sent automatically

### To-Do List & Task Management

1. Volunteers and admins access the task dashboard via `todo_list.html`
2. `TodoList.gs` and `TodoListApp.gs` handle task creation, assignment, and completion tracking
3. Tasks are organized by priority and due date
4. Team members receive notifications for assigned tasks

### Archive & Rollforward

1. End-of-season operations are handled via `archive_rollforward.html`
2. `ArchiveRollforward.gs` manages archiving of completed client records and volunteer data
3. System can rollforward selected data to the next season while maintaining historical records
4. Supports batch archival and selective data retention

---

## Development Workflow

### Prerequisites

- Node.js installed
- Google Apps Script API enabled at https://script.google.com/home/usersettings
- Clasp installed: `npm install -g @google/clasp`
- Logged in: `clasp login`

See [catbus_scripts/README-CLASP.md](catbus_scripts/README-CLASP.md) for full setup instructions.

### Edit, Push, Deploy

1. **Edit** `.gs` and `.html` files locally in `catbus_scripts/`
2. **Push** to Google Apps Script:
   ```bash
   cd catbus_scripts
   clasp push
   ```
   Or double-click `upload.bat`.
3. **Test** via the Apps Script editor or web app URL
4. **Deploy** a new version when ready — always use `--deploymentId` to update the existing deployment (bare `clasp deploy` creates a new URL and breaks all links):
   ```bash
   clasp deploy --deploymentId <your-deployment-id> --description "description"
   ```
   Or double-click `deploy.bat`.
5. **Commit** to git:
   ```bash
   git add -A && git commit -m "description of changes"
   ```

### Pulling Remote Changes

If edits were made in the online Apps Script editor:
```bash
cd catbus_scripts
clasp pull
```
Or double-click `download.bat`. This overwrites local files.

---

## Configuration

Instance-specific secrets live in [_Secrets.gs](catbus_scripts/_Secrets.gs) (gitignored):
- `SPREADSHEET_ID`, `CONSOLIDATED_VOLUNTEERS_SHEET_ID`, `RESUME_FOLDER_ID`
- `CLINIC_EMAIL`, `CLINIC_WEBSITE_URL`, `BOOKING_FORM_URL`, `WEBAPP_URL`

Copy `_Secrets.example.gs` → `_Secrets.gs` and fill in your values. This file is never committed.

The Apps Script project ID lives in [.clasp.json](catbus_scripts/.clasp.example.json) (gitignored):

Copy `.clasp.example.json` → `.clasp.json` and add your Script ID. This file is never committed.

All other system configuration lives in [Config.gs](catbus_scripts/Config.gs):
- `SCHEDULE_CONFIG` — day labels, shift times, shift ID mappings
- `APPOINTMENT_CONFIG` — booking settings, client ID format
- `INCOME_LIMITS` — eligibility thresholds
- `SIGN_IN_OUT` — station count, exception stations
- `PERFORMANCE` — row limits for optimization
- `MESSAGING_CONFIG` — sheet name, column mappings, polling interval (10s), message retention (7 days)
- `PRODUCT_CODE_CONFIG` — UFILE code sheet references and email template subject
- `VOLUNTEER_TAGS` — custom display tags per volunteer

---

## Setup for a New Deployment

To run your own instance of CATBUS:

1. **Create a Google Apps Script project** and a Google Sheet for the database
2. **Configure secrets** — copy `catbus_scripts/_Secrets.example.gs` → `_Secrets.gs` and fill in your IDs, emails, and URLs
3. **Configure clasp** — copy `catbus_scripts/.clasp.example.json` → `.clasp.json` and add your Script ID
4. **Push code** — `cd catbus_scripts && clasp push`
5. **Deploy** — create an initial web app deployment in Apps Script (Deploy → New Deployment), then record the deployment ID and add it to `_Secrets.gs` as `WEBAPP_URL`
6. **Configure webpage** — copy `webpage/config.example.js` → `webpage/config.js`, fill in your deployment URL, and upload `config.js` to your server alongside the HTML files
7. **Update config** — edit `Config.gs` to set your clinic dates, room locations, income limits, and shift schedule

---

## Tech Stack

- **Backend:** Google Apps Script (V8 runtime)
- **Frontend:** HTML/CSS/JavaScript served via HtmlService
- **Database:** Google Sheets (append-only model)
- **Charts:** Chart.js
- **Deployment:** Google Apps Script Web Apps
- **Version Control:** Git + clasp

---

## License

Free to fork and adapt for similar tax clinics or volunteer organizations, with attribution to the UW AFSA Tax Clinic. All other uses require explicit permission.

## Support

- Review Apps Script execution logs for errors
- See [catbus_scripts/README-CLASP.md](catbus_scripts/README-CLASP.md) for clasp troubleshooting
