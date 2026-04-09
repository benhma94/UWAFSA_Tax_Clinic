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
├── MentorTeams.gs                 # Mentor-to-senior-mentor pairing
├── VolunteerScheduleViewer.gs     # Schedule viewing
├── VolunteerSignInOut.gs          # Sign in/out tracking
│
├── # Client Management
├── ClientIntake.gs                # Client intake and eligibility
├── QueueManagement.gs             # Client queue operations
├── AppointmentBooking.gs          # Appointment booking + confirmation emails
├── ReviewRequests.gs              # Senior review requests (remote approve/return)
├── EmailReceipt.gs                # Post-filing email receipts
│
├── # Communication
├── Messaging.gs                   # Internal manager-to-volunteer messaging
├── ProductCodeDistribution.gs     # UFILE product code distribution to volunteers
│
├── # Admin & Support
├── AdminDashboard.gs              # Analytics and monitoring
├── ControlSheet.gs                # Volunteer dashboard
├── HelpRequests.gs                # Help request handling
├── Utils.gs                       # Shared utilities
├── CacheManager.gs                # Cache management
├── RequestHandler.gs              # Request processing
│
├── # Frontend UI
├── shared_styles.html             # Shared CSS (theme vars, role colours, dark mode)
├── messaging_admin.html           # Manager chat UI with unread badges
├── reviewer_page.html             # Remote review approval/return dashboard
├── product_code_dashboard.html    # Product code distribution dashboard
├── *.html                         # Other frontend UI files
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

### Mentor Team Management

1. Admin runs `MentorTeams.gs` after the schedule is generated
2. First-time mentors are paired with senior mentors based on shared shift availability
3. Round-robin load balancing distributes first-time mentors evenly across seniors

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
