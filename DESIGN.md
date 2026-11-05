# DESIGN.md — Smart QS (AegisQS)

> Visual design system for coding agents and designers.
> Read this before building or restyling any UI. `AGENTS.md` §9 summarises it; this file wins on visual detail.
> Components come from **21st.dev** (shadcn-compatible), but **their look comes from this file, never from the component's demo**.

---

## 1. Design concept: "Materials on site"

Smart QS is used by quantity surveyors working on Hong Kong building projects: comparing drawing revisions, watching material prices, keeping documents straight, and living in Excel. The palette is taken from the materials of that work:

| Name | Hex | Material |
|---|---|---|
| **Clay** | `#A98B76` | Fired brick, weathered render |
| **Sandstone** | `#BFA28C` | Stone cladding, timber |
| **Limewash** | `#F3E4C9` | Lime plaster, tracing paper, highlighter |
| **Lichen** | `#BABF94` | Moss on old concrete, patina |

The UI should feel like a **calm, well-lit site office**: warm neutrals, crisp drawings, dense legible numbers, colour only where it carries meaning.

### Three principles

1. **The drawing and the number are the hero.** On every screen the most important thing is either a drawing the QS must read or a figure they must trust. Nothing decorative competes.
2. **Colour means something.** Lichen = good / within range. Crimson = error / removed. Ochre = caution / modified. Blue = new revision. Limewash = "look here" (change, selection). Clay = brand and primary action.
3. **Borrow the drafter's language.** The signature element is the **revision cloud with a delta tag** (§7) — the mark every QS already reads on paper drawings.

---

## 2. Colour system

### 2.1 Brand palette (from the brief — do not alter these hex values)

| Token | Hex | Contrast on white | Allowed use |
|---|---|---|---|
| `--clay` | `#A98B76` | 3.16 : 1 | Brand mark, large icons, chart fills. **Not for body text.** |
| `--sandstone` | `#BFA28C` | 2.40 : 1 | Dividers, muted chart series, text **on ink** (6.56 : 1). **Not text on light.** |
| `--limewash` | `#F3E4C9` | 1.25 : 1 | Change fill inside revision clouds, selection, forecast band, secondary button. |
| `--lichen` | `#BABF94` | 1.91 : 1 | "Within range" fills, procurement window band, active nav bar on ink (8.21 : 1). |

All four brand colours are light and low-contrast — that's what makes them calm, and why text and controls use the derived shades below.

### 2.2 Derived neutrals and shades (contrast-checked)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--ink` | `#2B211B` | Primary text, sidebar | 15.7 : 1 on white |
| `--clay-800` | `#4A3A2F` | Primary hover, headings on limewash | 10.8 : 1 |
| `--clay-700` | `#6B5445` | **Primary button** (white text), forecast median line | 7.05 : 1 |
| `--clay-600` | `#8A6F5C` | Focus ring, links, revision cloud stroke | 4.66 : 1 |
| `--muted-ink` | `#6E6259` | Secondary text, headers, axis labels | 5.43 : 1 on canvas |
| `--canvas` | `#F7F5F2` | App background (warm grey, **not** cream) | — |
| `--panel` | `#FFFFFF` | Cards, tables, drawers | — |
| `--stone-50` | `#F1ECE5` | Table header, muted fill, spreadsheet row/column headers | — |
| `--limewash-100` | `#F8F0E1` | Selected row | ink 13.9 : 1 |
| `--line` | `#E7DED2` | Hairlines, panel borders, gridlines | — |
| `--line-strong` | `#94877B` | Input borders, frozen-column edge (≥ 3 : 1) | 3.21 : 1 |
| `--sidebar-hover` | `#3A2E26` | Hover/active in the ink sidebar | cream 10.5 : 1 |
| `--paper` | `#FFFFFF` | Drawing sheet background inside the viewer | — |
| `--viewer-bg` | `#E9E4DC` | Area around the drawing sheet | — |

### 2.3 Semantic status colours

| Meaning | Text / icon | Tint background | Solid / chart | Text on tint |
|---|---|---|---|---|
| **Good / within range / resolved** | `--tolerance` `#474C2E` | `--tolerance-bg` `#EEF0E2` | `#5E6440` | 7.77 : 1 |
| **Caution / warning / modified** | `--caution` `#7F5710` | `--caution-bg` `#F6EACB` | `#B8862E` | 5.36 : 1 |
| **Error / rising cost / removed** | `--risk` `#9E2B36` | `--risk-bg` `#F7E0E2` | `#9E2B36` | 5.86 : 1 |
| **Info / low confidence / no data** | `--muted-ink` `#6E6259` | `--stone-50` `#F1ECE5` | Hatched `#CFC2B2` | 5.03 : 1 |

### 2.4 Revision colours (drawing comparison only)

The overlay needs two colours that stay distinct for colour-blind users and don't collide with brand. Blue is introduced **only** for "new revision" and appears nowhere else in the product.

| Token | Hex | Meaning | Contrast on white |
|---|---|---|---|
| `--rev-base` | `#9E2B36` | Older revision (base) — lines only in base read as **removed** | 7.36 : 1 |
| `--rev-target` | `#2F6F8F` | Newer revision (target) — lines only in target read as **added** | 5.54 : 1 |
| `--rev-target-bg` | `#E3EEF3` | Tint for "added" chips | text 4.69 : 1 |

In overlay mode, lines present in both revisions combine (multiply) to near-black, so unchanged geometry reads as neutral and only differences carry colour.

### 2.5 Status vocabularies (never colour alone — colour + icon + label)

| Domain | Value | Colour | Icon (lucide-react) | Label |
|---|---|---|---|---|
| Change kind | added | rev-target | `Plus` | "Added" |
| | removed | rev-base | `Minus` | "Removed" |
| | modified | caution | `PenLine` | "Modified" |
| | dimension | caution | `Ruler` | "Dimension changed" |
| | annotation | muted | `Type` | "Text changed" |
| Change status | new | muted | `Circle` | "Not reviewed" |
| | no_variation | tolerance | `CircleCheck` | "No variation" |
| | potential_variation | caution | `TriangleAlert` | "Potential variation" |
| Variation status | potential | caution | `TriangleAlert` | "Potential" |
| | under_review | muted | `Clock` | "Under review" |
| | confirmed | ink (solid chip) | `CircleCheckBig` | "Confirmed" |
| | rejected | muted | `CircleSlash` | "Rejected" |
| Check severity | error | risk | `OctagonAlert` | "Error" |
| | warning | caution | `TriangleAlert` | "Warning" |
| | info | muted | `Info` | "Info" |
| Version status | current | tolerance | `BadgeCheck` | "Current" |
| | superseded | muted | `History` | "Superseded" |
| | conflict | risk | `GitCompareArrows` | "Conflict" |
| Price trend | rising | risk | `TrendingUp` | "Rising" |
| | stable | muted | `MoveRight` | "Stable" |
| | falling | tolerance | `TrendingDown` | "Falling" |
| Advice | buy_now | clay-700 solid | `ShoppingCart` | "Buy now" |
| | buy_in_window | tolerance | `CalendarRange` | "Buy in window" |
| | no_clear_advantage | muted | `Scale` | "No clear advantage" |

Note: for prices, **rising = red** because rising costs are bad for the QS's client. Say it in the label too.

---

## 3. Theme implementation (shadcn / 21st.dev variables)

21st.dev components read the standard shadcn CSS variables. Map the palette onto them **once** in `src/app/globals.css`; every installed component inherits it.

```css
@import "tailwindcss";

:root {
  /* shadcn contract — every 21st.dev component reads these */
  --background: #F7F5F2;
  --foreground: #2B211B;
  --card: #FFFFFF;
  --card-foreground: #2B211B;
  --popover: #FFFFFF;
  --popover-foreground: #2B211B;
  --primary: #6B5445;
  --primary-foreground: #FFFFFF;
  --secondary: #F3E4C9;
  --secondary-foreground: #4A3A2F;
  --muted: #F1ECE5;
  --muted-foreground: #6E6259;
  --accent: #F8F0E1;
  --accent-foreground: #2B211B;
  --destructive: #9E2B36;
  --destructive-foreground: #FFFFFF;
  --border: #E7DED2;
  --input: #94877B;
  --ring: #8A6F5C;
  --radius: 0.625rem;

  --sidebar: #2B211B;
  --sidebar-foreground: #F3E4C9;
  --sidebar-primary: #BABF94;
  --sidebar-primary-foreground: #2B211B;
  --sidebar-accent: #3A2E26;
  --sidebar-accent-foreground: #F3E4C9;
  --sidebar-border: #3F332B;
  --sidebar-ring: #BABF94;

  --chart-1: #2B211B;  /* history / focus series */
  --chart-2: #6B5445;  /* forecast median */
  --chart-3: #9E2B36;  /* rising / error */
  --chart-4: #5E6440;  /* falling / good */
  --chart-5: #CFC2B2;  /* background series */

  /* Smart QS tokens */
  --ink: #2B211B;
  --surface: #F7F5F2;
  --panel: #FFFFFF;
  --muted-ink: #6E6259;
  --clay: #A98B76;
  --clay-600: #8A6F5C;
  --clay-700: #6B5445;
  --clay-800: #4A3A2F;
  --sandstone: #BFA28C;
  --limewash: #F3E4C9;
  --limewash-100: #F8F0E1;
  --lichen: #BABF94;
  --stone-50: #F1ECE5;
  --line: #E7DED2;
  --line-strong: #94877B;
  --tolerance: #474C2E;
  --tolerance-bg: #EEF0E2;
  --caution: #7F5710;
  --caution-bg: #F6EACB;
  --risk: #9E2B36;
  --risk-bg: #F7E0E2;
  --rev-base: #9E2B36;
  --rev-target: #2F6F8F;
  --rev-target-bg: #E3EEF3;
  --paper: #FFFFFF;
  --viewer-bg: #E9E4DC;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-border: var(--sidebar-border);

  --color-ink: var(--ink);
  --color-clay: var(--clay);
  --color-clay-600: var(--clay-600);
  --color-clay-700: var(--clay-700);
  --color-clay-800: var(--clay-800);
  --color-sandstone: var(--sandstone);
  --color-limewash: var(--limewash);
  --color-limewash-100: var(--limewash-100);
  --color-lichen: var(--lichen);
  --color-stone-50: var(--stone-50);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-tolerance: var(--tolerance);
  --color-tolerance-bg: var(--tolerance-bg);
  --color-caution: var(--caution);
  --color-caution-bg: var(--caution-bg);
  --color-risk: var(--risk);
  --color-risk-bg: var(--risk-bg);
  --color-rev-base: var(--rev-base);
  --color-rev-target: var(--rev-target);
  --color-rev-target-bg: var(--rev-target-bg);
  --color-paper: var(--paper);
  --color-viewer-bg: var(--viewer-bg);

  --font-sans: var(--font-karla), var(--font-noto-hk), ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 0.25rem;   /* 4px  in-table chips, checkboxes */
  --radius-md: 0.375rem;  /* 6px  buttons, inputs */
  --radius-lg: 0.625rem;  /* 10px panels, drawers */
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

Dark mode is **not in the MVP**. Don't add `dark:` classes; tokens make it a later override.

---

## 4. Typography — Karla

### 4.1 Loading

```ts
// src/app/fonts.ts
import { Karla, Noto_Sans_HK } from 'next/font/google';

export const karla = Karla({ subsets: ['latin'], weight: 'variable', variable: '--font-karla', display: 'swap' });
export const notoSansHK = Noto_Sans_HK({ weight: ['400', '500', '700'], variable: '--font-noto-hk', display: 'swap', preload: false });
```

### 4.2 Tabular figures are mandatory

Karla's **default digits are proportional** ("1" is much narrower than "0"), so columns of prices won't line up. The font includes the `tnum` feature: every number in tables, KPIs, chart labels, cell grids and currency uses `font-variant-numeric: tabular-nums lining-nums` (Tailwind `tabular-nums`). Apply it on `<table>`, the spreadsheet grid and number components by default.

**Verification test:** render `1111.11` and `0000.00` stacked in a `tabular-nums` element; widths must match. If not, fix the font loading — don't switch to monospace.

### 4.3 Type scale (app, base 14px)

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 32 / 38 | 700 | −0.015em | KPI values, indicative cost total, latest price |
| `title-lg` | 24 / 30 | 600 | −0.01em | Page title |
| `title` | 18 / 24 | 600 | −0.005em | Panel and drawer titles |
| `body` | 14 / 20 | 400 | 0 | Default text, table cells |
| `body-strong` | 14 / 20 | 600 | 0 | Names, emphasised values |
| `label` | 13 / 18 | 500 | 0 | Form labels, table headers |
| `caption` | 12 / 16 | 400 | 0.005em | Axis labels, timestamps, cell refs, provenance |

### 4.4 Rules

- **Sentence case everywhere.** No all-caps labels, no letter-spaced eyebrows above headings.
- One family. **No monospace** — including cell references (`F124`) and drawing numbers (`A-201`); tabular Karla handles them.
- Prose (change summaries, advice rationale) max ~72 characters per line.
- zh-HK body text gets +2px line-height.

---

## 5. Space, radius, borders, elevation

- **Spacing:** 4px base — 4 · 8 · 12 · 16 · 24 · 32 · 48. Panel padding 16 (compact) / 20 (comfortable). Panel gap 16.
- **Radius hierarchy:** 4px in-table chips · 6px controls · 10px panels and drawers · pill only for status chips and avatars. The drawing sheet itself has **square corners** (it's paper).
- **Borders over shadows.** Panels: `1px solid var(--line)`, no shadow.
- **Shadows only for floating layers** (drawer, popover, dialog, dropdown, toast, the drawing sheet on the viewer background): `0 8px 24px rgba(43, 33, 27, 0.12), 0 1px 2px rgba(43, 33, 27, 0.08)`.
- **Density:** comfortable rows 44px, compact 36px. Compact is default for the spreadsheet preview, checks list and document register.

---

## 6. Layout

```
┌──────────┬──────────────────────────────────────────────┬──────────────┐
│ INK      │ Header (white, 56px, hairline)                │              │
│ sidebar  │ Project ▾          Search      Jobs ⟳   🔔    │              │
│ 240px    ├──────────────────────────────────────────────┤  Detail      │
│          │ Canvas #F7F5F2                                │  drawer      │
│ Overview │  Page title (24/600)          [Primary]       │  420–560px   │
│ Documents│  ┌─────────────────────────────────────────┐  │  (change,    │
│ Drawings │  │ white panels / viewer / grid            │  │  check,      │
│ Variations│ └─────────────────────────────────────────┘  │  version)    │
│ Workbooks│                                               │              │
│ Procure- │                                               │              │
│ ment     │                                               │              │
│ ─────    │                                               │              │
│ Materials│                                               │              │
│ Audit    │                                               │              │
└──────────┴──────────────────────────────────────────────┴──────────────┘
```

- **Sidebar:** ink background, limewash text, sandstone section labels, 3px **lichen** bar on the active item. Collapses to a 64px rail below 1440px and automatically inside the comparison viewer.
- **Header:** white, bottom hairline; project switcher, global search (documents, drawings, BOQ items, materials), job indicator, notifications.
- **Content:** left-aligned, max 1600px (viewer pages are full-bleed), 12-column grid, 16px gutters.
- **Ink surfaces:** only the sidebar and the comparison viewer toolbar.

### 6.1 Comparison viewer layout (the key screen)

```
┌────────────────────────────────────────────────────────────────────────┐
│ A-201 Level 2 floor plan   Rev B → Rev C   [Side by side|Overlay|Swipe] │  ink toolbar
│ Alignment: auto · 0.96 ✓     Zoom 100% − +   Fit     ◀ Change 2 of 4 ▶  │
├──────────────────────────────────────────────────────┬─────────────────┤
│                                                      │ Changes (4)     │
│      viewer-bg                                       │ ▢ All kinds ▾   │
│   ┌──────────────────── paper ───────────────────┐   │ △1 Modified  …  │
│   │                                              │   │ △2 Added     …  │
│   │        ⌒⌒⌒⌒△2                                 │   │ △3 Removed   …  │
│   │       (  new beam  )                         │   │ △4 Dimension …  │
│   │        ⌣⌣⌣⌣                                   │   │                 │
│   └──────────────────────────────────────────────┘   │ [Raise potential│
│                                                      │  variation (2)] │
└──────────────────────────────────────────────────────┴─────────────────┘
```

---

## 7. Signature element — revision cloud + delta tag

Drafters mark each change on a drawing with a scalloped **revision cloud** and a numbered **triangle (delta) tag**. Smart QS marks detected changes the same way, so a QS reads the screen exactly like a marked-up print.

- **Cloud:** scalloped outline around the change `bbox` (padded 8px at current zoom), stroke `--clay-600` 2px, fill `--limewash` at 40% with `mix-blend-mode: multiply` so drawing lines stay visible underneath.
- **Delta tag:** equilateral triangle 22px, fill `--ink`, number in white 12/700 tabular, placed at the cloud's top-right scallop.
- **Selected change:** fill rises to 70%, stroke 3px, the tag gets a 2px lichen outline; list item in the side panel uses `--limewash-100` + 2px clay-600 left edge (same language as selected table rows everywhere).
- **Reviewed changes:** "No variation" clouds drop to a dashed 1.5px stroke with no fill; "Potential variation" clouds keep fill and add a small caution `TriangleAlert` beside the tag.
- **Low confidence (< 0.6):** dashed stroke + "Low confidence" text in the list.
- On first load of a comparison, clouds fade in once over 300ms. That's the only non-user-triggered motion in the product.

Scallop path helper (SVG, coordinates in viewer pixels):

```ts
export function revisionCloudPath(x: number, y: number, w: number, h: number, r = 10): string {
  const pts: Array<[number, number]> = [];
  const along = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / (r * 2)));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  along(x, y, x + w, y); along(x + w, y, x + w, y + h); along(x + w, y + h, x, y + h); along(x, y + h, x, y);
  pts.push(pts[0]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i];
    const rr = Math.hypot(cx - px, cy - py) / 2;
    d += ` A ${rr} ${rr} 0 0 1 ${cx} ${cy}`;   // sweep 1 = arcs bulge outward for clockwise path
  }
  return d + ' Z';
}
```

Don't use clouds or limewash for decoration anywhere else.

---

## 8. Component specifications

### Buttons

| Variant | Style | Use |
|---|---|---|
| Primary | clay-700 bg, white text, hover clay-800, 6px radius, 36px (32 compact) | One per view: "Compare revisions", "Raise potential variation", "Upload new version", "Get advice" |
| Secondary | limewash bg, clay-800 text, hover `#EDD9B6` | "Download annotated copy", "Mark no variation" |
| Outline | white bg, `--line-strong` border, ink text | Filters, toolbar actions |
| Ghost | transparent, muted ink, hover stone-50 | Icon buttons, row actions |
| On-ink | transparent, limewash text, hover `--sidebar-hover` | Viewer toolbar controls |
| Danger | risk bg, white text | Reject variation (senior QS) only |

Disabled: 45% opacity, `cursor-not-allowed`, tooltip saying why. No gradients, glows or shine.

### Status chip
Pill, 24px, tint background + status text colour + 14px icon + label (§2.5). Dense tables: 4px-radius square variant, 20px.

### KPI / summary card
White panel, 20px padding. Label (13/500 muted) → value (32/700 ink, tabular) → context line (12 muted). Optional sparkline: 1.5px clay-600, no fill. **Numbers never animate or count up.**

### Document register (hub)
- Table: doc number · title · category · discipline · current rev · status chip · updated · uploaded by. Filter chips per category with counts.
- Row click → detail drawer: version timeline (newest on top, current marked with lichen dot and "Current" chip, superseded greyed), preview thumbnail, linked records, conflict banner.
- **Conflict banner:** risk-bg panel, `GitCompareArrows` icon, plain explanation ("Two files are labelled Rev 2. Choose which one is current."), side-by-side file cards with hash, size, uploader, date, and a "Set as current" action for senior QS.
- **Superseded banner** on any superseded version view: stone-50 strip, `History` icon, "Superseded — Rev C is current", link.
- Upload: dropzone panel with dashed `--line-strong` border; after drop, a short form for doc number, title, revision label, issued date. If the doc number exists, say "This will be added as a new version of A-201 (current: Rev B)".

### Drawing comparison viewer
- **Side by side:** two sheets, labelled "Rev B (base)" and "Rev C (target)" in caption text above each, pan and zoom synced.
- **Overlay:** single sheet; base lines tinted `--rev-base`, target tinted `--rev-target`, combined with multiply; a legend chip row: "Only in Rev B (removed)", "Only in Rev C (added)", "In both".
- **Swipe:** single sheet with a vertical divider handle (2px ink line, 28px round handle in white with `ChevronsLeftRight` icon); base on the left, target on the right; draggable and arrow-key operable.
- Revision clouds render on top in all three modes.
- Alignment chip in toolbar: "Alignment auto · 0.96" with check icon; below 0.8 it turns caution: "Alignment may be off — adjust" opening a nudge control (dx/dy arrows, scale, rotation) with live preview.
- Changes side panel (320px, white): filter by kind and status, list items show tag number, kind chip, one-line AI summary, confidence, status. Selecting zooms the viewer to that change. Multi-select checkboxes feed "Raise potential variation (n)".
- Change detail (in the panel): summary (AI-generated label), before/after text for dimension/annotation changes shown as `3,600 → 4,200` with the old value struck through in muted ink, confidence, and actions "Mark no variation" / "Potential variation".

### Variation event page
- Header: `VE-007` ref (title 18/600) · title · status chip · drawing link · raised by/at.
- Left: thumbnail crops of the source changes (each a mini viewer with its cloud), linking back to the comparison.
- Right: **Indicative cost panel** — total in display size with range below ("Range HK$171k – HK$203k"), basis line, then the cost lines table: BOQ item ref · description · unit · qty change (signed, tabular) · rate · rate source chip · amount. "Add BOQ item" opens a searchable combobox over current BOQ items. Amounts recompute live.
- Senior QS decision bar at the bottom: "Confirm variation" (primary) and "Reject" (danger), each requiring a reason.

### Spreadsheet preview (Excel)
Familiar to Excel users without imitating Excel's chrome:
- Column letters and row numbers in stone-50 headers, 12/500 muted; gridlines `--line`; cells 13px tabular, numbers right-aligned.
- **Issue marker:** a 7px triangle in the cell's top-right corner — `--risk` for errors, `--caution` for warnings — like Excel's comment indicator. Hover/focus shows the check message in a tooltip; click opens the check in the drawer.
- Selected cell: 2px clay-600 outline. Mapped columns show a small label under the column letter ("Rate", "Qty").
- Sheet tabs at the bottom as underlined tabs (not Excel's coloured tabs).
- Toolbar: version picker, sheet picker, "Errors only" toggle, "Download" and "Download annotated copy".

### Workbook checks list
Grouped by severity, then rule. Row: severity chip · rule name ("Amount mismatch") · `Sheet!F124` · item ref · message · status. Actions: "Show in sheet", "Mark resolved", "Ignore" (reason required). Summary strip at top: errors / warnings / info counts with chips.

### Workbook version diff
Table of changed rows: kind chip (added uses rev-target colours, removed rev-base, changed caution) · item ref · description · per-field `before → after` with old value struck through · amount delta (signed, red if cost increases). Summary cards above: rows added / removed / changed / total change (HK$).

### Column mapping wizard
Three steps in one dialog: pick sheet and header row (preview first 15 rows) → map each field to a column via selects with auto-suggestions highlighted in limewash → confirm with a preview of 5 parsed items. Missing required fields block "Save mapping" with a clear reason.

### Material list
Table: material · unit · latest price · 3-month change (signed %, trend chip) · forecast trend chip · sparkline (12 months history, 1.5px ink) · "View forecast". Category filter chips.

### Procurement advice card
- Recommendation chip large (title size) with icon: "Buy in window · Feb–Mar 2027".
- Three figures in a row: "Cost if bought now", "Expected cost in window" (with p10–p90 range below), "Expected saving" (signed; tolerance colour if positive, risk if negative).
- Confidence chip and "Latest order date 15 Mar 2027 (8 weeks lead time)".
- Rationale bullets labelled AI-generated.
- Footer caption: model name, trained through, backtest error ("Backtest error ±4.8%").

### Forms
Inputs 36px, white, `--line-strong` border, 6px radius; focus 2px clay-600 ring with 2px offset; labels above; errors in risk with icon stating the fix.

### Empty states
Left-aligned, one line + one primary action, optional single lucide icon in clay. **No illustrations, mascots or stock art.**

### Toasts
White, floating shadow, 3px left status edge, bottom-right. Text names the action: "Rev C set as current", "Comparison ready — 4 changes found".

---

## 9. Data visualisation (ECharts theme)

One theme in `src/components/charts/theme.ts`, used everywhere.

- Karla 12px tabular; axis labels muted ink; axis lines `--line`; horizontal gridlines `#EFE8DE` only.
- **Grey-first:** background series `#CFC2B2`, focus series ink, status colours only where meaningful.
- No 3D, no pies/donuts for comparison, no area gradients, `animation: false` except a 200ms transition when filters change.
- Tooltip: white, `--line` border, small floating shadow, tabular values.

### 9.1 Forecast fan chart (material page)
- X: months (60 history + 12 forecast). Y: HK$ per unit, axis title includes the unit.
- History: 1.75px solid ink line.
- Forecast median (p50): 1.75px **dashed** clay-700 line, continuing from the last actual point.
- Bands: p2.5–p97.5 in `--limewash-100`; p10–p90 in `--limewash` (drawn as stacked areas between bounds, not from zero). Legend: "Median forecast", "80% likely range", "95% likely range".
- "Today" vertical line: 1px muted ink, label "Latest data Oct 2026".
- **Procurement overlay** (when advice exists): recommended window as a `--lichen` band at 35% spanning its months, labelled "Recommended buy window"; latest order date as a 1px dashed caution line; need-by date as a 1px solid ink line with label.
- Data table fallback below the chart (collapsed by default).

### 9.2 Other charts
- **Project material exposure:** horizontal bars per material at p50 exposure, with p10–p90 whiskers; sorted by p90; rising-trend materials labelled.
- **Indicative cost range:** a single horizontal range bar (low–high) with a tick at the total — inside the VE cost panel.
- **Workbook total over versions:** small step line per version (ink), points clickable to open that version.
- **Changes by kind** (comparison summary): a compact stacked bar using §2.5 colours with labels — never a donut.

---

## 10. Motion

- Only in response to user actions: drawer slide 200ms `cubic-bezier(0.2, 0, 0, 1)`; popover fade 120ms; zoom-to-change 250ms ease-out; swipe handle follows pointer with no easing.
- Revision cloud fade-in (§7) is the single automatic motion.
- No page-load entrance animations, staggered reveals, hover lift or parallax.
- `prefers-reduced-motion: reduce` → durations 0ms, zoom-to-change jumps.

---

## 11. Iconography and imagery

- **lucide-react** only, 16px (20px empty states), stroke 1.5, colour inherits text.
- No emoji, stock photography or AI illustrations in the product.
- The only imagery is real project content: drawings, document previews, site photos.

---

## 12. Using 21st.dev without importing its slop

21st.dev is a community registry of shadcn-compatible React components. We take **structure and behaviour** from it and **all visual styling** from this file.

### 12.1 Install

```bash
npx shadcn@latest add "https://21st.dev/r/<author>/<component>"
```

Or pull components via the 21st.dev MCP in Claude Code / Cursor. They land in `src/components/ui/` and become our code to restyle.

### 12.2 Good fits from 21st.dev

Sidebar, data table, tabs, segmented control (viewer modes), dropdown/select, combobox (BOQ item picker), command palette (global search), dialog, sheet/drawer, tooltip, popover, toast, badge, progress, stepper (mapping wizard), file upload/dropzone, date picker, breadcrumb, pagination, timeline (version history), comparison slider (as a base for swipe mode — strip its styling), resizable panels, skeleton.

### 12.3 Banned patterns (don't install, or strip before use)

| Pattern | Why |
|---|---|
| Hero sections, marquees, bento grids, pricing tables, testimonial walls | Marketing patterns; this is a work tool |
| Aurora / beam / spotlight / meteor / particle / grid-glow backgrounds | Competes with drawings and numbers |
| Gradient, shimmer, typewriter text | Unreadable, reads as generated |
| Glassmorphism / backdrop blur on content | Kills contrast |
| Glowing or animated borders, "border beam" | Same |
| 3D tilt cards, magnetic buttons, hover lift | Motion without meaning |
| Number tickers / animated counters | Prices and costs must be read instantly |
| Neon, purple/indigo/violet gradients, zinc-on-black themes | Off-palette author defaults |
| Orbiting icons, floating dock, confetti | — |

### 12.4 Adoption checklist (every 21st.dev component)

- [ ] **Colours:** remove hard-coded Tailwind colours (`zinc-*`, `slate-*`, `neutral-*`, `gray-*`, `indigo-*`, `violet-*`, `purple-*`, `blue-*`, `emerald-*`) and hex values; use §3 tokens.
- [ ] **Effects:** delete `bg-gradient-*`, `from-/via-/to-*`, `backdrop-blur-*`, glow shadows, decorative `blur-*`.
- [ ] **Dark classes:** remove `dark:` variants.
- [ ] **Typography:** inherit Karla; replace `uppercase tracking-wider` with sentence case.
- [ ] **Radius:** map to §5 (no blanket `rounded-2xl`).
- [ ] **Shadows:** none on panels; floating layers use §5.
- [ ] **Motion:** remove non-interactive Motion/framer effects; respect reduced motion.
- [ ] **Accessibility:** keyboard operable, clay-600 focus ring, roles/labels intact, text ≥ 4.5 : 1.
- [ ] **i18n:** strings into `next-intl`.
- [ ] **Provenance:** header comment with 21st.dev URL, author, licence (must allow commercial use).
- [ ] **Slop test (§13)** passes.

---

## 13. Slop smell test (every PR with UI changes)

Answer "no" to all:

1. Would this screen look the same in a crypto dashboard or an AI-startup landing page?
2. Is there any gradient, glow, blur or shimmer that isn't carrying information?
3. Is any colour used that isn't in §2? Is blue used anywhere except "new revision"?
4. All-caps labels, eyebrow text, or monospace for data, cell refs or drawing numbers?
5. Is every card the same rounded box with the same soft grey shadow?
6. Does anything animate on page load other than the revision-cloud fade?
7. Are clouds or limewash used as decoration rather than to mark a change or selection?
8. Is any status shown by colour alone?
9. Is any forecast or cost shown as a single number without its range?
10. Does any copy sound like marketing ("Unlock powerful insights") instead of saying what the thing does?

---

## 14. Copy voice

- Plain, specific, sentence case: "Compare revisions", "4 changes found", "Rebar likely to rise 4–8% by Apr 2027".
- Use the QS's words: "Rev C", "potential variation", "BOQ item 3.2.14", "amount mismatch".
- Forecast language is probabilistic: "likely range", "expected saving", "low confidence" — never "will".
- Errors say what happened and the fix: "Column F has no rates in rows 120–134. Check the mapping or the file and upload again."
- Empty states invite the next action: "No drawings yet. Upload a drawing with its revision label to start tracking changes."

---

## 15. Quick reference

```
Font ........ Karla (variable 200–800) + Noto Sans HK · tabular-nums on all numbers
Base size ... 14px
Canvas ...... #F7F5F2   Panel #FFFFFF   Line #E7DED2   Input border #94877B   Viewer bg #E9E4DC
Text ........ #2B211B ink · #6E6259 muted
Primary ..... #6B5445 (hover #4A3A2F) · focus ring #8A6F5C
Brand ....... Clay #A98B76 · Sandstone #BFA28C · Limewash #F3E4C9 · Lichen #BABF94
Status ...... good #474C2E/#EEF0E2 · caution #7F5710/#F6EACB · error #9E2B36/#F7E0E2
Revisions ... base/removed #9E2B36 · target/added #2F6F8F (blue used nowhere else)
Radius ...... 4 small · 6 controls · 10 panels · pill chips · square drawing sheets
Signature ... Revision cloud (clay-600 scallops, limewash fill) + ink delta tag
Forecast .... ink history · dashed clay-700 median · limewash bands · lichen buy window
```