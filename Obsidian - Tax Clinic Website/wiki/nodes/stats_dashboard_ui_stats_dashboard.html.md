# Stats Dashboard UI (stats_dashboard.html)

## Metadata
- **ID**: `stats_dashboard_ui`
- **Type**: code
- **Source**: `catbus_scripts/stats_dashboard.html`

## Relationships
- -> **references** [[shared_catbus_css_theme_shared_styles.html]]
  - Confidence: 1.0
- -> **references** [[shared_frontend_scripts_include_shared_scripts]]
  - Confidence: 1.0
- -> **calls** [[backend_getadmindashboarddata]]
  - Confidence: 1.0
- <- **references** [[catbus_tool_hub_catbus.html]]
  - Confidence: 1.0
- -> **semantically_similar_to** [[personal_volunteer_dashboard_ui_volunteer_dashboard.html]]
  - Confidence: 0.7

**Tags**: #code

## UI Details

**Header Layout**: Minimal header with dark mode toggle in a right-aligned div

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`