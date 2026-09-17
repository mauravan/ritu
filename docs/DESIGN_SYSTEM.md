# Design System: Market-Scanning Terminal

RITU is designed as a focused market-scanning terminal for Swiss secondary marketplaces (Ricardo and Tutti). It emphasizes density, clear structure, fixed-width tabular data, and prominent commerce attributes (prices, sources, ranking signals).

It avoids generic developer-console tropes: no phosphor-green hacker aesthetic, no pure pitch black, no decorative CRT scanlines or noise, no fake logs or simulated connection status, no rounded SaaS cards, and no decorative gradients.

---

## 1. Core Color Tokens

Semantic theme tokens are declared in `src/app/globals.css` and selected via `[data-theme="light"]` or `[data-theme="dark"]` on `<html>`. Components consume CSS variables or Tailwind token classes (`text-text-primary`, `bg-panel`, etc.), never hardcoded colors or ad hoc `dark:` variants.

### Core Palette

| Role | Token | Light | Dark |
|---|---|---|---|
| Canvas | `--canvas` | `#E6EBEF` (Cold shell) | `#071118` (Night shell) |
| Panel | `--panel` | `#F8FAFB` (Paper terminal) | `#0D1922` (Terminal deck) |
| Primary text | `--text-primary` | `#182229` (Carbon) | `#DDE8ED` (Mist) |
| Secondary text | `--text-secondary` | `#5B6972` (Slate) | `#8496A0` (Steel) |
| Interface accent | `--interface-accent` | `#006B83` (Scan cyan) | `#59C7D9` (Scan cyan) |
| Marketplace accent | `--marketplace-accent` | `#9A4F00` (Trade amber) | `#FFB454` (Trade amber) |

### Companion Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--border` | `#A8B5BC` | `#29404C` | Structural boundaries and fieldset lines |
| `--surface-subtle` | `#D9E1E5` | `#122631` | Hover backgrounds, input fills |
| `--selection` / `--on-selection` | `#006B83` / `#FFFFFF` | `#59C7D9` / `#071118` | Active toggles, primary buttons |
| `--focus` | `#C96A08` | `#FFB454` | `:focus-visible` focus outlines |
| `--error-surface` / `--error-text` | `#F7DFDF` / `#9F2633` | `#351B24` / `#FF8F9D` | Validation errors, required alerts |
| `--notice-surface` / `--notice-text` | `#F4E8D3` / `#754400` | `#302515` / `#FFD08A` | Clarification questions, warnings |
| `--score-spec` | `#6046A8` | `#B5A0FF` | Specification match scores and tags |
| `--score-value` | `#26734E` | `#66D19E` | Value-for-money scores and tags |
| `--score-ai` | `#9A4F00` | `#FFB454` | LLM rerank relevance scores and tags |
| `--score-hybrid` | `#006B83` | `#59C7D9` | Hybrid composite score and tags |
| `--score-overall` | `#A53855` | `#FF7E9D` | Best overall recommendation tag |

### Score Tag Color Mapping

- `best specs` -> `score-spec`
- `best value` -> `score-value`
- `cheapest` and `best condition` -> `marketplace-accent` (Trade amber)
- `balanced` -> `score-hybrid`
- `best overall` -> `score-overall`

---

## 2. Typography & Alignment

- **Font Family**: `Martian_Mono` (`next/font/google`), weights 400, 500, 600, 700. Fallback: `ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`.
- **Numbers**: `font-variant-numeric: tabular-nums` globally on `body`.
- **Type Scale**:
  - Helper / small tag: `11px` (line-height: `16px`)
  - Metadata / secondary: `12px` (line-height: `18px`)
  - Body / default copy: `14px` (line-height: `22px`)
  - Section title / pane header: `18px` (line-height: `24px`)
  - Page hero prompt: `clamp(24px, 4vw, 34px)` (line-height: `1.2`)
  - Price: `18px` (desktop), `16px` (mobile), weight 600, tabular-nums.
- **Line Length**: Explanatory copy capped at 68 characters (`max-w-[68ch]`).

---

## 3. Geometry & Spacing

- **Grid**: 8px baseline rhythm. Gutters: 12px mobile (`px-3`), 24px desktop (`sm:px-6`). Max container width: 1320px.
- **Corners**:
  - Pane boundaries: square (`rounded-[2px]` or `0px`).
  - Interactive keycaps & buttons: `2px` corners (`rounded-[2px]`).
  - Never use pill shapes (`rounded-full`) or large circular bubbles.
- **Borders**: 1px solid `var(--border)`. Controls invert to `var(--selection)` background with `var(--on-selection)` text when active.
- **Brackets**: Square brackets in UI labels (`[search]`, `[filters]`, `[001]`, `[both]`) are rendered with CSS pseudo-elements (`.bracket-tag::before`, `.pane-legend::before`) so screen readers and accessible name calculations are not polluted.
- **Gradients**: The only gradient allowed across the entire interface is the 8px visual tick mask (`repeating-linear-gradient`) used on functional score meter bars (`.score-track-ticks`).

---

## 4. Layout Wireframes

### Desktop Initial State

```text
┌─ ritu://market-scan ─────────────────────── [theme] [EN|DE] ┐
│                                                              │
│  > Search Ricardo and Tutti at once.                         │
│  ┌─ [search] ─────────────────────────────────────────────┐   │
│  │ > [ describe the item, use, and constraints          ]│   │
│  ├─ [filters] ────────────────────────────────────────────┤   │
│  │ source: [both] [ricardo] [tutti]  [ask first] [search]│   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Desktop Completed State

- Top: Command Pane (`[search]` & `[filters]`).
- Left Column (304px fixed): `[search trace]` pane containing input query, clarification question/answer (if applicable), `SpecPanel`, and `QueryList`.
- Right Column (fluid): `[results 01–40]` ledger containing product records.
- Mobile Layout: Stacked vertically with results ledger first, followed by search trace.

---

## 5. Theme Resolution & Persistence

Theme state is resolved before paint to avoid flash of incorrect theme:

1. **Pre-paint Script**: An inline script in `src/app/layout.tsx` reads `localStorage.getItem("theme")`. If `"light"` or `"dark"`, it applies it to `document.documentElement.dataset.theme`.
2. **OS Fallback**: If no valid stored theme is found, `window.matchMedia("(prefers-color-scheme: dark)")` is evaluated.
3. **User Toggle**: `ThemeToggle` toggles between `light` and `dark`, updates `dataset.theme`, and persists to `localStorage.setItem("theme", nextTheme)`. Once explicitly set by the user, OS media changes are ignored.
4. **Storage Failure**: If `localStorage` access fails (e.g. private mode restrictions), DOM theme switching still functions gracefully for the active session.

---

## 6. Adding a Search Filter

To add a new filter (such as location/proximity, category, or condition):

1. **Keep state in `SearchForm.tsx`**: Add explicit React state and handlers in `SearchForm`.
2. **Add a typed filter control**: Create a component beside `PlatformSelect.tsx` (e.g., `LocationSelect.tsx` or `PriceFilter.tsx`). Use keycap buttons or input controls with 2px borders, semantic tokens, and disabled states during search.
3. **Place in `[filters]` region**: Place the new control inside the filter bar row in `SearchForm.tsx` alongside `PlatformSelect`.
4. **Extend schema and API only when supported**: Extend `SearchRequestSchema` and `SearchView`'s `onSearch` contract only when backend marketplace adapters support the filter. Do not invent non-functional placeholder options.
5. **Localization**: Add English and German dictionary keys in `src/dictionaries/en.json` and `src/dictionaries/de.json`.
6. **Responsive Layout**: Verify that the filter bar wraps cleanly on 390px mobile viewports without causing horizontal page scrolling.
