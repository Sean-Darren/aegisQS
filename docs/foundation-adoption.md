# Foundation adoption checks

4 November 2026.

The installed Radix package and existing project primitives supply behaviour. The 21st catalog search was attempted through its CLI, but code retrieval requires an authenticated account that is unavailable in this session. No 21st registry code was copied and no registry author/licence was invented. Sources are identified in component headers.

| Primitive         | Source and licence                                                                                                      | Behaviour reviewed                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| SegmentedControl  | Original composition of WorkOS Radix ToggleGroup, MIT; https://www.radix-ui.com/primitives/docs/components/toggle-group | Single selection; roving keyboard focus; disabled items; accessible group label.                                                            |
| Combobox          | Original composition of WorkOS Radix Popover, MIT; https://www.radix-ui.com/primitives/docs/components/popover          | Search, listbox/option semantics, active descendant, arrow/Home/End/Enter/Escape/Tab handling, disabled options and empty results.          |
| Dropzone          | Original composition of react-dropzone, MIT; https://github.com/react-dropzone/react-dropzone                           | Drag/drop and native file chooser, keyboard button, configurable type/size/count limits, disabled selection and translated rejection state. |
| LowConfidenceNote | Original project component                                                                                              | Configured strict confidence boundaries; readable icon/text; categorical forecast confidence.                                               |
| AiGeneratedLabel  | Original project component                                                                                              | Persistent translated provenance text; no decorative effects.                                                                               |
| StatusChip        | Original project component using Lucide icons                                                                           | Centralized domain vocabulary; icon + translated text + semantic token; 24px/20px variants.                                                 |

## DESIGN.md §12.4 checklist

Applied to each primitive above:

- Colours: project token classes only; no raw palette classes or component hex values.
- Effects: no gradients, glows, blur, shimmer or decorative backgrounds.
- Dark classes: none.
- Typography: inherited Karla / Noto Sans HK, sentence case, no monospace.
- Radius: 4px dense items, 6px controls, 10px panels; status pills only where specified.
- Shadows: none on panels; existing floating-layer shadow on the combobox popup.
- Motion: no added automatic animation; button colour transitions respect reduced motion.
- Accessibility: named controls, keyboard interaction, visible focus, disabled semantics, status icon/text and empty/rejection feedback. The sidebar retains accessible text in its rail and focusable links show tooltips.
- i18n: built-in copy in both locale files; caller-supplied labels are translated by consuming features.
- Provenance: actual source and licence in headers. No external source for the two original semantic labels.
- Verification: component/formatter/permission tests plus browser checks for role access, sidebar widths, accessible drawer and tabular numerals.

## DESIGN.md §13 smell test

1. Generic crypto/marketing screen? **No** — module navigation and actions use the QS workflow.
2. Decorative gradient/glow/blur/shimmer? **No**.
3. Off-palette colour or blue outside new-revision meaning? **No**.
4. All-caps/eyebrow/monospace data? **No**.
5. Uniform shadowed rounded cards? **No** — panels use borders; shadows are reserved for floating layers.
6. Added page-load animation? **No**.
7. Decorative clouds or limewash? **No** — limewash marks selection, approved secondary controls and revision semantics.
8. Colour-only status? **No** — status chips have icon and text.
9. New forecast/cost number without a range? **No** — this task adds formatters, not forecast or cost screens.
10. Marketing copy? **No** — labels describe controls and states.

The 21st CLI review also ran. Its colour findings point to the required token declarations themselves; its width findings point to a maximum content width and responsive drawer. Two existing Dialog/Select focus-outline findings were fixed with explicit visible focus rings.
