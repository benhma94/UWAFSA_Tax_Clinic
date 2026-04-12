# Schedule Dashboard UI

## Metadata
- **ID**: `schedule_dashboard_html`
- **Type**: document
- **Source**: `catbus_scripts/schedule_dashboard.html`

## Relationships
- -> **calls** [[generateschedulefromdashboard]]
  - Confidence: 1.0
- -> **calls** [[debugavailabilitysheet]]
  - Confidence: 1.0
- -> **calls** [[getvolunteershiftmap]]
  - Confidence: 1.0
- -> **calls** [[savevolunteerscheduleedits]]
  - Confidence: 1.0
- -> **calls** [[getallvolunteernames]]
  - Confidence: 1.0
- -> **calls** [[getvolunteerdistribution]]
  - Confidence: 1.0
- -> **references** [[shared_scripts_client-side_utilities]]
  - Confidence: 0.8

**Tags**: #document

## UI Details

**Header Layout**: Title ("📅 Tax Clinic Schedule Generator"), right-aligned action group with:
- Dark mode toggle (pill switch)

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`