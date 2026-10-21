  // ═══════════════════════════════════════════════════════════════
  // FarmListManager — external plugin for Nova Heartbeat
  // Scan farm lists · import targets · validate duplicates · start
  // Source: plugins/FarmListManager/src/ · Build: node build.js
  // ═══════════════════════════════════════════════════════════════


  // ─────────────────────────────────────────────────────────────
  // Identity / versioning
  // ─────────────────────────────────────────────────────────────
  const FLM_VERSION = "1.0.3";
  const FLM_NS = "FarmListManager";
  const FLM_STORAGE_KEY = "travian_farm_list_manager_v1";
  const FLM_STORAGE_VERSION = 1;
  const FLM_REQUIRES_NOVA_MIN = "0.0.3";
  const FLM_DEBUG_KEY = "flm_debug";
  const FLM_PANEL_ID = "flm-panel";
  const FLM_STYLE_ID = "flm-style";
  const FLM_DEBUG_TAB_ID = "farm";

  // ─────────────────────────────────────────────────────────────
  // Page / DOM constants (verified against private-doc samples and
  // the official Travian bundle: build.php?id=39&gid=16&tt=99)
  // ─────────────────────────────────────────────────────────────
  const FARM_LIST_TT = "99";
  const SLOT_CAPACITY = 100;
  const POLL_MS = 1000;
  const PANEL_RERENDER_MS = 10000;
  const MAX_IMPORT_TARGETS = 100;
  const IMPORT_MODE = { APPEND: "append", REPLACE: "replace" };

  // ─────────────────────────────────────────────────────────────
  // Timing (ms) — import flow guards
  // ─────────────────────────────────────────────────────────────
  const DIALOG_OPEN_TIMEOUT_MS = 4000;
  const DIALOG_CLOSE_TIMEOUT_MS = 4000;
  const SAVE_ENABLE_TIMEOUT_MS = 5000;
  const SLOT_COUNT_TIMEOUT_MS = 4000;
  const DELETE_CONTEXT_TIMEOUT_MS = 2500;
  const DELETE_APPLY_TIMEOUT_MS = 8000;
  const IMPORT_STEP_DELAY_MS = [200, 600];
  const IMPORT_STEP_RETRY_MS = [400, 800];
  const IMPORT_MAX_ATTEMPTS = 2;
  // Toast lifetimes for the import summary (multi-part text → needs more time
  // than the 4s/6s defaults in showToast).
  const IMPORT_TOAST_OK_MS = 9000;
  const IMPORT_TOAST_MS = 12000;
  const HUMAN_PROFILE = {
    charDelay: [12, 35],
    microDelay: [60, 160],
    betweenSteps: [220, 520],
  };

  // ─────────────────────────────────────────────────────────────
  // Log buffer (dedupe, same policy as Nova core / Farm Manager)
  // ─────────────────────────────────────────────────────────────
  const LOG_BUFFER_MAX = 300;
  const LOG_DEDUP_WINDOW_MS = 5000;
  const _logBuffer = [];
  const _logDedupMap = new Map();

  // ─────────────────────────────────────────────────────────────
  // Utils
  // ─────────────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = (p) => (p || "id") + "_" + Math.random().toString(36).slice(2, 9);

  // Removes bidi marks / zero-width chars that Travian injects around numbers
  const stripInvisible = (s) =>
    String(s ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  const cleanNum = (s) =>
    stripInvisible(s)
      .replace(/−/g, "-")
      .replace(/[^\d-]/g, "");
  const cleanInt = (s) => {
    const n = cleanNum(s);
    return n === "" || n === "-" ? null : parseInt(n, 10);
  };

  function logNormal(min, max) {
    const u = Math.random() || 1e-9;
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const t = Math.min(1, Math.max(0, (z + 3) / 6));
    return Math.round(min + (max - min) * t);
  }
  const rnd = (range) => logNormal(range[0], range[1]);

  async function waitFor(condFn, maxMs = 5000, stepMs = 100) {
    const t0 = now();
    while (now() - t0 < maxMs) {
      try {
        if (condFn()) return { ok: true, waited: now() - t0 };
      } catch (e) {}
      await delay(stepMs);
    }
    return { ok: false, waited: now() - t0 };
  }

  function compareVer(a, b) {
    const pa = String(a || "").split(".").map((x) => parseInt(x, 10) || 0);
    const pb = String(b || "").split(".").map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
  }

  function slugify(s) {
    return String(s || "village")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "village";
  }

  function formatElapsed(ms) {
    if (!ms || ms < 0) return "never";
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + "s ago";
    const m = Math.floor(sec / 60);
    if (m < 60) return m + "m " + (sec % 60) + "s ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h " + (m % 60) + "m ago";
    const d = Math.floor(h / 24);
    return d + "d " + (h % 24) + "h ago";
  }

  function isDebugEnabled() {
    if (window.FLM_DEBUG === true) return true;
    try {
      const p = new URL(location.href).searchParams.get("flm_debug");
      if (p === "1") {
        try {
          localStorage.setItem(FLM_DEBUG_KEY, "1");
        } catch (e) {}
        return true;
      }
      if (p === "0") {
        try {
          localStorage.removeItem(FLM_DEBUG_KEY);
        } catch (e) {}
        return false;
      }
    } catch (e) {}
    try {
      if (localStorage.getItem(FLM_DEBUG_KEY) === "1") return true;
    } catch (e) {}
    return false;
  }
