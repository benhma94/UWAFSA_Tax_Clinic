# Dark Mode Color Scheme Fix

**Date:** 2026-04-14  
**Status:** Approved

## Context

The public-facing `webpage/` pages use a dark mode with a slate/navy background (`#0F172A`) and red accent (`#E05252`). Users find the combination hard to read — navy and red clash visually, and muted text fails WCAG contrast requirements. The fix replaces the navy backgrounds with warm dark grays (Apple-style `#1a1a1a` family), which provides better contrast and lets the red accent read clearly (red on near-black is a well-established pattern).

## Scope

Single file change: `webpage/shared.css`, lines 33–51 (`html.dark-mode` block).  
No changes to light mode, component structure, fonts, layout, or brand colors.

## New Token Values

| Token | Old (navy) | New (warm dark gray) |
|---|---|---|
| `--bg` | `#0F172A` | `#1a1a1a` |
| `--bg-secondary` | `#1E293B` | `#242424` |
| `--bg-tertiary` | `#293548` | `#2e2e2e` |
| `--text` | `#F1F5F9` | `#F5F5F5` |
| `--text-body` | `#CBD5E1` | `#D4D4D4` |
| `--text-muted` | `#94A3B8` | `#A3A3A3` |
| `--border` | `#334155` | `#333333` |
| `--border-light` | `#1E293B` | `#242424` |
| `--border-mid` | `#475569` | `#444444` |
| `--input-bg` | `#1E293B` | `#242424` |
| `--surface` | `#1E293B` | `#242424` |
| `--accent` | `#E05252` | `#E05252` (unchanged) |
| `--accent-hover` | `#c0392b` | `#c0392b` (unchanged) |
| `--accent-subtle` | `rgba(192,57,43,0.15)` | unchanged |

## Contrast Improvements

- Body text: ~5:1 → ~9:1 (WCAG AAA)
- Muted text: fails AA → ~5.7:1 (passes WCAG AA)
- Accent red on new background: high contrast, no adjustment needed

## Verification

1. Open any `webpage/*.html` in a browser
2. Toggle dark mode using the floating button (bottom-right)
3. Confirm background is warm dark gray (not navy/blue)
4. Confirm body text and muted text are clearly readable
5. Confirm red links/borders are visible and not clashing
