# Changelog

All notable changes to Nova Heartbeat will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- External plugin structure: `plugins/<Name>/<Name>.user.js` (standalone userscripts that talk to the core via `window.TC`)
- `Nova Builder` moved to `plugins/Nova-Builder/Nova-Builder.user.js` as the first external plugin
- `docs/EXTERNAL-PLUGINS.md` — external plugin development guide
- `plugins/Nova-Builder/README.md`
- `npm run check` / `npm run check:plugins` syntax-check scripts
- CI syntax-check step for external plugins (`.github/workflows/build.yml`)

### Changed
- `Nova-Builder` userscript header: clean `@name`/`@namespace`, numeric `@version`, added `@updateURL`/`@downloadURL`

## [0.0.4] - 2026-10-09

### Fixed
- **Stuck build task — a build held the whole queue until the build finished**
  (`src/06-runner.js`, `src/01-config.js`). The `BUILDING` state kept
  `currentJob` alive until `buildEndsAt` (= build end + 5 s, watchdog
  `LIMIT_BUILDING = 4 h`). While a `currentJob` exists, `pickNextJob()` returns
  early **and** `rotationTick()` returns at `if (s.currentJob) return;` — so one
  2 h upgrade blocked rotation and every other village's queued work (Farm
  Manager raids, Builder items), while the box kept showing
  `⏱ next rotation → V0x in 0s`.
  The job now releases the queue after `CFG.BUILDING_HOLD_MS` (60 s) — or earlier
  if the build already ended — and moves to `VERIFYING`, which still verifies the
  item (level and/or build-queue membership) via `onArrive({ isVerify: true })`.
  `LIMIT_BUILDING` was reduced from 4 h to 10 min as a watchdog safety net only.

### Added
- Heartbeat box: the rotation line now shows `· ⛔ blocked by job` when rotation
  is due but a `currentJob` is holding the queue (`src/08-ui-hbbox.js`).

### Changed
- `@name` now carries the version: `Nova Heartbeat (V 0.0.4)`.
- `src/shared/04-report.js`: report-list reader is structure-agnostic
  (alliance `#offs` first, then a generic pass over `#overview` /
  `table.row_table_data` / any `tbody`), with `_sharedExtractReportRow()` and
  `_sharedNormalizeReportHref()` helpers. Fixes Attack Report Analyzer's
  "No qualifying reports found on this page" on `/report/offensive`.

## [0.0.3] - 2026-10-09

### Added
- **`TC.pluginLock` — exclusive queue ownership** (`src/07-plugins-api.js`, `src/11-api.js`).
  A plugin registers `{ active, ownsTask, label, description }`. While `active()` returns
  `true`: Nova enqueues no rotation/urgent village visits and `pickRunnableTask()` only
  returns tasks accepted by `ownsTask` — every other task stays queued and untouched.
  Additive API: plugins that never register a lock behave exactly as before.
  The Heartbeat box shows `🔒 LOCKED by <label>` while a lock is held.
  New state key `heartbeat._lastLockLog` (log dedupe).

### Fixed
- **Village switched while a plugin was working** (`src/06-runner.js`):
  `rotationTick()`'s *urgent visit* branch enqueued a `Heartbeat` task with
  `priority: 10` and never checked `nextRotationAt`, so it preempted a plugin's
  `priority: 9` tasks and navigated to another village in the middle of a run.
  Rotation (scheduled + urgent) is now suppressed while a plugin lock is active, and
  `nextRotationAt` is pushed forward so rotation does not fire the moment the lock is
  released.

## [0.0.2] - 2026-10-09

### Fixed
- **Queue starvation in `pickRunnableTask`** (`src/06-runner.js`): a task whose `readyAt`
  is still in the future (delayed `enqueue`, retry backoff, or a plugin `wait` action)
  no longer blocks the whole queue. Such tasks are now filtered out of the candidate set
  instead of making the picker return `null` — previously a single delayed task stalled
  every other ready task and handed the tick over to `rotationTick()`.

## [0.0.1] - 2026-10-07

### Added
- Initial modular release
- Automatic village rotation
- Construct-to-upgrade conversion
- Freeze pages system
- Plugin system
- Plugin development guide (`docs/PLUGINS.md`)
- Plugin template (`src/plugins/_template.js`)
- Debug panel

### Changed
- Migrated from single-file (Nova-HB-2.0.2.21) to modular structure
- Renamed project to "Nova Heartbeat"
- Started fresh versioning from 0.0.1
