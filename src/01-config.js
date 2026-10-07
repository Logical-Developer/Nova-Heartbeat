// ═══════════════════════════════════════════════════════════
// 01-config.js
// ═══════════════════════════════════════════════════════════

  const VERSION = '0.0.1';
  const SK = 'travian_nova_hb_v1';
  const DEBUG_KEY = 'nova_debug';
  const MY_TAB = 'tab_' + Math.random().toString(36).slice(2, 8);
  const LOG_MAX = 300;
  const SS_ROT_FROM = 'nova_rot_from';
  const SS_ROT_AT = 'nova_rot_at';
  const SS_PAGE_MARK = 'nova_page_mark';
  const ROT_WINDOW_MS = 30000;

  const CFG = {
    TICK_MS: 1500,
    WORKER_LOCK_TTL_MS: 10000,
    LIMIT_HUB_NAVIGATING: 30000,
    LIMIT_HUB_VISITING: 20000,
    LIMIT_HUB_DECIDING: 3000,
    LIMIT_BUILD_NAVIGATING: 30000,
    LIMIT_BUILD_EXECUTING: 45000,
    LIMIT_BUILD_CONFIRMING: 15000,
    LIMIT_BUILD_CONFIRMING_VIDEO_WAIT: 90000,
    LIMIT_BUILDING: 4 * 60 * 60 * 1000,
    LIMIT_VERIFYING: 45000,
    RETRY_BACKOFF_MS: [4000, 10000, 25000],
    MAX_ATTEMPTS: 3,
    NAV_TIMEOUT_MS: 12000,
    DOM_READY_TIMEOUT_MS: 3000,
    HUB_DOM_READY_MS: 1500,
    HUB_STABLE_MAX_MS: 8000,
    HUB_STABLE_SETTLE_MS: 800,
    ROTATION_TARGET_INTERVAL_MS: 5 * 60 * 1000,
    ROTATION_MIN_INTERVAL_MS: 90 * 1000,
    ROTATION_JITTER: 0.15,
    URGENT_AGE_MS: 15 * 60 * 1000,
    USER_ACTIVE_WINDOW_MS: 3000,
    DELAY_PRE_CLICK_MIN: 500,
    DELAY_PRE_CLICK_MAX: 1800,
    AUTO_UNFREEZE_MS: 10 * 60 * 1000,
    FREEZE_COOLDOWN_MS: 5 * 60 * 1000,
    WATCHDOG_RELEASE_MS: 90 * 1000,
    WATCHDOG_GRACE_MS: 5000,
    PLUGIN_GRACE_MS: 60 * 1000,
    QUEUE_FRESH_FOR_BUSY_MS: 120 * 1000,
    VILLAGE_DATA_STALE_MS: 10 * 60 * 1000,
    MAX_HUB_BOUNCE: 3,
    INIT_DELAY_MIN: 1200,
    INIT_DELAY_MAX: 2000,
    BUILD_NAV_DELAY_MIN: 800,
    BUILD_NAV_DELAY_MAX: 1500,
    BUSY_SKIP_LOG_INTERVAL_MS: 5 * 60 * 1000,
    LAST_SWITCH_DISPLAY_MS: 30 * 60 * 1000,
    RESTORED_STATE_MAX_AGE_MS: 5 * 60 * 1000,
    BUILD_CONFIRMING_FORCE_NAV_MS: 5000,
    VIDEO_WAIT_TIMEOUT_MS: 90000,
    VIDEO_MAX_RETRIES: 3,
    UNFREEZE_FALLBACK_DELAY_MS: 3000,
    // ═════ 2.0.2.21: rotation reschedule ═════
    ROTATION_BUSY_RESCHEDULE_MS: 2 * 60 * 1000,
    ROTATION_EXPIRE_RESCHEDULE_MS: 30 * 1000,
  };

  const DEF = {
    version: 1,
    villages: {}, tasks: [], currentJob: null, workerLock: null,
    logs: [], sessionId: null,
    heartbeat: {
      enabled: false, masterPaused: false, nextRotationAt: 0,
      _frozenAt: 0, _frozenReason: null, _frozenMessage: null,
      autoUnfreezeMs: 10 * 60 * 1000,
      _lastUnfreezeAt: 0,
      _lastBusySkipLog: 0,
      allowHiddenTab: false,
      _unfreezeFallbackAt: 0,
      // ═════ 2.0.2.21 ═════
      _lastRotCheck: 0,
    },
    plugins: {}, ui: { panelOpen: false },
  };
