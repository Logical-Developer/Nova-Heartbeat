# src/shared/ — Shared Utilities

This directory contains utilities that are shared between multiple
external plugins in the Nova-Heartbeat monorepo.

## Constraints

- **NO IIFE.** These files are concatenated inside the parent plugin's IIFE.
- **NO imports/exports.** Pure function declarations only.
- **NO plugin-specific globals.** No `window.TC`, `window.FM`, no reference to any CONFIG.
- **All functions prefixed with `_shared`** to avoid collisions.
- **Config values passed as parameters**, not read from globals.

## Why

Both `plugins/AttackReportAnalyzer/` and `plugins/FarmManager/` need to
parse Travian reports, fetch map info, and build farm-list-v1 exports.
Instead of duplicating this logic, they both pull from this folder.

## Build Integration

Each plugin's `build.js` reads these files in numeric order BEFORE the
plugin's own `src/*.js` files. So the concatenation order is:

```
00-header.js
src/shared/01-utils.js
src/shared/02-storage.js
src/shared/03-map.js
src/shared/04-report.js
src/shared/05-farmlist.js
plugins/<Plugin>/src/01-config.js
plugins/<Plugin>/src/02-*.js
...
```

These files are **not** part of the Nova core build (`build.js` at the repo
root lists `src/*.js` explicitly, so `src/shared/` is ignored there).

## Files

- `01-utils.js` — `_sharedEscapeHtml`, `_sharedStripBidi`, `_sharedCleanVillageName`, `_sharedParseCoord`, `_sharedExtractVillageId`, `_sharedTimestampSuffix`, `_sharedSleep`
- `02-storage.js` — `_sharedSaveCache`, `_sharedLoadCache`, `_sharedClearCacheKey`, `_sharedLoadCoordsCache`, `_sharedSaveCoordsCache`
- `03-map.js` — `_sharedFetchVillageInfo`, `_sharedFetchVillageInfoViaIframe`, `_sharedParseMapDetail`
- `04-report.js` — `_sharedReadReportListFromPage`, `_sharedFetchReportDetail`, `_sharedParseReportDetail`, `_sharedAggregateByVillage`
- `05-farmlist.js` — `_sharedBuildFarmListTarget`, `_sharedBuildFarmListDocument` (the `farm-list-v1` document shape)

## Adding a New Shared Utility

1. Pick the right file (or create a new numbered file).
2. Write a pure function with `_shared` prefix.
3. Take all config as parameters.
4. Add a plugin-side wrapper if needed.
5. Rebuild ALL plugins that use this shared folder.
