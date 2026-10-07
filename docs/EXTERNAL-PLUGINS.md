# Nova Heartbeat — External Plugin Guide

Nova Heartbeat supports **two kinds of plugins**:

| Kind | Location | How it runs | Build step |
|------|----------|-------------|------------|
| **Internal** | `src/plugins/<Name>.js` | Concatenated **inside** the core IIFE, shares the core closure | `node build.js` |
| **External** | `plugins/<Name>/<Name>.user.js` | A **separate userscript** that talks to the core via `window.TC` | none (source = dist) |

For internal plugins see [PLUGINS.md](./PLUGINS.md). This document covers
**external** plugins — the recommended way to ship an optional or independent
feature (reference implementation: **Nova Builder**).

---

## 1. Why a separate script?

- **No name collisions.** An external plugin has its own scope; it never shares
  the core's closure (`$`, `CFG`, `VERSION`, `log`, `esc`, …). Merging a plugin
  into the bundle would force renaming all of these.
- **Independent release cadence.** Its own `@version`, `@updateURL`,
  `@downloadURL` — it updates without rebuilding the core.
- **Parallel development.** Two authors, two files, one repository.
- **Smaller blast radius.** A bug in an external plugin cannot break the core
  bundle.

---

## 2. The connection contract

The core exposes a public API on `window.TC` (see `src/11-api.js`). An external
plugin loads **independently** of the core (it may run before or after it), so it
must wait for `window.TC` before registering.

### 2.1 Wait for the core

```js
function waitForHeartbeat(ms) {
  return new Promise(resolve => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (window.TC && window.TC.registerPlugin) { clearInterval(iv); resolve(window.TC); }
      else if (Date.now() - start > ms) { clearInterval(iv); resolve(null); }
    }, 100);
  });
}
```

### 2.2 Register

```js
const TC = await waitForHeartbeat(10000);
if (!TC) { console.error('[MyPlugin] Heartbeat not loaded within 10s'); return; }

TC.registerPlugin('MyPlugin', {
  onArrive,     // required — the core will not run a job whose plugin lacks it
  onComplete,   // optional
  onFail,       // optional
  onDecide,     // optional
});
```

The hooks and their return values are identical to internal plugins — see
[PLUGINS.md §3](./PLUGINS.md).

### 2.3 State

Keep all of the plugin's state under `TC.state().plugins.<Name>` and mutate it
through `TC.patch`:

```js
const s = TC.state();
s.plugins = s.plugins || {};
if (!s.plugins.MyPlugin) s.plugins.MyPlugin = { /* defaults */ };

TC.patch(st => { st.plugins.MyPlugin.enabled = true; });
```

---

## 3. `window.TC` reference

`window.TC` is defined in `src/11-api.js`. Current surface:

| Member | Purpose |
|--------|---------|
| `version`, `sessionId`, `tabId` | Core identity / cross-tab session info |
| `enqueue(task)`, `cancel(id)`, `list()` | Job queue |
| `registerPlugin(id, handlers)` | Register this plugin with the core |
| `navigate`, `humanClick`, `isOnTarget` | Navigation helpers |
| `page()`, `village()`, `villageLabel(id)` | Page / village helpers |
| `state()`, `patch(fn)` | Read / mutate shared state |
| `Resolver`, `captureCurrentVillage` | DOM resolution + village capture |
| `readResources`, `readMaxStorage`, `readMovements`, `readBuildingList` | Page readers |
| `flash(msg)`, `log(source, msg)`, `logs()`, `clearLogs()` | UI feedback & logging |
| `hardReset`, `isHub`, `isResourceGid`, `getTargetHub` | Misc core helpers |
| `heartbeat.*` | Heartbeat toggle / freeze control |
| `freezeOverride.*` | Freeze-override registry |
| `tests.register(id, cfg)`, `tests.panel()`, `tests.toggle()` | Debug panel tabs |
| `debug.enabled/enable/disable/toggle()` | Debug mode |
| `canAct`, `isPopupOpen`, `esc`, `clockOf`, `fmtDuration`, `fmtAge`, `fmtTimer`, `fmtSec` | Utilities |
| `isFlagActive`, `freezeInfo`, `computeFreezeState`, `isVillageBusy`, `decideFromHub`, `waitForHubStable`, `isDomReadyForDorf`, `isDebugEnabled`, `randomDelay`, `waitFor`, `computeWaitState` | Decision / timing helpers |

> **Compatibility:** always feature-detect before calling
> (`if (TC && typeof TC.fmtDuration === 'function') …`). Nova Builder does this so
> it degrades gracefully if a core helper is missing.

---

## 4. Adding an external plugin — step by step

1. Create `plugins/<Name>/<Name>.user.js` with a full `==UserScript==` header:
   - `@name`, `@namespace`, `@version`, `@description`, `@author`
   - your own `@match` lines
   - `@grant none` and `@run-at document-idle`
   - `@updateURL` / `@downloadURL` pointing at the raw repo URL of this file
2. Wrap everything in an IIFE. Declare **no** globals other than `window.TC`
   (read-only) and your own namespaced state.
3. `waitForHeartbeat(...)` → `TC.registerPlugin(...)`.
4. (Optional) register a debug tab:
   `TC.tests.register('<name>', { label, render })`.
5. Syntax-check: `node --check plugins/<Name>/<Name>.user.js`.
6. Add a short `plugins/<Name>/README.md`.

---

## 5. Checklist

- [ ] File at `plugins/<Name>/<Name>.user.js`
- [ ] `==UserScript==` header with `@updateURL` / `@downloadURL`
- [ ] `waitForHeartbeat` → `TC.registerPlugin`
- [ ] State under `TC.state().plugins.<Name>`
- [ ] No globals leaked (everything inside an IIFE)
- [ ] `node --check plugins/<Name>/<Name>.user.js` passes
- [ ] `plugins/<Name>/README.md` present
- [ ] `CHANGELOG.md` updated

---

## 6. Reference implementation

**Nova Builder** — `plugins/Nova-Builder/Nova-Builder.user.js`.
It depends on this `window.TC` subset: `state`, `patch`, `enqueue`, `cancel`,
`registerPlugin`, `readBuildingList`, `humanClick`, `village`, `villageLabel`,
`fmtDuration`, `flash`, `log`, `sessionId`, `tests`.
