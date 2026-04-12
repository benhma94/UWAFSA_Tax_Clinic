# Application Review UI

## Metadata
- **ID**: `application_review_html`
- **Type**: document
- **Source**: `catbus_scripts/application_review.html`

## Relationships
- -> **calls** [[getvolunteerapplications]]
  - Confidence: 1.0
- -> **calls** [[saveapplicationdecision]]
  - Confidence: 1.0
- -> **references** [[shared_scripts_client-side_utilities]]
  - Confidence: 0.8

**Tags**: #document

## UI Details

**Header Layout**: Minimal header with dark mode toggle

**Dark Mode Toggle**:
- **Design**: Sliding pill switch (~58×28px) with circular thumb
- **Behavior**: CSS-driven via `body.light` and `body.dark` classes
- **Icons**: Sun emoji (☀️) on light side, moon emoji (🌙) on dark side, auto-updated via `::before` pseudo-element
- **Function**: Calls `toggleTheme()` from `shared_scripts.html`
- **Persistence**: Theme preference stored in `localStorage` under key `'theme'`