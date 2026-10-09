# Nova Builder

External plugin (userscript) for **Nova-Heartbeat**.

Nova Builder converts *construct-to-upgrade*: it finds buildings that can be
upgraded and drives the build → confirm → verify flow through the core's job
queue. It does **not** run on its own — it plugs into Nova-Heartbeat through the
public `window.TC` API.

## Install

1. Install the core first: **[Nova-Heartbeat.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js)**
2. Install this plugin: **[Nova-Builder.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js)**
3. Open Travian — the Builder box appears and registers itself with the core.

> Requires Nova-Heartbeat to be loaded. Builder waits up to 10 s for
> `window.TC` and logs `[Nova Builder] Heartbeat not loaded within 10s` if the
> core is missing.

## How it connects

- `@run-at document-idle`, plain IIFE, `@grant none`, no globals.
- Polls `window.TC` (`waitForHeartbeat`) → `TC.registerPlugin('Builder', { … })`.
- All state lives under `TC.state().plugins.Builder` (seeded by Builder itself).
- A debug tab registers via `TC.tests.register('builder', …)` when the core's
  debug mode (`nova_debug`) is on.

### `window.TC` members used
`state`, `patch`, `enqueue`, `cancel`, `registerPlugin`, `readBuildingList`,
`humanClick`, `village`, `villageLabel`, `fmtDuration`, `flash`, `log`,
`sessionId`, `tests`.

## Development

- **Source *is* the shipped file**: `plugins/Nova-Builder/Nova-Builder.user.js`.
  There is no build step for this plugin (unlike the core, which is assembled
  from `src/` by `build.js`).
- Edit the file, then syntax-check:
  ```bash
  node --check plugins/Nova-Builder/Nova-Builder.user.js
  ```
- Reload the userscript in Tampermonkey and refresh the Travian tab.

## Versioning

- The version lives in the `@version` header (used by Tampermonkey for updates)
  and in the internal `VERSION` constant (used in log output). The `@name` also
  ends with the version: `Nova Builder (V 2.0.3.16)`.
- Updates independently of the core via `@updateURL` / `@downloadURL`.

## Changelog

### 2.0.3.16 — 2026-10-09

- **Orphaned `BUILDING` item fallback** (`onTick`): if the item's `buildEndsAt`
  has passed and the village's `buildQueue` data is stale (`bqFresh === false`,
  i.e. the village has not been visited for a while), the item is marked `DONE`.
  Without it a phantom "🔨 building…" stayed in the box forever and
  `maybeReturnToHubWhenIdle()` never ran (`queue.length > 0`).
  New constant `CFG.BUILDING_STALE_DONE_MS = 10 min`.
- Version added to `@name` (`Nova Builder (V 2.0.3.16)`).
- Pairs with **Nova core 0.0.4**, which no longer lets a `BUILDING` job hold the
  runner queue until the build finishes (that was the reason a build in one
  village stopped the queue from moving on to the next village).

### 2.0.3.15

- `isOwned` improvements via `slotId`; builder box/queue sync fixes.


## See also

- [docs/EXTERNAL-PLUGINS.md](../../docs/EXTERNAL-PLUGINS.md) — how external plugins work.
- [docs/PLUGINS.md](../../docs/PLUGINS.md) — internal (in-bundle) plugins.
