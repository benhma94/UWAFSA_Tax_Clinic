# Personal Volunteer Dashboard UI (volunteer_dashboard.html)

## Metadata
- **ID**: `volunteer_dashboard_ui`
- **Type**: code
- **Source**: `catbus_scripts/volunteer_dashboard.html`

## Relationships
- -> **references** [[shared_catbus_css_theme_shared_styles.html]]
  - Confidence: 1.0
- -> **references** [[shared_frontend_scripts_include_shared_scripts]]
  - Confidence: 1.0
- -> **calls** [[backend_getallvolunteernames]]
  - Confidence: 1.0
- -> **calls** [[backend_getscheduleconfig]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteerschedulebyname]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteerpersonalstats]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteercredentialstatus]]
  - Confidence: 1.0
- -> **calls** [[backend_submitvolunteercredentials]]
  - Confidence: 1.0
- -> **calls** [[backend_getvolunteerproductkeys]]
  - Confidence: 1.0
- -> **references** [[volunteer_role_system_filer_mentor_frontline_internal_services]]
  - Confidence: 1.0
- <- **references** [[catbus_tool_hub_catbus.html]]
  - Confidence: 1.0
- -> **semantically_similar_to** [[volunteer_sign-in_sign-out_ui_volunteer_signinout.html]]
  - Confidence: 0.7
- <- **semantically_similar_to** [[stats_dashboard_ui_stats_dashboard.html]]
  - Confidence: 0.7

**Tags**: #code

## UI Details

**Header Layout**: Title ("👤 Volunteer Dashboard"), right-aligned action group with:
- Dark mode toggle (pill switch)

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`