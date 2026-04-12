# Schedule by Day Dashboard UI (volunteer_schedule_dashboard.html)

## Metadata
- **ID**: `volunteer_schedule_dashboard_ui`
- **Type**: code
- **Source**: `catbus_scripts/volunteer_schedule_dashboard.html`

## Relationships
- -> **references** [[shared_catbus_css_theme_shared_styles.html]]
  - Confidence: 1.0
- -> **references** [[shared_frontend_scripts_include_shared_scripts]]
  - Confidence: 1.0
- -> **calls** [[backend_getscheduleconfig]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteerschedulebyday]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteerdistribution]]
  - Confidence: 1.0
- -> **references** [[volunteer_role_system_filer_mentor_frontline_internal_services]]
  - Confidence: 1.0
- <- **references** [[catbus_tool_hub_catbus.html]]
  - Confidence: 1.0
- <- **semantically_similar_to** [[volunteer_management_ui_volunteer_management.html]]
  - Confidence: 0.6

**Tags**: #code

## UI Details

**Header Layout**: Title, right-aligned action group with:
- Dark mode toggle (pill switch)

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`