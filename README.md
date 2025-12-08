# UW AFSA Tax Clinic - CATBUS

**Client And Tax Booking Utility System (CATBUS)**

Backup documents and source code for the Tax Clinic Website and CATBUS management system.

## Overview

CATBUS is the Tax Clinic's ERP system, completely built on a Google Sheet and Scripts framework. Used for scheduling, quality control, flow manamgement, reception, reviews, and tracking.

## System Components

### Main Applications

1. **Client Intake** (`app=intake`)
   - Client eligibility screening
   - Client information collection
   - Flags for senior review and high priority cases

2. **Queue Master Dashboard** (`app=queue`)
   - Real-time client queue management
   - Volunteer availability tracking

3. **Control Sheet** (`app=control`)
   - Volunteer-facing interface for tax return preparation
   - Tax year management per client
   - Review request system

4. **Admin Dashboard** (`app=admin`)
   - Return completion summary
   - Real-time statistics
   - Review request notifications

5. **Schedule Assignment Generator** (`app=assignment`)
   - Admin tool for generating volunteer schedules
   - Automatically assigns volunteers to shifts based on availability
   - Configurable assignment options and constraints
   - Generates schedule output sheet with volunteer assignments

6. **Volunteer Schedule Viewer** (`app=schedule`)
   - View generated volunteer schedules
   - Search by volunteer name
   - View schedule by day with role filtering

7. **Volunteer Availability Form** (`app=availability`)
   - Volunteers submit their availability
   - Shift preference collection

8. **Volunteer Sign-In/Out** (`app=signin`)
   - Station-based sign-in system
   - Role tracking (Mentor, Senior Mentor, Filer, etc.)

## Key Features

### Data Validation
- **Reviewer Validation**

### Senior Review System
- Clients can be flagged during intake for senior review
- When flagged, the Control Sheet automatically prompts for a secondary senior mentor reviewer
- Secondary reviewer field only appears for clients requiring senior review

### Review Workflow
- Volunteers can call for review from the Control Sheet
- Review requests appear in the Admin Dashboard
- Mentors can approve returns or return them for corrections
- Reviewer selection is validated against current on-shift mentors

## Technical Details

### Technology Stack
- **Platform**: Google Apps Script
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Google Apps Script (server-side)
- **Storage**: Google Sheets

### Spreadsheet Structure
- **Client Intake**: Client information and intake data
- **Client Assignment**: Volunteer-client assignments
- **Tax Return Tracker**: Completed returns and review information
- **Volunteer List**: Current on-shift volunteers
- **Help Requests**: Active help requests from volunteers
- **Review Requests**: Pending review requests
- **Schedule Availability**: Volunteer availability submissions
- **Schedule Output**: Generated volunteer schedules

### Configuration
All configuration is centralized in `Config.gs`, including:
- Spreadsheet ID
- Sheet names
- Column mappings
- Performance settings
- Cache TTL values

## Public Website

The `webpage/` directory contains static HTML files for the public-facing Squarespace website. These are backup copies of the Squarespace-generated pages that serve as the public interface for the Tax Clinic.

### Webpage Files

- **`index.html`** - Main landing page for the Tax Clinic
- **`catbus.html`** - CATBUS system access page with links to all applications
- **`FAQ.html`** - Frequently asked questions page
- **`PostFiling.html`** - Post-tax return filing information
- **`volunteerapplications.html`** - Volunteer application information
- **`admin.html`** - Admin access page (if applicable)

### Website Details

- **Platform**: Squarespace
- **Domain**: `uwafsa.com` / `taxclinic.uwaterloo.ca`
- **Template**: Squarespace template (ID: 52a74dafe4b073a80cd253c5)
- **Purpose**: Public-facing information and CATBUS system access portal

**Note**: These HTML files are Squarespace-generated and primarily serve as backups. The actual website is managed through the Squarespace CMS. The CATBUS applications themselves are hosted separately via Google Apps Script web apps and are linked from the `catbus.html` page.

## Development Notes

- System must be accessed in incognito mode for proper operation
- All scripts are deployed as web apps via Google Apps Script
- Main router handles app routing via query parameters
- Error handling uses `safeExecute()` wrapper for consistent error reporting
- Public website is managed separately through Squarespace CMS

## License

Internal use only - UW AFSA Tax Clinic
