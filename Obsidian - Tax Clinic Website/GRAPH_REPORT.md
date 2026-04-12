# CATBUS Knowledge Graph Report

**Generated**: April 12, 2026  
**Source**: Graphify extraction from 31 code/document files  
**Total Nodes**: 235 | **Total Edges**: 314 | **Workflows**: 20

---

## Executive Summary

The CATBUS (Client Appointment Tracking and Booking Unified System) knowledge graph reveals a highly modular Google Apps Script application with:

- **Backend engine**: 25+ Gas files handling data, workflows, and email
- **Frontend UI**: 15+ HTML dashboard and form pages
- **Data layer**: 18+ Google Sheets with specialized purposes
- **Web presence**: 12+ public/info webpages
- **Architecture pattern**: Hub-and-spoke with `Config.gs` and `Router.gs` as central orchestrators

---

## God Nodes (Highest Centrality)

These nodes are critical hubs that connect many subsystems:

### 1. **Config.gs** (code)
- **Degree**: 45+ edges
- **Role**: Central configuration repository
- **Key exports**: `CONFIG`, `SCHEDULE_CONFIG`, `ELIGIBILITY_CONFIG`, `APPOINTMENT_CONFIG`
- **Connected to**: ~15 GS files, Admin Dashboard, Queue Manager, Email Service
- **Impact**: Any changes require cascading updates across the system
- **Critical decision**: Uses static constants; no dynamic reloading mechanism

### 2. **Router.gs** (code)
- **Degree**: 38+ edges
- **Role**: Request dispatcher for all web app endpoints
- **Key function**: `doGet(e)` routes by `?app=` parameter
- **Connected pages**: All 15+ HTML dashboards and forms
- **Impact**: Central point of control for app routing; single point of failure for web UI
- **Pattern**: Switch statement with case for each page (scalable to ~20 pages max)

### 3. **GoogleSheets: Client Intake, Client Assignment, Tax Return Tracker** (data)
- **Degree**: 30+ edges each
- **Role**: Core transactional data
- **Connected to**: AdminDashboard, QueueManagement, ControlSheet, ClientIntake
- **Impact**: Data integrity issues here cascade to all dashboards and workflows
- **Constraint**: No transaction isolation; concurrent writes can cause data loss

### 4. **AdminDashboard.gs** (code)
- **Degree**: 28+ edges
- **Role**: Analytics and reporting hub
- **Key functions**: `getAdminDashboardData` (called by 8+ downstream consumers)
- **Connected to**: Config, all data sheets, EmailService, ReviewRequests
- **Impact**: Performance bottleneck; single `getAdminDashboardData()` call reads multiple sheets
- **Pattern**: Data aggregation without caching; expensive on every refresh

### 5. **ControlSheet.gs** (code)
- **Degree**: 24+ edges
- **Role**: Volunteer-client workflow orchestrator
- **Key patterns**: 
  - Consolidated polling endpoint: `getVolunteerPollingStatus(volunteer)` (returns help + review status)
  - Single-read optimization: All volunteer data fetched once per poll cycle
- **Connected to**: ReviewRequests, HelpRequests, ClientAssignment, EmailReceipt
- **Impact**: Critical for day-of operations; polling delays block volunteer UX
- **Vulnerability**: Tightly coupled to help/review request sheets

---

## Community Clusters (Workflow Groups)

### **Cluster 1: Day-of Clinic Operations** (6 nodes)
Signaling flow during live clinic event.

**Nodes**:
- `VolunteerSignInOut.gs` → starts sign-in
- `QueueManagement.gs` → assigns clients
- `ControlSheet.gs` → volunteers file returns
- `HelpRequests.gs` → help request escalation
- `ReviewRequests.gs` → mentor approval flow
- `EmailReceipt.gs` → receipt email trigger

**Critical edge**: Help/Review requests → triggering email notifications (timing-sensitive)

---

### **Cluster 2: Control Sheet Polling** (4 nodes)
Single consolidated polling pattern for volunteer dashboard.

**Nodes**:
- `ControlSheet.gs::getVolunteerPollingStatus()` → main endpoint
- `ReviewRequests.gs::getReviewApprovalResult()` → check approval status
- `HelpRequests.gs::getHelpStatus()` → check help request
- `control_sheet_form.html` → UI that polls every 2 seconds

**Pattern**: Reduces server calls from 2 requests → 1 request per poll cycle.  
**Benefit**: Improved UX responsiveness; reduced quota pressure.  
**Gotcha**: Both help + review data bundled in one response; can't selectively refresh.

---

### **Cluster 3: Admin Analytics Pipeline** (6 nodes)
Data aggregation and reporting backend.

**Nodes**:
- `AdminDashboard.gs::getAdminDashboardData()` → main aggregator
- `AdminDashboard.gs::readTrackerData_()` → cached read pattern
- `sheet_tax_return_tracker` → filed returns database
- `admin_dashboard.html` → UI with 6 chart tabs
- `CacheManager.gs` → optional performance layer (not used for dashboards)
- `Config.gs` → metrics definitions (`PERFORMANCE` constants)

**Optimization**: `readTrackerData_()` reads tracker once, shares across 4+ dashboard functions.  
**Issue**: Cacheability blocked; each refresh fetches all 300+ rows.

---

### **Cluster 4: Appointment Booking Workflow** (5 nodes)
Complex priority client pathway.

**Nodes**:
- `AppointmentBooking.gs::submitAppointmentBooking()` → form processor
- `appointment_screening.html` → eligibility + complexity checker
- `GoogleSheets: Client Intake` → destination sheet
- `EmailService.gs` → confirmation email
- `Config.gs::ELIGIBILITY_CONFIG` → validation rules

**Key pattern**: Client-side validation (HTML) mirrors server-side (GS).  
**Risk**: Config changes require updates in TWO places (CLAUDE.md documents this).  
**Decision**: Mirrored config maintains usability (offline eligibility check).

---

### **Cluster 5: Volunteer Scheduling** (5 nodes)
Pre-clinic scheduling automation.

**Nodes**:
- `VolunteerManagement.gs` → role management
- `ScheduleAutomation.gs` → schedule generation
- `ScheduleEditor.gs` → manual corrections
- `MentorTeams.gs` → pairing algorithm
- `sheet_schedule_availability` → form responses

**Feature**: Auto-generates mentor teams (senior paired with first-timers).  
**Complexity**: Depends on role designations from consolidated volunteer list.

---

## Architectural Patterns

### **Pattern 1: Centralized Configuration**
- **Implementation**: `Config.gs` exports constants object
- **Files using it**: 18+ (AdminDashboard, AppointmentBooking, Router, etc.)
- **Pattern strength**: 💪 Excellent for global settings
- **Pattern weakness**: No environment-specific overrides; secrets stored separately in `_Secrets.gs`
- **Recommendation**: Lock load order via `_` prefix on secrets file

---

### **Pattern 2: Consolidated Polling Endpoint**
- **Implementation**: `getVolunteerPollingStatus(volunteer)` returns {help, review}
- **Usage**: `control_sheet_form.html` polls every 2 seconds
- **Benefit**: Reduces server calls 2→1
- **Design principle**: CLAUDE.md documents this as optimization
- **Gotcha**: Both data types bundled; can't request only help status

---

### **Pattern 3: Single-Pass Data Aggregation**
- **Implementation**: `readTrackerData_()` reads tracker once, cached in memory
- **Usage**: 4+ functions reuse same data (return summary, metrics, timeline, etc.)
- **Benefit**: Efficient for related queries in same request
- **Weakness**: No fine-grained cache invalidation; entire 300-row sheet re-read on next call
- **Scalability**: Will break if tracker sheet grows >1000 rows (quota exceeded)

---

### **Pattern 4: Google Apps Script Deployment Wrapper**
- **Implementation**: Single `doGet(e)` in `Router.gs` dispatches by `?app=` parameter
- **Coverage**: 15 deployed pages (intake, queue, control, admin, alerts, etc.)
- **Benefit**: Single deployment URL; easy app catalog
- **Cost**: All pages live in same deployment; can't version independently
- **Gotcha**: Bare `clasp deploy` (without `--deploymentId`) creates new URL → breaks hardcoded links

---

## Data Flow Diagrams

### Appointment Booking Flow
```
appointment_screening.html
  ↓ (client-side validation)
  ↓ (submit form)
catbus_intake_form.html?app=intake
  ↓ (client picks: intake OR appointment)
  ↓ (intake-only) → ClientIntake.gs → sheet_client_intake
            (appointment) → AppointmentBooking.gs → buildConfirmationEmail → EmailService.gs
                                                  ↓ (reads ELIGIBILITY_CONFIG from Config.gs)
                                                  Google Forms → AppointmentBooking.gs
                                                  ↓ (form trigger)
                                                  submitAppointmentBooking() → sheet_client_intake
```

### Day-of Clinic Operations
```
volunteer_signinout.html → VolunteerSignInOut.gs → sheet_volunteer_list ← AdminDashboard (monitors)
        ↓
    ↓ (volunteers sign in)
queue_dashboard.html ← QueueManagement.gs ← sheet_client_intake (pulls queue)
        ↓ (doorman assigns)
control_sheet_form.html ← ControlSheet.gs (polls every 2s)
        ↓ (volunteer files)
        ↓ (sends help request) → HelpRequests.gs → sheet_help_requests
        ↓ (sends review request) → ReviewRequests.gs → sheet_review_requests
alert_dashboard.html ← AdminDashboard.gs (mentor sees alert)
                    ← ReviewRequests.gs (approval result)
                    → (approves/returns)
control_sheet_form.html (volunteer sees pop-up correction)
```

---

## Risk Assessment

### High Risk 🔴

1. **No transaction support**: Concurrent writes to Client Assignment sheet can cause data loss
   - **Mitigation**: Document this; use volunteer-by-volunteer locking in QueueManagement
   - **Evidence**: Config.gs warns about simultaneous writes

2. **Config sync problem**: `appointment_screening.html` mirrors Config.gs
   - **Mitigation**: CLAUDE.md flags this as manual update requirement
   - **Evidence**: ELIGIBILITY_CONFIG exists in TWO places

3. **Single polling endpoint bottleneck**: 1 GAS call→2 server reads every 2 seconds
   - **Mitigation**: Consider caching help + review status; only refresh on change
   - **Evidence**: 15+ volunteers × 2 requests/sec = quota pressure

### Medium Risk 🟡

1. **Admin dashboard performance**: No caching; reads 300+ rows on every `getAdminDashboardData()` call
   - **Evidence**: CacheManager.gs exists but not used for dashboards
   - **Mitigation**: Use CacheManager for dashboard aggregations; set 30s TTL

2. **Mentor team generation depends on role**: If volunteer roles not set, pairing fails
   - **Evidence**: VolunteerScheduleViewer.gs reads consolidated volunteer list; expects role field
   - **Mitigation**: Validate roles before schedule automation

3. **Config hot-reload missing**: Changes to time slots require redeployment
   - **Evidence**: SCHEDULE_CONFIG.TIME_SLOTS is constant; no UI to override
   - **Mitigation**: Add runtime override in Config.gs for clinic dates/times

### Low Risk 🟢

1. **Multiple Google Script runtimes**: If clasp push fails, deployment left in unknown state
   - **Mitigation**: Always use `clasp push --force` to sync in CI/CD

2. **Router.gs case statement scaling**: ~15 pages now; will exceed maintainability at 25+
   - **Mitigation**: Consider plugin architecture (dynamic page registry)

---

## Recommendations

### Short term (if adding features)
1. ✅ Keep `Config.gs` as single source of truth
2. ✅ Document `appointment_screening.html ↔ Config.gs` sync requirement in deploy checklist
3. ✅ Use `getVolunteerPollingStatus()` consolidated endpoint pattern for similar workflows

### Medium term (before clinic doubles in scale)
1. ⚠️ Implement caching for admin dashboard aggregations (CacheManager is ready to use)
2. ⚠️ Add write-ahead logging or optimistic locking to Client Assignment sheet
3. ⚠️ Extract route configuration from Router.gs into a manifest file (easier to extend)

### Long term (if building second clinic system)
1. 🔮 Consider separating deployment by role (Volunteer UI ≠ Admin UI) for independent versioning
2. 🔮 Migrate admin dashboard to Looker Studio for native Google Sheets integration + sharing
3. 🔮 Add runtime config overrides for time slots (via sheet or Apps Script properties)

---

## File Reference Index

### Core Backend (GS Files)
- **Config.gs** — Central configuration & schema
- **Router.gs** — Web app request dispatcher
- **AdminDashboard.gs** — Metrics & analytics
- **ControlSheet.gs** — Volunteer workflow orchestration
- **QueueManagement.gs** — Client assignment
- **ClientIntake.gs** — Walk-in intake processing
- **AppointmentBooking.gs** — Priority booking pathway
- **ReviewRequests.gs** — Mentor approval workflow
- **HelpRequests.gs** — In-session help escalation
- **EmailService.gs** — Email sending abstraction
- **EmailReceipt.gs** — Receipt email trigger
- **VolunteerManagement.gs** — Role & credential management
- **ScheduleAutomation.gs** — Pre-clinic scheduling
- **VolunteerSignInOut.gs** — Daily sign-in/out tracking
- **CacheManager.gs** — Performance optimization layer

### Frontend (HTML)
- **catbus_intake_form.html** — Client intake
- **queue_dashboard.html** — Doorman client queue
- **control_sheet_form.html** — Volunteer filing interface [Polling via ControlSheet.gs]
- **admin_dashboard.html** — Metrics & reporting [Data from AdminDashboard.gs]
- **alert_dashboard.html** — Help & review alerts [Polling via ControlSheet.gs]
- **volunteer_schedule_dashboard.html** — Schedule viewer
- **stats_dashboard.html** — System statistics

### Public Website (webpage/)
- **appointment_screening.html** — Client eligibility check
- **index.html** — Clinic homepage
- **about.html** — About page
- **FAQ.html** — FAQ
- **feedback.html** — Feedback form

---

## Glossary

- **GAS**: Google Apps Script
- **Quota**: Daily limits on GAS execution & sheet reads (Google Workspace tier)
- **Polling**: Client repeatedly asking server for status updates (inefficient but simple)
- **Hub-and-spoke**: Centralized node (Config/Router/AdminDashboard) with many connections
- **Consolidated endpoint**: Single function returning multiple related data items (e.g., `getVolunteerPollingStatus`)
- **Caching**: Storing computed results to avoid re-computation
- **Deployment**: Deployed Apps Script version accessible via URL
- **Mentorship pair**: Senior mentor paired with first-time volunteer

---

**Last Updated**: April 12, 2026  
**Next Review**: After next clinic cycle or when adding major features
