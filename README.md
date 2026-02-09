# CATBUS - Client Appointment Tracking and Booking Unified System

A Google Apps Script-based volunteer coordination and client management platform for the UW AFSA Tax Clinic. CATBUS manages the full workflow from volunteer scheduling through client intake, queue management, and tax return completion.

**Users:** ~100 volunteers (filers, mentors, frontline, internal services), queue masters, and administrators.

---

## Project Structure

```
catbus_scripts/                    # Google Apps Script backend
├── Config.gs                      # Central configuration
├── Router.gs                      # Web app URL routing
├── ScheduleAutomation.gs          # Volunteer schedule generation
├── AvailabilityForm.gs            # Volunteer availability submission
├── VolunteerScheduleViewer.gs     # Schedule viewing
├── VolunteerSignInOut.gs          # Sign in/out tracking
├── ClientIntake.gs                # Client intake and eligibility
├── QueueManagement.gs             # Client queue operations
├── AppointmentBooking.gs          # Appointment booking + confirmation emails
├── AdminDashboard.gs              # Analytics and monitoring
├── ControlSheet.gs                # Volunteer dashboard
├── HelpRequests.gs                # Help request handling
├── ReviewRequests.gs              # Senior review requests
├── EmailReceipt.gs                # Post-filing email receipts
├── Utils.gs                       # Shared utilities
├── CacheManager.gs                # Cache management
├── RequestHandler.gs              # Request processing
├── *App.gs                        # Web app entry points (doGet)
├── *.html                         # Frontend UI files
├── *.bat                          # Clasp upload/download/deploy scripts
└── appsscript.json                # Apps Script manifest

webpage/                           # Public-facing website pages
├── index.html                     # Main landing page
├── appointment_screening.html     # Eligibility + complexity screening
├── FAQ.html                       # FAQ
├── PostFiling.html                # Post-filing info
├── catbus.html                    # CATBUS info portal
├── admin.html                     # Admin links
└── volunteerapplications.html     # Volunteer application info
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
| Morning | 9:45 AM - 1:15 PM |
| Afternoon | 1:00 PM - 4:30 PM |
| Evening | 4:15 PM - 8:00 PM |

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
4. **Deploy** a new version when ready:
   ```bash
   clasp deploy
   ```
   Or double-click `deploy.bat`. After deploying, copy the new web app URL from the Apps Script console.
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

All system configuration lives in [Config.gs](catbus_scripts/Config.gs):
- `SCHEDULE_CONFIG` — day labels, shift times, shift ID mappings
- `APPOINTMENT_CONFIG` — booking settings, client ID format
- `INCOME_LIMITS` — eligibility thresholds
- `SIGN_IN_OUT` — station count, exception stations
- `PERFORMANCE` — row limits for optimization

---

## Tech Stack

- **Backend:** Google Apps Script (V8 runtime)
- **Frontend:** HTML/CSS/JavaScript served via HtmlService
- **Database:** Google Sheets (append-only model)
- **Charts:** Chart.js
- **Deployment:** Google Apps Script Web Apps
- **Version Control:** Git + clasp
- **Cost:** $0 (Google Workspace)

---

## License

Internal use only -- UW AFSA Tax Clinic. Redistribution or use by other organizations requires explicit permission.

## Support

- Review Apps Script execution logs for errors
- See [catbus_scripts/README-CLASP.md](catbus_scripts/README-CLASP.md) for clasp troubleshooting
- Contact Ben Ma @ UW AFSA Tax Clinic
