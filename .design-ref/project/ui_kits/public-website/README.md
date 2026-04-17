# Public Website UI Kit

Hi-fi recreation of `webpage/` from the repo — the public `taxclinic.uwaterloo.ca` site.

## What's here
- `shared.css` — trimmed version of the repo's `shared.css` (tokens, nav, callouts, status panel, tables, FAQ, tool-cards).
- `components.jsx` — `Header`, `Nav`, `Footer`, `DarkModeToggle`, `ClinicStatusPanel`, `ScheduleTable`, `Callout`, `SectionHeading`, `ToolCard`, `FaqCategory`, `FaqItem`.
- `pages.jsx` — full-page compositions: `HomePage`, `FAQPage`, `ChecklistPage`, `PostFilingPage`, `AboutPage`, `VolunteerPage`.
- `index.html` — click-thru demo with working nav, dark-mode toggle, status switcher, and a working volunteer-application form.

## Usage
```html
<link rel="stylesheet" href="shared.css" />
<script type="text/babel" src="components.jsx"></script>
<Callout><p>Your message here.</p></Callout>
```

## What's intentionally not here
- The real `search-index.js` + search page (search is not part of the visual system).
- The full `appointment_screening.html` wizard (too bespoke; compose from the same primitives).
- `shared.js` page-transition fade (we route via React state instead).
