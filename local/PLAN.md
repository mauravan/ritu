# Sorting for RITU Results

Subject: RITU — Swiss secondary-marketplace scanning terminal (Ricardo + Tutti). Add user-controlled sorting to the results ledger.
Audience: User scanning marketplace listings. Job: Let the user reorder ranked results by any ranking signal, price, or proximity, without leaving the terminal layout.

Design identity (confirmed): Dense market-scanning terminal. Square 2px corners, 1px borders, keycap buttons (`rounded-[2px]`), inverted active state (`bg-selection` + `text-on-selection`), no pill shapes, no decorative gradients. Sort controls sit in the `[filters]` bar beside the existing `PlatformSelect`, matching the keycap button pattern. Direction shown by an arrow (↑/↓) on the active keycap; clicking the active keycap toggles direction. No extra labels or eyebrow text above controls.

## Approach

1. **Dictionary keys** (`src/dictionaries/en.json`, `de.json`): add `sort_by`, `sort_dir_asc`, `sort_dir_desc`, and one label per sort field (`sort_spec`, `sort_value`, `sort_llm`, `sort_hybrid`, `sort_price`, `sort_proximity`). Keep lowercase sentence-case, no ALL-CAPS.

2. **Type updates** (`src/lib/types.ts`): add `SortBy = 'spec' | 'value' | 'llm' | 'hybrid' | 'price' | 'proximity'` and `SortDir = 'asc' | 'desc'`. Add optional `sortConfig?: { by: SortBy; dir: SortDir }` to `SearchResult` only if needed (not required — sort is client-side).

3. **SearchForm props** (`src/app/components/SearchForm.tsx`): extend props with `sortBy?: SortBy`, `sortDir?: SortDir`, `onSort?: (by: SortBy, dir: SortDir) => void`. Keep state local (`useState`) with defaults `spec` / `desc`. Add 6 keycap buttons in the filter region (after `PlatformSelect`): one per sort field. Active button: `bg-selection text-on-selection border-selection`; inactive: `bg-canvas text-text-secondary border-border`. Active button also shows `↑` or `↓` based on `sortDir`.

4. **Proximity behavior**: proximity uses existing `zipCode` and `radius` state already in `SearchForm`. If `zipCode` is empty when proximity is selected, disable the proximity keycap (`opacity-50 pointer-events-none`) or keep it selectable but fall back to alphabetical `location` sort. Implementation: sort comparator for proximity: if `zipCode` set, sort by `(p.location?.includes(zipCode) ? 1 : 0)` desc, then `location` asc/desc; else same but without zip match (alphabetical `location`). No geo API called.

5. **SearchView integration** (`src/app/components/SearchView.tsx`): add `sortState` (`{ by, dir }`) in component state, default `{ by: 'hybrid', dir: 'desc' }`. Pass `sortBy`, `sortDir`, `onSort` to `SearchForm`. Before rendering `ProductList`, apply sort to `result.products`:
   - `spec`: `p.specScore`
   - `value`: `p.valueScore`
   - `llm`: `p.relevance ?? -Infinity`
   - `hybrid`: `p.hybridScore ?? -Infinity`
   - `price`: `p.priceChf ?? Infinity` (null price sorted to bottom for desc, top for asc)
   - `proximity`: as defined in step 4
   Sort comparator uses `(b - a)` for desc, `(a - b)` for asc. For null/missing scores: desc puts lower values last; asc puts lower values first. This is standard numeric behavior.

6. **ProductList updates** (`src/app/components/ProductList.tsx`): no structural change needed (receives sorted array). Optionally show a small indicator in the results header (`pane-legend`) when sorted by something other than the server-side default (`hybrid` desc). Keep it minimal: e.g., append `· value ↓` to the legend only when sort differs from default. This avoids extra labels and uses existing structural space.

7. **Accessibility & motion**: respect `prefers-reduced-motion`; no animations on keycap state change. Ensure keyboard focus visible (`:focus-visible` with `ring-1 ring-focus`). Each keycap is a `<button>` with `aria-pressed={active}` and `aria-label` combining field + direction (e.g., `aria-label="Sort by value descending"`).

8. **Web-design-guidelines check** (`/skill:web-design-guidelines`): before build, verify no generic tells — no `rounded-full` pills, no ALL-CAPS labels, no unnecessary eyebrow labels, no decorative gradient under sort buttons, no `→` appended to buttons unless it indicates navigation (it does not here, so omit). Ensure line lengths under 80 chars, keyboard focus visible, motion only responds to user action (keycap click) not page load.

## Critical files & anchors

- `src/app/components/SearchForm.tsx`: filter bar layout (lines ~123–249). Add 6 `<button>` keycaps after `PlatformSelect` (around line 240).
- `src/app/components/SearchView.tsx`: sort state and sort application before `ProductList` (line ~276). Insert sort comparator function; call before `mapped` or pass sorted array.
- `src/lib/types.ts`: new `SortBy`, `SortDir` types.
- `src/dictionaries/en.json` / `de.json`: new keys.

## Verification

- Manual UI: open `http://localhost:3000`, run a search, click each sort keycap, confirm order changes. Check `↑/↓` toggles when clicking same keycap. Check proximity disabled when `zipCode` empty.
- Keyboard: tab through sort buttons, press Enter/Space to select/toggle, observe `focus-visible` ring.
- Reduced motion: `prefers-reduced-motion: reduce` — no transition on state change.
- Build: `npm run build` passes; `npm run lint` passes (Biome rules from `biome.json`).
- Visual: take screenshot of filter bar; confirm 2px rounded corners, 1px border, no pill shapes, no decorative gradients, no ALL-CAPS eyebrow above controls.

## Assumptions & contingencies

- Assumption: sorting stays client-side (no new API endpoint). If the user later wants server-side sort for >40 results, fall back to sorting the full server response before slicing.
- Assumption: proximity approximation by string match on `location` is acceptable (no geo DB). If a real distance service is added later, replace comparator with distance calculation.
- Contingency: if the user wants sort applied only to the top-40 shown (not full result set), the current approach (sort before slice) handles it automatically.
