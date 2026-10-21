# Changelog — Nova Farm List Manager

## [1.0.3] — 2026-10-21

UI / feedback polish. No change to the import or start logic.

### Changed

- **Import summary toast stays longer** — 9 s on success, 12 s for
  `partial`/`cancelled`/`failed`, instead of the shared 4 s/6 s defaults. The
  summary is multi-part (`N/M added, N skipped, N failed`) and was disappearing
  before it could be read.
- **Refresh now reports what it did** — the header button previously called
  `renderPanel()` with no feedback, which looked like a no-op. It now rescans,
  forces a real re-render (the length-keyed render cache is bypassed) and shows a
  toast such as `Refresh: 3 list(s) rescanned — 2 startable, 47 target(s)`,
  `Refresh: no farm list found on this page`, `Refresh unavailable while an
  import is running` or `Refresh failed: <err>` on a scan exception. The same text
  goes to the log.
- **Collapse button removed** — the header no longer has it. `Collapse`/`Expand`
  was rarely useful and its stored preference (`settings.panelCollapsed`) could
  leave the panel hidden with no obvious way back. The panel body and footer are
  now always rendered. No dead CSS or state is left behind.

### Compatibility

- `window.FLM.setCollapsed(v)` is still exported but is a no-op that just
  re-renders and returns `false` — no breaking change for external callers.
- `showToast(msg, kind)` keeps its old behaviour; the new optional third
  argument (`ms`) only overrides the lifetime when it is a positive number.

## [1.0.2] — 2026-10-21

Bug-fix release for the import flow. No new features.

### Fixed

- Fix native `<select>` value setter so the popup list can be chosen reliably.
- Wait for the popup options to render before choosing; detect "already exists"
  earlier to avoid 5s timeouts.
- Close the Import modal once the run starts and show progress on the main panel
  instead.

### Details

- **`setDialogListId()`** (`07-importer.js`) — waits for `select[name=listId]`
  (1500 ms), then for the **specific** `<option>` of the target list together
  with at least one real option (2000 ms), no-ops when the value is already
  correct, writes through `setNativeValueSelect()` (the
  `HTMLSelectElement.prototype` setter, added in 1.0.1), dispatches `input` +
  `change`, settles for `IMPORT_STEP_RETRY_MS` and verifies. On failure it logs
  the option values it actually saw, so "list not on this page" and "options
  rendered too late" are distinguishable in the log.
- **`openAddTargetDialog()`** — after `#farmListTargetForm` appears, it now waits
  up to 2000 ms for the list `<select>` to be populated and fails with
  `dialog did not render list options for <list>` instead of letting the caller
  poke at an empty popup.
- **`addTargetViaDialog()`** — checks `classifyValidation()` right after
  `fillCoordinates()`. A client-side "already" / "exists" message now returns
  `{status:"dup"}` immediately instead of waiting out the 5 s
  `SAVE_ENABLE_TIMEOUT_MS` and reporting a misleading `timeout`. A stale dialog is
  closed and followed by an 80–200 ms settle before the next target opens a new
  one.
- **Import modal closes on start** (`10-ui-modals.js`) — `_runModalImport()`
  captures the parsed payload, calls `closeImportModal()` and hands off to
  `runImport()`. The in-modal log (`_appendModalLog`, `_flushModalLog`,
  `_updateModalProgress`, `#flm-import-log`) and its CSS were removed.
- **Progress lives in the panel** (`09-ui-panel.js`) — while
  `getImportStats().status === "running"` the body shows a block with the list
  id, a `done/total` counter (`✓` added, `⏭` skipped, `✗` failed), a progress bar
  and the last 12 step lines. `updatePanelProgressOnly()` updates that block only
  (no list-row rebuild, scroll position preserved) and re-renders the panel
  normally once the run ends.
- **Header actions blocked during import** — Start all and Refresh are
  `disabled`; a red **Stop import** button appears and calls `cancelImport()`
  (finishes the current target, then stops).
- `finishImport()` already used the null-safe `setListMeta()` in 1.0.1; verified,
  not changed.

## [1.0.1] — 2026-10-21

Bug-fix release. No new features; behaviour change is limited to where the panel
lives and how the add-target dialog is driven.

### Fixed

- **Panel injection** — the box is no longer `position:fixed` in the bottom-right
  corner. It is now injected **inside `#rallyPointFarmList.contentV2`, before the
  first `.villageWrapper`**, at `width:100%`, with Travian-matching styling
  (light gradient, `#8a9ac0` border, 11–12 px text). Nothing is injected when
  `#rallyPointFarmList` is absent. The panel is re-injected whenever Travian
  re-renders the tab and drops our node (1 s poll + soft-navigation watcher).
  Collapse now hides the body with `display:none` (an in-flow `max-height` would
  leave the space reserved).
- **`setDialogListId()`** — the add-target `<select>` is a React controlled
  component: it now uses a native `HTMLSelectElement.prototype` value setter
  (new `setNativeValueSelect()` in `05-dom.js`), dispatches **both** `input` and
  `change`, waits up to 1500 ms for the options to be rendered, and verifies the
  value stuck. This removes the
  `could not select list #… in the dialog` failure.
- **`addTargetViaDialog()`** — waits for the dialog to be initialised before
  touching it (options rendered, then x/y inputs present and enabled) and reports
  `dialog did not initialise` after closing the popup on timeout.
- **`finishImport()` is null-safe** — writes through `setListMeta()` instead of
  mutating a `listMeta()` result, which is `null` for a list with no history yet
  (that is why the first import into a fresh list crashed). The same fix was
  applied to the start flow in `08-runner.js`.
- **Panel no longer flickers during import** — while an import runs the poll only
  updates the progress bar (`updatePanelProgressOnly()`), and the
  `MutationObserver` is suspended for imports / open dialogs.

### Changed

- The import parser logs a one-line summary
  (`parse ok: format=… targets=… warnings=…`) so a failed import can be diagnosed
  from the log alone.
- Panel header is `🌾 Farm List Manager v1.0.1` with text buttons
  **Start all**, **Refresh**, **Collapse** (`flm-head-btn`).
- The standalone floating debug panel was removed. FLM now registers a **`farm`
  tab inside Nova's debug box** (`TC.tests.register`, `?nova_debug=1`);
  `?flm_debug=1` keeps its logging behaviour.

## [1.0.0] — 2026-10-21

Initial release. External plugin (separate userscript) that talks to the Nova
core only through `window.TC` and never touches Nova internals.
Requires **Nova core 0.0.3+** (`FLM_REQUIRES_NOVA_MIN`).

### Added

- **Farm-list scan** — `scanFarmLists()` reads every `.farmListWrapper` of every
  rendered village (`.farmListHeader .dragAndDrop[data-list]`,
  `.farmListName .name`, `.farmListFooter button.startFarmList`), reporting
  `used / capacity`, target count, status text and startability.
- **Sidebar panel** (`#flm-panel`) — one card per list with `used/capacity`,
  target count and a live last-run timer ("just now", "3m ago", …). Collapsible,
  re-rendered on a 200 ms-debounced `MutationObserver`, never duplicated.
- **Start** — `FLM.start(listId)` and `FLM.startAll()` (panel buttons
  "Start" / "Start all"). Each start records `lastRunAt` in storage so the timer
  survives navigation.
- **Import modal** — `FLM.openImport(listId)`:
  - payload validation preview (valid targets, duplicates, remaining capacity,
    warnings and errors) before anything is written;
  - `mode: "append" | "replace"` — replace requires an explicit confirmation and
    clears existing slots first;
  - `dupMode: "skip" | "force" | "abort"` for targets that already exist;
  - live progress log inside the modal, cancellable at any step
    (`FLM.cancelImport()`), with the final report
    `{ status, total, done, skipped, failed, deleted }`.
- **`farm-list-v1` parser** (`06-import-parse.js`) — accepts
  `{_format:"farm-list-v1", list:{targets:[…]}}`, `{targets:[…]}`, a bare array
  and the legacy `{list:{targets:[…]}}` shape. Coordinate validation, in-payload
  duplicate detection and payload-vs-live duplicate detection.
- **Export** — `FLM.exportList(listId)` / the modal's "load current list"
  button fills the textarea with valid `farm-list-v1` JSON.
- **Storage** — independent key `localStorage['travian_farm_list_manager_v1']`
  holding only list metadata (`lastRunAt`, `lastRunStatus`, `lastImportAt`, …)
  and up to 5 backups (24 h TTL). Never stores target lists.
- **Adapter** — `02-adapter.js` is the only file that references `window.TC`;
  every call is feature-detected (`FLM.tc.waitForTC`, `FLM.tc.log`, …). The
  plugin works standalone when Nova is absent.
- **Log** — 300-line buffered log with a 5 s dedupe window, mirrored to Nova via
  `FLM.tc.log("farm-list", …)` when available.
- **Debug panel** — `?flm_debug=1` (persisted) or the panel's debug button:
  per-list table, import state, refresh / copy log + diag / clear log.
- **Public API** — `window.FLM` with `version`, `requiresNova`, `scan()`,
  `lists()`, `list(id)`, `start()`, `startAll()`, `isRunning()`, `parse()`,
  `import()`, `exportList()`, `openImport()`, `closeImport()`, `isImporting()`,
  `getImportStats()`, `cancelImport()`, `snapshot()`, `diag()`, `copyLog()`,
  `log()`, `getLog()`, `clearLog()`, `storage.*`.

### Notes

- Also registered into Nova's state as
  `TC.state().plugins.FarmListManager = { enabled, version, lastActionAt }`;
  no other Nova state is written.
- Verified with `node build.js` + `node --check` and a headless DOM smoke run
  (fake farm-list page): scan, panel mount, parse, diag, render, storage,
  modal open/close and start paths all execute without runtime errors.
