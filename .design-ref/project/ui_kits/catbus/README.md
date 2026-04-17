# CATBUS UI Kit

Hi-fi recreation of `catbus_scripts/` — the internal Google-Apps-Script tooling used by ~100 clinic volunteers, queue masters and admins.

## What's here
- `catbus.css` — tokens, form-section cards, data tables with severity rows, role pills, modals, toasts, stat cards.
- `components.jsx` — `TopBar`, `Tabs`, `FormSection`, `Field`, `StatCard`, `RolePill`, `Modal`, `Toast`, `BarChart`, `Footer`.
- `pages.jsx` — dashboards: `QueueDashboard`, `VolunteerManagement`, `Schedule`, `Stats`, `Intake`.
- `index.html` — click-thru demo: assign clients, switch tabs, toggle theme, add a walk-in.

## Visual rules
- **Segoe UI system stack only.** Do not import webfonts.
- **Deep brick red** `rgb(142, 0, 0)` — not the softer `#c0392b` from the public site.
- Body max-width `1200px`; form wrappers narrow to `800px`.
- Queue table header is **solid red, white type, uppercase**. Severity rows use yellow (warn, ≥15 min) and red (danger, ≥30 min — pulses).
- Emoji ARE allowed here as UI glyphs (✏️ 🗑️ 🔄 🏠 ☀️ 🌙). Do not carry this into public-site designs.

## What's intentionally not here
- Real Google Apps Script backends — all state is mock React state.
- `expense_tracker`, `product_code_dashboard`, `raffle_draw`, `todo_list`, `mass_email`, `appointment_screening` wizard — they share the same primitives, compose them as needed.
