  async function waitForTC(maxMs = 25000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (
        window.TC &&
        window.TC.registerPlugin &&
        window.TC.patch &&
        window.TC.enqueue
      )
        return window.TC;
      await delay(200);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Adapter — the ONLY place in this plugin that touches window.TC
  // ─────────────────────────────────────────────────────────────
  const _tcWarned = new Set();

  function _tcWarn(key, msg) {
    if (_tcWarned.has(key)) return;
    _tcWarned.add(key);
    console.warn("[FM] " + msg);
  }

  function tcCall(path, args, fallback) {
    if (!window.TC) {
      _tcWarn(
        "no-tc",
        "Nova Heartbeat (window.TC) not available — FM.tc." +
          path +
          "() ignored",
      );
      return fallback;
    }
    const parts = String(path).split(".");
    let owner = window.TC;
    for (let i = 0; i < parts.length - 1 && owner != null; i++) {
      owner = owner[parts[i]];
    }
    const fn = owner == null ? null : owner[parts[parts.length - 1]];
    if (typeof fn !== "function") {
      _tcWarn(
        "missing:" + path,
        "window.TC." +
          path +
          " is not available in this Nova build — FM.tc." +
          path +
          "() ignored",
      );
      return fallback;
    }
    return fn.apply(owner, args);
  }

  const FM = window.FM || {};

  FM.tc = {
    // Runtime
    state: () => tcCall("state", [], {}) ?? {},
    patch: (fn) => tcCall("patch", [fn], undefined),
    page: () => tcCall("page", [], null),
    village: () => tcCall("village", [], null),
    villageLabel: (v) => tcCall("villageLabel", [v], null) ?? String(v || "?"),

    // Tasks
    enqueue: (task) => tcCall("enqueue", [task], undefined),
    cancel: (id) => tcCall("cancel", [id], undefined),

    // UI
    flash: (msg) => tcCall("flash", [msg], undefined),
    log: (src, msg) => tcCall("log", [src, msg], undefined),

    // Navigation
    navigate: (target) => tcCall("navigate", [target], undefined),
    humanClick: (el, opts) => tcCall("humanClick", [el, opts], undefined),

    // Registration
    registerPlugin: (id, handlers) =>
      tcCall("registerPlugin", [id, handlers], undefined),

    // Freeze override
    freezeOverride: {
      register: (id, fn, desc) =>
        tcCall("freezeOverride.register", [id, fn, desc], undefined),
      unregister: (id) => tcCall("freezeOverride.unregister", [id], undefined),
    },

    // ⭐ فاز ۳ (باگ #۱): قفل صف — تا وقتی run فعال است Nova نه rotation می‌زند
    // و نه تسک پلاگین دیگری را برمی‌دارد (نیاز به Nova 0.0.3+، feature-detected)
    pluginLock: {
      register: (id, opts) => tcCall("pluginLock.register", [id, opts], false),
      unregister: (id) => tcCall("pluginLock.unregister", [id], false),
      check: () => tcCall("pluginLock.check", [], null),
    },

    // Heartbeat control
    heartbeat: {
      setOn: (v) => tcCall("heartbeat.setOn", [v], undefined),
    },

    // Village capture
    captureCurrentVillage: () => tcCall("captureCurrentVillage", [], undefined),

    // Debug
    tests: {
      register: (id, cfg) => tcCall("tests.register", [id, cfg], undefined),
    },

    // Version
    version: () => window.TC?.version ?? null,
  };

  window.FM = FM;
