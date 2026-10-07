// ═══════════════════════════════════════════════════════════
// 07-plugins-api.js
// ═══════════════════════════════════════════════════════════

  const plugins = new Map();
  const _registeredThisSession = new Set();
  function registerPlugin(id, handlers) {
    plugins.set(id, handlers || {});
    if (!_registeredThisSession.has(id)) {
      _registeredThisSession.add(id);
      log('sys', `plugin registered: ${id}`);
    }
  }


  const FREEZE_PAGES = [
    { id: 'karte', match: (pt, u) => pt === 'karte', message: 'Frozen · Map View', short: 'Map' },
    { id: 'marketplace', match: (pt, u) => pt === 'build' && u.searchParams.get('gid') === '17' && u.searchParams.get('t') === '5', message: 'Frozen · Market Busy', short: 'Market' },
    { id: 'rallypoint', match: (pt, u) => pt === 'build' && u.searchParams.get('gid') === '16' && u.searchParams.get('tt') === '2', message: 'Frozen · War Room', short: 'Rally' },
  ];

  const _freezeOverrides = new Map();

  function registerFreezeOverride(pluginId, matchFn, description) {
    if (!pluginId || typeof matchFn !== 'function') {
      console.error('[NovaHB] registerFreezeOverride: invalid args');
      return false;
    }
    _freezeOverrides.set(pluginId, { match: matchFn, description: description || '' });
    log('sys', `freeze-override registered: ${pluginId} (${description || 'no-desc'})`);
    return true;
  }
  function unregisterFreezeOverride(pluginId) {
    const had = _freezeOverrides.delete(pluginId);
    if (had) log('sys', `freeze-override unregistered: ${pluginId}`);
    return had;
  }
  function listFreezeOverrides() {
    return Array.from(_freezeOverrides.entries()).map(([id, cfg]) => ({
      id,
      description: cfg.description,
    }));
  }
  function checkFreezeOverride() {
    const pt = pageType();
    const u = new URL(location.href);
    for (const [pluginId, cfg] of _freezeOverrides.entries()) {
      try {
        if (cfg.match(pt, u)) {
          return { pluginId, description: cfg.description };
        }
      } catch (e) {
        console.error(`[NovaHB] freeze-override ${pluginId} threw:`, e);
      }
    }
    return null;
  }

  function computeFreezeState() {
    const pt = pageType();
    const u = new URL(location.href);

    const override = checkFreezeOverride();
    if (override) {
      return { frozen: false, override: override.pluginId };
    }

    for (const p of FREEZE_PAGES) {
      if (p.match(pt, u)) return { frozen: true, id: p.id, message: p.message, short: p.short };
    }
    return { frozen: false };
  }
  function freezeInfo() {
    const s = readState();
    if (!s.heartbeat._frozenAt) return null;
    const elapsed = now() - s.heartbeat._frozenAt;
    const autoMs = s.heartbeat.autoUnfreezeMs || CFG.AUTO_UNFREEZE_MS;
    const remain = Math.max(0, autoMs - elapsed);
    return { since: s.heartbeat._frozenAt, reason: s.heartbeat._frozenReason, message: s.heartbeat._frozenMessage, elapsed, remain, autoMs, expired: remain <= 0 };
  }
  function maybeFreezeTick() {
    const f = computeFreezeState();
    const s = readState();
    if (f.frozen) {
      if (!s.heartbeat._frozenAt) {
        patch(st => { st.heartbeat._frozenAt = now(); st.heartbeat._frozenReason = f.id; st.heartbeat._frozenMessage = f.message; });
        log('sys', `❄ frozen on ${f.short}`);
      }
    } else {
      if (s.heartbeat._frozenAt) {
        log('sys', 'unfrozen — left critical page');
        patch(st => { st.heartbeat._frozenAt = 0; st.heartbeat._frozenReason = null; st.heartbeat._frozenMessage = null; });
      }
    }
    return f;
  }

  function installUserTracker() {
    const handler = e => {
      if (_scriptClick) return;
      const t = e.target;
      if (!t) return;
      if (t.closest('#novaHBBox') || t.closest('#novaBldBox') || t.closest('#tcTestPanel')) return;
      if (!t.closest('button, a, input, select, textarea, [role="button"]')) return;
      _lastUserClickAt = now();
      ssSet(SS_PAGE_MARK, 'manual');
      const curVid = curVillageId();
      if (curVid) {
        ssSet(SS_ROT_FROM, curVid);
        ssSet(SS_ROT_AT, now());
      }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('mousedown', handler, true);
  }

