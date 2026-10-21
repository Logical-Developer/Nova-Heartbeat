# Nova Farm List Manager

External plugin for Nova Heartbeat. See [EXTERNAL-PLUGINS.md](../../docs/EXTERNAL-PLUGINS.md).

## Status

- Version: 1.0.3
- Source: `src/` (13 files, `00-header.js` … `12-bootstrap.js`)
- Build: `cd plugins/FarmListManager && node build.js` (or `node plugins/FarmListManager/build.js`)
- Output: `FarmListManager.user.js` (committed)
- Requires: Nova Heartbeat `>= 0.0.3` (`FLM_REQUIRES_NOVA_MIN`)
- Tampermonkey name: `Nova Farm List Manager (V 1.0.3)`

Runs on the rally-point farm-list page (`build.php?id=…&gid=16&tt=99`).

## What it does

- **Scans** every farm list rendered on the page (per village) and shows
  slots/targets, startability and last-run time in a panel injected inside
  `#rallyPointFarmList` (above the first `.villageWrapper`), not a floating box.
- **Starts** a single list or every startable list ("Start all"), then records
  `lastRunAt` so the panel can show a live "3m ago" timer.
- **Imports** targets from a `farm-list-v1` JSON payload via a modal:
  - `append` (keep existing slots) or `replace` (delete all slots first)
  - duplicate handling: `skip`, `force` (let Travian decide) or `abort`
  - live parse preview (valid count, duplicates, capacity, warnings/errors)
  - the modal closes as soon as the run starts; progress (bar, `done/total`,
    last step lines) is shown in the panel, and a **Stop import** button
    cancels after the current target
- **Export** the current targets of a list as `farm-list-v1` JSON (one click,
  fills the modal textarea) for round-tripping between lists/accounts.

## Architecture

- `src/02-adapter.js` is the **only** file that touches `window.TC`. Every other
  file goes through `FLM.tc.*`, and every call is feature-detected.
- Storage is independent: `localStorage['travian_farm_list_manager_v1']`.
  Only list metadata (last run / last import) lives there — never target lists.
- The only value written into Nova's state is
  `TC.state().plugins.FarmListManager = { enabled, version, lastActionAt }`.
- Nova is optional: if `window.TC` never appears, the panel, import and start
  still work (the log is just not mirrored into Nova).

### Module map

| File | Responsibility |
| --- | --- |
| `00-header.js` | userscript metadata + IIFE open |
| `01-config.js` | constants, selectors, timing, small utils, `isDebugEnabled()` |
| `02-adapter.js` | the only `window.TC` access (`FLM.tc.*`), `waitForTC` |
| `03-storage.js` | `travian_farm_list_manager_v1` read/write, backups, Nova version check |
| `04-log.js` | buffered log with dedupe, `showToast` |
| `05-dom.js` | page detection, farm-list scanning helpers, dialog + human-click helpers |
| `06-import-parse.js` | `farm-list-v1` (and legacy) parsing, duplicate/capacity analysis, export |
| `07-importer.js` | the add/delete loop (`runImport`), cancellation, stats |
| `08-runner.js` | start-a-list / start-all, run states, `sweepRunStates` |
| `09-ui-panel.js` | in-page panel (`#rallyPointFarmList`), polling, refresh/rescan |
| `10-ui-modals.js` | import modal (template, preview) — closes when the run starts |
| `11-public-api.js` | `window.FLM`, `diag()`, `copyLog()`, `onDataChanged()` |
| `12-bootstrap.js` | plugin registration, observers, debug tab, `init()` |

## JSON payload (`farm-list-v1`)

```json
{
  "_format": "farm-list-v1",
  "list": {
    "name": "Oasis run",
    "targets": [
      { "name": "Oasis 1", "x": 12, "y": -34, "population": 120, "distance": 8.4 },
      { "name": "Oasis 2", "x": 15, "y": -31 }
    ]
  }
}
```

Also accepted: `{ "targets": [...] }`, a bare array of targets, and the older
`{ list: { targets: [...] } }` shape. Invalid coordinates are dropped with a
warning; duplicates are detected both inside the payload and against the live
list.

## Public API (`window.FLM`)

```js
FLM.version;                          // "1.0.3"
FLM.scan();                           // { onFarmListPage, villages, count, lists[] }
FLM.lists();                          // richer list objects incl. run state
FLM.start(listId);                    // -> { ok, status, list } | { ok:false, error }
FLM.startAll();                       // -> { ok, started, total, errors }
FLM.parse(jsonString);                // -> { ok, format, targets[], warnings[], errors[] }
await FLM.import(listId, jsonOrObj, { mode: "append"|"replace", dupMode: "skip"|"force"|"abort" });
FLM.exportList(listId);               // -> farm-list-v1 object | null
FLM.getImportStats();                 // live progress object
FLM.cancelImport("reason");
FLM.snapshot();                       // panel snapshot
FLM.diag();                           // full diagnostics object
FLM.copyLog();                        // log + diag to clipboard (downloads if blocked)
FLM.log(msg); FLM.getLog(); FLM.clearLog();
```

## Debug

- `?flm_debug=1` on any matched page (persisted in `localStorage`) turns on
  verbose FLM logging.
- The UI for debugging is the **`farm` tab inside Nova's debug box**
  (`?nova_debug=1` → `TC.tests.register`): per-list table, import state, panel
  mount state, and buttons for refresh / copy log + diag / clear log.
- FLM has no floating debug panel of its own; without Nova only the log buffer
  is available (`FLM.log()`, `FLM.diag()`, `FLM.copyLog()`).

## Build & verify

```bash
cd plugins/FarmListManager
node build.js
node --check FarmListManager.user.js
```

Grep checks:

```bash
# only 02-adapter.js may reference window.TC
grep -l "window.TC" src/*.js

# only 01-config.js + 03-storage.js reference the storage key
grep -l "travian_farm_list_manager_v1" src/*.js

# must be zero
grep -E "^\s*(import|export)\s" src/*.js
```

## Manual test plan

1. **Scan** — open the farm-list tab: the panel lists every list of every
   rendered village with correct `used/capacity`.
2. **Start** — start one list; the card should show a "just now / Ns ago" timer
   that keeps counting.
3. **Start all** — only startable lists are attempted; errors are summarised.
4. **Import (append)** — paste a small payload, validate, run: the modal closes,
   the panel shows the progress block, and the log ends with `Import done: N/N added`.
5. **Import (replace)** — confirm the delete prompt; old slots are removed
   before the new ones are added.
6. **Duplicates** — a payload with an existing target is skipped (`skip`),
   retried (`force`) or aborts (`abort`) as chosen.
7. **Cancel** — press **Stop import** in the panel while a run is live; the run
   stops after the current target and the panel returns to normal.
8. **Export** — tick "load current list targets"; the textarea fills with valid
   `farm-list-v1` JSON that can be re-imported.
9. **Refresh** — press the header button: a toast reports
   `Refresh: N list(s) rescanned — M startable, T target(s)` (or
   `no farm list found`), and the panel numbers match the page.
10. **Panel header** — there is no Collapse button; the body is always visible.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).
