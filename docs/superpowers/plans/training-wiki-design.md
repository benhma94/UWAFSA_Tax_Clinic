# Plan: Training Wiki Page

## Context

`training.html` is a minimal static page (slides + quiz links). Transform it into a self-contained volunteer reference wiki: sidebar navigation, searchable content, collapsible accordions. Stays visually consistent with the existing CATBUS site.

**Output file:** `webpage/training-wiki.html` (new; does not replace training.html)

---

## 1. HTML Structure

```
<head>
  inline dark-mode detection script  (copy from training.html)
  <link> shared.css
  <script> config.js
  <style> (all page-specific styles)
</head>
<body>
  <div id="site-header">  ← shared.js
  <div id="site-nav">     ← shared.js

  <div class="wiki-wrap">
    <aside class="sidebar">
      <input id="wiki-search" type="search" placeholder="Search…">
      <nav> <!-- categories → subsection links --> </nav>
      <p class="no-results hidden">No results.</p>
    </aside>
    <main class="wiki-main">
      <!-- accordion sections, one per subsection -->
    </main>
  </div>

  <div id="site-footer">  ← shared.js
  <script> shared.js
  <script> wiki.js (inline)
</body>
```

---

## 2. CSS (inline `<style>` block — no external deps)

Use only existing CSS variables (`--bg`, `--bg-secondary`, `--border`, `--accent`, `--text`, `--text-muted`). No hardcoded colors.

| Selector | Key rules |
|---|---|
| `.wiki-wrap` | `display:flex; max-width:1100px; margin:0 auto; min-height:80vh` |
| `.sidebar` | `width:240px; flex-shrink:0; border-right:1px solid var(--border); padding:16px; position:sticky; top:20px; max-height:calc(100vh - 80px); overflow-y:auto` |
| `#wiki-search` | full-width, uses `--input-bg`, `--border`, `--text` |
| `.cat-header` | flex row, `cursor:pointer`, `+`/`−` icon via `::after`, hover bg `--bg-secondary` |
| `.cat-links` | hidden by default; `max-height` transition for expand |
| `.cat-link` | block, left-pad, hover + active accent left-border |
| `.wiki-main` | `flex:1; padding:0 32px 40px` |
| `.section` | `border-bottom:1px solid var(--border-light)` |
| `.section-header` | flex row, `cursor:pointer`, `+`/`−` icon, hover bg |
| `.section-body` | `max-height:0; overflow:hidden; transition:max-height 0.3s ease` |
| `.section-body.open` | `max-height:600px` |
| `.tip` | callout box using `--bg-secondary`, left accent border |
| `mark` | yellow bg, no border-radius (search highlight) |
| `@media(max-width:768px)` | `.wiki-wrap` column; `.sidebar` no sticky, no border-right, border-bottom; `.cat-links` hidden permanently |

---

## 3. Content: 4 Categories / 11 Sections

1. **Day-of Operations** → Volunteer Check-in · Intake Screening · Doorman Dispatch · Client Handoff  
2. **Filing & Tax Topics** → CRA Basics · T1 Walkthrough · Common Slips · Deductions & Credits  
3. **Client Interaction** → Discovery Questions · Privacy & Confidentiality · Handling Conflict  
4. **Help & Resources** → Contact Mentor · FAQ  

Each section: title, 1-sentence intro, numbered steps (5–8), optional `.tip` callout. Realistic placeholder text (not lorem ipsum).

---

## 4. JavaScript (inline, ~80 lines)

Four focused functions — no classes, no state objects:

```
toggleCategory(catEl)   — expand/collapse .cat-links; save to localStorage
toggleSection(secEl)    — open/close .section-body via .open class
filterWiki(query)       — debounced 300ms; hide non-matching links;
                          auto-expand matching categories; highlight <mark>;
                          show .no-results if nothing matches
scrollToSection(id)     — scroll .wiki-main to section, flash .highlight 600ms
```

localStorage key: `wikiCats` — JSON array of open category IDs. Restored on DOMContentLoaded.

---

## 5. Files

| Action | Path |
|---|---|
| Read (reference) | `webpage/shared.css` |
| Read (reference) | `webpage/training.html` |
| **Create** | `webpage/training-wiki.html` |

---

## 6. Verification

1. Page loads with shared header/nav/footer
2. Dark mode toggle — no hardcoded colors break
3. Category click — expands/collapses with animation
4. Subsection link click — content scrolls + section opens + brief highlight
5. Section header click — accordion opens/closes
6. Search — sidebar filters, content highlights, categories auto-expand
7. Clear search — resets to collapsed
8. Mobile (<768px) — single column, no broken layout
9. Reload — open categories restored from localStorage
10. Gibberish search — "No results." message appears
