# CATBUS - Client And Tax Booking Utility System

**Client And Tax Booking Utility System (CATBUS)** is a Google Apps Script-based volunteer coordination and client management platform designed specifically for the UW AFSA Tax Clinic.

---

## Overview

CATBUS is the Tax Clinic's complete ERP system, built entirely on Google Sheets and Apps Script. It manages the full client lifecycle from intake to tax return completion, providing workflow management for:

- **Frontline** handling client intake
- **Queue Masters** managing queue and volunteer allocation
- **~100 Volunteers** preparing tax returns
- **Mentors** providing real-time support and reviews

### System Flow
1. **Frontline** screens client eligibility and registers them
2. **Client** waits in queue (physical or virtual)
3. **Queue Master** assigns client to available volunteer
4. **Volunteer** prepares tax return with mentor support
5. **System** tracks completion and sends email receipt

---

## 📁 Project Structure

```
catbus_scripts/
├── Configuration
│   └── Config.gs                    # Centralized spreadsheet IDs, column mappings, constants
├── Core Utilities
│   ├── Utils.gs                     # Shared helper functions, validation, error handling
│   └── Router.gs                    # Web app routing and deployment
├── Business Logic
│   ├── ClientIntake.gs              # Eligibility screening and client registration
│   ├── QueueManagement.gs           # Client queue and volunteer assignment
│   ├── RequestHandler.gs            # Generic request system (help & review)
│   ├── HelpRequests.gs              # Volunteer help request wrappers
│   ├── ReviewRequests.gs            # Tax return review request wrappers
│   ├── VolunteerSignInOut.gs        # Station management and session tracking
│   ├── ControlSheet.gs              # Volunteer dashboard data
│   ├── ScheduleAutomation.gs        # Volunteer shift scheduling
│   ├── AdminDashboard.gs            # Analytics and performance metrics
│   └── EmailReceipt.gs              # Post-filing client communications
├── Web App Entry Points
│   ├── ClientIntakeApp.gs
│   ├── QueueDashboardApp.gs
│   ├── AdminDashboardApp.gs
│   ├── ControlSheetApp.gs
│   ├── VolunteerSignInOutApp.gs
│   ├── AvailabilityFormApp.gs
│   ├── ScheduleDashboardApp.gs
│   └── VolunteerScheduleDashboardApp.gs
└── UI Layer (HTML)
    ├── catbus_intake_form.html      # Client eligibility screener
    ├── queue_dashboard.html         # Queue management dashboard
    ├── admin_dashboard.html         # Analytics and monitoring
    ├── control_sheet_form.html      # Volunteer control panel
    ├── volunteer_signinout.html     # Sign-in/out interface
    ├── availability_form.html       # Volunteer availability collection
    ├── schedule_dashboard.html      # Schedule generation tool
    └── volunteer_schedule_dashboard.html  # Schedule viewing interface
```

---

## 🗄️ Data Model

The system uses **11 Google Sheets** within a single spreadsheet:

| Sheet Name | Purpose | Key Columns |
|------------|---------|-------------|
| **Client Intake** | New client data | Timestamp, Household, Filing Years, Situations, Client ID, High Priority, Senior Review |
| **Client Assignment** | Client-volunteer pairings | Timestamp, Client ID, Volunteer, Completed |
| **Help Requests** | Real-time mentor support | Timestamp, Volunteer, Status (Active/Escalated/Cleared) |
| **Review Requests** | Tax return review tracking | Timestamp, Volunteer, Status (Requested/Completed/Cancelled) |
| **Tax Return Tracker** | Filing completion records | Timestamp, Volunteer, Client ID, Tax Year, Reviewer, E-file/Paper |
| **Volunteer List** | Sign-in records | Timestamp, Name, Station, Session ID |
| **SignOut** | Sign-out records | Timestamp, Volunteer Info, Session ID |
| **Schedule Availability** | Form responses for preferences | (Form-generated columns) |
| **Schedule Output** | Generated volunteer schedule | (Schedule data) |

### Client ID System
- **Format**: `A001` through `Z999` (supports up to 26,000 clients)
- **Generation**: Atomic using `LockService` to prevent race conditions
- **Rollover**: Sequential per letter, advances to next letter when exhausted

---

## System Components

### 1. Client Intake (`app=intake`)
**Users**: Receptionists
**Interface**: `catbus_intake_form.html`

**Features**:
- Two-stage intake process:
  1. **Eligibility Screening**: Tuition credits, income limits, exclusion checks
  2. **Main Intake**: Household info, filing years, special situations, flags
- Real-time conditional UI (questions appear/hide based on answers)
- Client ID generation with concurrency protection
- High priority and senior review flagging

**Eligibility Rules**:
- Tuition credits (T2202 form) = automatic eligibility
- Income limits: $35k individual, $45k couple, +$2.5k per dependent
- Exclusions: self-employment, bankruptcy, rental income, foreign property

### 2. Queue Master Dashboard (`app=queue`)
**Users**: Doormen
**Interface**: `queue_dashboard.html`

**Features**:
- Real-time client queue with wait times
- Priority sorting (high priority first, then FIFO)
- Color-coded urgency: yellow (15+ min), pulsing red (30+ min)
- Available volunteer list (excludes busy, mentors, receptionists)
- One-click client assignment
- Mobile-responsive with card layout
- Auto-refresh every 30 seconds
- Manual refresh button

**Assignment Rules**:
- One client per volunteer maximum
- Validates client exists and unassigned
- Validates volunteer availability
- Optimized to check only recent 500 assignments

### 3. Control Sheet (`app=control`)
**Users**: Volunteers
**Interface**: `control_sheet_form.html`

**Features**:
- View assigned client details (filing years, situations, notes, flags)
- Submit help requests (Active → Escalated → Cleared)
- Request tax return reviews
- Track return completion per tax year
- Send email receipts with attachments
- Dark mode toggle with persistence

### 4. Admin Dashboard (`app=admin`)
**Users**: Mentors, Administrators
**Interface**: `admin_dashboard.html`

**Features**:
- **Live Monitoring**:
  - Active help requests (sorted by wait time)
  - Review requests (sorted by wait time)
  - Real-time status updates (10-second auto-refresh)

- **Return Completion Analytics**:
  - Total completed returns (all-time)
  - Returns completed today
  - Hourly completion bar chart (Chart.js)

- **Volunteer Performance Metrics** ✨ NEW:
  - Total active volunteers
  - Average returns per volunteer
  - Top 10 volunteers all-time leaderboard
  - Top 10 volunteers today (daily rankings)
  - Real-time performance tracking

- **UI Enhancements** ✨ NEW:
  - Manual refresh button
  - Dark mode with localStorage persistence
  - Improved mobile responsiveness

### 5. Schedule Assignment Generator (`app=assignment`)
**Users**: Administrators
**Interface**: `schedule_dashboard.html`

**Features**:
- Generate volunteer schedules from availability submissions
- 4 days × 3 shifts per day = 12 total shifts
- Shift times: 9:30-1:15, 1:00-4:45, 4:30-8:30
- Configurable assignment constraints
- Exports to Schedule Output sheet

### 6. Volunteer Schedule Viewer (`app=schedule`)
**Users**: Volunteers
**Interface**: `volunteer_schedule_dashboard.html`

**Features**:
- Search schedule by volunteer name
- View schedule by day with role filtering
- Mobile-friendly display

### 7. Volunteer Availability Form (`app=availability`)
**Users**: Volunteers
**Interface**: `availability_form.html`

**Features**:
- Submit shift availability preferences
- Indicate consecutive shift preferences
- Specify desired number of shifts

### 8. Volunteer Sign-In/Out (`app=signin`)
**Users**: All volunteers
**Interface**: `volunteer_signinout.html`

**Features**:
- Station-based sign-in (stations 1-150)
- Exception stations: Mentor, Senior Mentor, Receptionist
- Session tracking with UUID
- Live session viewer with filtering
- Auto-refresh with manual refresh button
- Dark mode persistence

---

## 🔧 Technical Architecture

### Technology Stack
- **Backend**: Google Apps Script (JavaScript)
- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Database**: Google Sheets (append-only event log model)
- **Charts**: Chart.js for visualizations
- **Deployment**: Google Apps Script Web Apps
- **Cost**: $0 (leverages Google Workspace)

### Design Principles

1. **Append-Only Data Model**
   - All operations append new rows
   - Complete audit trail preserved
   - No data deletion (soft deletes via status flags)
   - Easy rollback and recovery

2. **Performance Optimizations**
   - **Partial Sheet Reading**: Only read necessary columns
   - **Recent-Row Checking**: Check last 500 rows before full scan
   - **Caching**: Mentor list cached for 45 seconds (PropertiesService)
   - **Lazy Loading**: Sheets opened only when needed
   - **Range-Based Queries**: Avoid `getDataRange()` for memory efficiency
   - **Change Detection**: Re-render UI only when data changes

3. **Concurrency & Safety**
   - `LockService` for critical sections (client ID generation)
   - 10-second lock timeout with retry logic
   - Exponential backoff (100ms, 200ms, 400ms)
   - Graceful degradation on failures

4. **Error Handling**
   - `safeExecute()` wrapper for all operations
   - Automatic retry on rate limit errors
   - User-friendly error messages
   - Audit logging for significant events

5. **Security**
   - Input sanitization (max lengths, format validation)
   - Client ID format validation: `/^[A-Z]\d{3}$/`
   - Email format validation
   - Tax year range validation (±10 years)
   - No SQL injection risk (NoSQL data model)

---

## Features

### Dark Mode ✨ NEW
- Toggle between light and dark themes
- Preference persisted in localStorage
- Consistent across all 8 HTML interfaces
- Accessible color contrast (WCAG AA compliant)

### Mobile Responsiveness ✨ NEW
- **Queue Dashboard**: Card-based layout on mobile
- **Touch-Friendly**: 44x44px minimum touch targets
- **Responsive Typography**: Scales for readability
- **Orientation Handling**: Re-renders on device rotation
- **Viewport Optimization**: Proper meta tags

### Real-Time Updates
- Auto-refresh dashboards (10-30 second intervals)
- Pause refresh when browser tab hidden (performance)
- Change detection prevents unnecessary DOM updates
- Manual refresh buttons for immediate updates ✨ NEW

### Validation & Sanitization
- Client ID format: `A001` to `Z999`
- Email validation with regex
- Tax year limits: current year ±10 years
- Volunteer name max length: 100 chars
- Notes field max length: 1000 chars

---

## System Limits

| Aspect | Limit | Notes |
|--------|-------|-------|
| Client IDs | 26,000 | A001-Z999 range |
| Concurrent Users | ~10-20 | Google Apps Script quotas |
| Sheet Rows (optimal) | ~5,000 | Performance degrades beyond this |
| Email/Day (Standard) | 1,500 | Google Workspace quota |
| Email/Day (Workspace) | 2,000 | Google Workspace quota |
| Spreadsheet Size | 15GB | Google Drive limit |
| Execution Time | 6 minutes | Apps Script limit per execution |

---

## Setup & Deployment

### Prerequisites
- Google Workspace account
- Access to Google Apps Script
- Spreadsheet with appropriate permissions

### Initial Setup

1. **Create Spreadsheet**
   - File > New > Google Sheets
   - Create 11 sheets (see Data Model section)

2. **Configure Column Headers**
   - Match column mappings in `Config.gs`
   - Use exact sheet names as specified

3. **Open Apps Script Editor**
   - Extensions > Apps Script
   - Copy all `.gs` files from `catbus_scripts/`
   - Copy all `.html` files

4. **Update Configuration**
   ```javascript
   // In Config.gs
   SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE'
   ```

5. **Deploy Web Apps**
   - For each `*App.gs` file:
     - Deploy > New Deployment
     - Type: Web app
     - Execute as: User accessing the web app
     - Who has access: Anyone with Google account (or specific domain)

6. **Authorize Permissions**
   - First run prompts for authorization
   - Required permissions:
     - Google Sheets access
     - Send email
     - Display content in web pages

7. **Share Dashboard URLs**
   - Copy deployment URLs
   - Share with appropriate user groups

### Configuration Options

Edit `Config.gs` to customize:
```javascript
TIMEZONE: 'America/New_York',  // Your timezone
SIGN_IN_OUT: {
  STATION_COUNT: 150,           // Number of stations
  EXCEPTION_STATIONS: ['Mentor', 'Senior Mentor', 'Receptionist']
},
PERFORMANCE: {
  RECENT_ROWS_TO_CHECK: 500,    // Optimization threshold
  RECENT_HELP_REQUESTS_TO_CHECK: 200,
  RECENT_REVIEW_REQUESTS_TO_CHECK: 200
}
```

---

## Maintenance

### Data Archival Strategy
As the system grows (5,000+ rows), implement archival:
- Move completed assignments to `Archive_YYYY` sheets
- Create yearly intake sheets: `Client_Intake_2024`, `Client_Intake_2025`
- Keep only current season data in active sheets
- Export old data as CSV backups


**Problem**: Client ID generation fails
**Solutions**:
- Check if lock timeout is being hit (concurrent submissions)
- Verify spreadsheet permissions (edit access required)
- Check if IDs exhausted current letter (e.g., Z999 reached)

**Problem**: Dashboard not refreshing
**Solutions**:
- Check browser console for JavaScript errors
- Verify Apps Script deployment is active
- Ensure spreadsheet permissions allow reading
- Clear browser cache and reload

**Problem**: Email receipts not sending
**Solutions**:
- Check daily quota (1500 standard, 2000 Workspace)
- Verify email address format validation passes
- Check attachment file sizes (Gmail 25MB limit)
- Review Apps Script execution logs for errors

**Problem**: Volunteer assignment not working
**Solutions**:
- Verify volunteer has signed in today
- Check volunteer is not already assigned
- Ensure client is in Client Intake sheet
- Check CLIENT_ASSIGNMENT sheet for existing assignment

---

## Public Website

The `webpage/` directory contains static HTML backups for the Squarespace website.

### Website Pages
- **`index.html`** - Main landing page
- **`catbus.html`** - CATBUS system access portal
- **`FAQ.html`** - Frequently asked questions
- **`PostFiling.html`** - Post-filing information
- **`volunteerapplications.html`** - Volunteer applications

### Website Details
- **Domain**: `uwafsa.com` / `taxclinic.uwaterloo.ca`
- **Purpose**: Public information and CATBUS access portal
- **Note**: HTML files are backups

## License

**Internal use only** - UW AFSA Tax Clinic

This system is designed exclusively for the University of Waterloo Accounting and Finance Student Association (AFSA) Tax Clinic. Modification, redistribution, or use by other organizations requires explicit permission.


---

## Support

For technical issues or questions:
- Check this README first
- Review Apps Script execution logs
- Contact Ben Ma @ UW AFSA Tax Clinic
- Submit issue via GitHub (if applicable)

For feature requests:
- Document the use case clearly
- Explain expected behavior
- Consider performance implications
