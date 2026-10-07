// ═══════════════════════════════════════════════════════════
// 11-api.js
// ═══════════════════════════════════════════════════════════

  window.TC = {
    version: VERSION, sessionId: SESSION_ID, tabId: MY_TAB,
    enqueue, cancel: cancelTask, list: listTasks,
    registerPlugin, navigate, humanClick, isOnTarget,
    page: pageType, village: curVillageId, villageLabel: vLabel,
    state: readState, patch,
    Resolver,
    captureCurrentVillage,
    readResources, readMaxStorage, readMovements, readBuildingList,
    flash, logs: () => readState().logs,
    clearLogs: () => patch(s => { s.logs = []; }),
    hardReset,
    isHub, isResourceGid, getTargetHub,
    heartbeat: {
      isOn: () => readState().heartbeat.enabled,
      setOn: v => { patch(s => s.heartbeat.enabled = !!v); renderHB(); },
      forceRotation: () => document.getElementById('novaHBBox')?.querySelector('.nova-hb-force')?.click(),
      getAutoUnfreezeMs: () => readState().heartbeat.autoUnfreezeMs || CFG.AUTO_UNFREEZE_MS,
      setAutoUnfreezeMs: ms => { patch(s => s.heartbeat.autoUnfreezeMs = Math.max(1000, ms|0)); renderHB(); },
      getFreezeInfo: () => freezeInfo(),
      unfreezeNow: () => { patch(st => { st.heartbeat._frozenAt = 0; st.heartbeat._frozenReason = null; st.heartbeat._frozenMessage = null; }); renderHB(); },
      isAllowHiddenTab: () => readState().heartbeat.allowHiddenTab === true,
      setAllowHiddenTab: v => { patch(st => { st.heartbeat.allowHiddenTab = !!v; }); updateHBToggleStyles(); renderHB(); },
    },
    freezeOverride: {
      register: registerFreezeOverride,
      unregister: unregisterFreezeOverride,
      list: listFreezeOverrides,
      check: checkFreezeOverride,
    },
    tests: {
      register: (id, cfg) => registerDebugTab(id, cfg),
      panel: () => document.getElementById('tcTestPanel'),
      toggle: () => toggleDebugPanel()
    },
    debug: {
      enabled: () => isDebugEnabled(),
      enable: () => enableDebug(),
      disable: () => disableDebug(),
      toggle: () => { if (isDebugEnabled()) disableDebug(); else enableDebug(); },
    },
    canAct, isPopupOpen, logNormal, log, esc, clockOf,
    fmtDuration, fmtAge, fmtTimer, fmtSec,
    isFlagActive, freezeInfo, computeFreezeState, isVillageBusy, decideFromHub,
    waitForHubStable,
    isDomReadyForDorf,
    isDebugEnabled,
    randomDelay, waitFor,
    computeWaitState,
  };

