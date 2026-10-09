# Nova Farm Manager — Knowledge Transfer Document

Version: 1.0
Target: Nova Farm Manager v2.0.0 (modularized from v1.8.3)
Last updated: 2026-10-09

---

## 1. Project Overview

**Nova Farm Manager (FM)** is an external plugin for **Nova Heartbeat (Nova)**.
It orchestrates multi-target farm raids on Travian Legends, driving Nova's
task queue and leveraging Nova's navigation/state machine.

| Item                   | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Repo                   | Nova-Heartbeat (monorepo)                                          |
| Location               | `plugins/FarmManager/`                                             |
| Type                   | External plugin (separate userscript)                              |
| Core dependency        | Nova Heartbeat `>= 0.0.1` (uses `window.TC`)                       |
| Build                  | `cd plugins/FarmManager && node build.js` (concat-only)            |
| Output                 | `plugins/FarmManager/FarmManager.user.js` (committed)              |
| Storage                | `localStorage['travian_farm_manager_data_v18']` (independent)      |
| Metadata in Nova state | `TC.state().plugins.FarmManager = { enabled, version, lastRunAt }` |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Travian Legends (DOM)                    │
│   dorf1/dorf2  ·  build.php?gid=16&tt=0/1/2  ·  karte.php   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Nova Heartbeat (core, src/)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  window.TC — public API                               │  │
│  │    enqueue, cancel, registerPlugin, navigate,         │  │
│  │    humanClick, state, patch, page, village,           │  │
│  │    freezeOverride, tests, flash, log,                 │  │
│  │    heartbeat.setOn, captureCurrentVillage ...         │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │  uses only window.TC (via adapter)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Nova Farm Manager (external plugin)                 │
│  plugins/FarmManager/                                       │
│    src/  (19 files, concatenated to FarmManager.user.js)    │
│    ├── 02-adapter.js  ← ONLY file touching window.TC        │
│    └── ...                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key rules:**

- Farm Manager never touches Nova's internals; it uses `window.TC` only.
- The adapter (`src/02-adapter.js`) is the sole file allowed to reference `window.TC`.
- All other FM files call `FM.tc.*` (which the adapter provides).
- Farm Manager has its own `localStorage` key; Nova's reset must not erase FM data.

---

## 3. File Map

### 3.1 Nova core (unchanged reference)

| File                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `src/00-header.js`         | userscript metadata                                      |
| `src/01-config.js`         | constants (`CFG`, `DEF`, `SK`)                           |
| `src/02-utils.js`          | `$`, `$$`, `now`, `delay`, `esc`, `logNormal`, `waitFor` |
| `src/03-state.js`          | readState/patch/log, village scan, captureCurrentVillage |
| `src/04-resolver.js`       | DOM resolver (village switch, menu, tile, card, href)    |
| `src/05-navigate.js`       | `humanClick`, `navigate`, `waitNav`                      |
| `src/06-runner.js`         | task queue, state machine, watchdog, rotation            |
| `src/07-plugins-api.js`    | `registerPlugin`, freeze override registry               |
| `src/08-ui-hbbox.js`       | sidebar Heartbeat box                                    |
| `src/09-ui-settings.js`    | settings (placeholder)                                   |
| `src/10-ui-debug.js`       | debug panel                                              |
| `src/11-api.js`            | `window.TC` surface                                      |
| `src/plugins/Heartbeat.js` | internal driver plugin (8 lines)                         |
| `src/12-bootstrap.js`      | `tick()`, `init()`                                       |

### 3.2 Farm Manager v2 (target, 19 files)

| File                                              | Contents (from v1.8.3 source)                                                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/FarmManager/src/00-header.js`            | userscript metadata (bumped to 2.0.0) + IIFE open                                                                                                                                                                                                  |
| `plugins/FarmManager/src/01-config.js`            | FM*VERSION, FM_NS, DRIVER_PLUGIN, POLL_MS, MAX_WIDTH, PENDING_RUN_KEY, FM_STORAGE_KEY, FM_STORAGE_VERSION, FM_REQUIRES_NOVA_MIN, TTL*\_, ROTATION\_\_, LOG_BUFFER_MAX, \_logBuffer, \_logDedupMap, LOG_DEDUP_WINDOW_MS, PROFILES, plus Utils block |
| `plugins/FarmManager/src/02-adapter.js`           | **NEW** — `FM.tc` object; ONLY place touching `window.TC`                                                                                                                                                                                          |
| `plugins/FarmManager/src/03-storage.js`           | readFMData, writeFMData, fmPatch, defaultFarmData, fmState, ensureVillageBucket, makeBackup, migrateFromNovaState, **migrateV17ToV18 (new)**                                                                                                       |
| `plugins/FarmManager/src/04-troops.js`            | TROOP_LABELS, TROOP_ICON_CLASS, troopIconHTML, troopsInlineHTML, troopGridHTML, numericInputHTML, attachNumericFilter, troopCountLabel, makeList, makeTarget, computeTroopsToSend, limitTargetsByAvailableTroops, getReservedInRun                 |
| `plugins/FarmManager/src/05-human.js`             | PROFILES, profileSettings, humanType, humanTabToNext, humanClickNoNav                                                                                                                                                                              |
| `plugins/FarmManager/src/06-log.js`               | \_logKey, fmLog, clearLogBuffer, getFullLog, copyFullLog                                                                                                                                                                                           |
| `plugins/FarmManager/src/07-notify.js`            | playAlarm, showToast, fmtDuration                                                                                                                                                                                                                  |
| `plugins/FarmManager/src/08-cooldown.js`          | \_cooldown*, \_fmPanelRef, \_fmMapBoxRef, pickCooldown*, isCooldownActive, openCooldownModal, closeCooldownModal, setCooldownFreeze, clearCooldownFreeze, cancelOrphanedFarmTasks, cancelCurrentRun                                                |
| `plugins/FarmManager/src/09-import-export.js`     | exportListCompact, parseImportText, parseLossCoordinates, previewLossRemoval, removeLossTargets, previewImport, importListToTarget, importListFromText                                                                                             |
| `plugins/FarmManager/src/10-map-box.js`           | extractMapTarget, injectFarmBoxOnMap                                                                                                                                                                                                               |
| `plugins/FarmManager/src/11-rally-panel.js`       | isRally*, shouldShowFarmPanel, renderRallyRunStatus, pauseActiveRun, injectFarmPanel (\*\*including all render* helpers and startRun\*\*), openEditTargetDialog, openExportModal, openImportModal                                                  |
| `plugins/FarmManager/src/12-run-controller.js`    | savePausedRun, applyResultAndMaybeFinish, markTargetInvalidAndMaybeFinish, stopRunDueToNoTroops, restoreHeartbeatAfterRun, enqueueRunTasks, resumeRunIfPending                                                                                     |
| `plugins/FarmManager/src/13-arrive-handler.js`    | detectSendTroopsForm, detectConfirmForm, detectInvalidVillageError, isFarmRunActive, handleFarmArrive                                                                                                                                              |
| `plugins/FarmManager/src/14-pending-report.js`    | checkPendingReport, notifyRunComplete, showFinalReport, closeFinalReportModal, readOwnTroopsSnapshot, captureSnapshot                                                                                                                              |
| `plugins/FarmManager/src/15-debug-tab.js`         | registerFarmDebugTab, renderFarmDebug, bindFarmDebug                                                                                                                                                                                               |
| `plugins/FarmManager/src/16-heartbeat-wrapper.js` | installHeartbeatWrapper, findActiveFarmTask, installFreezeOverride                                                                                                                                                                                 |
| `plugins/FarmManager/src/17-public-api.js`        | `installPublicApi(TC)` function that builds `window.FM`                                                                                                                                                                                            |
| `plugins/FarmManager/src/18-bootstrap.js`         | injectStyles, mapDialogSignature, attachMapObserver, attachRallyObserver, live, boot, migrateV17ToV18 call, IIFE close                                                                                                                             |
| `plugins/FarmManager/build.js`                    | concat-only build for FarmManager.user.js                                                                                                                                                                                                          |
| `plugins/FarmManager/FarmManager.user.js`         | build output (committed)                                                                                                                                                                                                                           |
| `plugins/FarmManager/README.md`                   | short description                                                                                                                                                                                                                                  |
| `plugins/FarmManager/CHANGELOG.md`                | version history                                                                                                                                                                                                                                    |

**Note on numbering:** `00..18` = **19 files**. Earlier drafts said "18"; that was a counting error.

**Note on `startRun`:** In v1.8.3, `startRun` is nested inside `injectFarmPanel`
and depends on its closure (`activeList`, `renderAll`, `renderProgress`,
`setActive`, etc.). It MUST remain inside `11-rally-panel.js` to preserve
behavior. Moving it breaks the closure.

**Note on `window.FM`:** In v1.8.3, `window.FM = { ... }` is defined inside
`boot()` and captures `TC` as a parameter. In v2, `17-public-api.js` defines
`installPublicApi(TC)` and `boot()` calls it. The resulting `window.FM` shape
is identical.

---

## 4. Connection Contract (window.TC)

Farm Manager may only use these `window.TC` members (all feature-detected in `02-adapter.js`):

| Member                                     | Usage in FM                                                   |
| ------------------------------------------ | ------------------------------------------------------------- |
| `TC.version`                               | compatibility check                                           |
| `TC.page()`                                | current page type                                             |
| `TC.village()`                             | current village id                                            |
| `TC.villageLabel(vid)`                     | UI label                                                      |
| `TC.state()`                               | read Nova state (for freeze check, etc.)                      |
| `TC.patch(fn)`                             | mutate Nova state (plugin metadata, heartbeat.nextRotationAt) |
| `TC.enqueue(task)`                         | queue a farm task                                             |
| `TC.cancel(taskId)`                        | cancel a farm task                                            |
| `TC.registerPlugin(id, handlers)`          | register the Heartbeat wrapper                                |
| `TC.humanClick(el, opts)`                  | human-like click (used indirectly)                            |
| `TC.flash(msg)`                            | toast in Nova                                                 |
| `TC.log(src, msg)`                         | log to Nova's buffer                                          |
| `TC.captureCurrentVillage()`               | capture current village state                                 |
| `TC.freezeOverride.register(id, fn, desc)` | override Nova freeze in tt=2                                  |
| `TC.heartbeat.setOn(v)`                    | turn Heartbeat on/off                                         |
| `TC.tests.register(id, cfg)`               | register debug tab                                            |

Anything else FM needs must be implemented locally.

---

## 5. Storage Schema

### 5.1 Farm Manager (independent)

`localStorage['travian_farm_manager_data_v18']`:

```js
{
  _version: 18,
  _updatedAt: <ms>,
  enabled: true,
  settings: {
    waveDelayMs, maxWavesPerRun, heroFollow, autoEnableHeartbeat,
    restoreHeartbeatAfterRun, soundEnabled, notificationsEnabled, profile
  },
  byVillage: {
    "<vid>": {
      lists: [ { id, name, troops, heroFollow, autoFill, cooldown, targets, pausedRun, createdAt } ],
      activeListId: "<id>",
      lastRunAt: <ms>,
      snapshot: { t1..t11, freeCrop? },
      snapshotAt: <ms>
    }
  },
  runs: [],
  runInProgress: null | { ... },
  backups: [ { at, reason, byVillage, settings } ], // max 5
  _heartbeatWasEnabled: null | boolean,
  _pendingFinalReport: null | { ... },
  _navigateToTt0AfterRun: false,
  _endOfRunHandled: false,
  _activeRunId: null
}
```

### 5.2 Session

`sessionStorage['fm_pending_run_v17']` (name kept as v17 for compat):

```js
{
  (id,
    sourceVid,
    listId,
    listName,
    startedAt,
    planned,
    sent,
    failed,
    skipped,
    targetIds,
    resumeTargetIds,
    troopSnapshot,
    troops,
    heroFollow,
    autoFill,
    listSnapshot,
    _sentSinceCooldown,
    _cooldownThreshold);
}
```

### 5.3 Nova (shared)

`TC.state().plugins.FarmManager = { enabled: true, version: '2.0.0', lastRunAt: <ms> }`

That's the **only** entry Farm Manager writes into Nova's state.
If Nova is reset (user calls `TC.hardReset()`), FM data survives because it
lives in its own key.

### 5.4 Migration v17 → v18

`03-storage.js` defines:

```js
function migrateV17ToV18() {
  const OLD_KEY = "travian_farm_manager_data_v17";
  const NEW_KEY = "travian_farm_manager_data_v18";
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return false;
    if (localStorage.getItem(NEW_KEY)) return false;
    const old = JSON.parse(raw);
    old._version = 18;
    localStorage.setItem(NEW_KEY, JSON.stringify(old));
    return true;
  } catch (e) {
    return false;
  }
}
```

Called once in `18-bootstrap.js` **before** `migrateFromNovaState(TC)`.

---

## 6. Task Queue Format

FM enqueues tasks with this shape:

```js
FM.tc.enqueue({
  id: `fm_${runId}_${targetId}`,
  plugin: "Heartbeat",
  priority: 9,
  villageId: sourceVid,
  target: {
    page: "build",
    village: sourceVid,
    params: { gid: "16", tt: "2" },
  },
  payload: {
    rotation: true,
    farm: {
      runId,
      listId,
      listName,
      sourceVid,
      targetId,
      targetName,
      x,
      y,
      troops,
      heroFollow,
      autoFill,
    },
  },
  ttlMs: dynamicTtl, // max(15min, N*45s), capped at 6h
});
```

---

## 7. State Machines

### 7.1 Run lifecycle (v1.8.3 — to be refined in v2.1+)

```
idle
  → [startRun] preparing
  → running
      ├── cooldown       (temporary; resumes running)
      ├── paused-no-troops → finished (with pending targets)
      └── finished       (all targets processed)
  → navigating-to-report (to tt=0)
  → showing-report
  → idle
```

Current flags (v1.8.3):

- `runInProgress` (object) — active run state
- `_activeRunId` — id of active run (or null)
- `_endOfRunHandled` — run is done, ignore stale tasks
- `_navigateToTt0AfterRun` — must navigate to tt=0
- `_pendingFinalReport` — report data waiting to be shown

**Future improvement (not in v2.0.0):** consolidate into a single `run.status` field.

### 7.2 Task lifecycle (Nova-driven)

```
queued → NAVIGATING → EXECUTING → done
                  ↘ fail (retry up to 3)
                  ↘ ttl-expired (watchdog)
```

FM payload uses `rotation: true` so Nova does not skip busy villages.

### 7.3 Cooldown

```
armed (sentSinceCooldown=0, threshold=random[min,max])
  → after each successful confirm: sentSinceCooldown++
  → when sentSinceCooldown >= threshold:
      - freeze Nova heartbeat
      - show cooldown modal with countdown
      - when countdown ends: unfreeze, reset counter, resume
```

`freeze` uses `reason='fm-cooldown'` so it does not conflict with Nova's own freezes.

---

## 8. DOM Selectors (verified from tt0/tt1/tt2 samples)

| Selector                                              | Purpose                   | Verified in   |
| ----------------------------------------------------- | ------------------------- | ------------- |
| `#build.gid16`                                        | rally point page root     | tt0, tt1, tt2 |
| `#content`                                            | content wrapper           | tt0, tt1, tt2 |
| `#closeContentButton`                                 | back to dorf2             | tt0, tt1, tt2 |
| `.contentNavi.subNavi a.tabItem`                      | tab links (tt=0,1,2,3)    | tt0, tt1, tt2 |
| `table.troop_details`                                 | a row of troop info       | tt1           |
| `table.troop_details.inReturn`                        | incoming return           | tt1           |
| `table.troop_details.outRaid`                         | outgoing raid             | tt1           |
| `table.troop_details[data-vid="3"]`                   | "Own troops" table        | tt1           |
| `table.troop_details[data-did]`                       | village id on troop table | tt1           |
| `#troops input[name="troop[t1]"]` … `t11`             | send-troops inputs        | tt2           |
| `#xCoordInput`, `#yCoordInput`                        | coordinates               | tt2           |
| `input[name="eventType"][value="4"]`                  | Raid radio                | tt2           |
| `#ok`                                                 | Send button               | tt2           |
| `#enterVillageName`                                   | village autocomplete      | tt2           |
| `.dialogWrapper[data-context="map"] #tileDetails`     | map tile details          | (map)         |
| `#sidebarBoxVillageList .listEntry.village[data-did]` | village list              | (all)         |

**Note:** troop inputs on Travian side have `maxlength="6"`, not 5.
FM's own template inputs currently use `maxlength="5"` — **known bug**,
NOT fixed in v2.0.0. Logged as bug #1 below.

---

## 9. Known Bugs & Tech Debt (to fix in future versions, NOT in v2.0.0)

| #   | Location                                                                               | Issue                                                                              | Severity                |
| --- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| 1   | `troopGridHTML` / `numericInputHTML` (v1.8.3 L863, L874)                               | `maxlength="5"` while Travian uses 6                                               | Medium                  |
| 1b  | `attachNumericFilter` (v1.8.3 L883)                                                    | `.slice(0,5)` truncates 6-digit inputs                                             | Medium                  |
| 2   | `parseLossCoordinates`                                                                 | does not accept `{x, y}` shape (only `{coords:{x,y}}`)                             | Low                     |
| 3   | `injectFarmBoxOnMap`                                                                   | `tile.parentNode` may be null in new DOM                                           | Low                     |
| 4   | `checkPendingReport`                                                                   | if `_pendingFinalReport` is null but `_navigateToTt0AfterRun` true, no modal shown | Medium                  |
| 5   | `enqueueRunTasks`                                                                      | `count++` only when `res` non-null; flash may be misleading                        | Low                     |
| 6   | `startRun` in `mode==='resume'`                                                        | if `l.pausedRun` null, silently starts normal run                                  | Low                     |
| 7   | `cancelOrphanedFarmTasks` (boot)                                                       | can cancel tasks created during the 3s wait                                        | Medium                  |
| 8   | `stopRunDueToNoTroops`                                                                 | cooldown modal not closed                                                          | Low                     |
| 9   | `applyResultAndMaybeFinish`                                                            | `_heartbeatWasEnabled` not set                                                     | Medium                  |
| 10  | `mapDialogSignature`                                                                   | two same-name villages → no update                                                 | Low                     |
| 11  | `handleFarmArrive`                                                                     | ~150 lines; hard to debug                                                          | High (refactor later)   |
| 12  | `computeTroopsToSend` + `limitTargetsByAvailableTroops`                                | duplicated logic                                                                   | Medium (refactor later) |
| 13  | `humanClickNoNav`                                                                      | duplicates Nova's `humanClick`                                                     | Medium (dedup later)    |
| 14  | `window.FM` only exists after `boot` succeeds                                          | if TC missing, `FM.diag()` unavailable                                             | Low (design note)       |
| 15  | `_endOfRunHandled` + `_activeRunId` + `_navigateToTt0AfterRun` + `_pendingFinalReport` | four parallel flags — fragile                                                      | High (refactor later)   |

---

## 10. Testing Checklist

Before every commit, manually test:

### 10.1 Baseline run (no cooldown)

1. Load Travian dorf2 → tt=0
2. Add 3 targets with enough troops
3. Click Start Raid
4. Confirm each target gets filled and sent
5. Run finishes → navigates to tt=0 → final report modal appears

### 10.2 Cooldown

1. Set cooldown: min=2, max=2, delay 5s
2. Start a run with 5 targets
3. After 2 attacks, modal appears
4. Cancel → run stops
5. Start again → repeats

### 10.3 Out of troops

1. Add 10 targets but configure template with more troops than available
2. Start
3. Run should stop mid-way with "paused-no-troops"
4. Paused notice visible in FM panel
5. Resume after adding troops → continues from where it stopped

### 10.4 Orphan cleanup

1. Start a run
2. Manually call `window.TC.hardReset()` (or use debug panel)
3. FM should navigate to tt=0 and show report (no orphaned tasks)

### 10.5 Invalid village

1. Add a target with fake coords (e.g., 999|999)
2. Start
3. Travian shows "no village at these coordinates"
4. FM should mark target invalid and continue

### 10.6 Migration v17 → v18

1. Set `localStorage['travian_farm_manager_data_v17']` to a fake object with lists
2. Load the page
3. FM should read v17, write v18, keep v17 intact
4. Old data should be visible in FM panel

### 10.7 End-of-run → tt=0 (bug #2, fixed in 2.1.2)

1. Start a run whose **last** target confirms successfully
2. Travian redirects to `build.php?id=39&gid=16&tt=1` after the final "Send troops"
3. FM must navigate to `build.php?id=39&gid=16&tt=0` and show the final report modal
   (before 2.1.2 the navigation was gated on `tt=2`, so the browser stayed on `tt=1`)
4. Repeat for the out-of-troops stop and the invalid-last-target stop

### 10.8 Syntax check

```bash
node --check plugins/FarmManager/FarmManager.user.js
```

### 10.8 Grep checks

```bash
grep -l "window.TC" plugins/FarmManager/src/*.js
# Expected: only 02-adapter.js

grep -l "travian_farm_manager_data_v18" plugins/FarmManager/src/*.js
# Expected: only 01-config.js + 03-storage.js

grep -l "travian_farm_manager_data_v17" plugins/FarmManager/src/*.js
# Expected: only 03-storage.js

grep -l "fm_pending_run_v17" plugins/FarmManager/src/*.js
# Expected: only 01-config.js

grep -E "^\s*(import|export)\s" plugins/FarmManager/src/*.js
# Expected: zero matches
```

---

## 11. Build & Release

```bash
cd plugins/FarmManager
node build.js
node --check FarmManager.user.js
```

Release:

1. Bump `FM_VERSION` in `01-config.js` and `00-header.js`.
2. Update `CHANGELOG.md`.
3. `git commit -m "release(fm): v2.0.0"`
4. Push.

Output `FarmManager.user.js` is committed.

---

## 12. Migration Path (v1.8.3 → v2.0.0)

| Aspect             | v1.8.3                          | v2.0.0                           |
| ------------------ | ------------------------------- | -------------------------------- |
| File               | single 4939-line userscript     | 19 files in `src/` + build.js    |
| Storage key        | `travian_farm_manager_data_v17` | `travian_farm_manager_data_v18`  |
| Pending key        | `fm_pending_run_v17`            | `fm_pending_run_v17` (unchanged) |
| Public API         | `window.FM`                     | `window.FM` (identical shape)    |
| `window.TC` access | scattered                       | only in `02-adapter.js`          |
| Behaviour          | v1.8.3 semantics                | preserved; no new features       |

Migration is automatic (see §5.4). Old v17 key is left intact for rollback.

---

## 13. Open Questions for Future Versions

- Should FM support multi-village concurrent runs? (Currently singleton.)
- Should run state machine be explicit (`run.status`)?
- Should `humanClickNoNav` defer to Nova's `humanClick`?
- Should FM push its own logs into Nova's log buffer or keep separate?
- Should the cooldown freeze be replaced with a Nova "pause" API?
- Should 19 files be reduced? (`startRun` must stay nested in `11-rally-panel.js`.)
- Should utils be extracted to a shared `src/shared/` in Nova core?

---

## 14. References

- Nova Heartbeat source: `src/`
- Nova Heartbeat plugin guide: `docs/PLUGINS.md`
- Nova Heartbeat external plugin guide: `docs/EXTERNAL-PLUGINS.md`
- Reference external plugin: `plugins/Nova-Builder/`
- Travian DOM samples: `private-doc/travian-document/Rally Point-tt{0,1,2}.txt`
- Original Farm Manager v1.8.3: `backup/Nova Farm Manager (1.8.3)-1.8.3.user.js`
- Bug analysis: `private-doc/03-bug-analysis.md`
- Core Nova doc: `private-doc/01-core-nova.md`
