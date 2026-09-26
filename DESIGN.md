# DESIGN.md — Smart QS (AegisQS)

> Visual design system for coding agents and designers.
> Read this before building or restyling any UI. It overrides §8 of `AGENTS.md`.
> Components come from **21st.dev** (shadcn-compatible), but **their look comes from this file, never from the component's demo**.

---

## 1. Design concept: "Materials on site"

Smart QS is used by quantity surveyors auditing building-rehabilitation tenders in Hong Kong. The palette is taken from the materials of that work, so each colour gets a material name:

| Name          | Hex       | Material                        |
| ------------- | --------- | ------------------------------- |
| **Clay**      | `#A98B76` | Fired brick, weathered render   |
| **Sandstone** | `#BFA28C` | Stone cladding, timber          |
| **Limewash**  | `#F3E4C9` | Lime plaster, surveyor's marker |
| **Lichen**    | `#BABF94` | Moss on old concrete, patina    |

The UI should feel like a **calm, well-lit site office**: quiet warm neutrals, dense, legible numbers, and colour used only where it carries meaning.

### Three principles

1. **Numbers are the hero.** The most important visual element on any screen is a figure a QS has to trust. Give it room, tabular figures, and a stable position. No decoration competes with it.
2. **Colour means something.** Lichen = within tolerance. Crimson = breach. Ochre = caution. Limewash = "look here" (evidence, selection). Clay = brand and primary action. Nothing else gets colour.
3. **Spend boldness in one place.** The one signature element is the **Limewash highlight** (§7). Everything else stays disciplined.

---

## 2. Colour system

### 2.1 Brand palette (from the brief — do not alter these hex values)

| Token         | Hex       | RGB           | Contrast on white | Allowed use                                                                                     |
| ------------- | --------- | ------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `--clay`      | `#A98B76` | 169, 139, 118 | 3.16 : 1          | Brand mark, large icons, chart fills, focus-adjacent accents. **Not for body text.**            |
| `--sandstone` | `#BFA28C` | 191, 162, 140 | 2.40 : 1          | Decorative dividers, muted chart series, text **on ink** (6.56 : 1). **Not for text on light.** |
| `--limewash`  | `#F3E4C9` | 243, 228, 201 | 1.25 : 1          | Highlight / selection / evidence marker, secondary button background, owner-portal callouts.    |
| `--lichen`    | `#BABF94` | 186, 191, 148 | 1.91 : 1          | Within-tolerance fills, chart points, active nav indicator on ink (8.21 : 1).                   |

The four brand colours are all **light and low-contrast**. That's what makes them calm — and it's why every text and interactive use goes through the derived shades below. **Never put text in a brand colour on a light background.**

### 2.2 Derived neutrals and shades (all contrast-checked)

| Token             | Hex       | Use                                                    | Contrast             |
| ----------------- | --------- | ------------------------------------------------------ | -------------------- |
| `--ink`           | `#2B211B` | Primary text, sidebar, the recommended-awardee card    | 15.7 : 1 on white    |
| `--clay-800`      | `#4A3A2F` | Primary button hover, headings on limewash             | 10.8 : 1 on white    |
| `--clay-700`      | `#6B5445` | **Primary button background** (white text)             | 7.05 : 1             |
| `--clay-600`      | `#8A6F5C` | Focus ring, links on white, icons                      | 4.66 : 1 on white    |
| `--muted-ink`     | `#6E6259` | Secondary text, table headers, axis labels             | 5.43 : 1 on canvas   |
| `--canvas`        | `#F7F5F2` | App background (warm grey, deliberately **not** cream) | —                    |
| `--panel`         | `#FFFFFF` | Cards, tables, drawer, popovers                        | —                    |
| `--stone-50`      | `#F1ECE5` | Table header, muted fills, hover on canvas             | —                    |
| `--limewash-100`  | `#F8F0E1` | Selected table row, hover on flagged items             | ink on it 13.9 : 1   |
| `--line`          | `#E7DED2` | Hairlines, panel borders, grid lines (decorative)      | —                    |
| `--line-strong`   | `#94877B` | Input borders, checkbox outlines (must meet 3 : 1)     | 3.21 : 1 on canvas   |
| `--sidebar-hover` | `#3A2E26` | Hover/active background in the ink sidebar             | cream on it 10.5 : 1 |

### 2.3 Semantic status colours

The brief has no red or strong green, and a risk tool needs both. These are **harmonised to the earth palette** but kept clearly distinct from Clay (the crimson sits at a different hue so a breach never reads as "brand").

| Meaning                         | Text / icon             | Tint background            | Solid fill (charts, dots)                        | Text on tint |
| ------------------------------- | ----------------------- | -------------------------- | ------------------------------------------------ | ------------ |
| **Within tolerance / low risk** | `--tolerance` `#474C2E` | `--tolerance-bg` `#EEF0E2` | `--lichen` `#BABF94` / `#5E6440` for small marks | 7.77 : 1     |
| **Caution / moderate / medium** | `--caution` `#7F5710`   | `--caution-bg` `#F6EACB`   | `#B8862E`                                        | 5.36 : 1     |
| **Breach / high / critical**    | `--risk` `#9E2B36`      | `--risk-bg` `#F7E0E2`      | `#9E2B36`                                        | 5.86 : 1     |
| **Insufficient data**           | `--muted-ink` `#6E6259` | `--stone-50` `#F1ECE5`     | Hatched `#CFC2B2`                                | 5.03 : 1     |

Critical vs high: same crimson family; **critical uses the solid fill with white text and the octagon icon**, high uses the tint with the triangle icon.

**Rule (from AGENTS.md):** status is **never** colour alone — always colour + icon + text.

| Band / severity   | Icon (lucide-react) | Label                         |
| ----------------- | ------------------- | ----------------------------- |
| Low               | `CircleCheck`       | "Low risk"                    |
| Moderate          | `CircleDot`         | "Moderate risk"               |
| High              | `TriangleAlert`     | "High risk"                   |
| Critical          | `OctagonAlert`      | "Critical risk"               |
| Insufficient data | `CircleDashed`      | "Insufficient benchmark data" |

### 2.4 Where each colour goes (at a glance)

```
Sidebar ............ ink bg · limewash text · lichen active bar
Canvas ............. #F7F5F2
Panels ............. white · 1px --line border · no shadow
Primary button ..... clay-700 bg · white text
Selection/evidence . limewash (the signature)
Status ............. tolerance / caution / risk tokens only
Brand mark ......... clay
```

**Limewash is never a full-page background.** A cream page background is one of the most common generated-UI looks; here cream is a marker, not a wallpaper.

---

## 3. Theme implementation (shadcn / 21st.dev variables)

21st.dev components are built on shadcn/ui, so they read the standard shadcn CSS variables. Map the palette onto those variables **once** in `src/app/globals.css`, and every installed component inherits it.

```css
@import "tailwindcss";

:root {
  /* shadcn contract — every 21st.dev component reads these */
  --background: #f7f5f2;
  --foreground: #2b211b;
  --card: #ffffff;
  --card-foreground: #2b211b;
  --popover: #ffffff;
  --popover-foreground: #2b211b;
  --primary: #6b5445;
  --primary-foreground: #ffffff;
  --secondary: #f3e4c9;
  --secondary-foreground: #4a3a2f;
  --muted: #f1ece5;
  --muted-foreground: #6e6259;
  --accent: #f8f0e1;
  --accent-foreground: #2b211b;
  --destructive: #9e2b36;
  --destructive-foreground: #ffffff;
  --border: #e7ded2;
  --input: #94877b;
  --ring: #8a6f5c;
  --radius: 0.625rem;

  --sidebar: #2b211b;
  --sidebar-foreground: #f3e4c9;
  --sidebar-primary: #babf94;
  --sidebar-primary-foreground: #2b211b;
  --sidebar-accent: #3a2e26;
  --sidebar-accent-foreground: #f3e4c9;
  --sidebar-border: #3f332b;
  --sidebar-ring: #babf94;

  --chart-1: #2b211b; /* focus series */
  --chart-2: #5e6440; /* within tolerance */
  --chart-3: #9e2b36; /* breach */
  --chart-4: #b8862e; /* caution */
  --chart-5: #cfc2b2; /* background series */

  /* Smart QS semantic tokens (names used in AGENTS.md / TASK_PROMPTS.md) */
  --ink: #2b211b;
  --surface: #f7f5f2;
  --panel: #ffffff;
  --muted-ink: #6e6259;
  --clay: #a98b76;
  --clay-600: #8a6f5c;
  --clay-700: #6b5445;
  --clay-800: #4a3a2f;
  --sandstone: #bfa28c;
  --limewash: #f3e4c9;
  --limewash-100: #f8f0e1;
  --lichen: #babf94;
  --stone-50: #f1ece5;
  --line: #e7ded2;
  --line-strong: #94877b;
  --tolerance: #474c2e;
  --tolerance-bg: #eef0e2;
  --caution: #7f5710;
  --caution-bg: #f6eacb;
  --risk: #9e2b36;
  --risk-bg: #f7e0e2;
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

  --font-sans:
    var(--font-karla), "Noto Sans HK", ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 0.25rem; /* 4px  badges inside tables, checkboxes */
  --radius-md: 0.375rem; /* 6px  buttons, inputs, selects */
  --radius-lg: 0.625rem; /* 10px panels, cards, drawer */
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

Dark mode is **not in the MVP**. Tokens are structured so it becomes a `:root[data-theme="dark"]` override later; don't add `dark:` classes now.

---

## 4. Typography — Karla

### 4.1 Loading

```ts
// src/app/fonts.ts
import { Karla, Noto_Sans_HK } from "next/font/google";

export const karla = Karla({
  subsets: ["latin"],
  weight: "variable", // 200–800 variable axis
  variable: "--font-karla",
  display: "swap",
});

export const notoSansHK = Noto_Sans_HK({
  weight: ["400", "500", "700"],
  variable: "--font-noto-hk",
  display: "swap",
  preload: false, // large CJK file; load only on zh-HK routes if possible
});
```

### 4.2 Tabular figures are mandatory

Karla's **default digits are proportional** (e.g. "1" is much narrower than "0"), which breaks column alignment. The font includes a `tnum` feature, so every number in a table, KPI, chart label, or currency must use:

```css
.num {
  font-variant-numeric: tabular-nums lining-nums;
}
```

Tailwind: `tabular-nums`. Put it on the `<table>` and on KPI/number components by default, not per cell.
**Verification test:** render `1111.11` and `0000.00` stacked in a `.num` element; they must be identical width. If not, the font file is missing `tnum` — fix the font loading, don't switch to a monospace face.

### 4.3 Type scale (app, base 14px)

| Token         | Size / line-height | Weight | Tracking | Use                                    |
| ------------- | ------------------ | ------ | -------- | -------------------------------------- |
| `display`     | 32 / 38            | 700    | −0.015em | KPI values, score on the score detail  |
| `title-lg`    | 24 / 30            | 600    | −0.01em  | Page title                             |
| `title`       | 18 / 24            | 600    | −0.005em | Panel titles, drawer title             |
| `body`        | 14 / 20            | 400    | 0        | Default text, table cells              |
| `body-strong` | 14 / 20            | 600    | 0        | Tenderer names, emphasised values      |
| `label`       | 13 / 18            | 500    | 0        | Form labels, table headers, KPI labels |
| `caption`     | 12 / 16            | 400    | 0.005em  | Axis labels, timestamps, provenance    |

Owner portal uses base 16px (scale ×1.143) — owners read, they don't scan.

### 4.4 Typography rules

- **Sentence case everywhere.** "Average rate variance (z)", not "AVG RATE VARIANCE (Z)". No all-caps labels, no letter-spaced eyebrows above headings.
- One family (Karla) for everything. **No monospace** for data or labels; tabular Karla does that job.
- Don't emphasise a single word in a heading with colour/italic/weight.
- Line length for prose (auditor notes, report text, owner summaries): max ~72 characters (`max-w-prose`).
- Chinese text inherits Noto Sans HK; line-height +2px for zh-HK body text.

---

## 5. Space, radius, borders, elevation

- **Spacing:** 4px base. Use 4 · 8 · 12 · 16 · 24 · 32 · 48. Panel padding 16 (compact) / 20 (comfortable). Gap between panels 16.
- **Radius hierarchy (deliberately not uniform):** 4px for small in-table items, 6px for controls, 10px for panels and the drawer, full-round **only** for status chips and avatars.
- **Borders over shadows.** Panels: `1px solid var(--line)`, no shadow. The canvas/panel contrast plus hairlines creates structure.
- **Shadows only for things that float** (drawer, popover, dialog, dropdown, toast): `0 8px 24px rgba(43, 33, 27, 0.12), 0 1px 2px rgba(43, 33, 27, 0.08)`. Warm-tinted, never neutral grey.
- **Density:** comfortable (row 44px) and compact (row 36px). Compact is the default for the rate grid and flag inbox.

---

## 6. Layout

Three-pane workspace (from AGENTS.md), with this skin:

```
┌──────────┬──────────────────────────────────────────────┬──────────────┐
│ INK      │ Header bar (white, 56px, bottom hairline)     │              │
│ sidebar  │ Project ▾  Pre-Tender › Tender › Post-Award   │              │
│ 240px    ├──────────────────────────────────────────────┤  Evidence    │
│          │ Canvas #F7F5F2                                │  drawer      │
│ logo     │  Page title (24/600)            [Primary]     │  480–640px   │
│ nav      │  ┌──────┐ ┌──────┐ ┌──────────┐               │  white       │
│ lichen   │  │ KPI  │ │ KPI  │ │ INK card │  ← awardee    │  shadow      │
│ active   │  └──────┘ └──────┘ └──────────┘               │  limewash    │
│ bar      │  ┌───────────────────┐ ┌──────────────────┐   │  highlight   │
│          │  │ white panel       │ │ white panel      │   │              │
│          │  └───────────────────┘ └──────────────────┘   │              │
└──────────┴──────────────────────────────────────────────┴──────────────┘
```

- **Sidebar:** ink background, limewash text at 400, sandstone for section labels, a 3px **lichen** bar on the active item, `--sidebar-hover` on hover. Collapses to a 64px icon rail below 1440px.
- **Header:** white with a bottom hairline; stage stepper uses clay-700 for the current stage, muted ink for others, a lichen check for completed.
- **Content:** left-aligned, max width 1600px, 12-column grid, 16px gutters.
- **Only two ink surfaces:** the sidebar and the recommended-awardee KPI card. Nothing else goes dark.

---

## 7. Signature element — the Limewash highlight

The one memorable visual idea: **evidence is marked the way a surveyor marks up a paper bill.**

- In the PDF evidence viewer, the cited bbox is a **limewash fill (`#F3E4C9` at 70%, `mix-blend-mode: multiply`) with a 2px clay-600 underline** along its bottom edge — like a highlighter plus a pencil tick.
- The flagged BOQ row that opened the drawer gets the same treatment: `--limewash-100` background with a 2px clay-600 left edge.
- Selected rows anywhere in the app use `--limewash-100`, so "selected" and "evidence" share one visual language.
- On open, the highlight does a single 400ms fade from 100% to 70% opacity to draw the eye to the cited spot. That's the only non-user-triggered motion in the product.

Don't reuse limewash for decoration elsewhere, or it stops meaning "look here."

---

## 8. Component specifications

### Buttons

| Variant   | Style                                                                         | Use                                                                           |
| --------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Primary   | clay-700 bg, white text, hover clay-800, 6px radius, 36px height (32 compact) | One per view: "Run analysis", "Sign off report"                               |
| Secondary | limewash bg, clay-800 text, hover `#EDD9B6`                                   | "Propose", "Export CSV"                                                       |
| Outline   | white bg, `--line-strong` border, ink text                                    | Filters, toolbar actions                                                      |
| Ghost     | transparent, muted ink, hover stone-50                                        | Icon buttons, row actions                                                     |
| Danger    | risk bg, white text                                                           | Only for irreversible actions (none in MVP; "Dismiss flag" is **not** danger) |

Disabled: 45% opacity, `cursor-not-allowed`, and a tooltip saying why ("3 high-risk flags need a decision").
No gradients, glows, or shine animations on any button.

### Status chip / badge

Full-round pill, 24px height, tint background + status text colour + 14px icon + label. In dense tables use the 4px-radius square variant at 20px height.

### KPI card

White panel, 20px padding. Label (13/500, muted ink, sentence case) → value (32/700, ink, tabular) → context line (12, muted ink, e.g. "12 bids · benchmark as of Q2 2026"). Optional sparkline: 1.5px clay-600 line, **no area fill, no gradient**. Numbers never animate or count up — auditors must see the true value immediately.

**Recommended-awardee card:** ink background, limewash name (18/600), sandstone secondary text, lichen score chip.

### Tables and the rate grid

- Header: stone-50 bg, 13/500 muted ink, sticky, bottom hairline; sortable columns show a small chevron.
- Rows: white, hairline separators, **no zebra striping**. Hover `#FAF7F2`, selected limewash-100 with clay-600 left edge.
- Numbers right-aligned, tabular; units in muted ink after the value.
- Heatmap cells: `|z| < 1` no fill · `1–2` caution-bg + caution text · `≥ 2` risk-bg + risk text · insufficient data = hatched stone pattern + "n/a" text. Always show the signed sigma value in the cell.
- Frozen columns separated by a 1px `--line-strong` edge (not a shadow).

### Evidence drawer

White, 10px left radius, floating shadow, 480px default (resizable to 640). Header: flag title (18/600), status chip, confidence as a quiet 4-segment bar in clay-600 + "82% confidence". Body: limewash highlight in the viewer, calculation trace in a stone-50 block using tabular Karla (not monospace). Footer: sticky disposition panel on white with a top hairline.

### Forms

Inputs 36px, white, `--line-strong` border, 6px radius; focus = 2px clay-600 ring with 2px offset. Labels above inputs (13/500). Error text in risk colour with an icon, stating how to fix it.

### Empty states

Left-aligned in the panel, one line of explanation + one primary action. A single small lucide icon in clay is fine. **No illustrations, no mascots, no stock art.**

### Toasts

White, floating shadow, left 3px status edge, bottom-right. Text names the action: "Report signed", "Flag dismissed".

---

## 9. Data visualisation (ECharts theme)

Register one theme (`src/components/charts/theme.ts`) and use it for every chart.

- Font: Karla, 12px, tabular figures; axis labels muted ink; axis lines `--line`; grid lines `#EFE8DE`, solid, horizontal only.
- **Grey-first colouring:** background series in `#CFC2B2`, the series in focus in ink, and only breaches/tolerance in status colours. Twelve tenderers never get twelve colours.
- Tender price distribution: benchmark curve 2px clay-600; ±1σ band limewash at 60%; ±2σ band edges as 1px dashed caution lines with the label "±2.0σ threshold"; points lichen-700 (`#5E6440`) inside tolerance, risk crimson with a text label when breaching.
- Provisional sums: measured work `#CFC2B2`, provisional sum clay; 15% threshold as a 1px dashed risk line labelled "15% threshold".
- Signal breakdown bars: clay for positive contribution, stone hatching for insufficient data.
- Tooltip: white, `--line` border, small floating shadow, tabular values, no arrow decorations.
- No 3D, no pie/donut for comparisons, no area gradients, no chart entrance animations (`animation: false`) except a 200ms transition when filters change.

---

## 10. Motion

- Motion answers user actions only: drawer slide 200ms `cubic-bezier(0.2, 0, 0, 1)`; popover/dropdown fade 120ms; row expand 150ms.
- The Limewash highlight fade (§7) is the single attention-drawing motion.
- No entrance animations on page load, no staggered card reveals, no hover lift on cards, no parallax.
- `prefers-reduced-motion: reduce` → all durations 0ms.

---

## 11. Iconography and imagery

- **lucide-react** only, 16px in UI (20px in empty states), stroke 1.5, colour inherits text.
- No emoji in the product UI. No stock photography. No AI-generated illustrations.
- The only imagery is real evidence: document pages and site photos.

---

## 12. Using 21st.dev without importing its slop

21st.dev is a community registry of shadcn-compatible React components. Many are excellent; many are built to look impressive in a landing-page demo. We take **structure and behaviour** from 21st.dev and **all visual styling** from this file.

### 12.1 How to install

```bash
# Install via the shadcn CLI using the component's registry URL from 21st.dev
npx shadcn@latest add "https://21st.dev/r/<author>/<component>"
```

Or pull components through the 21st.dev MCP in Claude Code / Cursor. Either way, the component lands in `src/components/ui/` and becomes **our code** to restyle.

### 12.2 What to take from 21st.dev

Functional, app-level components: sidebar, data table, tabs, dropdown / select, combobox, command palette, dialog, sheet / drawer, tooltip, popover, toast, badge, progress, stepper, file upload / dropzone, date picker, breadcrumb, pagination, accordion, skeleton, resizable panels.

### 12.3 What NOT to take (or strip before use)

| Banned pattern                                                          | Why                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| Hero sections, marquees, bento grids, pricing tables, testimonial walls | Marketing patterns — this is a work tool       |
| Aurora / beam / spotlight / meteor / particle / grid-glow backgrounds   | Decoration that competes with the numbers      |
| Gradient text, shimmer / shiny text, typewriter text                    | Unreadable in data context, reads as generated |
| Glassmorphism / backdrop blur on content surfaces                       | Kills contrast, looks templated                |
| Glowing or animated gradient borders, "border beam"                     | Same                                           |
| 3D tilt cards, magnetic buttons, hover lift                             | Motion without meaning                         |
| Animated number counters / number tickers on KPIs                       | An auditor must see the real figure instantly  |
| Neon, purple/indigo/violet gradients, zinc-on-black themes              | Off-palette defaults of the component authors  |
| Orbiting icons, floating dock, confetti                                 | —                                              |

### 12.4 Adoption checklist (run for every 21st.dev component)

- [ ] **Colours:** remove every hard-coded Tailwind colour (`zinc-*`, `slate-*`, `neutral-*`, `gray-*`, `indigo-*`, `violet-*`, `purple-*`, `blue-*`, `emerald-*`, hex values) and replace with the theme tokens from §3.
- [ ] **Gradients & effects:** delete `bg-gradient-*`, `from-*/via-*/to-*`, `backdrop-blur-*`, `shadow-[0_0_...]` glows, `blur-*` decorative layers.
- [ ] **Dark classes:** remove `dark:` variants (no dark mode in MVP).
- [ ] **Typography:** remove font imports/classes the component ships with; it must inherit Karla. Replace any `uppercase tracking-wider` labels with sentence case.
- [ ] **Radius:** map to the §5 hierarchy (don't leave `rounded-2xl`/`rounded-3xl` everywhere).
- [ ] **Shadows:** panels get none; floating layers get the §5 shadow.
- [ ] **Motion:** remove framer-motion/Motion effects that aren't a response to a user action; respect reduced motion.
- [ ] **Accessibility:** keyboard operable, visible focus ring (clay-600), roles/labels intact, contrast ≥ 4.5 : 1 for text.
- [ ] **i18n:** move all strings to `next-intl` messages.
- [ ] **Provenance:** add a header comment with the 21st.dev URL, author, and licence; check the licence permits commercial use.
- [ ] **Slop test (§13)** passes.

---

## 13. Slop smell test (for every PR with UI changes)

Answer "no" to all of these before merging:

1. Would this screen look the same if the product were a crypto dashboard or an AI startup landing page?
2. Is there any gradient, glow, blur, or shimmer that isn't carrying information?
3. Is any colour used that isn't in §2?
4. Are there all-caps labels, eyebrow text above headings, or a monospace face for data?
5. Is every card the same rounded box with the same soft grey shadow?
6. Does anything animate on page load?
7. Is limewash used as decoration rather than to mark evidence or selection?
8. Is any status shown by colour alone?
9. Do any numbers move, count up, or shift width when they update?
10. Does any copy sound like marketing ("Unlock powerful insights") instead of saying what the thing does?

---

## 14. Copy voice (visual-adjacent)

- Plain, specific, sentence case: "Run analysis", "Sign off report", "3 bids outside ±2.0σ".
- Name things by what a QS understands: "Provisional sums", not "PS concentration metric".
- Errors state what happened and the fix: "This BOQ has no rates in column F. Check the tenderer's file and upload again."
- Empty states invite the next action: "No tender documents yet. Upload each tenderer's priced BOQ to start."
- Never accusatory (see banned words in `AGENTS.md` §9).

---

## 15. Quick reference

```
Font ........ Karla (variable 200–800) + Noto Sans HK · tabular-nums on all numbers
Base size ... 14px app · 16px owner portal
Canvas ...... #F7F5F2   Panel #FFFFFF   Line #E7DED2   Input border #94877B
Text ........ #2B211B ink · #6E6259 muted
Primary ..... #6B5445 (hover #4A3A2F) · focus ring #8A6F5C
Brand ....... Clay #A98B76 · Sandstone #BFA28C · Limewash #F3E4C9 · Lichen #BABF94
Status ...... tolerance #474C2E/#EEF0E2 · caution #7F5710/#F6EACB · risk #9E2B36/#F7E0E2
Radius ...... 4 small · 6 controls · 10 panels · pill for chips only
Shadow ...... floating layers only, warm-tinted
Signature ... Limewash highlight on evidence and selection
```
