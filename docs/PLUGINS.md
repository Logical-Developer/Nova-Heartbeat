# Nova Heartbeat — Plugin Development Guide

Nova Heartbeat is a **core** (the userscript itself) that runs **plugins**.
A plugin is a small file that registers itself with the core and receives
callbacks while a *job* travels through the navigation/state machine.

> Rules (see `.clinerules`): no `import`/`export`, no TypeScript, no bundler.
> The build is a plain concatenation of `src/` files into a single IIFE.

---

## 1. How the core and plugins fit together

Everything lives inside **one IIFE**:

```
src/00-header.js   →  opens the IIFE  (function () { 'use strict';
src/01..11-*.js    →  core (config, state, runner, UI, API)
src/plugins/*.js   →  plugin files  (call registerPlugin(...) at top level)
src/12-bootstrap.js→  closes the IIFE  })();
```

Because there are no modules, a plugin **shares the core's closure scope**.
It can directly call any core function visible in that scope
(e.g. `captureCurrentVillage()`, `readResources()`, `navigate()`, `log()`, `now()`,
`Resolver`, `readState()`, `patch()` …). A template is provided at
`src/plugins/_template.js`.

The core also exposes a public API on `window.TC` (see `src/11-api.js`),
including `window.TC.registerPlugin` and `window.TC.enqueue`, so a plugin
*written outside* the bundle can register itself too.

---

## 2. Registering a plugin

```js
registerPlugin('Builder', {
  onDecide,   // optional
  onArrive,   // required (the core will not run a job whose plugin lacks it)
  onComplete, // optional
  onFail,     // optional
});
```

`registerPlugin(id, handlers)` stores `handlers` in a `Map` keyed by `id`
(`src/07-plugins-api.js`). The `id` is the string you use in `enqueue({ plugin: id })`.

---

## 3. The plugin contract (hooks)

| Hook | Signature | When the core calls it | Must return |
|------|-----------|------------------------|-------------|
| `onDecide` | `(ctx) => decision` *(sync)* | On the hub, state `HUB_DECIDING`, before going to `build.php` | `{ action, delayMs?, reason? }` |
| `onArrive` | `async (ctx) => action` | On the target page: state `BUILD_EXECUTING`, and again in `VERIFYING` | an **action** object |
| `onComplete` | `({ job })` | After the job finishes successfully (`finishJob`) | — |
| `onFail` | `({ job, reason })` | After final failure (`retryOrFail`) or TTL expiry (`watchdog`) | — |

### `ctx` passed to `onArrive`
```js
{ job, target, payload, isVerify }
```
- `job`      – the current job (id, plugin, target, payload, state, attempts, …)
- `target`   – `{ page, village, params }`
- `payload`  – whatever you put in `enqueue({ payload })`, plus core-merged fields
- `isVerify` – `false` on first arrival, `true` when re-entering for verification

### `ctx` passed to `onDecide`
```js
{ job, village }   // village = the captured village snapshot from state
```

### Decisions (`onDecide` return value)
```js
{ action: 'build' }                        // proceed to build.php
{ action: 'wait',  delayMs, reason }       // pause, requeue the task
{ action: 'skip',  delayMs, reason }       // pause, requeue (alias behaviour)
{ action: 'done',  reason }                // finish the job here
```
If `onDecide` is omitted (or throws / returns nothing), the core uses its
default decision (build unless the village build-queue is full).

### Actions (`onArrive` return value) — handled by `handleAction`
```js
{ type: 'done',       reason }             // finish the job
{ type: 'wait',       delayMs, reason }    // pause & requeue (delayMs default 30000)
{ type: 'retry',      reason }             // bump attempt → retry or fail
{ type: 'fail',       reason }             // same as retry (bump attempt)
{ type: 'transition', state, extra }       // move the job to another state
```
Returning `undefined` is treated as `{ type: 'done' }`.

---

## 4. Jobs (tasks) and the state machine

You create a job with `enqueue(...)` (`src/06-runner.js`):

```js
enqueue({
  plugin: 'Builder',        // must equal your registerPlugin id
  priority: 5,              // higher = picked sooner
  villageId: '1234',        // or target.village
  target: { page: 'build', village: '1234', params: { gid: 17, t: 5 } },
  payload: { /* your data */ },
  requiresFlag: 'heartbeat',// 'heartbeat' | 'plugin:Builder:enabled' | null
  ttlMs: 5 * 60 * 1000,
  delayMs: 0,
  maxAttempts: 3,
});
```

### Modern job flow (any non-`Heartbeat` plugin)
```
HUB_NAVIGATING → HUB_VISITING → HUB_DECIDING → BUILD_NAVIGATING
   → BUILD_EXECUTING → BUILD_CONFIRMING → BUILDING → VERIFYING
```
The `Heartbeat` plugin uses a **legacy** flow instead: `NAVIGATING → EXECUTING`
(see `advanceJobLegacy`). New plugins should use the modern flow.

> **`BUILDING` holds the queue for at most `CFG.BUILDING_HOLD_MS` (60 s)** — not for
> the whole build (Nova 0.0.4). While any `currentJob` exists, `pickNextJob()` and
> `rotationTick()` both return early, so waiting out a 2 h upgrade used to block
> rotation *and* every other village's queued work. The job now moves to
> `VERIFYING` after the hold (or as soon as the build ends) and releases the queue.
> Do **not** rely on `BUILDING` as a long-lived state; track your own build state
> inside `state.plugins[<id>]` (see how Builder does it with `buildEndsAt`).
> When rotation is due but a job is holding the queue, the Heartbeat box shows
> `⛔ blocked by job`.

### Flags (`requiresFlag`)
`isFlagActive(flag, state)` understands:
- `'heartbeat'`                → `state.heartbeat.enabled === true`
- `'plugin:Builder:enabled'`   → `state.plugins.Builder.enabled === true`

So a plugin can keep its own toggles under `state.plugins[<id>]`
(seeded via `DEF.plugins` in `src/01-config.js`).

---

## 5. Adding a plugin — step by step

1. **Create** `src/plugins/<Name>.js` (copy `src/plugins/_template.js`).
2. **Register** it:
   ```js
   registerPlugin('<Name>', {
     onDecide(ctx) { /* … */ return { action: 'build' }; },
     async onArrive(ctx) { /* … */ return { type: 'done', reason: 'ok' }; },
     onComplete({ job }) {},
     onFail({ job, reason }) {},
   });
   ```
3. **Add it to the build** — edit the `FILES` array in `build.js`:
   ```js
   const FILES = [
     '00-header.js',
     …
     '11-api.js',
     'plugins/Heartbeat.js',
     'plugins/<Name>.js',     // ← add here
     '12-bootstrap.js',       // must stay LAST (it closes the IIFE)
   ];
   ```
   > Plugin files **must** come before `12-bootstrap.js`, because their
   > top-level `registerPlugin(...)` call has to run *inside* the IIFE.
4. **(Optional) seed default config** in `DEF.plugins` (`src/01-config.js`):
   ```js
   plugins: {
     // Builder: { enabled: false, travianPlus: false },
   },
   ```
5. **(Optional) enqueue jobs** from anywhere in the core (e.g. a tick) via
   `enqueue({ plugin: '<Name>', … })`.
6. **Build** and test:
   ```bash
   node build.js
   node --check Nova-Heartbeat.user.js   # syntax check
   ```

### Adding a plugin that lives *outside* the bundle
A plugin can register itself at runtime through the public API:
```js
window.TC.registerPlugin('MyExt', { async onArrive(ctx) { /* … */ } });
```
This works because `window.TC` is set in `src/11-api.js`.
See [EXTERNAL-PLUGINS.md](./EXTERNAL-PLUGINS.md) for the full external-plugin guide (reference implementation: Nova Builder).

---

## 5b. Exclusive queue ownership — `TC.pluginLock` (Nova 0.0.3+)

Some plugins must be the **only** thing Nova does while they work (e.g. Farm Manager
farming a specific village: a rotation or an *urgent visit* in the middle of the run
would navigate away). For that, a plugin claims the queue:

```js
TC.pluginLock.register('FarmManager', {
  active: () => isFarmRunActive(),          // lock engaged while true
  ownsTask: (t) => !!t.payload?.farm,       // only these tasks may be picked
  label: 'Farm Manager',                    // shown in the Heartbeat box
  description: 'farm run in progress',
});
```

While `active()` returns `true`:

- `rotationTick()` is suppressed — no scheduled rotation and no *urgent visit*
  (the urgent branch used to enqueue `priority: 10` and ignore `nextRotationAt`);
  `nextRotationAt` is pushed 60 s forward so rotation does not fire right after release.
- `pickRunnableTask()` only returns tasks accepted by `ownsTask`
  (default: `t.plugin === pluginId`). Other tasks are **not** cancelled — they stay
  queued and run as soon as the lock is released.
- The Heartbeat box shows `🔒 LOCKED by <label>`.

Other members:

```js
TC.pluginLock.unregister('FarmManager');   // release + remove
TC.pluginLock.list();                      // [{ id, label, description }]
TC.pluginLock.check();                     // { pluginId, label, description, ownsTask } | null
```

Notes:

- **Additive**: plugins that never register a lock behave exactly as before.
- `active()` is called on every tick (~1.5 s) — keep it cheap (cache if it reads storage).
- A lock does **not** replace the freeze system. `TC.freezeOverride` still decides whether
  a freeze page (map / market / war room) may be worked on; the lock decides *what the
  runner may pick* and *whether rotation runs*.

---

## 6. Minimal example

```js
// src/plugins/Heartbeat.js  (the real one)
registerPlugin('Heartbeat', {
  onArrive: async (ctx) => { captureCurrentVillage(); return { type: 'done', reason: 'captured' }; }
});
```

A richer example (a hypothetical builder) would look like:

```js
registerPlugin('Builder', {
  onDecide({ job, village }) {
    if (isVillageBusy(village.villageId, readState())) {
      return { action: 'wait', delayMs: 60000, reason: 'busy' };
    }
    return { action: 'build' };
  },
  async onArrive({ job, target, payload, isVerify }) {
    if (isVerify) {
      const list = readBuildingList();
      // … confirm the build actually happened
      return { type: 'done', reason: 'verified' };
    }
    const btn = Resolver.resolve(target);
    if (!btn) return { type: 'wait', delayMs: 5000, reason: 'no-button' };
    await humanClick(btn.el);
    return { type: 'transition', state: 'BUILD_CONFIRMING' };
  },
  onComplete({ job }) { log('sys', `builder done: ${job.id}`); },
  onFail({ job, reason }) { log('sys', `builder failed: ${reason}`); },
});
```

---

## 7. Checklist for a new plugin

- [ ] File created at `src/plugins/<Name>.js`
- [ ] `registerPlugin('<Name>', { … })` present, `onArrive` implemented
- [ ] `<Name>.js` added to `build.js` `FILES` **before** `12-bootstrap.js`
- [ ] `DEF.plugins` seed added (if the plugin has settings)
- [ ] Jobs enqueued with `plugin: '<Name>'`
- [ ] `node build.js` + `node --check Nova-Heartbeat.user.js` pass
- [ ] `CHANGELOG.md` updated
