# UW AFSA Tax Clinic — Design System

A design system for the **University of Waterloo Accounting & Finance Student
Association (AFSA) Tax Clinic** — a free, student-run walk-in tax clinic that
serves ~1,000 KW-area residents a year, operating since 2009.

## Source of truth

Everything in this system was derived from the project's public repo:

- **GitHub:** `benhma94/UWAFSA_Tax_Clinic` (default branch `main`)
- **Live site:** <https://taxclinic.uwaterloo.ca>
- **Parent org:** Accounting & Finance Student Association, <https://uwafsa.com/>
- **Contact:** taxclinic@uwafsa.com

The repo contains two very different products sharing the AFSA red:

1. **`webpage/`** — the public-facing marketing + information website
   (index, FAQ, checklist, eligibility screening, about, volunteer
   applications, etc). Modern slate palette, Lexend + Source Sans 3,
   crimson (`#c0392b`) accent, dark mode toggle.
2. **`catbus_scripts/`** — **CATBUS** (Client And Tax Booking Utility
   System), the internal Google Apps Script platform used by ~100
   volunteers, queue masters and admins to run the clinic day-of.
   Warmer off-white palette, Segoe UI system stack, deeper red
   (`rgb(142, 0, 0)`) accent, role-coded volunteer types.

Both share the same **deep AFSA brick red**, the **AFSA shield logo**, and
the same general "quiet, trustworthy, classroom-friendly" tone. They differ
in typography and neutrals, and this system captures both.

---

## Index

| File / folder | What's in it |
| --- | --- |
| `README.md` | This file — context, content voice, visual foundations, iconography. |
| `colors_and_type.css` | Every color, type and spacing token as CSS variables. Drop into any page. |
| `SKILL.md` | Agent-skill entry point (for Claude Code compatibility). |
| `assets/` | Logo, favicon. Copy out as needed. |
| `preview/` | Atomic spec cards that populate the Design System tab. |
| `ui_kits/public-website/` | Hi-fi recreation of the public marketing site. |
| `ui_kits/catbus/` | Hi-fi recreation of the internal CATBUS tools. |

---

## Products

### Public website (`webpage/`)
Informational site. Main jobs-to-be-done, in order of traffic:
1. **Am I eligible?** Income thresholds, income types we can/can't handle,
   T2202 waiver.
2. **What do I bring?** The checklist page — the "big red download PDF"
   call to action.
3. **When/where is the clinic?** The dated schedule table on the home
   page. A live `clinic-status` pill polls the CATBUS backend and shows
   Open / Closed in real time.
4. **FAQ** — accordion-style, grouped by category.
5. **Volunteer applications** — for prospective student volunteers.
6. **Post-filing** — what to do after filing (direct deposit links, etc).

### CATBUS internal tools (`catbus_scripts/`)
Google Apps Script web apps served through HtmlService. Each `.html`
page below is a separate mini-app; they share `shared_styles.html` and
`shared_scripts.html`. Key dashboards:

| Dashboard | Purpose |
| --- | --- |
| `queue_dashboard.html` | Day-of client queue, priority flags, wait-time colour coding, assign/reassign modals. |
| `volunteer_dashboard.html` | Volunteer landing page. |
| `volunteer_management.html` | Volunteer roster & role assignments. |
| `schedule_dashboard.html` | Shift schedule (4 days × 3 shifts). |
| `volunteer_signinout.html` | Station sign in/out. |
| `control_sheet_form.html` | Volunteer control sheet with polling. |
| `stats_dashboard.html` | Season analytics (Chart.js). |
| `alert_dashboard.html` | System alerts & escalations. |
| `expense_tracker.html` | Volunteer reimbursements. |
| `product_code_dashboard.html` | UFILE product-code distribution. |
| `raffle_draw.html` | Volunteer raffle draws. |
| `todo_list.html` | Task assignment across the team. |
| `catbus_intake_form.html` | Walk-in client intake. |
| `application_review.html` | Volunteer-application triage. |
| `availability_form.html` | Volunteer availability survey. |
| `appointment_screening.html` | Complex-case screening wizard. |
| `mass_email.html` | Mass email composer for announcements. |

---

## Content fundamentals

### Voice & tone
**Warm, direct, practical, slightly conversational — never corporate.** Copy
is written the way a student volunteer would explain things to a nervous
first-time filer at the table. It assumes you're smart but new to taxes.

- **We / us / you.** Uses "we" when referring to the clinic, "you" when
  addressing the reader directly: *"We will walk you through the process
  of getting an Individual Tax Number (ITN) if you're not eligible for a
  SIN."* No "the clinic recommends…" style.
- **Plain English over jargon.** Technical tax terms are introduced with
  context: *"For tax purposes this is considered self-employment income.
  Unfortunately, we are unable to assist with returns that include
  self-employment income."*
- **Enthusiastic + welcoming.** *"International students are welcome and
  encouraged to file a tax return even if they don't have any income!"*
  *"Absolutely, we do not restrict our services to University of
  Waterloo students"*
- **Practical over polished.** Acknowledges real-world mess: *"if you've
  left stuff at home, or come back another time if they don't have
  everything at the moment."*
- **Honest about limits.** Regrets are stated plainly, with a reason:
  *"Due to resource contraints, this is not a service we can provide."*
- **Occasional easter-egg humor** in the codebase (see `shared.js`:
  *"Ah! You found my Easter Egg!"*). The production-facing site keeps
  humor restrained — it's a government-adjacent service.

### Casing & punctuation
- **Sentence case** for most headings ("About Us", "Frequently Asked
  Questions", "Preparing for Your Visit"). Title Case is acceptable for
  top-level section banners.
- **Bold** is used generously for scannable keywords inside paragraphs,
  especially in the checklist and FAQ (the key take-away in each answer
  is typically bold).
- Oxford comma: inconsistent; lean toward including it.
- em-dashes (`—`) for asides; never spaced em-dashes.
- Uses Canadian context (CPA, CRA, CFE, KW, Ontario Trillium Benefit,
  GST/HST Credit). Dollars are `$40,000`.

### Example phrases (copy-as-is vocabulary)
- "walk-in basis" / "No appointment necessary!"
- "Regrettably, we will not be able to prepare your return if…"
- "Free tax filing clinic for students and low-income individuals at the
  University of Waterloo."
- "Resource contraints" (yes, typo-as-written; don't correct in
  historical references)
- Internal: "Client And Tax Booking Utility System (CATBUS)",
  "Designed by Ben Ma, CPA, CFA, CFP for the UW AFSA Tax Clinic."

### Emoji & icons in copy
- Public site: **no emoji in body copy.** Section markers use `✓` and `✕`
  (unicode check/cross) for bring/don't-bring lists, in red.
- Internal CATBUS: emoji ARE used freely in dashboard UI — `🏠 Home`,
  `🔄 Refresh`, `✏️ Edit`, `🗑️ Remove`, `✅`, `❌`, `ℹ️`, `⏱️`,
  `☀️`/`🌙` for the light/dark toggle thumb. They're treated as
  disposable iconography, not brand.

---

## Visual foundations

### Color
See `colors_and_type.css` for the full token set. The short version:

- **One brand red, two shades.** The public site uses a softer crimson
  `#c0392b` (with hover `#922b21`). CATBUS uses a deeper brick `rgb(142, 0, 0)`
  (hover `#a00000`). Both read as "AFSA red". Charts on the About page
  use the even-deeper `#980000` for bar fills.
- **Neutrals differ per product.** Public site is cool slate
  (`#F8FAFC` → `#0F172A`, slate-50 through slate-900 Tailwind-ish).
  CATBUS is warm off-white (`#f5f5f5`, `#e0e0e0`, `#1a1a1a`).
- **No gradients** except one subtle `linear-gradient(180deg, surface,
  bg-secondary)` on the home-page clinic-status panel. No bluish-purple
  anything.
- **Role colors (CATBUS only).** Each volunteer role has a pastel tag
  color: mentor `#3498db`, frontline `#2ecc71`, filer `#9b59b6`,
  internal services `#e74c3c`. Use these ONLY for volunteer typing.
- **Status colors** — green/red/blue, for the clinic open / closed /
  loading pill. Green uses `#2e7d32` (darker, readable-on-white) or the
  mint `#10B981` depending on context.
- **Dark mode is a first-class citizen.** Both products support it; the
  toggle persists in `localStorage`. Every token has a dark-mode
  counterpart. Tables, callouts and FAQ summaries get explicit overrides.

### Typography
- **Public site: Lexend (display) + Source Sans 3 (body).** Both loaded
  from Google Fonts (`Lexend:300,400,500,600,700` and `Source Sans 3`
  same weights). Lexend handles headings and nav; Source Sans 3 handles
  body copy and tables. `letter-spacing: -0.01em` on headings. Base font
  size is `16px` with `line-height: 1.65`.
- **CATBUS internal: Segoe UI system stack** (`'Segoe UI', Verdana,
  sans-serif`). No webfont loaded — the internal tools prioritize cold
  load speed on school-lab machines. Headings use `letter-spacing:
  -0.5px` (h1) to `-0.2px` (h3) for a slightly tighter look.
- **Charts (Chart.js): Roboto / Arial fallback.** The stats bar chart
  specifies `font: { family: 'Roboto, Arial, sans-serif' }`.
- Body copy on the public site uses `text-align: justify` inside the
  `.sqs-html-content` wrapper (inherited from the Squarespace era). Lists
  and table cells stay left-aligned.

### Spacing & layout
- **Public content max-width: `860px`.** Single column, centered, with
  28–48px vertical padding. No sidebars.
- **CATBUS body max-width: `1200px`.** Internal forms wrap inside
  `max-width: 800px`. Padding `30px 20px` on desktop, `10px` on mobile.
- **Rounded corners:** small `4px`, medium `8px`, large `12px`,
  pill `999px`. The public site uses `8px`/`12px` liberally;
  CATBUS uses `8px` on cards and modals, `12px` on the form-section
  outer containers.
- **Mobile breakpoint:** `600px` on the public site, `768px` on
  CATBUS (where the queue/assignment tables collapse into full-width
  cards with `min-height: 44px` touch targets).

### Backgrounds & imagery
- **No hero images, no photography.** Every page is typography-first on
  a flat surface.
- **No illustrations, no patterns, no textures.** The AFSA shield
  (`assets/logo.png`) is the single piece of imagery on the public site.
  On CATBUS dashboards, there's often no image at all above the fold.
- **One subtle gradient exists:** the `.clinic-status-panel` on the
  homepage uses `linear-gradient(180deg, var(--surface),
  var(--bg-secondary))`.
- **Charts** (About page, Stats dashboard) are the only "decorative"
  graphics — flat bar charts in brand red, rounded 4px corners, Chart.js.

### Borders, cards & shadows
- **Cards:** 1px solid border (`#E2E8F0` web / `#e0e0e0` catbus) +
  12px radius + a soft `shadow-sm`. On hover they lift 3px and swap to
  `shadow-md` plus a red border. See `.tool-card` on the public site and
  `.form-section` on CATBUS.
- **Shadows are subtle and cool-toned on the public site** (RGB of slate
  navy at 6–10% opacity). CATBUS uses plain black at 10–15%.
- **The red-bar accent is a major motif.** Section heads, callout boxes,
  collapsed FAQ categories, and the home-page clinic status box all use
  a left border (3–5px) in brand red. This is the closest thing the
  brand has to a signature visual move.
- **The callout box** (`.callout-box`) — surface bg, 1px border,
  4px-left red stripe, 0 top-left / 0 bottom-left radius — is used
  everywhere on the public site and **must be preserved**.

### Borders continued
- Table rows: 1px bottom border in `border-light`, zebra striping via
  `:nth-child(even)` on `bg-secondary`. Table headers on the public
  site are UPPERCASE micro-text with a 2px bottom divider.
- On CATBUS the queue table header is **solid red** with white type,
  uppercase, 0.85em, letter-spacing 0.5px.

### Motion
- Transitions run at **0.18s ease** for most interactive states
  (`color`, `background`, `border-color`, `box-shadow`), **0.2s** for
  card lift, **0.3s** for theme switches.
- **One page-enter animation** on the public site: `pageEnter` fades in
  and slides up 8px over 0.35s on every page load. Respects
  `prefers-reduced-motion` (becomes a no-op).
- `.pulse` animation (1.5s infinite, opacity 1 → 0.6) is reserved for
  **danger states** — queue rows where wait time ≥ 30 min.
- **Page exits fade** on internal link clicks (opacity to 0 over 0.2s
  before `window.location.href` swap) — see `shared.js`.
- No bouncy springs anywhere. No scroll-jacking. No marquees.

### Hover states
- Links: darker accent (`--accent-hover`).
- Nav items: tint background with `--accent-subtle`, text switches to
  accent red.
- Cards: `translateY(-3px)`, stronger shadow, red border, fade-in arrow
  `→` at bottom-right (only on public-site tool cards).
- Buttons (CATBUS): `translateY(-2px)` + red drop shadow on primary.

### Press / active states
- Buttons reset to `translateY(0)` (cancels the hover lift).
- No color change on press; the translate is the only cue.

### Focus
- Always a **2px red outline + 3px 10%-tint red halo**
  (`outline: 2px solid var(--accent)` + `box-shadow: 0 0 0 3px rgba(142,0,0,0.1)`).
  Inputs on both products follow the same recipe.

### Transparency, blur
- The public site's sticky `<nav>` uses
  `background: rgba(255,255,255,0.92); backdrop-filter: blur(8px)`
  (with a dark-mode equivalent at `rgba(36,36,36,0.92)`).
- Modals use a `rgba(0,0,0,0.6)` scrim. No blur on scrims.

### Layout fixtures
- Sticky top nav, `z-index: 100`.
- Fixed bottom-right **dark-mode toggle button** on every public page.
- Fixed bottom footer copyright strip on CATBUS dashboards — tiny
  (`11px`), 60% opacity, `pointer-events: none`.

---

## Iconography

- **System:** inline SVG icons, sourced from **Feather Icons** style
  (1.5–2px stroke, rounded joins, 24×24 viewbox, `stroke="currentColor"`,
  `fill="none"`). See the footer Instagram + Email icons in `shared.js`
  for the canonical treatment, and the sun/moon dark-mode toggle icons.
  These ship inline and reuse `currentColor` so they adopt theme.
- **No icon font.** No Font Awesome. No Lucide import — but the Feather
  style is functionally identical to Lucide, so Lucide (CDN) is a safe
  substitute when an icon isn't in the codebase already.
- **Library suggestion when extending:** `https://unpkg.com/lucide-static@latest`.
  Stay on default 2px stroke. Flag any icon that isn't already
  represented on the live site.
- **PNG icons:** just two — `assets/logo.png` (the AFSA shield wordmark)
  and `assets/favicon.ico`. Both are provided.
- **Emoji** are used as UI glyphs inside CATBUS dashboards (✏️ Edit,
  🗑️ Remove, 🔄 Refresh, 🏠 Home, ⏱️, 🔑, 👤, ✅, ❌, ℹ️,
  ☀️/🌙 for theme) but **never on the public site**.
- **Unicode glyphs** are used for checklist markers: `✓` (U+2713) for
  "Bring" items (green `#27ae60`), `✕` (U+2717) for "Don't bring"
  (red `#c0392b`). The FAQ accordion chevrons are `▶` and `+`/`×`
  CSS-drawn, rotated on open.

### Logo

- `assets/logo.png` — the AFSA shield (scales of justice + chevron +
  book with crown) and the "AFSA" wordmark, in brand red on transparent.
- Used in the public site header at `max-width: 180px`, centred,
  clickable to `uwafsa.com`.
- Used as the schema.org `logo` for structured data.
- **Do not recolor.** Do not place on non-white backgrounds without
  testing contrast; in dark mode the site keeps the logo as-is on a
  dark surface — the red shield still reads.

---

## How to use this system

1. **Building a new public-site page:** link `colors_and_type.css`,
   import the header/nav/footer pattern from `ui_kits/public-website/`,
   and write content inside `<div id="content"><div class="sqs-html-content">…</div></div>`.
2. **Building a new internal CATBUS dashboard:** add the `ctx-catbus`
   class on `<body>`, use the form-section / table / modal / toast
   patterns from `ui_kits/catbus/`, and keep to Segoe UI.
3. **Picking a red:** if it's public-facing, use `--afsa-red-web`
   (`#c0392b`). If it's internal-tool chrome, use `--afsa-red`
   (`rgb(142,0,0)`).
4. **Picking a neutral:** cool slate = public, warm off-white = CATBUS.
   Don't cross the streams.
