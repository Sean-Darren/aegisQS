# Smart QS (AegisQS) — Revised Front-End Product Brief

> Human-facing reference for the team and judges. Replaces the earlier tender-audit breakdown.
> Coding agents use `AGENTS.md`, `DESIGN.md` and `TASK_PROMPTS.md`; this file explains the why.
> Revised November 2026 for the hackathon scope.

---

## 1. What changed

| Kept | Dropped |
|---|---|
| Drawing revision analysis & variation highlighting | Tender evaluation, bid comparison, compliance/credit scores |
| Material cost forecasting & procurement timing | News sentiment, fraud/collusion detection |
| Centralised data & document hub | Owner voting portal, sign-off certificates |
| Excel integration | Automated quantity take-off, BIM, formal VO / final accounts |

The four features map directly onto the judges' priorities:

| Judges' priority | Feature that answers it |
|---|---|
| Variation management | Drawing revision analysis → variation events |
| Cost forecasting | Material forecasting & procurement timing |
| Data fragmentation | Document hub + Excel integration |

---

## 2. Your question: link drawing changes to cost, or visual detection only?

**Recommendation: do both, but keep the cost part QS-assisted and labelled "indicative".**

- **Automated (the AI part):** detect and highlight changes between revisions, classify them (added / removed / modified / dimension / text), and write a one-line summary.
- **QS-assisted (the cost part):** the QS marks a change as a potential variation, picks the affected BOQ items from the project's Excel BOQ, and enters the quantity change. Smart QS multiplies by the contract rates and shows an **indicative cost with a range**.
- **Not attempted:** measuring quantities from the drawing automatically. That's the take-off problem you deliberately dropped.

Why this is the right call:

1. **Visual compare on its own is already common.** PDF tools QS teams use today (for example Bluebeam Revu's compare and overlay features) already highlight drawing differences. A visual-only demo risks looking like a re-implementation. The cost link is what makes it a *QS* tool.
2. **It connects all four features into one story.** The change becomes a variation event → its cost comes from the Excel BOQ → the extra rebar shows up in material forecasting → every step is in the document hub's audit trail. Judges see one product, not four modules.
3. **It's cheap to build.** It's a form, a BOQ item picker and a multiplication. No new AI model is needed, and the risk of wrong numbers is low because the QS supplies the quantities.
4. **It's honest.** "Indicative", a visible range, and "quantities entered by QS" keep you clear of over-claiming.

**Stretch (only if time allows):** suggest likely BOQ items for a change by matching the change summary text against BOQ descriptions, shown as "Suggested items — confirm before adding".

---

## 3. Users

| Persona | Goals | Key permissions |
|---|---|---|
| **Senior QS** | Catch variations early, defend cost advice, keep one version of the truth | Confirm/reject variation events, resolve document conflicts |
| **QS / Assistant QS** | Upload drawings and BOQs, review changes, price variations, plan purchases | Upload, compare, raise variations, cost lines, procurement advice |
| **Viewer** (PM, client rep) | See current documents, variation exposure, material outlook | Read and download only |
| **Admin** | Users, project access, material catalogue | Admin console |

---

## 4. The demo story (5 minutes)

1. **Hub:** upload *A-201 Level 2 floor plan Rev C*. Smart QS recognises it as a new version, marks Rev B superseded, and offers to compare.
2. **Drawings:** comparison runs; four revision clouds appear on the drawing. Switch between side-by-side, overlay and swipe.
3. **Review:** mark "slab opening enlarged" and "new beam added" as potential variations → **VE-007**.
4. **Cost:** add three BOQ items from the Excel BOQ with quantity changes → **indicative HK$186,400 (HK$171k–203k)**.
5. **Forecasting:** VE-007 adds 4.2 t rebar. The rebar forecast is rising; the planner advises **"Buy in window · Feb–Mar 2027"** with an expected saving and a likely range.
6. **Excel:** re-upload the updated BOQ. Checks catch a #REF!, an amount mismatch and a duplicate item; the version diff shows the three new rows tied to VE-007.
7. **Audit:** the project timeline shows every step, who did it, and when.

---

## 5. Feature map

Priority: **P0** = hackathon demo, **P1** = if time allows, **P2** = after the hackathon.

### 5.1 Document hub

| Feature | Priority |
|---|---|
| Register by category (contract, drawing, site record, financial, correspondence) with search and filters | P0 |
| Upload with doc number + revision label; auto-detect "new version of an existing document" | P0 |
| One "Current" version per document; superseded banner on old versions | P0 |
| Conflict detection (duplicate file, same label different file, out-of-order label) and senior QS resolution | P0 |
| File preview, download, linked records across features | P0 |
| Per-document activity and project audit trail | P0 |
| Bulk upload with filename parsing (e.g. `A-201_RevC.pdf`) | P1 |
| Transmittal / issue records, OneDrive/SharePoint sync | P2 |

### 5.2 Drawing revision analysis

| Feature | Priority |
|---|---|
| Drawing register with revisions and latest comparison status | P0 |
| Compare any two revisions; background job with progress | P0 |
| Viewer: side by side (synced), overlay (red = removed, blue = added), swipe | P0 |
| Revision clouds + numbered delta tags on detected changes | P0 |
| Change list with kind, AI summary, confidence; jump to change | P0 |
| Manual alignment nudge when auto-alignment is weak | P0 |
| Mark change "No variation" / "Potential variation" | P0 |
| Multi-page drawing sets | P1 |
| Auto-compare on upload of a new revision | P1 |

### 5.3 Variation events (from drawing changes)

| Feature | Priority |
|---|---|
| Raise a variation event from one or more changes | P0 |
| Indicative cost: BOQ item picker, signed quantity changes, contract rates, total + range | P0 |
| Variation register with status and totals | P0 |
| Senior QS confirm/reject with reason | P0 |
| Suggested BOQ items from change text | P1 |
| Forecast-adjusted rates for future-dated work | P1 |
| Export variation event as PDF/Excel for the client | P1 |

### 5.4 Excel integration

| Feature | Priority |
|---|---|
| Upload workbooks (BOQ, cost plan, valuation); every upload is a version | P0 |
| Column mapping wizard (each firm's BOQ layout differs) | P0 |
| Automated checks: formula errors, quantity × rate ≠ amount, section totals, missing rate/unit/qty, duplicate item refs, outlier rates, external links | P0 |
| Sheet preview with Excel-style issue markers; jump from a check to the cell | P0 |
| Version diff (added / removed / changed rows, total change) | P0 |
| Download original or annotated copy | P0 |
| Excel add-in (task pane): save version, see checks, pull latest | P1 (stretch) |
| Two-way sync with OneDrive / SharePoint | P2 |

### 5.5 Material forecasting & procurement timing

| Feature | Priority |
|---|---|
| Material list with latest price, 3-month change, forecast trend | P0 |
| Forecast fan chart (history, median, 80% and 95% ranges) with model card | P0 |
| Purchase planner: quantity, need-by date, lead time → advice (buy now / buy in window / no clear advantage) with expected saving and range | P0 |
| Project material needs from BOQ and variation events, with cost exposure | P0 |
| Price alerts when a forecast moves | P1 |
| Scenario comparison (buy all now vs split purchases) | P2 |

---

## 6. Key screens and visual components

| Screen | Main components |
|---|---|
| Project overview | Four summary cards (one per feature), "Needs attention" list, recent activity |
| Document hub | Register table, category chips, upload dropzone + form, version timeline, conflict and superseded banners |
| Drawing comparison | Ink toolbar, three viewer modes, revision clouds + delta tags, change list, alignment control |
| Variation event | Source change crops, indicative cost panel with range bar, cost-line table with BOQ picker, decision bar |
| Workbook | Checks list, Excel-style sheet grid with issue markers, mapping wizard, version diff table, total-over-versions chart |
| Material forecast | Fan chart with procurement overlay, forecast-at-a-glance text, model card, purchase planner, advice card |
| Procurement | Material needs table, exposure bar chart with ranges, saved advice |
| Audit | Filterable timeline, CSV export |

---

## 7. UX principles specific to this scope

- **Assist, don't decide.** AI finds changes and forecasts prices; a QS reviews every change and a senior QS confirms every variation.
- **Ranges, not points.** Every forecast and indicative cost shows its likely range and its basis.
- **Excel stays the editor.** Smart QS never edits cells; it stores, checks, compares and hands back files. That's the promise that makes adoption easy.
- **One current version.** Superseded and conflicting files are impossible to miss.
- **Speak the drafter's language.** Revision clouds and delta tags make detected changes instantly readable to anyone who has marked up a print.
- **Traceability is one click.** Variation → changes → drawing revisions → BOQ rows → materials → audit events.

Visual details are in `DESIGN.md` (earth palette, Karla, revision-cloud signature, 21st.dev rules).

---

## 8. Data and AI notes for the pitch

| Feature | Data | Approach (backend) |
|---|---|---|
| Drawing comparison | Pairs of PDF drawing revisions | Rasterise → align (feature matching) → pixel/vector difference → group into regions → classify and summarise with a vision-language model |
| Material forecasting | C&SD / CEDD monthly average wholesale prices of building materials (your existing 5,226-row dataset), plus TPI and wage indices as drivers | Time-series model per material with prediction intervals; backtest error shown in the UI |
| Excel checks | Uploaded `.xlsx` workbooks | Rule-based checks on parsed cells and formulas; outlier rates vs project median |
| Hub | All uploads | SHA-256 hashing for duplicates, revision-label ordering, immutable audit log |

The previous Qwen3-VL fine-tuning plan can be repurposed for change classification and summaries, but the hackathon demo should not depend on it: the mock backend delivers deterministic results.

---

## 9. Build plan

| Step | Tasks (see `TASK_PROMPTS.md`) | Result |
|---|---|---|
| Foundations | 00–02 | Running app, mock backend with real sample drawings and workbooks, design system |
| Core features | 03–09 | All four features working on mock data |
| Tie together | 10 | Project overview and audit trail |
| Demo-ready | 11 | Accessibility, translations, a passing end-to-end demo test, a demo script |
| Stretch | 12 | Excel add-in |

---

## 10. Open questions for the team

1. **Forecast model ownership:** who builds it, and will it be ready for real data, or does the demo use precomputed forecasts? (Default: precomputed fixtures.)
2. **Drawing samples:** do you have real anonymised revision pairs to show alongside the generated ones?
3. **BOQ layout:** which real BOQ template should the column-mapping defaults match (e.g. ArchSD or HKHA format)?
4. **Hub categories:** are the five categories enough, or do you need folders per discipline/package?
5. **Excel add-in:** attempt it in the hackathon, or describe it as the next step in the pitch? (Default: next step.)