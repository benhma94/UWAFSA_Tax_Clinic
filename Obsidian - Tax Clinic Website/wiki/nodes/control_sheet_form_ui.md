# Control Sheet Form UI

## Metadata
- **ID**: `control_sheet_form_html`
- **Type**: document
- **Source**: `catbus_scripts/control_sheet_form.html`

## Relationships
- -> **references** [[control_sheet_form_ui]]
  - Confidence: 1.0
- -> **references** [[shared_scripts_client-side_utilities]]
  - Confidence: 0.8
- -> **calls** [[control_sheet_form_ui]]
  - Confidence: 1.0

**Tags**: #document

## UI Details

**Header Layout**: Title on left ("AFSA Tax Clinic Control Sheet"), right-aligned action group containing:
- Home nav link (🏠)
- Break toggle button (☕, volunteer-facing)
- Dark mode toggle (pill switch)

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`