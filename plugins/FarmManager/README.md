# Nova Farm Manager

External plugin for Nova Heartbeat. See [EXTERNAL-PLUGINS.md](../../docs/EXTERNAL-PLUGINS.md).

## Status

- Version: 2.1.2 (modularized from 1.8.3)
- Source: `src/` (19 files, `00-header.js` … `18-bootstrap.js`)
- Build: `cd plugins/FarmManager && node build.js` (or `node plugins/FarmManager/build.js`)
- Output: `FarmManager.user.js` (committed)
- Requires: Nova Heartbeat `>= 0.0.3` (`FM_REQUIRES_NOVA_MIN`)
- Tampermonkey name: `Nova Farm Manager (V 2.1.2)`

### Recent fixes

- **2.1.2** — end-of-run navigation to `build.php?id=39&gid=16&tt=0`
  (`isRallyAnyTab()` + direct `goToReport()` after the last confirm).
- **2.1.1** — Nova `TC.pluginLock` during a run (no mid-run village switch) and
  `farm-list-v1` support in the "Remove villages with losses" importer.
- **2.1.0** — run lifecycle state machine (`transitionRun`), troop accounting,
  Cool Down freeze fix.

Full history: [`CHANGELOG.md`](./CHANGELOG.md).


## Architecture

- `src/02-adapter.js` is the **only** file that touches `window.TC`. Every other
  file goes through `FM.tc.*`.
- Storage is independent: `localStorage['travian_farm_manager_data_v18']`
  (auto-migrated from `..._v17`, which is left intact).
- The only value written into Nova's state is
  `TC.state().plugins.FarmManager = { enabled, version, lastRunAt }`.
- Public API (`window.FM`) is installed by `installPublicApi(TC)` in
  `src/17-public-api.js`; its shape is unchanged from 1.8.3 (additive: `FM.tc`).

## Verification

```bash
node build.js
node --check FarmManager.user.js
```

Manual browser tests are listed in
[docs/KNOWLEDGE-TRANSFER.md](../../docs/KNOWLEDGE-TRANSFER.md) §10.

