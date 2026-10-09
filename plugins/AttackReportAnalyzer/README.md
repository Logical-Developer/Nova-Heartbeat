# Nova Attack Report Analyzer

Standalone external plugin for Nova-Heartbeat monorepo.

Analyzes attack reports and extracts farm targets with loot %, distance,
coordinates, and tribe. Separates Natars, oases, and normal farms. Exports as
`farm-list-v1` (compatible with Farm Manager) or analytical JSON.

Two page modes (v1.6.0):

| Mode | Page | Title |
|------|------|-------|
| `alliance` | `/alliance/reports` | Nova Alliance Attack Analyzer |
| `own` | `/report/offensive` | Nova Attack Report Analyzer — Own Reports |

**This plugin does NOT depend on `window.TC` or Nova core.** It runs
independently when the user opens one of those pages.

## Installation

Install via Tampermonkey / Violentmonkey / Greasemonkey:

**[Install AttackReportAnalyzer.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/AttackReportAnalyzer/AttackReportAnalyzer.user.js)**

## Usage

1. Open `/alliance/reports` **or** `/report/offensive` in Travian.
2. Click **🔍 Scan Reports** in the injected box.
3. Wait for scan to complete.
4. Filter by min loot % and max distance.
5. Export as `farm-list-v1` (Copy/Download) for Farm Manager import,
   OR export analytical JSON for reference.

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

- `1.6.1` — fixed the `/report/offensive` reader (`#overview` table + relative
  `?id=…` links), shared row extractor, loot fallback from the list icon,
  version added to `@name`
- `1.6.0` — own-reports mode (`/report/offensive`), per-mode caches, generic reader fallback
- `1.5.1` — modularized from monolithic (no behavior change)
- Source: `src/`
- Shared utilities: `src/shared/`

## Notes

- Alliance cache keys: `nova_ara_alliance_cache_v5`, `nova_ara_alliance_coords_v5`
- Own-reports cache keys: `nova_ara_own_cache_v1`, `nova_ara_own_coords_v1`
- Cache TTL: 30 minutes
- Only scans the current page's reports (not paginated)
- Verified DOM structure (from a real `/report/offensive` page): table
  `#overview.row_table_data` inside `#reportsForm`, rows `td.sel` + `td.sub`
  (`img.iReport.iReport1`, `a.reportInfoIcon[href*="reportId="]`,
  `div > a[href="?id=…%7C…&s=1"]`) + `td.dat`
- Tampermonkey name: `Nova Attack Report Analyzer - Alliance (V 1.6.1)`

