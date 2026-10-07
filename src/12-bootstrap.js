// ═══════════════════════════════════════════════════════════
// 12-bootstrap.js
// ═══════════════════════════════════════════════════════════

  // ═════ 2.0.2.21: tick — reset stateAt only for transient states ═════
  async function tick() {
    try {
      const s0 = readState();
      if (s0.currentJob && s0.currentJob.stateAt && (now() - s0.currentJob.stateAt) > 5000) {
        // only transient states are reset (BUILDING/BUILDING_VIDEO are long-lived))
        const transientStates = [
          'HUB_NAVIGATING', 'HUB_VISITING', 'HUB_DECIDING',
          'BUILD_NAVIGATING', 'BUILD_EXECUTING',
          'BUILD_CONFIRMING', 'VERIFYING',
        ];
        if (transientStates.includes(s0.currentJob.state)) {
          log('runner', `↻ page reload detected → reset stateAt for ${s0.currentJob.plugin} (state=${s0.currentJob.state})`);
          patch(st => {
            if (st.currentJob) {
              st.currentJob.stateAt = now();
            }
          });
        }
      }

      scanVillages();
      if (isHub()) captureCurrentVillage();
      watchdog();
      const f = maybeFreezeTick();
      const fi = freezeInfo();
      if (fi && fi.expired) {
        const s2 = readState();
        const lastUnfreeze = s2.heartbeat._lastUnfreezeAt || 0;
        const inCooldown = (now() - lastUnfreeze) < CFG.FREEZE_COOLDOWN_MS;
        if (inCooldown) {
          log('sys', `⏰ auto-unfreeze (cooldown active, no enqueue)`);
          patch(st => { st.heartbeat._frozenAt = 0; st.heartbeat._frozenReason = null; st.heartbeat._frozenMessage = null; });
        } else {
          log('sys', `⏰ auto-unfreeze after ${Math.round(fi.elapsed/1000)}s → dorf1`);
          patch(st => {
            st.heartbeat._frozenAt = 0;
            st.heartbeat._frozenReason = null;
            st.heartbeat._frozenMessage = null;
            st.heartbeat._lastUnfreezeAt = now();
            st.heartbeat._unfreezeFallbackAt = now();
          });
          const curVid = curVillageId();
          let enqueued = false;
          if (curVid && readState().heartbeat.enabled) {
            const sent = enqueue({ plugin: 'Heartbeat', priority: 9, villageId: String(curVid), target: { page: 'dorf1', village: String(curVid) }, payload: { rotation: true, unfreeze: true }, requiresFlag: 'heartbeat', ttlMs: 2 * 60 * 1000, createdAt: now() });
            enqueued = !!sent;
          }
          if (!enqueued) {
            log('sys', `🚪 unfreeze fallback → direct location.href = /dorf1.php`);
            setTimeout(() => {
              const stillFrozen = freezeInfo();
              if (stillFrozen && !stillFrozen.expired) {
                try { location.href = '/dorf1.php'; } catch (e) { log('sys', `fallback failed: ${e.message}`); }
              }
            }, CFG.UNFREEZE_FALLBACK_DELAY_MS);
          }
        }
      } else if (fi && !fi.expired) {
        ensureHBBox(); renderHB();
        if (isDebugEnabled() && isPanelOpen()) renderDebugPanel();
        setTimeout(tick, CFG.TICK_MS);
        return;
      }
      const s = readState();
      if (s.currentJob) {
        if (s.currentJob.plugin === 'Heartbeat') await advanceJobLegacy();
        else await advanceJob();
      } else if (s.heartbeat.enabled) {
        await pickNextJob();
      }
      ensureHBBox(); renderHB();
      if (isDebugEnabled() && isPanelOpen()) renderDebugPanel();
    } catch (e) { console.error('[NovaHB] tick error:', e); }
    setTimeout(tick, CFG.TICK_MS);
  }

  function enableDebug() {
    window.NOVA_DEBUG = true;
    try { localStorage.setItem(DEBUG_KEY, '1'); } catch {}
    const oldHB = document.getElementById('novaHBBox');
    if (oldHB) oldHB.remove();
    ensureHBBox();
    ensureDebugPanel();
    _panelTabs.set('heartbeat', {
      label: '💓 Heartbeat',
      render: renderHBDebug,
      onMount: bindHBDebug,
    });
    renderHB();
    if (isPanelOpen()) renderDebugPanel();
    flash('Debug ON');
  }
  function disableDebug() {
    window.NOVA_DEBUG = false;
    try { localStorage.removeItem(DEBUG_KEY); } catch {}
    const oldHB = document.getElementById('novaHBBox');
    if (oldHB) oldHB.remove();
    ensureHBBox();
    const p = document.getElementById('tcTestPanel');
    if (p) p.remove();
    _panelTabs.clear();
    _panelActiveTab = 'heartbeat';
    patch(s => { s.ui.panelOpen = false; });
    renderHB();
    flash('Debug OFF');
  }


  async function init() {
    window.NOVA_VERBOSE = window.NOVA_VERBOSE === true;
    await randomDelay(CFG.INIT_DELAY_MIN, CFG.INIT_DELAY_MAX);
    injectStyles();
    installUserTracker();
    ensureHBBox();
    if (isDebugEnabled()) {
      ensureDebugPanel();
      registerDebugTab('heartbeat', {
        label: '💓 Heartbeat',
        render: renderHBDebug,
        onMount: bindHBDebug,
      });
    }
    log('sys', `ready @ ${pageType()} v=${vLabel(curVillageId())} v=${VERSION} debug=${isDebugEnabled()}`);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
