# Nova Attack Report Analyzer

Standalone external plugin for the Nova-Heartbeat monorepo.

Reads the battle reports of the current page, extracts every attacked target and
builds a sorted farm list out of them — with loot yield, coordinates, distance,
tribe, target alliance and attacker. Natars, oases and normal villages are kept
in separate tabs.

**This plugin does NOT depend on `window.TC` or Nova core.** It runs
independently when the user opens one of the supported pages.

## Features

### Scanning

- **Two page modes** — one for the alliance report archive, one for personal
  outbound reports. Both share the same pipeline, filters, exports and cache
  logic; caches are per mode so the two never mix.
- **Detailed per-target analysis** — every report is opened in turn (with a
  configurable delay) and parsed for subject, date, attacker, defender, carried
  loot and loot capacity.
- **Loot fallback** — when a detail page reports no loot, the carry icon of the
  list row is used instead, so a target is never silently dropped to 0 %.
- **Coordinate resolution** — the target's position is taken from the report
  itself when available, and otherwise from the map detail view through a
  hidden iframe (with a coordinate cache and an iframe-timeout guard).
- **Distance resolution** — read from the map detail view first; if that fails
  but coordinates are known, it is computed directly from the delta to the
  currently active village. Results always end up with a usable distance.
- **Campaign-wide aggregation** — targets hit by several reports are merged into
  one row that keeps the best loot percentage, the hit count and every attacker.
- **Interruptible scan** — the stop button aborts cleanly between reports.

### Filtering

- **Min Loot %** — keep only targets at or above a loot threshold.
- **Max Distance** — upper bound in map fields. `0` = no upper bound.
- **Min Distance** — lower bound in map fields. `0` = no lower bound. The two
  distance sliders are cross-clamped so an impossible range cannot be set.
- **Alliance filter** — a checkbox list of every alliance found among the
  *target* villages, with **All** and **Invert**. The alliance always belongs to
  the defended village, never to the attacker.
- **Attacker filter** — the same UI for the players who launched the reports.
  A target attacked by several players survives only if at least one of the
  remaining attackers is still selected (applied before aggregation).
- Every filter applies to the on-screen table **and** to every export.
- Filter and sort preferences are persisted per mode.

### Table

- Three tabs: **Normal Farms**, **Oases**, **Natars**.
- Columns: Village, Coord, Dist, Loot %, Tribe, Alliance, Player, with tags that
  mark Natars and Oases.
- Loot values are colour-coded in four bands.
- **Every column is sortable** (asc/desc) — the active column shows ▲ / ▼.
- Empty or unavailable values are rendered as `—`, never as `undefined`.

### Export

- **`farm-list-v1`** — Copy or Download, directly importable by Farm Manager.
- **Analytical JSON** — the full dataset with per-mode metadata (thresholds, both
  distance bounds, counts per tab, active alliance/attacker filters, sort state).
- **Debug snapshot** — the same data plus the raw parse buffer and environment
  details, for troubleshooting a scan.
- Exports always include only the rows that survive the current filters, and are
  ordered by distance regardless of the on-screen sort.
- File names are mode-tagged so two exports never overwrite each other.

### Robustness

- **Per-mode caches** with TTL for both the report list and the coordinate data.
- **Safe parsing** — bidi control characters are stripped before anything is
  compared or exported, dash placeholders are ignored, and every value that
  reaches the DOM goes through an HTML escaper.
- **Non-destructive merging** — a failed map lookup never overwrites data that
  was already read from the report.
- **Zero Nova dependency** — the plugin can be installed on its own.

## Page modes

| Mode | Page | In-page title |
|------|------|---------------|
| `alliance` | alliance report archive | Nova Alliance Attack Analyzer |
| `own` | personal outbound reports | Nova Attack Report Analyzer — Own Reports |

## Installation

Install via Tampermonkey / Violentmonkey / Greasemonkey:

**[Install AttackReportAnalyzer.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/AttackReportAnalyzer/AttackReportAnalyzer.user.js)**

## Usage

1. Open the alliance report archive **or** the personal outbound reports page.
2. Click **🔍 Scan Reports** in the injected box.
3. Wait for the scan to complete.
4. Narrow the result down with the sliders (Min Loot %, Max Distance,
   Min Distance).
5. Optionally narrow it down further with the **Alliance filter** (alliance of
   the *target* village) and the **Attacker filter** — both lists are built from
   what the scan actually found. Click any column header to sort (asc/desc).
6. Export as `farm-list-v1` (Copy/Download) for Farm Manager import, or export
   the analytical JSON for reference.

> Filter rule: **nothing checked = no filter**, **everything checked = no
> filter**, a partial selection = only the checked values. Use **Invert** to get
> the complement of the current selection.
>
> Distance rule: `0` on either slider disables that bound. A target without a
> known distance is hidden only while at least one distance bound is active.

## Build

```
cd plugins/AttackReportAnalyzer
node build.js
node --check AttackReportAnalyzer.user.js
```

## Source layout

- `src/00-header.js` — userscript metadata (opens the IIFE)
- `src/01-config.js` — `CONFIG`, `MODES`/`MODE` (page mode), `THEME` + wrappers over `src/shared/*`
- `src/02-ui.js` — styles, toast, box, log/progress/button helpers
- `src/03-scan.js` — state, scan pipeline, filters, exports, render
- `src/04-clipboard.js` — clipboard, file download, cache load
- `src/05-bootstrap.js` — `injectBox()`, `init()` (closes the IIFE)
- Shared utilities: [`src/shared/`](../../src/shared/) (concatenated in by `build.js`)

## Version

- `1.6.3` — **Min Distance** slider; fixed the empty **Distance** column for
  oases (label row without `<th>`, cache gate that required `tribe`, iframe
  guard that only accepted the generic map heading); target coordinates are now
  also read from the report page, and a missing distance is computed from the
  active village
- `1.6.2` — target-village **Alliance** column + alliance/attacker filters +
  sortable columns
- `1.6.1` — fixed the personal outbound reports reader, shared row extractor,
  loot fallback from the list icon, version added to `@name`
- `1.6.0` — own-reports mode, per-mode caches, generic reader fallback
- `1.5.1` — modularized from monolithic (no behavior change)
- Source: `src/`
- Shared utilities: `src/shared/`

## Notes

- Alliance cache keys: `nova_ara_alliance_cache_v5`, `nova_ara_alliance_coords_v6`
- Own-reports cache keys: `nova_ara_own_cache_v1`, `nova_ara_own_coords_v2`
- Filter/sort keys: `nova_ara_<mode>_ally_filter`, `nova_ara_<mode>_attacker_filter`,
  `nova_ara_<mode>_sort` (`<mode>` = `alliance` \| `own`)
- Alliance source: the **target** village's map detail view. Attacker alliance is
  never used for the column/filter.
- Cache TTL: 30 minutes
- Only scans the current page's reports (not paginated)
- `meta.minDistance` / `meta.maxDistance` are `null` in the export when the
  corresponding bound is disabled
- Verified structure of the outbound reports page: table
  `#overview.row_table_data` inside `#reportsForm`, rows `td.sel` + `td.sub`
  (`img.iReport.iReport1`, `a.reportInfoIcon[href*="reportId="]`,
  `div > a[href="?id=…%7C…&s=1"]`) + `td.dat`
- Verified structure of the map detail view: `#tileDetails` / `#map_details`,
  coordinates via `.coordinateX` + `.coordinateY`, distance row emitted as
  `<td class="desc">Distance</td><td class="bold">N fields</td>`
- Tampermonkey name: `Nova Attack Report Analyzer - Alliance (V 1.6.3)`

