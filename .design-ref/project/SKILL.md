---
name: uwafsa-tax-clinic-design
description: Use this skill to generate well-branded interfaces and assets for the UW AFSA Tax Clinic — either for production or throwaway prototypes, mocks, slides, etc. Contains essential design guidelines, colors, typography, fonts, assets, and UI-kit components for prototyping both the public marketing site and the internal CATBUS tools.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

The UW AFSA Tax Clinic has **two visual contexts that share the same red** but differ elsewhere:

- **Public site** (`ui_kits/public-website/`) — Lexend + Source Sans 3, cool slate neutrals, softer crimson `#c0392b`, full dark-mode support.
- **Internal CATBUS tools** (`ui_kits/catbus/`) — Segoe UI system stack, warm off-white neutrals, deeper brick `rgb(142, 0, 0)`, role-coded volunteer tags, emoji as UI glyphs.

Pick the right one before you start. Cross-using tokens is the most common failure.

## Files

- `README.md` — full design system documentation.
- `colors_and_type.css` — all tokens as CSS variables, plus a sensible default semantic layer and `.ctx-catbus` override class.
- `assets/logo.png`, `assets/favicon.ico` — the only brand imagery.
- `preview/` — atomic spec cards for the Design System tab.
- `ui_kits/public-website/` — hi-fi recreation of the public site. `index.html` is a working click-thru.
- `ui_kits/catbus/` — hi-fi recreation of the internal tools. `index.html` is a working click-thru.

## Core rules

- **Voice:** warm, direct, practical, never corporate. Uses "we" for the clinic and "you" for the reader. No emoji in public-facing body copy.
- **Red accent bar:** a 3–5px left border in brand red is the brand's signature move — use it on section headings, callouts, the status panel.
- **No gradients**, no photography, no hand-drawn SVG illustrations. Typography + flat surfaces + the occasional bar chart.
- **Focus ring:** always 2px solid accent + 3px 10%-tint accent halo.
- **Icons:** Feather-style inline SVG (2px stroke, `currentColor`, `fill="none"`). Lucide via CDN is an acceptable fallback.
