# Changelog — Nova Farm Manager

## [2.1.2] — 2026-10-09

Bug-fix release: the run no longer leaves the browser on the rally point after it
finishes. No `window.FM` changes; every edit is behavior-preserving elsewhere.
Requires **Nova core 0.0.3+** (unchanged, `FM_REQUIRES_NOVA_MIN`).

### Fixed

- **#2 (browser report) — after the last confirmed attack the browser stayed on
  `build.php?id=39&gid=16&tt=1` and never showed the final report.**
  `14-pending-report.js:checkPendingReport()` gated the navigation to `tt=0` on
  `isRallySend()` — and `isRallySend()` (`11-rally-panel.js`) only accepts
  `tt === "2"`, while Travian redirects to **`tt=1`** after the final
  `#confirmSendTroops` click. The condition is now `isRallyAnyTab()`
  (`tt=0` / `tt=1` / `tt=2` / no `tt`); the 4 s anti-loop guard and
  `!detectConfirmForm()` are unchanged.
- **#2 — navigation no longer depends on the 1 s poll.** In
  `13-arrive-handler.js`, the "run finished after the last confirm" branch now
  calls `goToReport(farm.sourceVid)` directly (same pattern as the
  out-of-troops / invalid-target paths) before returning `done`, after a short
  `await delay(1200)` so the confirm POST is not aborted by the navigation.
  Manual stop/cancel still shows no report (flags cleared by `transitionRun(IDLE)`).

### Added

- `isRallyAnyTab()` in `11-rally-panel.js`.
- Browser test scenario §10.7 in `docs/KNOWLEDGE-TRANSFER.md`.

### Notes

- `@name` now carries the version: `Nova Farm Manager (V 2.1.2)`.
- If the run ends while the browser is **not** on a rally page, FM deliberately
  does not hijack the navigation (Nova may be working); use
  `FM.forceNavigateTt0()` in that case.

## [2.1.1] — 2026-10-09

Follow-up to 2.1.0 — fixes the mid-run village switch reported from the browser and
adds `farm-list-v1` support to the "Remove villages with losses" importer.
Requires **Nova core 0.0.3+** for the queue lock (`FM_REQUIRES_NOVA_MIN`).

### Fixed

- **#1 (browser report) — the village changed in the middle of a farm run.**
  `src/06-runner.js:rotationTick()` (Nova 0.0.2) enqueued an *urgent visit* with
  `priority: 10` and without checking `nextRotationAt`; FM's farm tasks are
  `priority: 9`, so Nova navigated to another village's `dorf1` between two raids
  (`pickNextJob()` → no runnable task → `rotationTick()`).
  FM now registers `TC.pluginLock` (`16-heartbeat-wrapper.js:installPluginLock`) while
  `isFarmRunActive()` is true: Nova enqueues no rotation/urgent visits and picks only
  tasks with `payload.farm`. `FM.lockActive()` / `FM.lockInfo()` expose the state, and
  `window.FM.diag()` reports `lockActive` / `lockLabel` / `novaVersion`.
- **#3 — "Remove villages with losses" rejected `farm-list-v1` JSON.**
  `09-import-export.js:parseLossCoordinates` only accepted an array or
  `{ blacklist: [...] }`, so an export from Farm Manager / Attack Report Analyzer
  failed with *"Expected a JSON village list"*. It now also accepts `farm-list-v1`
  (`{ _format, list: { targets: [...] } }`), `{ list: { targets } }`, `{ targets }`,
  `{ villages }` and `{ coordinates }`, and reports which shape was detected.
- **#3 — the Preview box was hidden whenever parsing failed**, so remove mode showed no
  `ℹ Preview:` at all. `11-rally-panel.js:refreshPreview()` now always renders the box
  for `remove` (and for import errors), showing the detected format, list name and the
  match / not-found / duplicate / invalid counts.

### Added

- `TC.pluginLock` wrapper in `02-adapter.js` (feature-detected; needs Nova 0.0.3+).
- Nova version compatibility warning at boot (`FM_REQUIRES_NOVA_MIN = "0.0.3"`).

## [2.1.0] — 2026-10-09

Bug-fix release for the run lifecycle, troop accounting and Cool Down.
No `window.FM` renames — every change is additive or behavior-preserving.
Analysis: `private-doc/bug-fix/002-fm-run-lifecycle-troops-bug-analysis.md` (Phase 1).

### Fixed

- **X1 (critical) — Cool Down freeze was cancelled by FM's own freeze override.**
  `16-heartbeat-wrapper.js` returned `true` while a cooldown was active; Nova
  clears `heartbeat._frozenAt` on every tick (~1.5 s) when an override matches
  (`src/07-plugins-api.js:81-95`), so raids kept firing during Cool Down.
  The override now returns `false` during cooldown (Nova core untouched).
- **#1 — four parallel run-lifecycle flags unified behind `transitionRun()`.**
  Added `RUN_STATUS` (`01-config.js`) and a single mutation point
  `transitionRun(next, opts)` (`12-run-controller.js`). All four end-of-run
  paths (normal, invalid-last-target, out-of-troops, manual stop/cancel) now
  go through it; the legacy flags (`_endOfRunHandled`, `_activeRunId`,
  `_navigateToTt0AfterRun`, `_pendingFinalReport`) are still written as derived
  values so `window.FM.diag()` and the debug panel stay compatible.
- **#1/S3 — `resumeRunIfPending` no longer treats a stale `_endOfRunHandled`
  as absolute truth**: the early bail-out only happens when there is **no**
  pending-run key; a pending run whose key exists is resumed.
- **#1/5.3 — `isFarmRunActive(runId)`** is now status-based
  (`run.status` + `run.id`); the lenient `!fm._activeRunId ||` escape hatch is gone.
- **#2/#5 — troop snapshot freshness.** New `readTroopsFromSendTroopsPage()`
  reads available troops from the `tt=2` form (`#troops input[name="troop[tN]"]`
  + its sibling `<a>` count — verified against
  `private-doc/travian-document/Rally Point-tt2.txt`), with a 10-minute TTL on
  cached data (`SNAPSHOT_TTL_MS`, `isSnapshotFresh`). `computeTroopsToSend`,
  `startRun`, `resumeRunIfPending` and `savePausedRun` now use
  `pickStartSnapshot`/`resolveTroopSnapshot`; `snapshotAt` is finally read.
  When the fresh page read is used, `reserved` is no longer subtracted twice.
- **#3 — `autoFill` is no longer a dead field.** `computeTroopsToSend` honors
  `requireExact` (skip the target instead of sending fewer troops) and the
  per-target override wins over the list setting. New UI: "Require exact troop
  count" checkbox in the troop editor + "Troop fill policy" select in the
  target edit dialog. Default stays `fillAvailable` (backward compatible).
- **#4 — `stopRunDueToNoTroops` now cleans up Cool Down** (`closeCooldownModal`
  + `clearCooldownFreeze`, matching `pauseActiveRun`) and transitions through
  `transitionRun(RUN_STATUS.PAUSED_NO_TROOPS)`.
- **#5 — resume refreshes troops** instead of reusing a frozen stale snapshot.
- **A3 — final report reliability.** Flags are cleared before the 300 ms render
  timeout but the render is token-guarded; a nav-loop guard
  (`_navigateToTt0At`, 4 s) stops the `tt=2 → tt=0` bounce; reports are
  de-duplicated via `_lastShownReportRunId`; report payloads carry `runId`.
- **A5-1 — unified `goToReport(sourceVid)`** (always with `newdid`), used by
  `pauseActiveRun`, the invalid-target path, the skip path and the
  out-of-troops path. **A5-2** — `pauseActiveRun` no longer leaves the four
  flags behind (it goes through `transitionRun(RUN_STATUS.IDLE)`).
- **A7 — `maxlength="5"` → `"6"`** on troop inputs (`04-troops.js`, also the
  `attachNumericFilter` clamp) so 6-digit templates are not silently truncated.
- **X2 — Cool Down state is persisted** (`fm.cooldown`) and restored by
  `restoreCooldownIfActive()` from `live()`; navigation/reload no longer loses
  the countdown or the freeze.
- **X3 — re-entrancy guard in `startRun`** (confirm before cancelling a live run).
- **X4 — `cancelOrphanedFarmTasks(runId)` never means "cancel everything"**.
  Added `cancelFarmTasksOfRun(runId, includeCurrentJob=false)` and
  `cancelAllFarmTasks(reason)`; the boot cleanup and all end-of-run paths now
  cancel a scoped set only.
- **`detectSendTroopsForm()`** no longer requires the `troop[t1]` row
  (a village without Phalanx is still detected as the send-troops page).

### Notes

- Nova core, `src/shared/`, `plugins/AttackReportAnalyzer/` and `backup/` were
  not modified.
- `window.FM` additions (additive only): `cancelRunTasks`, `cancelAllFarmTasks`,
  `goToReport`; `FM.diag()` gains `runStatus`, `snapshotAge`,
  `cooldownPersistedUntil`, `lastShownReportRunId`, `runInProgress.status`,
  `runInProgress.snapshotSource`, `runInProgress.troopSnapshotAt`,
  `runInProgress.autoFill`.
- `FM.cancelOrphaned()` now requires a run id (or an active run); use
  `FM.cancelAllFarmTasks()` for the old "cancel everything" behavior.

## [2.0.0] — 2026-10-09

Pure refactor of 1.8.3 into a modular external plugin. **No behavioral change.**

- Refactor: split the monolithic 1.8.3 userscript (4939 lines) into 19 files
  under `src/` (`00-header.js` … `18-bootstrap.js`)
- Build: added `build.js` (concat-only, no minify) → `FarmManager.user.js`
- Added `src/02-adapter.js` — the only file allowed to touch `window.TC`;
  every other file uses `FM.tc.*`
- Storage: `travian_farm_manager_data_v17` → `travian_farm_manager_data_v18`
  (v17 is left intact; auto-migrated by `migrateV17ToV18()` in `03-storage.js`)
- Added `FM_REQUIRES_NOVA_MIN = '0.0.1'`
- `window.FM` shape unchanged (additive: `FM.tc`); `installPublicApi(TC)` in
  `17-public-api.js`
- Version bumped 1.8.3 → 2.0.0 (`@name`, `@version`, `FM_VERSION`)
- Session key `fm_pending_run_v17` unchanged

### Intentionally not fixed in this release

15 known bugs are preserved verbatim, including the `maxlength="5"` troop-input
truncation (#1 / #1b) and the four parallel run-lifecycle flags (#15).
See `docs/KNOWLEDGE-TRANSFER.md` §9.

## [1.8.3] — Frozen

- Last monolithic release
- Backup: `backup/Nova Farm Manager (1.8.3)-1.8.3.user.js`

