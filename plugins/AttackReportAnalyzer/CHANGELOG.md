# Changelog — Nova Attack Report Analyzer

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
