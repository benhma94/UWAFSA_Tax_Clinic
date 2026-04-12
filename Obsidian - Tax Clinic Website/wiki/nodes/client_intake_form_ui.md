# Client Intake Form UI

## Metadata
- **ID**: `catbus_intake_form_html`
- **Type**: document
- **Source**: `catbus_scripts/catbus_intake_form.html`

## Relationships
- -> **references** [[client_intake_form_ui]]
  - Confidence: 1.0
- -> **references** [[shared_scripts_client-side_utilities]]
  - Confidence: 0.8

**Tags**: #document

## UI Details

**Header Layout**: Title ("AFSA Tax Clinic Client Intake Form"), right-aligned action group with:
- Home nav link (🏠)
- Dark mode toggle (pill switch)

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`