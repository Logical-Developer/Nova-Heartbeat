  async function waitForTC(maxMs = 25000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (window.TC && window.TC.registerPlugin && window.TC.log) return window.TC;
      await delay(200);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Adapter — the ONLY place in this plugin that touches window.TC
  // Every call is feature-detected (window.TC?.method?.()); if a method
  // is missing we warn once and fall back to a safe local behaviour.
  // No business logic lives here.
  // ─────────────────────────────────────────────────────────────
  const _tcWarned = new Set();

  function _tcWarn(key, msg) {
    if (_tcWarned.has(key)) return;
    _tcWarned.add(key);
    console.warn("[FLM] " + msg);
  }

  function tcCall(path, args, fallback) {
    if (!window.TC) {
      _tcWarn("no-tc", "Nova Heartbeat (window.TC) not available — FLM.tc." + path + "() ignored");
      return fallback;
    }
    const parts = String(path).split(".");
    let owner = window.TC;
    for (let i = 0; i < parts.length - 1 && owner != null; i++) owner = owner[parts[i]];
    const fn = owner == null ? null : owner[parts[parts.length - 1]];
    if (typeof fn !== "function") {
      _tcWarn("missing:" + path, "window.TC." + path + " is not available in this Nova build — FLM.tc." + path + "() ignored");
      return fallback;
    }
    try {
      return fn.apply(owner, args);
    } catch (e) {
      _tcWarn("throw:" + path, "window.TC." + path + "() threw: " + (e && e.message));
      return fallback;
    }
  }

  const FLM = window.FLM || {};

  FLM.tc = {
    // Runtime
    state: () => tcCall("state", [], {}) ?? {},
    patch: (fn) => tcCall("patch", [fn], undefined),
    page: () => tcCall("page", [], null),
    village: () => tcCall("village", [], null),
    villageLabel: (v) => tcCall("villageLabel", [v], null) ?? String(v || "?"),

    // Tasks (unused in v1 — kept for parity / future use)
    enqueue: (task) => tcCall("enqueue", [task], undefined),
    cancel: (id) => tcCall("cancel", [id], undefined),

    // UI
    flash: (msg) => tcCall("flash", [msg], undefined),
    log: (src, msg) => tcCall("log", [src, msg], undefined),

    // Navigation
    navigate: (target) => tcCall("navigate", [target], undefined),
    humanClick: (el, opts) => tcCall("humanClick", [el, opts], undefined),
    humanType: (el, text, opts) => tcCall("humanType", [el, text, opts], undefined),

    // Registration
    registerPlugin: (id, handlers) => tcCall("registerPlugin", [id, handlers], undefined),

    // Freeze override (unused in v1 — FLM never freezes Nova)
    freezeOverride: {
      register: (id, fn, desc) => tcCall("freezeOverride.register", [id, fn, desc], undefined),
      unregister: (id) => tcCall("freezeOverride.unregister", [id], undefined),
    },

    // Heartbeat control
    heartbeat: {
      setOn: (v) => tcCall("heartbeat.setOn", [v], undefined),
    },

    // Villages
    villages: () => tcCall("state", [], {})?.villages ?? {},
    captureVillages: () => tcCall("captureCurrentVillage", [], undefined),

    // Debug
    tests: {
      register: (id, cfg) => tcCall("tests.register", [id, cfg], undefined),
    },

    // Version
    version: () => window.TC?.version ?? null,
  };

  window.FLM = FLM;
