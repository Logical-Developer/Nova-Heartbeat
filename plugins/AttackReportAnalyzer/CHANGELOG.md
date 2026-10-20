# Changelog — Nova Attack Report Analyzer

## [1.6.3] — 2026-10-18

### Added

- **Min Distance filter.** A second range slider (`0–200`, default `0` = no
  lower bound) sits right below *Max Distance*. It is applied in
  `getFilteredAggregated()` together with the existing upper bound, logged into
  the export metadata as `meta.minDistance`, shown in the empty-state message,
  and included in the debug snapshot (`minDistance`).
  - The two sliders are cross-clamped in `05-bootstrap.js`: raising Min above a
    non-zero Max pushes Max up, and lowering Max below a non-zero Min pulls Min
    down. A value of `0` on either slider means "no bound on that side".
- **Distance derivation layers** (see *Fixed* below). Every result may now carry
  `distanceSource = "calculated"` when the distance had to be computed from
  coordinates instead of being read from the map page.

### Fixed

- **Oasis rows always had an empty Distance column.** Three independent defects
  were found and fixed:

  1. **`Distance` row was skipped by the map parser.**
     `src/shared/03-map.js` → `_sharedParseMapDetail()` only looked for a label
     inside a `<th>` cell. The real map page emits this row as
     `<tr><td class="desc">Distance</td><td class="bold">4.47 fields</td></tr>`
     — no `<th>` at all — so the row never matched and `distance` stayed `null`
     for every target. The parser now reads `<th>` **or** any two-cell
     `(label, value)` row and keeps the `th`-based paths as a fallback.
  2. **The coordinate cache could never store an unoccupied oasis.**
     `_sharedFetchVillageInfo()` only wrote to the cache when
     `info.tribe` was set, but an ownerless oasis has no `Tribe` row at all.
     The entry was therefore re-fetched on every scan, and each attempt ran into
     the iframe timeout. The cache gate and the write condition now only require
     `x`, `y` and `distance`; `tribe` is optional.
  3. **The iframe guard rejected the oasis page.**
     `_sharedFetchVillageInfoViaIframe()` waited for an `<h1 class="titleInHeader">`
     whose text was exactly `Map`. On an oasis the first `h1` is
     `Unoccupied oasis (−74|−72)`, so the guard polled until
     `iframeMaxAttempts` and returned `null`. The guard now also accepts the
     page as soon as `#tileDetails` exposes `.coordinateX` / `.coordinateY`.
- **Report page coordinates are now read as well** (`src/shared/04-report.js`).
  `_sharedParseReportDetail()` returns `x` / `y`, taken from
  `.headline .subject` (`.coordinateX` + `.coordinateY`) with a fallback to the
  defender's `a.village`. For an oasis report the defender anchor only contains
  a numeric label (`<a class="village" href="/karte.php?d=…">40</a>`) and no
  coordinates, while the subject carries e.g.
  `40 raids Unoccupied oasis (−182|−79)`. A stable `defender.coordsKey`
  (`"x:y"`) is produced when a target has coordinates but no id.
- **The map fetch no longer erases report-side data.** `03-scan.js` used to
  assign `d.x = info.x`, `d.y = info.y`, `d.distance = info.distance`
  unconditionally, which overwrote previously known values with `null` whenever
  the map fetch failed. Each field is now only overwritten when the map actually
  returned a value.
- **Fallback distance.** When neither the report nor the map yields a distance
  but coordinates are known, `runScan()` computes it with
  `Math.round(Math.hypot(Δx, Δy))` from the currently active village
  (`getActiveVillageCoords()` → `#villageName[data-x][data-y]`, falling back to
  the active village entry's `.coordinateX` / `.coordinateY`).

### Unchanged by design (zero regression)

- `maxDistance` default stays `0` (no limit); the Min slider defaults to `0`
  too, so an untouched UI behaves exactly like 1.6.2.
- A `null` distance is still excluded only when a bound is actually active.
- The default sort (distance ascending, `null` last) and the export ordering
  (distance ascending) are untouched.
- Cache keys are unchanged; no migration is needed.

## [1.6.2] — 2026-10-18

### Added

- **Target-village alliance.** The alliance of the *defended* village is now
  extracted from the map detail page (`/karte.php?d=<id>` →
  `#tileDetails` / `#map_details`) and shown as a new **Alliance** column between
  *Tribe* and *Player*.
  - `src/shared/03-map.js` → `_sharedParseMapDetail()` gained an `alliance` field
    with two extraction paths: the `Alliance` label row (link text preferred) and,
    as a fallback, any `a[href*="/alliance/"]` inside the tile details. Dash
    placeholders (`-`, `—`) are ignored, bidi marks are stripped.
  - `_sharedFetchVillageInfo()` cache-hit condition now also requires the
    `alliance` key, and the iframe fallback merges `alliance`.
  - **This is the target's alliance, never the attacker's.** `d.alliance`
    (attacker side, filled from the report list) is deliberately *not* used;
    `targetAllianceOf()` reads `d.mapAlliance` first and `d.defender.alliance`
    second.
- **Alliance filter.** A checkbox list of every alliance found among the target
  villages, above the existing Normal Farms / Oases / Natars tabs, with **All**
  and **Invert** buttons. The selection applies to the table *and* to every
  export (analytical JSON + farm list).
- **Attacker filter.** The same checkbox UI for the players who launched the
  reports. A village attacked by several players survives only if at least one
  of the remaining attackers is still selected (the filter runs on raw results,
  before aggregation).
- **Sortable columns.** Every header (`Village`, `Coord`, `Dist`, `Loot`,
  `Tribe`, `Alliance`, `Player`) toggles asc/desc via `data-sort`; the active
  column shows ▲ / ▼.
- New export metadata: `meta.allianceFilter`, `meta.attackerFilter`,
  `meta.sort`. Every exported entry now carries `alliance`.

### Changed

- Filter and sort preferences persist per mode in `localStorage`
  (`nova_ara_alliance_ally_filter`, `nova_ara_alliance_attacker_filter`,
  `nova_ara_alliance_sort` — and the `_own_` equivalents).
- `coordsCacheKey` bumped (`nova_ara_alliance_coords_v5 → v6`,
  `nova_ara_own_coords_v1 → v2`) so previously cached villages without the
  alliance field are re-fetched. The results cache key (`storageKey`) is
  unchanged.
- `_sharedAggregateByVillage` output is stamped with `mapAlliance` / `alliance`
  in `03-scan.js` (`stampAlliance`) — the shared aggregator itself is untouched.
- `filter options` are rebuilt after a scan **and** when loading from cache.

### Unchanged by design (zero regression)

- Distance sort ascending remains the default, and exports are still ordered by
  distance regardless of the on-screen sort.
- Empty selection = no filter; a fully-checked list = no filter. Removing every
  checkbox therefore does **not** empty the table — use **Invert** to see the
  inverse set.
- `maxDistance` default stays `0` (no limit).

## [1.6.1] — 2026-10-09

### Fixed

- **`/report/offensive` scan reported "No qualifying reports found on this page".**
  The report-list reader only knew the alliance layout (`#offs tbody tr`) and the
  absolute link shape `a[href*="/report?id="]`. The personal/offensive page uses
  `table#overview.row_table_data` and **relative** links (`?id=47141955%7C118b6e1f&s=1`),
  so zero rows matched.
  - `src/shared/04-report.js`: new `_sharedExtractReportRow(tr)` +
    `_sharedNormalizeReportHref(href)`; `_sharedReadReportListFromPage()` now tries
    `#offs` first (alliance, unchanged) and only falls back to a generic pass
    (`#overview` / `#reportsForm` / `table.row_table_data` / any `tbody`) when it
    finds 0 rows. Hrefs are normalized to `/report?id=…` (the endpoint the alliance
    path already uses).
  - The `reportId` is read from `a.reportInfoIcon[href*="reportId="]` when present.
- **Selector trap found by the browser harness:** a scoped-looking selector such as
  `td.sub div a[href*="id="]` also matches anchors whose only `div` ancestor is
  *outside* the row (e.g. `#reportsForm`) — `querySelectorAll` does not scope
  ancestor parts. That made the analyzer pick the `reportInfoIcon` link
  (`/build.php?id=39&…&reportId=…`) with an empty subject. The extractor now walks
  `td.sub a[href*="id="]` explicitly, skips `.reportInfoIcon` and prefers real
  report links (`/report?id=` or `?id=`).
- **Loot fallback:** if the detail page reports no loot, the `alt` of the list's
  carry icon (`"26/225"`) is used (`d.lootSource = "list-icon"`).

### Changed

- `@name` now carries the version: `Nova Attack Report Analyzer - Alliance (V 1.6.1)`
  (in 1.6.0 the name was intentionally left untouched — Tampermonkey may therefore
  show a second entry; remove the old one).
- `03-scan.js:extractReportRow()` now delegates to the shared extractor (one
  implementation for both modes).

## [1.6.0] — 2026-10-09

### Added

- **`/report/offensive` support (own reports).** A second `@match` plus a page-mode
  table (`MODES` in `src/01-config.js`): `alliance` for `/alliance/reports` and
  `own` for `/report/offensive`. Both modes share the same scan pipeline, loot/distance
  filters, tabs (Farms / Oases / Natars), `farm-list-v1` export and analytical JSON
  export. The in-page title and the new *Source* line are mode-aware.
- Generic report-list fallback reader (`03-scan.js:extractReportRow` /
  `readReportListFromPage`) used when the shared `#offs` reader finds 0 rows — covers
  own-report markup differences instead of silently scanning nothing.
- `injectBox()` no longer requires `.navigationSpacer`; on pages without it the box is
  inserted at the top of `#content`.
- Per-mode cache keys: `nova_ara_own_cache_v1` / `nova_ara_own_coords_v1`
  (the alliance keys are unchanged) so an alliance scan never mixes with an own scan.
- Export file names are mode-tagged: `nova-farmlist-own-*.json`, `nova-ara-own-*.json`,
  `nova-ara-own-debug-*.json`.
- Farm-list name for own reports: `Nova Own Farms`.
- This `CHANGELOG.md`.

### Changed

- `@version` 1.5.1 → 1.6.0; `@description` now covers both pages. `@name` is
  intentionally unchanged so Tampermonkey keeps the same script identity.
- `03-scan.js` analytical export: `meta.app` and new `meta.mode` reflect the active mode.

## [1.5.1] — 2026-10-09

- Modularized from the monolithic single file into `src/` + `src/shared/`
  (no behavior change). Frozen reference:
  `backup/Nova Attack Report Analyzer - Alliance-1.5.1.user.js`.
