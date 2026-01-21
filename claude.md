# CATBUS Tax Clinic System - Architecture Overview

## System Overview

The CATBUS (Client Appointment Tracking and Booking Unified System) is a comprehensive tax clinic management system built on Google Apps Script with HTML frontends. It manages the entire workflow from volunteer scheduling to client intake and queue management.

---

## Architecture

### Technology Stack
- **Backend:** Google Apps Script (JavaScript)
- **Frontend:** HTML/CSS/JavaScript served via `HtmlService`
- **Database:** Google Sheets
- **Email:** Gmail via `MailApp`
- **Deployment:** Google Apps Script Web Apps

### File Structure

```
catbus_scripts/                    # Google Apps Script backend
├── Config.gs                      # Central configuration (SCHEDULE_CONFIG, APPOINTMENT_CONFIG)
├── Router.gs                      # URL routing for web apps
│
├── # Volunteer Management
├── AvailabilityForm.gs           # Volunteer availability submission logic
├── AvailabilityFormApp.gs        # Entry point for availability form
├── availability_form.html        # Volunteer availability form UI
├── ScheduleAutomation.gs         # Automated schedule generation
├── VolunteerScheduleViewer.gs    # Schedule viewing logic
├── VolunteerScheduleViewerApp.gs # Entry point for schedule viewer
├── volunteer_schedule_dashboard.html  # Schedule dashboard UI
├── schedule_dashboard.html       # Admin schedule view
├── VolunteerSignInOut.gs         # Sign in/out tracking
├── VolunteerSignInOutApp.gs      # Entry point for sign in/out
├── volunteer_signinout.html      # Sign in/out UI
│
├── # Client Management
├── ClientIntake.gs               # Client intake logic
├── ClientIntakeApp.gs            # Entry point for intake form
├── catbus_intake_form.html       # Receptionist intake form UI
├── QueueManagement.gs            # Queue operations
├── QueueDashboardApp.gs          # Entry point for queue dashboard
├── queue_dashboard.html          # Queue management UI
│
├── # Appointment Booking (Public)
├── AppointmentBooking.gs         # Appointment booking + confirmation emails
│
├── # Admin & Support
├── AdminDashboard.gs             # Admin operations
├── AdminDashboardApp.gs          # Entry point for admin
├── admin_dashboard.html          # Admin UI
├── ControlSheet.gs               # Control sheet operations
├── ControlSheetApp.gs            # Entry point for control sheet
├── control_sheet_form.html       # Control sheet UI
├── HelpRequests.gs               # Help request handling
├── ReviewRequests.gs             # Senior review requests
├── EmailReceipt.gs               # Email receipt generation
│
├── # Utilities
├── Utils.gs                      # Shared utility functions
├── CacheManager.gs               # Cache management
├── RequestHandler.gs             # Request processing
├── VersionCheck.gs               # Version management
└── TestAvailability.gs           # Testing utilities

webpage/                           # Public-facing static pages
├── index.html                     # Main website
├── appointment_screening.html     # Public eligibility + complexity screening
├── FAQ.html                       # FAQ page
├── PostFiling.html               # Post-filing info
├── admin.html                    # Admin links
├── catbus.html                   # CATBUS info
└── volunteerapplications.html    # Volunteer application info
```

---

## Core Workflows

### 1. Volunteer Scheduling Flow

```
Volunteer submits availability (availability_form.html)
            ↓
AvailabilityForm.gs stores shift IDs (D1A, D1B, etc.)
            ↓
Admin runs ScheduleAutomation.gs
            ↓
System generates optimal schedule
            ↓
Volunteers view schedule (volunteer_schedule_dashboard.html)
            ↓
Day-of: Volunteers sign in/out (volunteer_signinout.html)
```

**Shift ID System:**
- Format: `D{day}{shift}` (e.g., D1A = Day 1, Morning)
- Days: D1, D2, D3, D4 (Saturday Mar 21, Sunday Mar 22, Saturday Mar 28, Sunday Mar 29)
- Shifts: A = Morning (9:45-1:15), B = Afternoon (1:00-4:45), C = Evening (4:30-8:15)
- 15-minute overlaps for smooth transitions

### 2. Client Intake Flow (Walk-ins)

```
Client arrives at clinic
            ↓
Receptionist uses catbus_intake_form.html
            ↓
ClientIntake.gs assigns Client ID (A001, B001, etc.)
            ↓
Client added to queue (QueueManagement.gs)
            ↓
Queue dashboard shows next client
            ↓
Volunteer claims client
            ↓
Filing complete → EmailReceipt.gs sends receipt
```

**Client ID System:**
- Walk-ins: A001, B001, C001... (letter prefix rotates)
- Priority appointments: P001, P002, P003...

### 3. Appointment Booking Flow (Complex Cases)

```
Client visits appointment_screening.html
            ↓
STEP 1: Eligibility Screening
- Tuition credits check
- Income limits check
- Self-employment/crypto check
- Bankruptcy/deceased check
- Rental income check
- Capital gains check
- Foreign property check
            ↓
      ┌─────┴─────┐
      ↓           ↓
INELIGIBLE      ELIGIBLE
(alternatives   Continue to
 shown)         Step 2
            ↓
STEP 2: Complexity Screening
- Tax years (5+ = complex)
- Childcare expenses
- Foreign co-op income
            ↓
      ┌─────┴─────┐
      ↓           ↓
   SIMPLE      COMPLEX
   (walk-in)   (book appointment)
                    ↓
            Google Form submission
                    ↓
            AppointmentBooking.gs processes
                    ↓
            Priority Client ID generated (P001)
                    ↓
            Confirmation email with situation-specific docs
```

**Complexity Criteria (triggers appointment recommendation):**
1. More than 3 years of late tax returns
2. Childcare expenses
3. Foreign co-op income

**Eligibility Criteria (any = ineligible):**
1. Income over limits without tuition credits ($35K individual, $45K couple)
2. Self-employment income or crypto transactions
3. Filing for bankruptcy or deceased person
4. Rental income
5. Capital gains (sold real estate, stocks, etc.)
6. Foreign property over $100K

---

## Key Configuration

### SCHEDULE_CONFIG (Config.gs)
Central configuration for volunteer scheduling:
- Day labels (dates)
- Shift definitions (times)
- Shift ID mappings

### APPOINTMENT_CONFIG (Config.gs)
Appointment booking settings:
- Sheet name
- Column mappings
- Client ID format (P prefix)

---

## Confirmation Email Logic

The appointment confirmation email (AppointmentBooking.gs) includes situation-specific document requirements:

| Situation | Additional Documents |
|-----------|---------------------|
| More than 3 years late returns | Tax slips for each year, NOA for each prior year |
| Childcare expenses | Child's SIN/ITN, childcare receipts, custody agreement |
| Foreign co-op income | Foreign income docs, arrival date, work permit/visa |

---

## Deployment

### Clasp Commands
```bash
clasp push          # Upload changes to Apps Script
clasp push --force  # Force upload (overwrites remote)
clasp pull          # Download from Apps Script
clasp deploy        # Create new deployment
```

### Web App URLs
- Each `*App.gs` file serves as an entry point with `doGet()` function
- Deploy as web app with "Execute as: Me" and "Who has access: Anyone" for public pages

---

## Recent Changes Log

### 2026-01-21
- ✅ Split rental income and capital gains into separate eligibility questions
- ✅ Added situation-specific document requirements to confirmation email

### 2026-01-08
- ✅ Refactored to shift ID-based architecture (D1A, D1B, etc.)
- ✅ Removed hardcoded time slot string parsing
- ✅ Fixed schedule viewer morning/evening shift display bug

### 2026-01-07
- ✅ Updated volunteer time slots (Morning: 9:45-1:15, Afternoon: 1:00-4:45, Evening: 4:30-8:15)
- ✅ Added backward compatibility for old time slot formats
- ✅ Implemented queue client removal with audit trail

---

## Google Sheets Structure

| Sheet | Purpose |
|-------|---------|
| Volunteer Availability | Stores volunteer shift availability (shift IDs) |
| Generated Schedule | Output from ScheduleAutomation |
| Client Intake | Walk-in client records |
| Appointment Bookings | Pre-booked appointment records |
| Queue | Active client queue |
| Sign In/Out | Volunteer attendance tracking |

---

## Notes for Future Development

1. **Changing Time Slots:** Update SCHEDULE_CONFIG in Config.gs only (shift IDs remain stable)
2. **Adding Eligibility Criteria:** Update appointment_screening.html and corresponding JavaScript
3. **Modifying Email Content:** Update buildConfirmationEmailBody() in AppointmentBooking.gs
4. **Adding New Complexity Triggers:** Add checkbox to Google Form, add matching logic to email builder
