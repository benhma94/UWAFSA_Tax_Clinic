# Alert Dashboard UI

## Metadata
- **ID**: `alert_dashboard_html`
- **Type**: document
- **Source**: `catbus_scripts/alert_dashboard.html`

## Relationships
- -> **references** [[alert_dashboard_ui]]
  - Confidence: 1.0
- -> **references** [[shared_scripts_client-side_utilities]]
  - Confidence: 0.8

**Tags**: #document

## UI Details

**Header Layout**: Minimal header with dark mode toggle in a right-aligned div

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`