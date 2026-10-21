// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: 2026-10-21T00:44:42.895Z
// Source: plugins/FarmListManager/src/
// Rebuild: node build.js
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// FILE: 00-header.js (16 lines)
// ═══════════════════════════════════════════════════════════

// ==UserScript==
// @name         Nova Farm List Manager (V 1.0.3)
// @namespace    local.travian.nova.farmlistmanager
// @version      1.0.3
// @description  Farm List Manager for Nova-HB — scan farm lists, import targets from farm-list-v1 JSON, validate duplicates, start lists, track last run
// @match        https://*.travian.com/*
// @match        https://*.traviantop.com/*
// @match        https://*.international.travian.com/*
// @match        https://*.arabics.travian.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

// ═══════════════════════════════════════════════════════════
// FILE: 01-config.js (168 lines)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// FILE: 02-adapter.js (96 lines)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// FILE: 03-storage.js (156 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Storage — independent of Nova state, key: travian_farm_list_manager_v1
  // Shape:
  // {
  //   _version: 1,
  //   settings: { profile: "normal" },
  //   lists: { [listId]: { lastRunAt, lastRunBy: villageId, lastRunStatus, lastRunCount, lastImportAt } },
  //   backups: [ { ts, reason, data } ]   // max 5
  // }
  // ─────────────────────────────────────────────────────────────
  const BACKUP_MAX = 5;
  const BACKUP_TTL_MS = 24 * 60 * 60 * 1000;

  function defaultFLMData() {
    return {
      _version: FLM_STORAGE_VERSION,
      settings: { profile: "normal" },
      lists: {},
      backups: [],
    };
  }

  let _cache = null;
  let _lastRaw = null;

  function _normalizeFLMData(raw) {
    const base = defaultFLMData();
    if (!raw || typeof raw !== "object") return base;
    const out = base;
    if (raw.settings && typeof raw.settings === "object") {
      out.settings.profile = raw.settings.profile === "paranoid" || raw.settings.profile === "fast" ? raw.settings.profile : "normal";
    }
    if (raw.lists && typeof raw.lists === "object") {
      for (const [id, meta] of Object.entries(raw.lists)) {
        if (!meta || typeof meta !== "object") continue;
        out.lists[String(id)] = {
          lastRunAt: Number(meta.lastRunAt) || 0,
          lastRunBy: meta.lastRunBy ? String(meta.lastRunBy) : null,
          lastRunStatus: meta.lastRunStatus ? String(meta.lastRunStatus) : null,
          lastRunCount: Number(meta.lastRunCount) || 0,
          lastRunVillage: meta.lastRunVillage ? String(meta.lastRunVillage) : null,
          lastRunStatusText: meta.lastRunStatusText ? String(meta.lastRunStatusText) : null,
          lastImportAt: Number(meta.lastImportAt) || 0,
          lastImportStatus: meta.lastImportStatus ? String(meta.lastImportStatus) : null,
          lastImportMode: meta.lastImportMode ? String(meta.lastImportMode) : null,
          lastImportCounts: meta.lastImportCounts && typeof meta.lastImportCounts === "object"
            ? {
                total: Number(meta.lastImportCounts.total) || 0,
                done: Number(meta.lastImportCounts.done) || 0,
                failed: Number(meta.lastImportCounts.failed) || 0,
                skipped: Number(meta.lastImportCounts.skipped) || 0,
                deleted: Number(meta.lastImportCounts.deleted) || 0,
              }
            : null,
        };
      }
    }
    if (Array.isArray(raw.backups)) {
      out.backups = raw.backups.filter((b) => b && typeof b === "object").slice(-BACKUP_MAX);
    }
    return out;
  }

  function readFLMData() {
    let rawStr = null;
    try {
      rawStr = localStorage.getItem(FLM_STORAGE_KEY);
    } catch (e) {
      rawStr = null;
    }
    if (_cache && rawStr === _lastRaw) return _cache;
    let parsed = null;
    if (rawStr) {
      try {
        parsed = JSON.parse(rawStr);
      } catch (e) {
        flmLog("WARN", "Corrupted FLM storage — falling back to defaults");
        parsed = null;
      }
    }
    _cache = _normalizeFLMData(parsed);
    _lastRaw = rawStr;
    return _cache;
  }

  function writeFLMData(data) {
    const d = _normalizeFLMData(data);
    d._version = FLM_STORAGE_VERSION;
    try {
      const str = JSON.stringify(d);
      localStorage.setItem(FLM_STORAGE_KEY, str);
      _cache = d;
      _lastRaw = str;
      return true;
    } catch (e) {
      flmLog("ERROR", "Failed to write FLM storage", e);
      return false;
    }
  }

  function mutateFLMData(fn) {
    const d = readFLMData();
    fn(d);
    return writeFLMData(d);
  }

  function listMeta(listId) {
    const d = readFLMData();
    return d.lists[String(listId)] || null;
  }

  function setListMeta(listId, patchObj) {
    mutateFLMData((d) => {
      const key = String(listId);
      d.lists[key] = Object.assign(
        {
          lastRunAt: 0,
          lastRunBy: null,
          lastRunStatus: null,
          lastRunCount: 0,
          lastImportAt: 0,
          lastImportCount: 0,
          lastImportMode: null,
        },
        d.lists[key] || {},
        patchObj || {},
      );
    });
  }

  function pruneBackups() {
    mutateFLMData((d) => {
      const cutoff = now() - BACKUP_TTL_MS;
      d.backups = (d.backups || []).filter((b) => Number(b.ts) > cutoff).slice(-BACKUP_MAX);
    });
  }

  function pushFLMBackup(reason) {
    const d = readFLMData();
    const snapshot = { _version: d._version, settings: { ...d.settings }, lists: JSON.parse(JSON.stringify(d.lists)) };
    mutateFLMData((x) => {
      const cutoff = now() - BACKUP_TTL_MS;
      x.backups = (x.backups || []).filter((b) => Number(b.ts) > cutoff);
      x.backups.push({ ts: now(), reason: String(reason || "manual"), data: snapshot });
      if (x.backups.length > BACKUP_MAX) x.backups = x.backups.slice(-BACKUP_MAX);
    });
  }

  function flmRequiresNovaCheck() {
    const v = FLM.tc.version();
    if (!v) return { ok: false, reason: "Nova Heartbeat not detected on this page" };
    if (compareVer(v, FLM_REQUIRES_NOVA_MIN) < 0)
      return { ok: false, reason: `Nova ${v} is older than required ${FLM_REQUIRES_NOVA_MIN}` };
    return { ok: true, reason: `Nova ${v}`, version: v };
  }

// ═══════════════════════════════════════════════════════════
// FILE: 04-log.js (93 lines)
// ═══════════════════════════════════════════════════════════

  function _logKey(level, msg) {
    return level + "|" + String(msg).replace(/\d+/g, "#").slice(0, 120);
  }

  function _fmtLogArg(a) {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object") {
      try {
        return JSON.stringify(a);
      } catch (e) {
        return String(a);
      }
    }
    return String(a);
  }

  // FLM log — own buffer (independent from Nova), dedup window 5s.
  // Every line is mirrored into Nova via FLM.tc.log("flm", msg) so it shows
  // up in the Nova debug panel too.
  function flmLog(level, ...args) {
    const ts = new Date().toISOString().slice(11, 23);
    const msg = args.map(_fmtLogArg).join(" ");
    const key = _logKey(level, msg);
    const tsMs = now();
    const prev = _logDedupMap.get(key);
    if (prev && tsMs - prev.lastTs < LOG_DEDUP_WINDOW_MS) {
      prev.count++;
      prev.lastTs = tsMs;
      const lastIdx = _logBuffer.length - 1;
      if (lastIdx >= 0 && _logBuffer[lastIdx].includes(msg.slice(0, 80))) {
        _logBuffer[lastIdx] = `[${ts}] [${level}] ${msg} (×${prev.count})`;
      }
      return;
    }
    _logDedupMap.set(key, { count: 1, lastTs: tsMs });
    const line = `[${ts}] [${level}] ${msg}`;
    _logBuffer.push(line);
    if (_logBuffer.length > LOG_BUFFER_MAX) _logBuffer.shift();
    if (level === "ERROR") console.error("[FLM]", ...args);
    else if (level === "WARN") console.warn("[FLM]", ...args);
    else console.log("[FLM]", ...args);
    const tag = level === "ERROR" ? "❌ " : level === "WARN" ? "⚠️ " : "";
    FLM.tc.log("flm", (tag + msg).slice(0, 280));
  }

  function getLogBuffer() {
    return _logBuffer.slice();
  }

  function clearLogBuffer(silent) {
    const n = _logBuffer.length;
    _logBuffer.length = 0;
    _logDedupMap.clear();
    if (!silent) {
      showToast("Log cleared (" + n + " lines)", "ok");
      flmLog("INFO", "Log buffer cleared by user");
    }
  }

  function appendLogLines(lines) {
    for (const line of lines || []) {
      _logBuffer.push(String(line).slice(0, 500));
      if (_logBuffer.length > LOG_BUFFER_MAX) _logBuffer.shift();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Toast (single instance, auto dismiss)
  // ─────────────────────────────────────────────────────────────
  let _toastTimer = null;
  // `ms` overrides the default lifetime — used by the import summary, which is
  // long enough to need more reading time than a one-line confirmation.
  function showToast(msg, kind, ms) {
    let el = document.getElementById("flm-toast");
    if (el) el.remove();
    if (_toastTimer) {
      clearTimeout(_toastTimer);
      _toastTimer = null;
    }
    el = document.createElement("div");
    el.id = "flm-toast";
    el.className = "flm-toast flm-toast-" + (kind || "ok");
    el.textContent = msg;
    document.body.appendChild(el);
    const lifetime =
      typeof ms === "number" && ms > 0 ? ms : kind === "warn" || kind === "error" ? 6000 : 4000;
    _toastTimer = setTimeout(() => {
      el.style.transition = "opacity .4s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400);
    }, lifetime);
  }

// ═══════════════════════════════════════════════════════════
// FILE: 05-dom.js (349 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Page detection
  // ─────────────────────────────────────────────────────────────
  function isFarmListPage() {
    try {
      const sp = new URL(location.href).searchParams;
      if (sp.get("gid") !== "16") return false;
      if (sp.get("tt") !== FARM_LIST_TT) return false;
      return !!document.getElementById("rallyPointFarmList");
    } catch (e) {
      return false;
    }
  }

  function farmListUrl() {
    try {
      const sp = new URL(location.href).searchParams;
      const id = sp.get("id") || "39";
      return "/build.php?id=" + encodeURIComponent(id) + "&gid=16&tt=" + FARM_LIST_TT;
    } catch (e) {
      return "/build.php?id=39&gid=16&tt=" + FARM_LIST_TT;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Village list (id ↔ name map) — needed because .villageWrapper has
  // no data-did; only the sidebar list entries carry it.
  // ─────────────────────────────────────────────────────────────
  function villageNameToId() {
    const map = Object.create(null);
    $$("#sidebarBoxVillageList .listEntry.village[data-did]").forEach((el) => {
      const n = el.querySelector(".name");
      const name = (n ? n.textContent : "").trim();
      const id = el.getAttribute("data-did");
      if (name && id) map[name.toLowerCase()] = id;
    });
    return map;
  }

  function parseSlotsText(text) {
    // Travian wraps numbers with LTR/RTL marks: "\u202d\u202d2\u202c/\u202d100\u202c\u202c"
    const m = stripInvisible(text).match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { used: parseInt(m[1], 10), capacity: parseInt(m[2], 10) };
  }

  function readListWrapper(wrapper, villageName, nameMap) {
    const listEl = wrapper.querySelector(".farmListHeader .dragAndDrop[data-list]");
    if (!listEl) return null;
    const id = listEl.getAttribute("data-list");
    if (!id) return null;
    const nameEl = wrapper.querySelector(".farmListHeader .farmListName .name");
    const name = (nameEl ? nameEl.textContent : "").trim() || "List " + id;
    const statusEl = wrapper.querySelector(".farmListHeader .farmListStatus span");
    const statusText = stripInvisible(statusEl ? statusEl.textContent : "").replace(/\s+/g, " ").trim();

    const headBtn = wrapper.querySelector(".farmListHeader button.startFarmList");
    const footBtn = wrapper.querySelector(".farmListFooter button.startFarmList");
    const startBtn = footBtn || headBtn;
    const startDisabled = !!(startBtn && startBtn.classList.contains("disabled"));

    const addTd = wrapper.querySelector("table.slots td.addTarget");
    const counts = parseSlotsText(addTd ? addTd.textContent : "");
    const rows = $$("table.slots tbody tr.slot", wrapper);

    const targets = [];
    for (const tr of rows) {
      const cb = tr.querySelector("input.selectOne, input[name='selectOne']");
      const link = tr.querySelector("td.target a[href]");
      if (!link) continue;
      let x = null;
      let y = null;
      try {
        const q = new URL(link.getAttribute("href"), location.origin).searchParams;
        x = parseInt(q.get("x"), 10);
        y = parseInt(q.get("y"), 10);
      } catch (e) {}
      const nameSpan = link.querySelector("span");
      const targetName = ((nameSpan ? nameSpan.textContent : link.textContent) || "").trim();
      const popEl = tr.querySelector("td.population span");
      const distEl = tr.querySelector("td.distance span");
      targets.push({
        slotId: cb ? cb.getAttribute("data-slot-id") : null,
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null,
        name: targetName,
        population: popEl ? cleanInt(popEl.textContent) : null,
        distance: distEl ? parseFloat(cleanNum(distEl.textContent)) || null : null,
      });
    }

    // Travian renders deactivated slots too (slotsStates), so trust the
    // larger of: parsed "used/capacity" text and rendered slot rows.
    const used = Math.max(counts ? counts.used : 0, rows.length);
    const capacity = (counts && counts.capacity) || SLOT_CAPACITY;
    const meta = listMeta(id) || {};

    return {
      id: String(id),
      name,
      villageName,
      villageId: nameMap[String(villageName || "").toLowerCase()] || null,
      used,
      capacity,
      full: used >= capacity,
      targetsCount: rows.length,
      targets,
      statusText,
      startDisabled,
      canStart: !!startBtn && !startDisabled && used > 0,
      lastRunAt: Number(meta.lastRunAt) || 0,
      lastRunBy: meta.lastRunBy || null,
      lastRunStatus: meta.lastRunStatus || null,
      lastImportAt: Number(meta.lastImportAt) || 0,
      wrapper,
      startBtn,
      addTargetAnchor: wrapper.querySelector("table.slots td.addTarget a"),
    };
  }

  function scanFarmLists() {
    const root = document.getElementById("rallyPointFarmList");
    if (!root) return [];
    const nameMap = villageNameToId();
    const out = [];
    $$(".villageWrapper", root).forEach((wrapper) => {
      const vNameEl = wrapper.querySelector(":scope > .villageHeader .villageName");
      const villageName = (vNameEl ? vNameEl.textContent : "").trim();
      $$(".farmListWrapper", wrapper).forEach((lw) => {
        const row = readListWrapper(lw, villageName, nameMap);
        if (row) out.push(row);
      });
    });
    return out;
  }

  function getListById(listId) {
    const want = String(listId);
    return scanFarmLists().find((l) => l.id === want) || null;
  }

  function findListWrapper(listId) {
    const want = String(listId);
    return (
      $$(".farmListWrapper").find((w) => {
        const el = w.querySelector(".farmListHeader .dragAndDrop[data-list]");
        return !!el && el.getAttribute("data-list") === want;
      }) || null
    );
  }

  // Slot rows currently rendered for a list (deactivated slots included)
  function slotCountInDom(listId) {
    const w = findListWrapper(listId);
    return w ? $$("table.slots tbody tr.slot", w).length : 0;
  }

  // Number of slots we can actually address in the DOM (used right after a
  // delete/append so we do not trust a stale "X/100" counter)
  function listSlotRows(listId) {
    const w = findListWrapper(listId);
    return w ? $$("table.slots tbody tr.slot", w) : [];
  }

  // ─────────────────────────────────────────────────────────────
  // Dialog helpers — the Add-Target / Edit-Slot dialog
  // (#reactDialogWrapper > #dialogOverlay.dialogVisible > .dialog.slotDialog
  //  > .contentV2 > #farmListTargetForm.formV2)
  // ─────────────────────────────────────────────────────────────
  function dialogRoot() {
    return document.getElementById("reactDialogWrapper");
  }
  function isDialogVisible() {
    const ov = document.getElementById("dialogOverlay");
    return !!ov && ov.classList.contains("dialogVisible");
  }
  function targetForm() {
    return document.getElementById("farmListTargetForm");
  }
  function dialogSaveButton() {
    const form = targetForm();
    return form ? form.querySelector(".actionButtons button.save") : null;
  }
  function dialogCancelButton() {
    const form = targetForm();
    return form ? form.querySelector(".actionButtons button.cancel") : null;
  }
  function dialogXInput() {
    const f = targetForm();
    return f ? f.querySelector("input[name='x']") : null;
  }
  function dialogYInput() {
    const f = targetForm();
    return f ? f.querySelector("input[name='y']") : null;
  }
  function dialogListSelect() {
    const f = targetForm();
    return f ? f.querySelector("select[name='listId']") : null;
  }
  function dialogTargetValidationText() {
    const f = targetForm();
    if (!f) return "";
    const v = f.querySelector(".targetSelectionValidation");
    return stripInvisible(v ? v.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function isSaveEnabled() {
    const btn = dialogSaveButton();
    return !!btn && !btn.disabled && !btn.classList.contains("disabled");
  }

  // ─────────────────────────────────────────────────────────────
  // Travian confirmation dialogs (React API `oi({...})`):
  // rendered inside #reactDialogWrapper as .dialogWrapper[.confirm]
  // with a red/green confirm button; the cancel button carries .cancel.
  // ─────────────────────────────────────────────────────────────
  function confirmDialogRoot() {
    const roots = $$("#reactDialogWrapper .dialogWrapper");
    for (const r of roots) {
      if (r.querySelector("#farmListTargetForm")) continue;
      if (r.querySelector(".actionButtons button.save")) continue;
      if (r.querySelector("button.confirm, button.greenConfirm, button.redConfirm")) return r;
    }
    return null;
  }
  function isConfirmDialogVisible() {
    return !!confirmDialogRoot();
  }
  function confirmDialogButton() {
    const r = confirmDialogRoot();
    return r ? r.querySelector("button.confirm, button.greenConfirm, button.redConfirm") : null;
  }
  function confirmDialogCancelButton() {
    const r = confirmDialogRoot();
    return r ? r.querySelector("button.cancel, button.cancelButton") : null;
  }

  function waitDialogClosed(maxMs) {
    if (!isDialogVisible()) return Promise.resolve({ ok: true, waited: 0 });
    return waitFor(() => !isDialogVisible(), maxMs || DIALOG_CLOSE_TIMEOUT_MS, 80);
  }

  async function closeAnyDialog() {
    if (isConfirmDialogVisible()) {
      const c = confirmDialogCancelButton();
      if (c) await humanClick(c);
      await waitFor(() => !isConfirmDialogVisible(), 2000, 80);
    }
    if (isDialogVisible()) {
      const c = dialogCancelButton() || document.querySelector("#dialogOverlay .dialogCancelButton");
      if (c) await humanClick(c);
      await waitDialogClosed(2000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Human input (local copy — Nova 0.0.3 exposes no humanType())
  // React inputs need the native value setter + input event to update
  // their internal state (otherwise the Save button never enables).
  // ─────────────────────────────────────────────────────────────
  function humanProfile() {
    const p = readFLMData().settings.profile;
    if (p === "fast") return { charDelay: [8, 25], microDelay: [40, 120] };
    if (p === "paranoid") return { charDelay: [60, 180], microDelay: [300, 900] };
    return { charDelay: HUMAN_PROFILE.charDelay, microDelay: HUMAN_PROFILE.microDelay };
  }

  function setNativeValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(input, String(value));
    else input.value = String(value);
  }

  // React keeps its own value tracker on the element instance. Writing to the
  // prototype setter bypasses it, so React sees a real change on the next
  // input/change event. A <select> needs the HTMLSelectElement descriptor —
  // the input one silently does nothing on it.
  function setNativeValueSelect(sel, value) {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (desc && desc.set) desc.set.call(sel, String(value));
    else sel.value = String(value);
  }

  function createSignal() {
    return {
      cancelled: false,
      cancelledAt: 0,
      cancel() {
        this.cancelled = true;
        this.cancelledAt = now();
      },
    };
  }

  async function humanType(input, value, signal) {
    if (!input || !input.isConnected) return false;
    const prof = humanProfile();
    input.focus();
    await delay(rnd(prof.microDelay));
    if (input.value) {
      try {
        input.select();
      } catch (e) {}
      await delay(rnd(prof.charDelay));
      setNativeValue(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const ch of String(value)) {
      if (signal && signal.cancelled) return false;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true }));
      await delay(rnd(prof.charDelay));
      setNativeValue(input, input.value + ch);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true, cancelable: true }));
      await delay(rnd(prof.charDelay));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function humanClick(el, signal) {
    if (!el || !el.isConnected) return { ok: false, reason: "gone" };
    let st;
    try {
      st = getComputedStyle(el);
    } catch (e) {
      st = null;
    }
    if (st && (st.display === "none" || st.visibility === "hidden")) return { ok: false, reason: "hidden" };
    if (el.disabled) return { ok: false, reason: "disabled" };
    const prof = humanProfile();
    await delay(rnd(prof.microDelay));
    if (signal && signal.cancelled) return { ok: false, cancelled: true };
    const rect = el.getBoundingClientRect();
    const tx = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const ty = rect.top + rect.height * (0.3 + Math.random() * 0.4);
    const opts = { bubbles: true, cancelable: true, clientX: tx, clientY: ty };
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mousemove", opts));
    el.dispatchEvent(new MouseEvent("mousedown", Object.assign({ buttons: 1 }, opts)));
    await delay(rnd(prof.charDelay));
    if (signal && signal.cancelled) return { ok: false, cancelled: true };
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.click();
    return { ok: true };
  }

// ═══════════════════════════════════════════════════════════
// FILE: 06-import-parse.js (176 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Import payload parsing / validation
  //
  // Accepted shapes:
  //  1) farm-list-v1 (AttackReportAnalyzer export)
  //     { _format: "farm-list-v1", list: { name, troops, targets: [{name,x,y}] }, blacklist: [...] }
  //  2) { targets: [ {x, y, name} ], name?: string }
  //  3) [ {x, y, name} ]  |  [ [x, y] ]  |  [ "123|456" ]
  //  4) { blacklist: [...] } — blacklist only, nothing to import
  // ─────────────────────────────────────────────────────────────
  const MAP_LIMIT = 400;

  function _coerceTarget(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return { x: cleanInt(raw[0]), y: cleanInt(raw[1]), name: String(raw[2] || "") };
    }
    if (typeof raw === "object") {
      const x = cleanInt(raw.x ?? raw.X ?? raw.coordX);
      const y = cleanInt(raw.y ?? raw.Y ?? raw.coordY);
      return { x, y, name: String(raw.name ?? raw.village ?? raw.villageName ?? "").trim() };
    }
    if (typeof raw === "string") {
      const m = stripInvisible(raw).match(/(-?\d+)\s*[|:,;\s]\s*(-?\d+)/);
      if (m) return { x: parseInt(m[1], 10), y: parseInt(m[2], 10), name: "" };
    }
    return null;
  }

  function parseImportPayload(text) {
    const result = {
      ok: false,
      format: null,
      listName: "",
      targets: [],
      blacklist: [],
      errors: [],
      warnings: [],
      totalRaw: 0,
    };
    let data;
    try {
      data = JSON.parse(String(text || "").trim());
    } catch (e) {
      result.errors.push("Invalid JSON: " + (e && e.message ? e.message : "parse error"));
      return result;
    }
    let rawTargets = null;
    if (Array.isArray(data)) {
      result.format = "array";
      rawTargets = data;
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.targets)) {
        result.format = data._format ? String(data._format) : "object.targets";
        rawTargets = data.targets;
        result.listName = String(data.name || (data.list && data.list.name) || "").trim();
      } else if (data.list && Array.isArray(data.list.targets)) {
        result.format = String(data._format || "farm-list-v1");
        rawTargets = data.list.targets;
        result.listName = String(data.list.name || "").trim();
      } else if (Array.isArray(data.blacklist)) {
        result.format = "blacklist-only";
        rawTargets = [];
      }
      if (Array.isArray(data.blacklist)) {
        result.blacklist = data.blacklist.map(_coerceTarget).filter(Boolean);
      }
    }
    if (!result.format) {
      result.errors.push("Unrecognised payload. Expected farm-list-v1, {targets:[...]} or an array of {x,y}.");
      return result;
    }
    if (rawTargets === null) {
      result.errors.push("No `targets` array found in payload.");
      return result;
    }
    result.totalRaw = rawTargets.length;
    const seen = new Set();
    const blackset = new Set(result.blacklist.map((b) => b.x + "|" + b.y));
    for (let i = 0; i < rawTargets.length; i++) {
      const t = _coerceTarget(rawTargets[i]);
      if (!t) {
        result.warnings.push(`#${i + 1}: unreadable entry (skipped)`);
        continue;
      }
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) {
        result.warnings.push(`#${i + 1}: missing coordinates (skipped)`);
        continue;
      }
      if (Math.abs(t.x) > MAP_LIMIT || Math.abs(t.y) > MAP_LIMIT) {
        result.warnings.push(`#${i + 1}: (${t.x}|${t.y}) out of map bounds (skipped)`);
        continue;
      }
      const key = t.x + "|" + t.y;
      if (blackset.has(key)) {
        result.warnings.push(`#${i + 1}: (${t.x}|${t.y}) is blacklisted (skipped)`);
        continue;
      }
      if (seen.has(key)) {
        result.warnings.push(`#${i + 1}: duplicate inside payload (${t.x}|${t.y}) — skipped`);
        continue;
      }
      seen.add(key);
      result.targets.push({ x: t.x, y: t.y, name: t.name || "" });
    }
    if (result.targets.length > MAX_IMPORT_TARGETS) {
      result.warnings.push(`Payload has ${result.targets.length} targets — only the first ${MAX_IMPORT_TARGETS} are kept.`);
      result.targets = result.targets.slice(0, MAX_IMPORT_TARGETS);
    }
    result.ok = result.targets.length > 0;
    if (!result.ok && !result.errors.length) result.errors.push("No valid targets after validation.");
    // One-line summary so a failed import can be diagnosed from the log alone.
    flmLog(
      "INFO",
      `parse ok: format=${result.format} targets=${result.targets.length} warnings=${result.warnings.length}`,
    );
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Duplicate analysis against a scanned list
  // ─────────────────────────────────────────────────────────────
  const DUP_MODE = { SKIP: "skip", FORCE: "force", ABORT: "abort" };

  function analyzeDuplicates(parsedTargets, existingTargets) {
    const existing = new Set((existingTargets || []).map((t) => t.x + "|" + t.y));
    const dup = [];
    const fresh = [];
    for (const t of parsedTargets || []) {
      if (existing.has(t.x + "|" + t.y)) dup.push(t);
      else fresh.push(t);
    }
    return { fresh, duplicates: dup, duplicateCount: dup.length };
  }

  function capacityCheck(list, incomingCount, mode) {
    const capacity = (list && list.capacity) || SLOT_CAPACITY;
    const free = Math.max(0, capacity - ((list && list.used) || 0));
    const usable = mode === IMPORT_MODE.REPLACE ? capacity : free;
    if (incomingCount > usable) {
      return {
        ok: false,
        free,
        capacity,
        overflow: incomingCount - usable,
        message:
          mode === IMPORT_MODE.REPLACE
            ? `${incomingCount} targets exceed the list capacity (${capacity}).`
            : `Only ${free} free slot(s) in this list — ${incomingCount} targets requested.`,
      };
    }
    return { ok: true, free, capacity, overflow: 0 };
  }

  function summarizeTargets(targets) {
    const t = targets || [];
    if (!t.length) return "-";
    return t
      .slice(0, 3)
      .map((x) => `(${x.x}|${x.y})`)
      .join(", ") + (t.length > 3 ? ` +${t.length - 3}` : "");
  }

  // Converts a full list scan into the same JSON shape we accept for import
  // (handy for building a payload from the current list / copying between lists).
  function exportListAsPayload(list) {
    return {
      _format: "farm-list-v1",
      list: {
        name: list.name,
        village: list.villageName,
        targets: (list.targets || []).map((t) => ({ name: t.name, x: t.x, y: t.y })),
      },
    };
  }

// ═══════════════════════════════════════════════════════════
// FILE: 07-importer.js (556 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Importer — drives Travian's own dialogs (no direct API calls).
  //
  // Add single target:
  //   td.addTarget a  →  dialog opens (#farmListTargetForm)
  //   → select[name=listId].value = listId (+ change)
  //   → input[name=x] / input[name=y]  (React needs native setter + input event)
  //   → button.save becomes enabled   → click
  //   → dialog closes
  //
  // Bulk delete (replace mode):
  //   every input.selectOne[data-slot-id] in the list → click (select all)
  //   → .farmListFooter button.openContextMenu → .contextMenu button.entry.delete
  //   → Travian confirmation dialog → confirm
  // ─────────────────────────────────────────────────────────────
  let _importing = false;
  let _importSignal = null;
  let _importStats = null;

  function isImporting() {
    return _importing;
  }
  function getImportStats() {
    return _importStats ? { ..._importStats, steps: _importStats.steps.slice() } : null;
  }
  function cancelImport(reason) {
    if (!_importing || !_importSignal) return false;
    _importSignal.cancel();
    flmLog("WARN", "Import cancel requested: " + (reason || "user"));
    return true;
  }

  function _step(stats, kind, label, extra) {
    const entry = Object.assign({ ts: now(), kind, label }, extra || {});
    stats.steps.push(entry);
    if (stats.steps.length > 400) stats.steps.shift();
    const icon = kind === "ok" ? "✓" : kind === "skip" ? "⏭" : kind === "fail" ? "✗" : kind === "warn" ? "!" : "·";
    flmLog(kind === "fail" ? "WARN" : "INFO", `[import ${stats.done + stats.failed + stats.skipped}/${stats.total}] ${icon} ${label}`);
  }

  async function openAddTargetDialog(list, signal, stats) {
    let wrapper = findListWrapper(list.id);
    if (!wrapper) {
      _step(stats, "fail", `List ${list.id} not found in DOM`);
      return false;
    }
    let anchor = wrapper.querySelector("table.slots td.addTarget a");
    if (!anchor) {
      _step(stats, "fail", `List ${list.id} has no "Add target" row`);
      return false;
    }
    // Make sure the list is expanded so the dialog is anchored properly
    const listWrapperEl = wrapper;
    if (listWrapperEl.classList.contains("collapsed")) {
      const exp = listWrapperEl.querySelector(".farmListHeader a.expandCollapse");
      if (exp) await humanClick(exp, signal);
      await waitFor(() => !wrapper.classList.contains("collapsed"), 1500, 80);
      anchor = wrapper.querySelector("table.slots td.addTarget a");
    }
    await humanClick(anchor, signal);
    const opened = await waitFor(() => !!targetForm(), DIALOG_OPEN_TIMEOUT_MS, 80);
    if (!opened.ok) {
      _step(stats, "fail", `Add-target dialog did not open for ${list.name}`);
      await closeAnyDialog();
      return false;
    }
    // The form mounts before React fills the list <select>. Do not let the
    // caller touch the popup until at least one real option exists.
    const formReady = await waitFor(() => {
      const s = dialogListSelect();
      return !!s && !!s.options && s.options.length > 0;
    }, 2000, 80);
    if (!formReady.ok) {
      _step(stats, "fail", `dialog did not render list options for ${list.name}`);
      await closeAnyDialog();
      return false;
    }
    await waitFor(() => !!dialogSaveButton(), 1200, 60);
    return true;
  }

  // The popup <select> is a React controlled component. Accepting a value
  // requires (1) the native HTMLSelectElement setter — otherwise React's value
  // tracker swallows it, (2) an `input` AND a `change` event (both bubbling),
  // and (3) the target <option> actually being rendered. No keyboard events
  // are needed for a select (unlike a text input, which needs char-by-char).
  async function setDialogListId(listId, signal) {
    const want = String(listId);

    // 1) wait for the <select> itself to be in the DOM
    const selRes = await waitFor(() => !!dialogListSelect(), 1500, 60);
    if (!selRes.ok) {
      flmLog("WARN", `select[name=listId] never appeared in the dialog (list #${want})`);
      return false;
    }
    if (signal && signal.cancelled) return false;

    // 2) React renders <option> nodes asynchronously after the dialog mounts —
    //    wait until the option we want actually exists (not just "some option").
    const optRes = await waitFor(() => {
      const s = dialogListSelect();
      if (!s || !s.options) return false;
      const all = Array.from(s.options);
      const real = all.filter((o) => o.value);
      return real.length > 0 && all.some((o) => String(o.value) === want);
    }, 2000, 80);
    if (!optRes.ok) {
      // Fail loudly with the option values we did see — this is the difference
      // between "list not on this page" and "options rendered too late".
      const s = dialogListSelect();
      const seen = s && s.options ? Array.from(s.options).map((o) => String(o.value)).join(",") : "none";
      flmLog("WARN", `dialog <select> never offered list #${want}; options=[${seen}]`);
      return false;
    }
    if (signal && signal.cancelled) return false;

    // 3) already correct → nothing to do (React may have preselected it)
    const sel = dialogListSelect();
    if (!sel) return false;
    if (String(sel.value) === want) return true;

    // 4) native select setter, then both events (bubbling)
    setNativeValueSelect(sel, want);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    // 5) short settle + verify the value actually stuck
    await delay(rnd(IMPORT_STEP_RETRY_MS));
    const sel2 = dialogListSelect();
    const ok = !!sel2 && String(sel2.value) === want;
    if (!ok) flmLog("WARN", `dialog <select> rejected #${want} (value stayed "${sel2 ? sel2.value : "n/a"}")`);
    return ok;
  }

  async function fillCoordinates(x, y, signal) {
    const xi = dialogXInput();
    if (!xi) return { ok: false, reason: "no-x-input" };
    await humanType(xi, String(x), signal);
    if (signal && signal.cancelled) return { ok: false, reason: "cancelled" };
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    let yi = dialogYInput();
    if (!yi) return { ok: false, reason: "no-y-input" };
    await humanType(yi, String(y), signal);
    if (signal && signal.cancelled) return { ok: false, reason: "cancelled" };
    // Force the validation cycle: blur y, then re-dispatch change on both
    yi.dispatchEvent(new Event("change", { bubbles: true }));
    xi.dispatchEvent(new Event("change", { bubbles: true }));
    yi.blur();
    return { ok: true };
  }

  function classifyValidation() {
    const txt = dialogTargetValidationText().toLowerCase();
    if (!txt) return { kind: "none", text: "" };
    if (txt.includes("already") || txt.includes("exists")) return { kind: "dup", text: txt };
    if (txt.includes("coordinate") || txt.includes("village name") || txt.includes("enter"))
      return { kind: "empty", text: txt };
    return { kind: "error", text: txt };
  }

  async function waitSaveEnabled(signal) {
    let last = null;
    const res = await waitFor(
      () => {
        if (isSaveEnabled()) return true;
        last = classifyValidation();
        return false;
      },
      SAVE_ENABLE_TIMEOUT_MS,
      100,
    );
    return { ok: res.ok, waited: res.waited, validation: last };
  }

  // Adds a single target through the dialog. Returns a result object:
  //   { status: "ok" | "dup" | "invalid" | "timeout" | "error" | "cancelled", message }
  async function addTargetViaDialog(listId, target, signal) {
    const list = getListById(listId);
    if (!list) return { status: "error", message: "list is not in the DOM" };
    // Never open a second popup on top of a stale one: findListWrapper() would
    // resolve a different anchor while the old dialog is still mounted.
    if (isDialogVisible()) await closeAnyDialog();
    await delay(rnd([80, 200]));

    const stats = _importStats || { steps: [], total: 0, done: 0, failed: 0, skipped: 0 };
    const opened = await openAddTargetDialog(list, signal, stats);
    if (!opened) return { status: "error", message: "dialog did not open" };

    // Save can exist before React has populated the <select> options and the
    // x/y inputs — selecting the list or typing too early would be dropped.
    const initialised = await waitFor(() => {
      const sel = dialogListSelect();
      return !!sel && !!sel.options && sel.options.length > 0;
    }, 1500, 60);
    if (!initialised.ok) {
      await closeAnyDialog();
      return { status: "error", message: "dialog did not initialise" };
    }

    const listSet = await setDialogListId(listId, signal);
    if (!listSet) {
      await closeAnyDialog();
      return { status: "error", message: "could not select list #" + listId + " in the dialog" };
    }

    const inputsReady = await waitFor(() => {
      const xi = dialogXInput();
      const yi = dialogYInput();
      return !!xi && !!yi && !xi.disabled && !yi.disabled;
    }, 1200, 60);
    if (!inputsReady.ok) {
      await closeAnyDialog();
      return { status: "error", message: "dialog did not initialise" };
    }

    const filled = await fillCoordinates(target.x, target.y, signal);
    if (!filled.ok) {
      await closeAnyDialog();
      return { status: filled.reason === "cancelled" ? "cancelled" : "error", message: filled.reason };
    }

    // Travian's client-side validation already knows the village is in the
    // list. Without this check the save button never enables and we would burn
    // SAVE_ENABLE_TIMEOUT_MS and report a misleading "timeout".
    const preValid = classifyValidation();
    if (preValid.kind === "dup") {
      await closeAnyDialog();
      return { status: "dup", message: "already in list (client validation)" };
    }

    const enabled = await waitSaveEnabled(signal);
    if (!enabled.ok) {
      const v = enabled.validation || classifyValidation();
      await closeAnyDialog();
      if (v.kind === "dup") return { status: "dup", message: "already in list (Travian validation)" };
      if (v.kind === "error" && v.text) return { status: "invalid", message: v.text };
      return { status: "timeout", message: "Save stayed disabled for " + SAVE_ENABLE_TIMEOUT_MS + "ms" };
    }

    const save = dialogSaveButton();
    await humanClick(save, signal);
    const closed = await waitDialogClosed(DIALOG_CLOSE_TIMEOUT_MS);
    if (!closed.ok) {
      // Travian shows a native confirm for "village already in raid list" when
      // the server rejects it (race with our pre-check). Accept, or abort.
      if (isConfirmDialogVisible()) {
        const btn = confirmDialogButton();
        if (btn) await humanClick(btn, signal);
        const closed2 = await waitDialogClosed(DIALOG_CLOSE_TIMEOUT_MS);
        if (closed2.ok) return { status: "ok", message: "added (force-confirmed)" };
      }
      await closeAnyDialog();
      return { status: "error", message: "dialog did not close after Save" };
    }
    // Wait for the list to re-render with the new slot
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    return { status: "ok", message: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Replace mode — delete every slot of the list via Travian's own
  // bulk-delete context menu (selectAll → openContextMenu → delete →
  // confirmation dialog → confirm).
  // ─────────────────────────────────────────────────────────────
  function listContextMenuButton(wrapper) {
    return (
      wrapper.querySelector(".farmListFooter button.openContextMenu") ||
      wrapper.querySelector("table.slots thead th.contextMenu button.openContextMenu") ||
      wrapper.querySelector("table.slots thead th.contextMenu")
    );
  }

  function findVisibleContextMenuEntry(textHint) {
    const candidates = $$(".contextMenu .entry, .contextMenu li, .contextMenu a.entry, [class*='contextMenu'] [class*='entry']");
    const want = String(textHint || "").toLowerCase();
    for (const el of candidates) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (want && !String(el.textContent || "").toLowerCase().includes(want)) continue;
      return el;
    }
    // Fallback: class-based lookup (minified React components keep class names)
    return (
      $$(".contextMenu .entry.delete, .contextMenu button.delete, [class*='contextMenu'] .delete").find((el) => {
        const st = getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden";
      }) || null
    );
  }

  async function selectAllSlots(wrapper, signal) {
    const boxes = $$("table.slots tbody tr.slot input.selectOne", wrapper).filter(
      (cb) => !cb.disabled && !cb.checked,
    );
    for (const cb of boxes) {
      if (signal && signal.cancelled) return false;
      cb.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, buttons: 1 }));
      cb.click();
      await delay(rnd([40, 120]));
    }
    // Some builds only react to the header "select all" checkbox
    const still = $$("table.slots tbody tr.slot input.selectOne:not(:checked)", wrapper).length;
    if (still > 0) {
      const all = wrapper.querySelector("table.slots thead input[data-check-all]");
      if (all) {
        all.click();
        await delay(rnd([120, 260]));
      }
    }
    return true;
  }

  async function deleteAllSlotsInList(listId, signal) {
    const wrapper = findListWrapper(listId);
    if (!wrapper) return { status: "error", message: "list is not in the DOM" };
    const rows = $$("table.slots tbody tr.slot", wrapper);
    if (!rows.length) return { status: "ok", message: "list already empty", deleted: 0 };

    if (isDialogVisible()) await closeAnyDialog();
    if (isConfirmDialogVisible()) {
      const c = confirmDialogCancelButton();
      if (c) await humanClick(c, signal);
      await waitFor(() => !isConfirmDialogVisible(), 1500, 80);
    }

    const waitStart = await waitFor(() => !!findListWrapper(listId), SLOT_COUNT_TIMEOUT_MS, 150);
    if (!waitStart.ok) return { status: "error", message: "list wrapper not ready" };

    await selectAllSlots(wrapper, signal);
    if (signal && signal.cancelled) return { status: "cancelled", message: "cancelled" };

    const menuBtn = listContextMenuButton(wrapper);
    if (!menuBtn) return { status: "error", message: "context-menu button not found" };
    await humanClick(menuBtn, signal);

    let entry = null;
    const menuOpened = await waitFor(() => {
      entry = findVisibleContextMenuEntry("delete");
      return !!entry;
    }, DELETE_CONTEXT_TIMEOUT_MS, 80);
    if (!menuOpened.ok || !entry) {
      await document.body.click();
      return { status: "error", message: "delete entry not found in context menu" };
    }

    await humanClick(entry, signal);
    await waitFor(() => isConfirmDialogVisible(), DELETE_CONTEXT_TIMEOUT_MS, 80);
    const confirmBtn = confirmDialogButton();
    if (!confirmBtn) {
      await closeAnyDialog();
      return { status: "error", message: "delete confirmation dialog not shown" };
    }
    await humanClick(confirmBtn, signal);

    const emptied = await waitFor(() => {
      const w = findListWrapper(listId);
      if (!w) return false;
      return $$("table.slots tbody tr.slot", w).length === 0;
    }, DELETE_APPLY_TIMEOUT_MS, 200);
    if (!emptied.ok) {
      const left = slotCountInDom(listId);
      return { status: "error", message: "slots still present after delete (" + left + ")" };
    }
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    return { status: "ok", message: "", deleted: rows.length };
  }

  // ─────────────────────────────────────────────────────────────
  // Orchestrator — runs a whole import for one list.
  //   opts = { mode: "append"|"replace", dupMode: "skip"|"force"|"abort" }
  // Returns a report object that the UI shows and we persist in meta.
  // ─────────────────────────────────────────────────────────────
  function newImportStats(listId, mode) {
    return {
      listId: String(listId),
      mode,
      startedAt: now(),
      finishedAt: 0,
      total: 0,
      done: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      deleted: 0,
      status: "running",
      steps: [],
      errors: [],
    };
  }

  async function ensureListExpanded(listId, signal) {
    let list = getListById(listId);
    if (!list) return null;
    if (list.wrapper.classList.contains("expanded")) return list;
    const exp = list.wrapper.querySelector(".farmListHeader a.expandCollapse");
    if (!exp) return list;
    await humanClick(exp, signal);
    await waitFor(() => {
      const l = getListById(listId);
      return !!l && l.wrapper.classList.contains("expanded");
    }, 1500, 80);
    return getListById(listId) || list;
  }

  function prepareIncoming(list, parsed, mode, dupMode, stats) {
    let incoming = parsed.targets.slice();
    const cap = capacityCheck(list, incoming.length, mode);
    if (!cap.ok) {
      if (mode === IMPORT_MODE.APPEND && cap.overflow > 0 && cap.free > 0) {
        incoming = incoming.slice(0, cap.free);
        stats.errors.push(`Truncated to ${incoming.length} target(s) to fit free slots.`);
        flmLog("WARN", `Import truncated to ${incoming.length} target(s) (capacity).`);
      } else {
        throw new Error(cap.message);
      }
    }
    if (mode === IMPORT_MODE.APPEND) {
      const dup = analyzeDuplicates(incoming, list.targets);
      stats.duplicates = dup.duplicateCount;
      if (dup.duplicateCount) {
        if (dupMode === DUP_MODE.ABORT) throw new Error(`Aborted: ${dup.duplicateCount} duplicate(s) found`);
        incoming = dup.fresh;
      }
    }
    return incoming;
  }

  async function addOneWithRetry(listId, t, signal, stats) {
    const label = `(${t.x}|${t.y})${t.name ? " " + t.name : ""}`;
    let res = null;
    for (let attempt = 1; attempt <= IMPORT_MAX_ATTEMPTS; attempt++) {
      res = await addTargetViaDialog(listId, t, signal);
      if (res.status === "ok" || res.status === "dup" || res.status === "cancelled") break;
      if (attempt < IMPORT_MAX_ATTEMPTS) {
        _step(stats, "warn", `${label}: ${res.message} — retry ${attempt + 1}/${IMPORT_MAX_ATTEMPTS}`);
        await delay(rnd(IMPORT_STEP_RETRY_MS));
      }
    }
    if (!res) res = { status: "error", message: "no result" };
    if (res.status === "ok") {
      stats.done++;
      _step(stats, "ok", label + (res.message ? " — " + res.message : ""));
    } else if (res.status === "dup") {
      stats.skipped++;
      stats.duplicates++;
      _step(stats, "skip", label + " — duplicate (" + res.message + ")");
    } else if (res.status !== "cancelled") {
      stats.failed++;
      stats.errors.push(label + ": " + res.message);
      _step(stats, "fail", label + " — " + res.message);
    }
    return res.status;
  }

  async function runImport(listId, parsed, opts) {
    if (_importing) return { ok: false, error: "An import is already running." };
    const mode = opts && opts.mode === IMPORT_MODE.REPLACE ? IMPORT_MODE.REPLACE : IMPORT_MODE.APPEND;
    const dupMode = (opts && opts.dupMode) || DUP_MODE.SKIP;

    _importing = true;
    _importSignal = createSignal();
    const signal = _importSignal;
    const stats = newImportStats(listId, mode);
    _importStats = stats;

    try {
      if (!isFarmListPage()) throw new Error("Not on the farm-list page");
      flmLog("INFO", `Import started: list #${listId}, mode=${mode}, targets=${parsed.targets.length}`);

      const list = await ensureListExpanded(listId, signal);
      if (!list) throw new Error("List #" + listId + " is not rendered");

      const incoming = prepareIncoming(list, parsed, mode, dupMode, stats);
      if (!incoming.length) {
        stats.status = "done";
        stats.errors.push("Nothing to add — every target was already present.");
        return finishImport(stats, listId);
      }
      stats.total = incoming.length;

      if (mode === IMPORT_MODE.REPLACE) {
        _step(stats, "info", `Clearing list "${list.name}"…`);
        const del = await deleteAllSlotsInList(listId, signal);
        if (del.status !== "ok") {
          stats.status = del.status === "cancelled" ? "cancelled" : "failed";
          stats.errors.push("Delete step: " + del.message);
          return finishImport(stats, listId);
        }
        stats.deleted = del.deleted || 0;
        _step(stats, "ok", `Deleted ${stats.deleted} slot(s)`);
      }

      for (let i = 0; i < incoming.length; i++) {
        if (signal.cancelled) break;
        const st = await addOneWithRetry(listId, incoming[i], signal, stats);
        if (st === "cancelled") break;
        await delay(rnd(IMPORT_STEP_DELAY_MS));
      }

      if (signal.cancelled) stats.status = "cancelled";
      else if (stats.failed && !stats.done) stats.status = "failed";
      else if (stats.failed) stats.status = "partial";
      else stats.status = "done";
      return finishImport(stats, listId);
    } catch (e) {
      stats.status = "failed";
      stats.errors.push(String((e && e.message) || e));
      flmLog("ERROR", "Import failed: " + ((e && e.message) || e));
      return finishImport(stats, listId);
    } finally {
      _importing = false;
      _importSignal = null;
    }
  }

  function finishImport(stats, listId) {
    stats.finishedAt = now();
    try {
      if (isConfirmDialogVisible()) {
        const c = confirmDialogCancelButton();
        if (c) c.click();
      }
      if (isDialogVisible()) closeAnyDialog();
    } catch (e) {}
    // setListMeta merges with defaults, so it is null-safe for a list that has
    // never been touched before (listMeta() returns null in that case).
    setListMeta(listId, {
      lastImportAt: stats.finishedAt,
      lastImportStatus: stats.status,
      lastImportMode: stats.mode || null,
      lastImportCounts: {
        total: stats.total,
        done: stats.done,
        failed: stats.failed,
        skipped: stats.skipped,
        deleted: stats.deleted,
      },
    });
    const summary = `Import ${stats.status}: ${stats.done}/${stats.total} added, ${stats.skipped} skipped, ${stats.failed} failed`;
    flmLog(stats.status === "done" ? "INFO" : "WARN", summary);
    for (const er of stats.errors) flmLog("WARN", "  · " + er);
    try {
      // The summary is multi-part and worth reading — keep it up longer than a
      // one-line confirmation (success 9s, anything else 12s).
      showToast(
        summary,
        stats.status === "done" ? "ok" : stats.status === "failed" ? "err" : "warn",
        stats.status === "done" ? IMPORT_TOAST_OK_MS : IMPORT_TOAST_MS,
      );
    } catch (e) {}
    try {
      if (typeof onDataChanged === "function") onDataChanged();
    } catch (e) {}
    return stats;
  }

// ═══════════════════════════════════════════════════════════
// FILE: 08-runner.js (152 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Runner — starts a farm list by clicking Travian's own Start button.
  // A list is only startable when the server allows it (not full/inactive
  // and at least one active slot), so we never force it: we click, then
  // wait for the status text / wrapper class to change.
  // ─────────────────────────────────────────────────────────────
  const RUN_STATUS = {
    IDLE: "idle",
    STARTING: "starting",
    RUNNING: "running",
    DONE: "done",
    FAILED: "failed",
  };

  const _runs = new Map(); // listId -> { status, startedAt, finishedAt, message }

  function getRunState(listId) {
    return _runs.get(String(listId)) || { status: RUN_STATUS.IDLE, startedAt: 0, finishedAt: 0, message: "" };
  }

  function _setRunState(listId, patchObj) {
    const key = String(listId);
    const next = Object.assign({}, getRunState(key), patchObj);
    _runs.set(key, next);
    return next;
  }

  function isListRunning(listId) {
    const st = getRunState(listId).status;
    return st === RUN_STATUS.STARTING || st === RUN_STATUS.RUNNING;
  }

  function anyRunActive() {
    for (const v of _runs.values()) {
      if (v.status === RUN_STATUS.STARTING || v.status === RUN_STATUS.RUNNING) return true;
    }
    return false;
  }

  // Travian marks a started list with `started` on the wrapper and replaces the
  // status text ("Farm list started" / remaining time). Either signal counts.
  function _listStartedSignal(listId, prevStatusText) {
    const list = getListById(listId);
    if (!list) return false;
    if (list.wrapper.classList.contains("started")) return true;
    if (list.statusText && list.statusText !== prevStatusText) return true;
    return false;
  }

  function lastRunSummary(list) {
    if (!list.lastRunAt) return { text: "never", cls: "never", ago: null };
    const ago = now() - list.lastRunAt;
    return { text: formatElapsed(ago), cls: ago < 6 * 3600 * 1000 ? "recent" : "old", ago };
  }

  // Stale-run janitor: a "starting" state older than 60s is considered lost
  // (page reload mid-start), so we reset it instead of blocking the button.
  function sweepRunStates() {
    const t = now();
    for (const [key, v] of _runs) {
      if (v.status === RUN_STATUS.STARTING && t - v.startedAt > 60000) {
        _setRunState(key, { status: RUN_STATUS.FAILED, finishedAt: t, message: "start timed out" });
      } else if (v.status === RUN_STATUS.DONE && t - (v.finishedAt || v.startedAt) > 5 * 60000) {
        _runs.delete(key);
      }
    }
  }

  async function startList(listId, opts) {
    const key = String(listId);
    if (!isFarmListPage()) return { ok: false, error: "Not on the farm-list page" };
    if (_importing) return { ok: false, error: "An import is running — wait for it to finish." };
    if (isListRunning(key)) return { ok: false, error: "This list is already starting." };

    const list = getListById(key);
    if (!list) return { ok: false, error: "List #" + key + " is not rendered" };
    if (!list.startBtn) return { ok: false, error: "Start button not found for this list" };
    if (list.startDisabled) {
      return { ok: false, error: "Travian reports this list as not startable (empty / inactive / no troops)" };
    }
    if (!list.used) return { ok: false, error: "List has no active slots" };

    const prevStatus = list.statusText;
    _setRunState(key, { status: RUN_STATUS.STARTING, startedAt: now(), finishedAt: 0, message: "" });
    flmLog("INFO", `Starting farm list "${list.name}" (#${key}) of ${list.villageName || "?"}`);

    try {
      const click = await humanClick(list.startBtn);
      if (!click.ok) throw new Error("Start button not clickable (" + click.reason + ")");

      const confirmed = await waitFor(() => _listStartedSignal(key, prevStatus), 6000, 120);
      if (!confirmed.ok && isConfirmDialogVisible()) {
        const btn = confirmDialogButton();
        if (btn) {
          await humanClick(btn);
          await waitFor(() => _listStartedSignal(key, prevStatus), 6000, 120);
        }
      }

      const nowList = getListById(key) || list;
      const started =
        nowList.wrapper.classList.contains("started") || (nowList.statusText && nowList.statusText !== prevStatus);
      const status = started ? RUN_STATUS.RUNNING : RUN_STATUS.DONE;

      // listMeta() is null for a list with no history yet — merge via setListMeta.
      const meta = listMeta(key) || {};
      setListMeta(key, {
        lastRunAt: now(),
        lastRunStatus: started ? "started" : "unknown",
        lastRunVillage: nowList.villageName || meta.lastRunVillage || "",
        lastRunBy: (opts && opts.by) || "manual",
        lastRunCount: nowList.targetsCount,
        lastRunStatusText: nowList.statusText || "",
      });

      _setRunState(key, { status, message: nowList.statusText || "" });
      flmLog("INFO", `Farm list "${nowList.name}" started.`);
      try {
        showToast(`Started "${nowList.name}" (${nowList.targetsCount} targets)`, "ok");
      } catch (e) {}
      try {
        if (typeof onDataChanged === "function") onDataChanged();
      } catch (e) {}
      return { ok: true, status, list: nowList };
    } catch (e) {
      const msg = String((e && e.message) || e);
      _setRunState(key, { status: RUN_STATUS.FAILED, finishedAt: now(), message: msg });
      flmLog("ERROR", `Start failed for "${list.name}": ${msg}`);
      try {
        showToast(`Start failed: ${msg}`, "err");
      } catch (err) {}
      return { ok: false, error: msg };
    }
  }

  // Starts every startable list found on the page (per village, DOM order).
  async function startAllVisible(opts) {
    const lists = scanFarmLists().filter((l) => l.canStart);
    if (!lists.length) return { ok: false, started: 0, total: 0, errors: ["No startable list found"] };
    flmLog("INFO", `Start all: ${lists.length} startable list(s) found`);
    let started = 0;
    const errors = [];
    for (const l of lists) {
      if (isImporting()) break;
      const r = await startList(l.id, opts);
      if (r.ok) started++;
      else errors.push(`${l.name}: ${r.error}`);
      await delay(rnd(IMPORT_STEP_DELAY_MS));
    }
    return { ok: started > 0, started, total: lists.length, errors };
  }

// ═══════════════════════════════════════════════════════════
// FILE: 09-ui-panel.js (457 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Panel — an in-flow box injected inside #rallyPointFarmList,
  // directly above the first .villageWrapper (same idea as the
  // Attack Report Analyzer box inside #content). Never floating.
  // ─────────────────────────────────────────────────────────────
  const FLM_PANEL_HOST_ID = "rallyPointFarmList";
  const PANEL_CSS = `
#flm-panel{width:100%;box-sizing:border-box;margin:0 0 10px 0;padding:0;
  font-family:Verdana,Arial,sans-serif;font-size:12px;color:#1a2050;
  background:linear-gradient(180deg,#f9fbff,#e8eff9);border:1px solid #8a9ac0;
  border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden}
#flm-panel *{box-sizing:border-box}
#flm-panel .flm-head{display:flex;align-items:center;gap:6px;padding:6px 10px;
  background:linear-gradient(180deg,#dfe8f7,#c3d2ea);border-bottom:1px solid #8a9ac0;
  font-weight:bold;font-size:12px;color:#1a2050}
#flm-panel .flm-title{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#flm-panel .flm-head-btn{font-family:Verdana,Arial,sans-serif;font-size:11px;line-height:1.2;
  background:linear-gradient(180deg,#fbfdff,#dbe5f4);color:#1a2050;border:1px solid #8a9ac0;
  border-radius:4px;padding:2px 7px;cursor:pointer;white-space:nowrap}
#flm-panel .flm-head-btn:hover{background:linear-gradient(180deg,#ffffff,#e9f0fb)}
#flm-panel .flm-head-btn:disabled{opacity:.5;cursor:default}
#flm-panel .flm-body{padding:8px 10px}
#flm-panel .flm-summary{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px;padding-bottom:5px;
  border-bottom:1px dashed #b8c4dc;font-size:11px;color:#4a5a80}
#flm-panel .flm-summary b{color:#1a2050}
#flm-panel .flm-group{margin:8px 0 4px}
#flm-panel .flm-group-title{font-weight:bold;font-size:11px;letter-spacing:.3px;color:#2a4a70;
  margin-bottom:4px;display:flex;justify-content:space-between;gap:6px}
#flm-panel .flm-list{border:1px solid #c3d2ea;background:#fdfdff;border-radius:4px;
  padding:5px 7px;margin-bottom:5px}
#flm-panel .flm-list.flm-list-running{border-color:#4c8a3f;box-shadow:0 0 0 1px rgba(76,138,63,.30) inset}
#flm-panel .flm-list-row1{display:flex;align-items:center;gap:6px}
#flm-panel .flm-list-name{flex:1 1 auto;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#flm-panel .flm-badge{font-size:10px;padding:1px 5px;border-radius:8px;background:#e2e9f6;color:#3a4a70;white-space:nowrap}
#flm-panel .flm-badge.ok{background:#d5ecd0;color:#2f6b25}
#flm-panel .flm-badge.warn{background:#f8e3b8;color:#8a5a09}
#flm-panel .flm-badge.err{background:#f6d2cf;color:#8d2b22}
#flm-panel .flm-list-row2{display:flex;align-items:center;gap:8px;margin-top:3px;font-size:11px;color:#4a5a80}
#flm-panel .flm-timer{font-variant-numeric:tabular-nums}
#flm-panel .flm-timer.recent{color:#2f6b25;font-weight:bold}
#flm-panel .flm-timer.old{color:#8a5a09}
#flm-panel .flm-actions{display:flex;gap:4px;margin-left:auto}
#flm-panel .flm-actions button{font-family:Verdana,Arial,sans-serif;font-size:11px;line-height:1.2;
  border:1px solid #8a9ac0;background:linear-gradient(180deg,#fbfdff,#dbe5f4);color:#1a2050;
  border-radius:4px;padding:2px 7px;cursor:pointer}
#flm-panel .flm-actions button:hover{background:linear-gradient(180deg,#ffffff,#e9f0fb)}
#flm-panel .flm-actions button:disabled{opacity:.5;cursor:default}
#flm-panel .flm-actions button.flm-primary{background:linear-gradient(180deg,#eaf6e4,#d2e8c8);border-color:#5f8a4f}
#flm-panel .flm-empty{padding:10px;text-align:center;color:#6a7a98;font-style:italic}
#flm-panel .flm-foot{padding:5px 10px;border-top:1px solid #c3d2ea;background:#eef3fb;font-size:10px;
  color:#4a5a80;display:flex;justify-content:space-between;gap:6px}
#flm-panel .flm-progress-wrap{margin:0 0 6px 0;padding:5px 7px;border:1px solid #b8c4dc;
  border-radius:4px;background:#f4f8ff;font-size:11px;color:#2a4a70}
#flm-panel .flm-progress-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px}
#flm-panel .flm-import-log{max-height:88px;overflow:auto;margin-top:4px;font:10px/1.45 Consolas,monospace;color:#5a6a88}
#flm-panel .flm-import-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#flm-panel .flm-import-log .ok{color:#2f6b25}
#flm-panel .flm-import-log .skip{color:#8a5a09}
#flm-panel .flm-import-log .fail{color:#8d2b22}
#flm-panel .flm-head-btn.flm-stop{border-color:#a8574a;color:#8d2b22}
#flm-panel .flm-progress{height:6px;background:#dbe5f4;border-radius:3px;overflow:hidden;margin:0}
#flm-panel .flm-progress > i{display:block;height:100%;background:#5f8a4f;width:0;transition:width .3s}
.flm-toast{position:fixed;right:16px;bottom:16px;max-width:340px;padding:8px 12px;border-radius:5px;
  font:12px Verdana,Arial,sans-serif;color:#fff;z-index:2147483001;box-shadow:0 4px 16px rgba(0,0,0,.35)}
.flm-toast-ok{background:#3f7a33}
.flm-toast-warn{background:#a8750c}
.flm-toast-err,.flm-toast-error{background:#8d2b22}
.flm-dbg{font:11px Verdana,Arial,sans-serif;color:#1a2050}
.flm-dbg table{width:100%;margin-top:6px;font-size:11px;border-collapse:collapse}
.flm-dbg th{text-align:left}
.flm-dbg button{font:11px Verdana,Arial,sans-serif;margin-right:6px}
`;

  function ensurePanelStyle() {
    if (document.getElementById(FLM_STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = FLM_STYLE_ID;
    st.textContent = PANEL_CSS;
    document.head.appendChild(st);
  }

  let _panelEl = null;
  let _panelRenderTimer = null;

  function removePanel() {
    const old = document.getElementById(FLM_PANEL_ID);
    if (old) old.remove();
    _panelEl = null;
  }

  // The host is Travian's own wrapper for the farm-list tab. If it is missing
  // (any other page, or the tab is still loading) we simply do not inject.
  function getPanelHost() {
    return document.getElementById(FLM_PANEL_HOST_ID);
  }

  function isPanelMounted() {
    const host = getPanelHost();
    if (!host) return false;
    return !!_panelEl && _panelEl.isConnected && _panelEl.parentNode === host;
  }

  // Insert before the first .villageWrapper so the box sits at the top of the
  // farm-list tab, above every village block. Falls back to prepend.
  function mountPanel(el) {
    const host = getPanelHost();
    if (!host) return false;
    const first = host.querySelector(".villageWrapper");
    if (first && first.parentNode === host) host.insertBefore(el, first);
    else host.insertBefore(el, host.firstChild);
    return true;
  }

  // Kept for the public API surface (window.FLM.setCollapsed). The header
  // Collapse button was removed in 1.0.3, so this no longer changes anything —
  // it only re-renders and reports that collapsing is unsupported.
  function setPanelCollapsed(v) {
    renderPanel();
    return false;
  }

  function _listCardHtml(list) {
    const run = getRunState(list.id);
    const timer = lastRunSummary(list);
    const running = run.status === RUN_STATUS.STARTING || run.status === RUN_STATUS.RUNNING;
    const slotBadge =
      list.used >= list.capacity
        ? `<span class="flm-badge warn" title="farm list is full">${list.used}/${list.capacity}</span>`
        : `<span class="flm-badge">${list.used}/${list.capacity}</span>`;
    const startLabel = run.status === RUN_STATUS.STARTING ? "Starting…" : "Start";
    const startDisabled = running || !!list.startDisabled || !list.used || isImporting();
    const importDisabled = isImporting();
    return `
<div class="flm-list${running ? " flm-list-running" : ""}" data-list-id="${esc(list.id)}">
  <div class="flm-list-row1">
    <span class="flm-list-name" title="${esc(list.name)}">${esc(list.name)}</span>
    ${list.statusText ? `<span class="flm-badge${/\d/.test(list.statusText) ? " ok" : ""}" title="list status">${esc(list.statusText)}</span>` : ""}
    <span class="flm-badge" title="active slots / capacity">${esc(String(list.used))}/${esc(String(list.capacity))}</span>
  </div>
  <div class="flm-list-row2">
    <span title="last run">🕒 <span class="flm-timer ${timer.cls}">${esc(timer.text)}</span></span>
    <span title="targets in this list">🎯 ${esc(String(list.targetsCount))}</span>
    <span class="flm-actions">
      <button type="button" class="flm-primary" data-act="start" ${startDisabled ? "disabled" : ""}
        title="${esc(startDisabled ? "cannot start now" : "start this farm list")}">${esc(startLabel)}</button>
      <button type="button" data-act="import" data-list-id="${esc(list.id)}" ${importDisabled ? "disabled" : ""}
        title="import targets from JSON into this list">Import</button>
    </span>
  </div>
</div>`;
  }

  function _groupHtml(villageName, lists) {
    return `
<div class="flm-group">
  <div class="flm-group-title"><span>${esc(villageName || "unknown village")}</span><span>${lists.length} list(s)</span></div>
  ${lists.map(_listCardHtml).join("")}
</div>`;
  }

  function _panelSummaryHtml(lists) {
    const total = lists.length;
    const startable = lists.filter((l) => l.canStart).length;
    const targets = lists.reduce((a, l) => a + l.targetsCount, 0);
    const last = lists.reduce((a, l) => Math.max(a, l.lastRunAt || 0), 0);
    return `
<div class="flm-summary">
  <span>lists <b>${total}</b></span>
  <span>startable <b>${startable}</b></span>
  <span>targets <b>${targets}</b></span>
  <span>last run <b>${last ? esc(formatElapsed(now() - last)) : "never"}</b></span>
</div>`;
  }

  function _panelBodyHtml() {
    if (!isFarmListPage()) {
      return `<div class="flm-empty">Open the rally point → <b>Farm list</b> tab (build.php?id=…&amp;gid=16&amp;tt=99).</div>`;
    }
    const lists = scanFarmLists();
    if (!lists.length) return `<div class="flm-empty">No farm list found on this page.</div>`;
    const groups = new Map();
    for (const l of lists) {
      const key = l.villageName || "unknown village";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(l);
    }
    return Array.from(groups.entries())
      .map(([v, arr]) => _groupHtml(v, arr))
      .join("");
  }

  // Import progress block — replaces the old in-modal log (the modal now closes
  // as soon as the run starts, see _runModalImport).
  function _importProgressHtml() {
    const st = getImportStats();
    if (!st || st.status !== "running") return "";
    const done = st.done + st.failed + st.skipped;
    const pct = st.total ? Math.min(100, Math.round((done / st.total) * 100)) : 0;
    const tail = (st.steps || []).slice(-12);
    const rows = tail
      .map((s) => `<div class="${esc(s.kind === "info" ? "" : s.kind)}">${esc(s.label)}</div>`)
      .join("");
    return `<div class="flm-progress-wrap">
    <div class="flm-progress-head">
      <span>Importing list #${esc(String(st.listId || "?"))}…</span>
      <span><b>${done}</b>/${st.total} — ✓${st.done} ⏭${st.skipped} ✗${st.failed}</span>
    </div>
    <div class="flm-progress" title="import progress"><i style="width:${pct}%"></i></div>
    ${rows ? `<div class="flm-import-log">${rows}</div>` : ""}
  </div>`;
  }

  function _onPanelClick(ev) {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const card = btn.closest(".flm-list");
    const listId = btn.getAttribute("data-list-id") || (card ? card.getAttribute("data-list-id") : null);
    if (act === "start" && listId) {
      ev.preventDefault();
      startList(listId, { by: "panel" }).then(() => {
        startPanelPolling();
      });
    } else if (act === "import" && listId) {
      ev.preventDefault();
      openImportModal(listId);
    } else if (act === "start-all") {
      ev.preventDefault();
      btn.disabled = true;
      startAllVisible({ by: "panel" }).then((r) => {
        btn.disabled = false;
        if (!r.ok) showToast("Start all: " + (r.errors[0] || "nothing started"), "warn");
        renderPanel();
      });
    } else if (act === "stop-import") {
      ev.preventDefault();
      if (cancelImport("stop button")) {
        btn.disabled = true;
        showToast("Cancelling import — finishes the current target first", "warn");
      }
    } else if (act === "refresh") {
      ev.preventDefault();
      refreshPanelFromPage();
    }
  }

  // Re-scans the page and tells the user what actually changed. A bare
  // renderPanel() is invisible when nothing moved, which made the button look
  // broken — so the result is always reported through a toast.
  function refreshPanelFromPage() {
    if (!isFarmListPage()) {
      showToast("Refresh: not on the farm list page — nothing to scan", "warn");
      flmLog("WARN", "Refresh requested outside the farm list page");
      renderPanel();
      return { ok: false, lists: 0, startable: 0, targets: 0 };
    }
    if (isImporting()) {
      showToast("Refresh unavailable while an import is running", "warn");
      return { ok: false, lists: 0, startable: 0, targets: 0, importing: true };
    }
    let lists = [];
    try {
      lists = scanFarmLists();
    } catch (e) {
      flmLog("ERROR", "Refresh scan failed: " + ((e && e.message) || e));
      showToast("Refresh failed: " + ((e && e.message) || e), "err");
      return { ok: false, lists: 0, startable: 0, targets: 0 };
    }
    // Force a real rebuild: the length-keyed cache in renderPanel() would
    // otherwise swallow a change that keeps the same HTML length.
    if (_panelEl) _panelEl._lastKey = null;
    renderPanel();
    const startable = lists.filter((l) => l.canStart).length;
    const targets = lists.reduce((a, l) => a + l.targetsCount, 0);
    const msg = lists.length
      ? `Refresh: ${lists.length} list(s) rescanned — ${startable} startable, ${targets} target(s)`
      : "Refresh: no farm list found on this page";
    flmLog(lists.length ? "INFO" : "WARN", msg.replace("Refresh: ", ""));
    showToast(msg, lists.length ? "ok" : "warn");
    return { ok: true, lists: lists.length, startable, targets };
  }

  function renderPanel() {
    if (typeof FLM === "undefined") return;
    if (!isFarmListPage()) {
      // Auto-hide outside the farm-list page — the panel simply is not
      // injected there. renderPanel() in 09-ui-panel.js is re-run by the
      // poller as soon as the tab is back.
      return;
    }
    ensurePanelStyle();
    const lists = scanFarmLists();
    const importing = isImporting();
    const parts = [];

    parts.push(`<div class="flm-head">`);
    parts.push(`<span class="flm-title" title="Nova Farm List Manager">🌾 Farm List Manager v${esc(FLM_VERSION)}</span>`);
    // Every header action except Stop is blocked while an import drives the
    // page's dialogs — re-scanning or starting lists mid-run breaks it.
    parts.push(
      `<button type="button" class="flm-head-btn" data-act="start-all"${importing || !lists.some((l) => l.canStart) ? " disabled" : ""} title="start every startable list">Start all</button>`,
    );
    parts.push(
      `<button type="button" class="flm-head-btn" data-act="refresh"${importing ? " disabled" : ""} title="rescan the page">Refresh</button>`,
    );
    if (importing) {
      parts.push(`<button type="button" class="flm-head-btn flm-stop" data-act="stop-import" title="cancel the running import">Stop import</button>`);
    }
    parts.push(`</div>`);

    parts.push(`<div class="flm-body">`);
    parts.push(_panelSummaryHtml(lists));
    parts.push(_importProgressHtml());
    parts.push(_panelBodyHtml());
    parts.push(`</div>`);
    parts.push(
      `<div class="flm-foot"><span>v${esc(FLM_VERSION)}</span><span>${esc(FLM.tc.version() || "no Nova")}</span></div>`,
    );

    const html = parts.join("");

    if (isPanelMounted()) {
      const bodyKey = html.length;
      if (_panelEl._lastKey === bodyKey) return;
      _panelEl._lastKey = bodyKey;
      _panelEl.innerHTML = html;
      return;
    }

    // Not mounted (first render, soft navigation, or Travian re-rendered the
    // tab and dropped our node) → build fresh and insert into the host.
    removePanel();
    const el = document.createElement("div");
    el.id = FLM_PANEL_ID;
    el.className = "flm-panel";
    el.innerHTML = html;
    el._lastKey = html.length;
    el.addEventListener("click", _onPanelClick);
    if (!mountPanel(el)) return; // no #rallyPointFarmList → do not inject
    _panelEl = el;
  }

  // While an import runs, re-render only the progress block and flip the header
  // buttons. A full renderPanel() would rebuild every list row (and drop the
  // user's scroll position) on each of the ~1s poll ticks.
  function updatePanelProgressOnly() {
    if (!isPanelMounted()) return false;
    const st = getImportStats();
    const body = _panelEl.querySelector(".flm-body");
    if (!body) return false;

    if (!st || st.status !== "running") {
      // Run just ended: put the panel back into its normal state.
      if (_panelEl.querySelector(".flm-progress-wrap")) renderPanel();
      return false;
    }

    let wrap = body.querySelector(".flm-progress-wrap");
    const html = _importProgressHtml();
    if (!wrap) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      wrap = tmp.firstElementChild;
      if (!wrap) return false;
      const summary = body.querySelector(".flm-summary");
      body.insertBefore(wrap, summary ? summary.nextSibling : body.firstChild);
    } else {
      // Only touch the DOM when something actually changed.
      const key = html.length + "|" + st.done + "|" + st.failed + "|" + st.skipped + "|" + st.total;
      if (wrap._flmKey !== key) {
        wrap._flmKey = key;
        wrap.outerHTML = html;
      }
    }

    // Header buttons: block everything except Stop while the run is live.
    const head = _panelEl.querySelector(".flm-head");
    if (head) {
      const startAll = head.querySelector("button[data-act='start-all']");
      const refresh = head.querySelector("button[data-act='refresh']");
      if (startAll) startAll.disabled = true;
      if (refresh) refresh.disabled = true;
      if (!head.querySelector("button[data-act='stop-import']")) {
        const stop = document.createElement("button");
        stop.type = "button";
        stop.className = "flm-head-btn flm-stop";
        stop.setAttribute("data-act", "stop-import");
        stop.title = "cancel the running import";
        stop.textContent = "Stop import";
        head.appendChild(stop);
      }
    }
    return true;
  }

  // Lightweight periodic refresh — timers ("3m ago") and Travian-side state
  // changes (a list becoming startable again) need to be reflected without
  // a full re-render loop.
  let _panelPollTimer = null;
  let _panelObs = null;

  function startPanelPolling() {
    stopPanelPolling();
    _panelPollTimer = setInterval(() => {
      try {
        sweepRunStates();
        if (!isFarmListPage()) {
          removePanel();
          return;
        }
        // Travian re-renders the tab on soft navigation / AJAX refreshes and
        // can drop our node — re-inject before doing anything else.
        if (!isPanelMounted()) {
          renderPanel();
          return;
        }
        if (isImporting()) {
          // Do not re-render the whole body mid-import (it would rebuild the
          // list rows under the user's cursor); update the bar only.
          const st = getImportStats();
          if (st && st.status === "running") updatePanelProgressOnly();
          return;
        }
        if (isDialogVisible()) return;
        renderPanel();
      } catch (e) {
        flmLog("ERROR", "Panel poll failed", e);
      }
    }, POLL_MS);
  }

  function stopPanelPolling() {
    if (_panelPollTimer) {
      clearInterval(_panelPollTimer);
      _panelPollTimer = null;
    }
  }

  // Copy-safe helper for the public API / debug tab
  function getPanelSnapshot() {
    return {
      present: !!(_panelEl && _panelEl.isConnected),
      lists: scanFarmLists().map((l) => ({
        id: l.id,
        name: l.name,
        village: l.villageName,
        used: l.used,
        capacity: l.capacity,
        targets: l.targetsCount,
        canStart: l.canStart,
        lastRunAt: l.lastRunAt,
        run: getRunState(l.id),
      })),
      importing: isImporting(),
    };
  }

// ═══════════════════════════════════════════════════════════
// FILE: 10-ui-modals.js (320 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Import modal — pick mode, paste JSON, see the parsed preview,
  // then hand over to runImport(). Single instance, own style block.
  // ─────────────────────────────────────────────────────────────
  const MODAL_CSS = `
.flm-backdrop{position:fixed;inset:0;background:rgba(30,22,10,.55);z-index:2147483090;display:flex;
  align-items:center;justify-content:center;font:12px/1.5 Verdana,Arial,sans-serif}
.flm-modal{width:560px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;background:#f7f3e8;color:#3d2f1f;
  border:1px solid #a08a63;border-radius:6px;box-shadow:0 10px 34px rgba(0,0,0,.45);overflow:hidden}
.flm-modal-head{padding:8px 10px;background:linear-gradient(#7d6a48,#5c4a2c);color:#f4e9cf;font-weight:bold;
  display:flex;justify-content:space-between;align-items:center;gap:8px}
.flm-modal-head button{background:#efe3c6;border:1px solid #8c784f;border-radius:3px;color:#3d2f1f;font:11px Verdana;padding:2px 7px;cursor:pointer}
.flm-modal-body{padding:10px;overflow:auto;flex:1 1 auto}
.flm-modal-foot{padding:8px 10px;border-top:1px solid #d8c9a8;background:#f1e8d3;display:flex;gap:8px;justify-content:flex-end}
.flm-modal-foot button{font:11px Verdana,Arial,sans-serif;border:1px solid #8c784f;background:#efe3c6;color:#3d2f1f;
  border-radius:3px;padding:4px 12px;cursor:pointer}
.flm-modal-foot button:hover{background:#fff6e0}
.flm-modal-foot button:disabled{opacity:.5;cursor:default}
.flm-modal-foot button.flm-primary{background:#d7e7cf;border-color:#5f8a4f}
.flm-field{margin-bottom:8px}
.flm-field label{display:block;font-weight:bold;font-size:11px;margin-bottom:3px;color:#6a5940}
.flm-field textarea{width:100%;box-sizing:border-box;height:140px;font:11px Consolas,monospace;border:1px solid #b9a884;
  border-radius:3px;padding:5px;resize:vertical;background:#fffdf5;color:#3d2f1f}
.flm-field select,.flm-field input[type=text]{font:11px Verdana;border:1px solid #b9a884;border-radius:3px;padding:3px 4px;background:#fffdf5}
.flm-modes{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.flm-modes label{display:inline-flex;align-items:center;gap:4px;font-weight:normal;font-size:11px;color:#3d2f1f}
.flm-preview{border:1px solid #d8c9a8;background:#fffdf5;border-radius:4px;padding:6px 8px;font-size:11px}
.flm-preview .flm-k{color:#6a5940}
.flm-preview ul{margin:4px 0 0;padding-left:16px}
.flm-preview li{color:#8a5a09}
.flm-preview li.err{color:#8d2b22}
`;

  let _modalEl = null;
  let _modalCtx = null;

  function ensureModalStyle() {
    const id = FLM_STYLE_ID + "-modal";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = MODAL_CSS;
    document.head.appendChild(st);
  }

  function closeImportModal() {
    if (_modalEl) {
      if (_modalCtx && _modalCtx.onClose) {
        try {
          _modalCtx.onClose();
        } catch (e) {}
      }
      _modalEl.remove();
      _modalEl = null;
    }
    _modalCtx = null;
  }

  function _modalTemplate(list, lists) {
    const optHtml = lists
      .map(
        (l) =>
          `<option value="${esc(l.id)}"${String(l.id) === String(list.id) ? " selected" : ""}>${esc(l.villageName || "?")} → ${esc(l.name)} (${l.used}/${l.capacity})</option>`,
      )
      .join("");
    return `
<div class="flm-backdrop" id="flm-import-backdrop">
  <div class="flm-modal" role="dialog" aria-modal="true" aria-labelledby="flm-modal-title">
    <div class="flm-modal-head">
      <span id="flm-modal-title">Import targets → ${esc(list.name)}</span>
      <button type="button" data-mact="close" title="close">✕</button>
    </div>
    <div class="flm-modal-body">
      <div class="flm-field">
        <label for="flm-target-list">Target farm list</label>
        <select id="flm-target-list">${optHtml}</select>
      </div>
      <div class="flm-field">
        <label>Mode</label>
        <div class="flm-modes">
          <label><input type="radio" name="flm-mode" value="append" checked /> Append (keep existing slots)</label>
          <label><input type="radio" name="flm-mode" value="replace" /> Replace (delete all slots first)</label>
        </div>
      </div>
      <div class="flm-field">
        <label>Duplicate handling</label>
        <div class="flm-modes">
          <label><input type="radio" name="flm-dup" value="skip" checked /> Skip</label>
          <label><input type="radio" name="flm-dup" value="force" /> Force (let Travian decide)</label>
          <label><input type="radio" name="flm-dup" value="abort" /> Abort if any</label>
        </div>
      </div>
      <div class="flm-field">
        <label for="flm-json">JSON payload</label>
        <textarea id="flm-json" spellcheck="false" placeholder='{"_format":"farm-list-v1","list":{"targets":[{"name":"x","x":12,"y":-34}]}}'></textarea>
      </div>
      <div class="flm-field">
        <div class="flm-modes">
          <button type="button" data-mact="validate">Validate &amp; preview</button>
          <label style="margin-left:auto"><input type="checkbox" id="flm-export-cur" /> load current list targets</label>
        </div>
      </div>
      <div class="flm-preview" id="flm-preview"><span class="flm-k">Paste JSON and press “Validate &amp; preview”.</span></div>
      <div class="flm-k" style="margin-top:6px">The modal closes when the import starts — progress and the step log move to the panel above the list.</div>
    </div>
    <div class="flm-modal-foot">
      <button type="button" data-mact="cancel">Cancel</button>
      <button type="button" class="flm-primary" data-mact="run" disabled>Start import</button>
    </div>
  </div>
</div>`;
  }

  function _modalEl_(sel) {
    return _modalEl ? _modalEl.querySelector(sel) : null;
  }

  function _modalMode() {
    const r = _modalEl ? _modalEl.querySelector("input[name='flm-mode']:checked") : null;
    return r ? r.value : IMPORT_MODE.APPEND;
  }

  function _modalDupMode() {
    const r = _modalEl ? _modalEl.querySelector("input[name='flm-dup']:checked") : null;
    return r ? r.value : DUP_MODE.SKIP;
  }

  function _modalCurrentListId() {
    const sel = _modalEl_("#flm-target-list");
    return sel ? sel.value : null;
  }

  function _renderPreview() {
    const box = _modalEl_("#flm-preview");
    if (!box) return;
    const ctx = _modalCtx;
    if (!ctx || !ctx.parsed) {
      box.innerHTML = `<span class="flm-k">Paste JSON and press “Validate &amp; preview”.</span>`;
      return;
    }
    const p = ctx.parsed;
    const listId = _modalCurrentListId();
    const list = listId ? getListById(listId) : null;
    const mode = _modalMode();
    const cap = list ? capacityCheck(list, p.targets.length, mode) : null;
    const dup = list ? analyzeDuplicates(p.targets, list.targets) : { duplicateCount: 0, fresh: p.targets };

    const rows = [];
    rows.push(`<div><span class="flm-k">format:</span> ${esc(p.format)}</div>`);
    rows.push(
      `<div><span class="flm-k">targets:</span> <b>${p.targets.length}</b> valid of ${p.totalRaw} (${esc(summarizeTargets(p.targets))})</div>`,
    );
    if (p.listName) rows.push(`<div><span class="flm-k">payload list name:</span> ${esc(p.listName)}</div>`);
    if (list) {
      rows.push(
        `<div><span class="flm-k">target list:</span> ${esc(list.name)} — ${list.used}/${list.capacity} slots${mode === IMPORT_MODE.REPLACE ? " (will be cleared first)" : ""}</div>`,
      );
      rows.push(
        `<div><span class="flm-k">duplicates in list:</span> <b>${dup.duplicateCount}</b>${dup.duplicateCount && mode === IMPORT_MODE.APPEND && _modalDupMode() === DUP_MODE.SKIP ? ` → ${dup.fresh.length} will be added` : ""}</div>`,
      );
    }
    if (cap && !cap.ok) rows.push(`<div class="flm-k" style="color:#8d2b22">⚠ ${esc(cap.message)}</div>`);

    const warn = p.warnings.slice(0, 8);
    if (warn.length) {
      rows.push(`<div class="flm-k" style="margin-top:4px">warnings:</div><ul>`);
      for (const w of warn) rows.push(`<li>${esc(w)}</li>`);
      if (p.warnings.length > warn.length) rows.push(`<li>… ${p.warnings.length - warn.length} more</li>`);
      rows.push(`</ul>`);
    }
    if (p.errors.length) {
      rows.push(`<div class="flm-k" style="margin-top:4px;color:#8d2b22">errors:</div><ul>`);
      for (const e of p.errors) rows.push(`<li class="err">${esc(e)}</li>`);
      rows.push(`</ul>`);
    }
    box.innerHTML = rows.join("");

    const runBtn = _modalEl_("button[data-mact='run']");
    if (runBtn) runBtn.disabled = !(p.ok && list && (!cap || cap.ok)) || isImporting();
  }

  function _validateModalPayload() {
    const ta = _modalEl_("#flm-json");
    if (!_modalCtx) return;
    _modalCtx.parsed = parseImportPayload(ta ? ta.value : "");
    if (_modalCtx.parsed.errors.length) {
      flmLog("WARN", "Import payload rejected: " + _modalCtx.parsed.errors[0]);
    } else {
      flmLog(
        "INFO",
        `Payload parsed (${_modalCtx.parsed.format}): ${_modalCtx.parsed.targets.length} target(s), ${_modalCtx.parsed.warnings.length} warning(s)`,
      );
    }
    _renderPreview();
  }

  async function _runModalImport(ev) {
    if (!_modalCtx || !_modalCtx.parsed || !_modalCtx.parsed.ok) return;
    const listId = _modalCurrentListId();
    if (!listId) return;
    const mode = _modalMode();
    const dupMode = _modalDupMode();
    const total = _modalCtx.parsed.targets.length;

    if (mode === IMPORT_MODE.REPLACE) {
      const list = getListById(listId);
      const ok = window.confirm(
        `Replace mode will DELETE all ${list ? list.used : "?"} slot(s) of "${list ? list.name : "#" + listId}" before importing.\n\nContinue?`,
      );
      if (!ok) {
        flmLog("WARN", "Replace import cancelled by user at the delete confirmation");
        return;
      }
    }

    // Capture everything the run needs BEFORE closing: closeImportModal()
    // drops _modalCtx, so reading it afterwards would import nothing.
    const parsed = _modalCtx.parsed;
    flmLog("INFO", `importing ${total} target(s), mode=${mode}, dup=${dupMode}`);

    // The run drives Travian's own dialogs and needs the page, not the modal —
    // hand it off and close so the user watches progress on the main panel.
    closeImportModal();
    renderPanel();

    let report = null;
    try {
      report = await runImport(listId, parsed, { mode, dupMode });
    } catch (e) {
      flmLog("ERROR", "Import crashed: " + ((e && e.message) || e));
      showToast("Import failed: " + ((e && e.message) || e), "err");
    } finally {
      renderPanel();
    }
    if (report) {
      flmLog(
        report.status === "done" ? "INFO" : "WARN",
        `Import done: ${report.done}/${report.total} added, ${report.skipped} skipped, ${report.failed} failed`,
      );
    }
  }

  function _onModalClick(ev) {
    const btn = ev.target.closest("button[data-mact]");
    if (!btn) return;
    const act = btn.getAttribute("data-mact");
    if (act === "close" || act === "cancel") {
      ev.preventDefault();
      if (isImporting()) {
        cancelImport("user closed the modal");
        flmLog("WARN", "Import cancellation requested — finishing the current step first");
      }
      closeImportModal();
      renderPanel();
    } else if (act === "validate") {
      ev.preventDefault();
      _validateModalPayload();
    } else if (act === "run") {
      ev.preventDefault();
      _runModalImport(ev);
    }
  }

  function _onModalChange(ev) {
    if (!_modalCtx) return;
    if (ev.target && ev.target.id === "flm-export-cur") {
      const ta = _modalEl_("#flm-json");
      if (ev.target.checked && ta) {
        const list = getListById(_modalCurrentListId());
        if (list) {
          ta.value = JSON.stringify(exportListAsPayload(list), null, 2);
          _validateModalPayload();
        }
      }
      return;
    }
    _renderPreview();
  }

  function openImportModal(listId) {
    const lists = scanFarmLists();
    const list = lists.find((l) => String(l.id) === String(listId));
    if (!list) {
      showToast("List #" + listId + " is not on this page", "err");
      return;
    }
    if (isImporting()) {
      showToast("An import is already running", "warn");
      return;
    }
    closeImportModal();
    ensurePanelStyle();
    ensureModalStyle();
    const holder = document.createElement("div");
    holder.innerHTML = _modalTemplate(list, lists);
    // The template starts with a newline, so firstElementChild is not
    // guaranteed to be the backdrop — resolve it explicitly.
    let backdrop = holder.firstElementChild;
    if (!backdrop || !backdrop.classList.contains("flm-backdrop")) {
      const all = holder.querySelectorAll("*");
      backdrop = Array.prototype.find.call(all, (n) => n.classList && n.classList.contains("flm-backdrop"));
    }
    if (!backdrop) {
      flmLog("ERROR", "Import modal template did not produce a backdrop node");
      showToast("Could not open the import dialog", "err");
      return;
    }
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop && !isImporting()) closeImportModal();
    });
    backdrop.addEventListener("click", _onModalClick);
    backdrop.addEventListener("change", _onModalChange);
    document.body.appendChild(backdrop);
    _modalEl = backdrop;
    _modalCtx = { listId: String(list.id), parsed: null, onClose: null };
    flmLog("INFO", `Import modal opened for "${list.name}" (#${list.id})`);
    const ta = _modalEl_("#flm-json");
    if (ta) ta.focus();
  }

// ═══════════════════════════════════════════════════════════
// FILE: 11-public-api.js (215 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Public API — window.FLM
  // Additive only. Every mutation goes through the same code paths the UI
  // uses, so the panel/timers stay in sync.
  // ─────────────────────────────────────────────────────────────
  const FLM_API = window.FLM || {};
  Object.assign(FLM_API, {
    version: FLM_VERSION,
    requiresNova: FLM_REQUIRES_NOVA_MIN,

    // ── page / scan ──────────────────────────────────────────
    isFarmListPage,
    url: farmListUrl,
    lists() {
      return scanFarmLists().map((l) => {
        const { wrapper, startBtn, targets, ...rest } = l;
        return Object.assign(rest, { run: getRunState(l.id), targetsPreview: targets.slice(0, 5) });
      });
    },
    list(listId) {
      return getListById(listId) || null;
    },
    scan() {
      const lists = scanFarmLists();
      return {
        page: location.href,
        onFarmListPage: isFarmListPage(),
        villages: Object.keys(villageNameToId()),
        count: lists.length,
        lists: lists.map((l) => ({
          id: l.id,
          name: l.name,
          village: l.villageName,
          used: l.used,
          capacity: l.capacity,
          targets: l.targetsCount,
          status: l.statusText,
          canStart: l.canStart,
          lastRunAt: l.lastRunAt,
        })),
      };
    },

    // ── run ──────────────────────────────────────────────────
    start(listId, opts) {
      return startList(listId, opts);
    },
    startAll(opts) {
      return startAllVisible(opts);
    },
    isRunning(listId) {
      return isListRunning(listId);
    },
    anyRunActive,

    // ── import ───────────────────────────────────────────────
    parse(text) {
      return parseImportPayload(text);
    },
    // FLM.import(listId, jsonOrObject, { mode, dupMode }) → report
    import(listId, payload, opts) {
      let parsed;
      if (typeof payload === "string") parsed = parseImportPayload(payload);
      else {
        const text = JSON.stringify(payload);
        parsed = parseImportPayload(text);
      }
      if (!parsed.ok) return Promise.resolve({ status: "failed", errors: parsed.errors, total: 0, done: 0, failed: 0, skipped: 0, deleted: 0 });
      return runImport(listId, parsed, opts || {});
    },
    exportList(listId) {
      const l = getListById(listId);
      return l ? exportListAsPayload(l) : null;
    },
    openImport(listId) {
      openImportModal(listId);
    },
    closeImport: closeImportModal,
    isImporting,
    getImportStats,
    cancelImport,

    // ── panel ────────────────────────────────────────────────
    render: renderPanel,
    removePanel,
    setCollapsed: setPanelCollapsed,
    snapshot: getPanelSnapshot,

    // ── misc ─────────────────────────────────────────────────
    storage: {
      read: readFLMData,
      write: writeFLMData,
      backup: pushFLMBackup,
      key: FLM_STORAGE_KEY,
    },
    lastRun(listId) {
      return listMeta(listId);
    },
    clearLastRun(listId) {
      mutateFLMData((d) => {
        if (listId === undefined) d.lists = {};
        else delete d.lists[String(listId)];
      });
      renderPanel();
      return true;
    },
    log: flmLog,
    getLog: getLogBuffer,
    clearLog: clearLogBuffer,
    copyLog,
    diag,
    toast: showToast,
  });

  window.FLM = FLM_API;

  // ─────────────────────────────────────────────────────────────
  // Diagnostics — one object with everything needed to debug a report
  // ─────────────────────────────────────────────────────────────
  function diag() {
    let novaOk = { ok: false, reason: "unknown" };
    try {
      novaOk = flmRequiresNovaCheck();
    } catch (e) {
      novaOk = { ok: false, reason: String((e && e.message) || e) };
    }
    return {
      version: FLM_VERSION,
      requiresNova: FLM_REQUIRES_NOVA_MIN,
      nova: novaOk,
      href: location.href,
      onFarmListPage: isFarmListPage(),
      importing: isImporting(),
      importStats: getImportStats(),
      runs: Array.from(_runs.entries()).map(([id, v]) => Object.assign({ listId: id }, v)),
      panel: getPanelSnapshot(),
      settings: readFLMData().settings,
      storageKey: FLM_STORAGE_KEY,
      storageBytes: (() => {
        try {
          return (localStorage.getItem(FLM_STORAGE_KEY) || "").length;
        } catch (e) {
          return -1;
        }
      })(),
      logLines: _logBuffer.length,
      dom: {
        farmListRoots: $$(".farmListWrapper").length,
        dialogVisible: isDialogVisible(),
        confirmVisible: isConfirmDialogVisible(),
      },
    };
  }

  // Copies log + snapshot into the clipboard (falls back to a download)
  function copyLog() {
    const payload = [
      "===== Nova Farm List Manager " + FLM_VERSION + " =====",
      "URL: " + location.href,
      "Time: " + new Date().toISOString(),
      "",
      "----- diag -----",
      JSON.stringify(diag(), null, 2),
      "",
      "----- log (" + _logBuffer.length + ") -----",
      _logBuffer.join("\n"),
    ].join("\n");
    const done = () => showToast("FLM log + diag copied to clipboard", "ok");
    const fail = () => {
      try {
        const blob = new Blob([payload], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "flm-diagnostics-" + Date.now() + ".txt";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 1000);
        showToast("Clipboard unavailable — diagnostics downloaded", "warn");
      } catch (e) {
        showToast("Could not copy diagnostics", "err");
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(done).catch(fail);
      } else {
        fail();
      }
    } catch (e) {
      fail();
    }
    return payload;
  }

  // Single notification point used by the runner / importer so the panel and
  // (optionally) Nova metadata stay consistent.
  function onDataChanged() {
    try {
      FLM.tc.patch((st) => {
        st.plugins = st.plugins || {};
        st.plugins.FarmListManager = Object.assign({}, st.plugins.FarmListManager || {}, {
          enabled: true,
          version: FLM_VERSION,
          lastActionAt: now(),
        });
      });
    } catch (e) {}
    try {
      renderPanel();
    } catch (e) {}
  }

// ═══════════════════════════════════════════════════════════
// FILE: 12-bootstrap.js (178 lines)
// ═══════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // Debug view — rendered as a tab inside Nova's debug box
  // (TC.tests.register). There is no standalone FLM panel anymore:
  // without Nova there is no debug UI, only the log buffer.
  // ─────────────────────────────────────────────────────────────
  function _debugPanelHtml() {
    const lists = scanFarmLists();
    const st = getImportStats();
    const rows = lists
      .map(
        (l) =>
          `<tr><td>${esc(l.id)}</td><td>${esc(l.name)}</td><td>${esc(l.villageName || "?")}</td>` +
          `<td>${l.used}/${l.capacity}</td><td>${l.targetsCount}</td><td>${l.canStart ? "yes" : "no"}</td>` +
          `<td>${l.lastRunAt ? esc(formatElapsed(now() - l.lastRunAt)) : "never"}</td></tr>`,
      )
      .join("");
    return `
<div class="flm-dbg">
  <div><b>FLM ${esc(FLM_VERSION)}</b> — requires Nova ≥ ${esc(FLM_REQUIRES_NOVA_MIN)} (found ${esc(FLM.tc.version() || "none")})</div>
  <div>farm-list page: <b>${isFarmListPage() ? "yes" : "no"}</b> · lists: <b>${lists.length}</b> · importing: <b>${isImporting() ? "yes" : "no"}</b> · panel: <b>${isPanelMounted() ? "mounted" : "absent"}</b></div>
  ${st ? `<div>last import: <b>${esc(st.status)}</b> ${st.done}/${st.total} added, ${st.skipped} skipped, ${st.failed} failed</div>` : ""}
  <table>
    <thead><tr><th>id</th><th>name</th><th>village</th>
    <th>slots</th><th>targets</th><th>can start</th><th>last run</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="color:#888">no farm list on this page</td></tr>`}</tbody>
  </table>
  <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
    <button type="button" data-dbg="refresh">refresh</button>
    <button type="button" data-dbg="copy">copy log + diag</button>
    <button type="button" data-dbg="clear">clear log</button>
    <button type="button" data-dbg="diag">log diag()</button>
  </div>
</div>`;
  }

  // Nova re-renders the tab content on demand, so every action re-renders it.
  function _bindDebug(root) {
    root.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-dbg]");
      if (!b) return;
      const act = b.getAttribute("data-dbg");
      if (act === "copy") {
        copyLog();
        return;
      }
      if (act === "clear") clearLogBuffer(false);
      else if (act === "diag") flmLog("INFO", "diag: " + JSON.stringify(diag()));
      _refreshDebugTab();
    });
  }

  function _refreshDebugTab() {
    const host = document.getElementById(FLM_DEBUG_TAB_ID);
    if (!host) return;
    host.innerHTML = _debugPanelHtml();
  }

  function _registerDebugTab() {
    if (typeof FLM.tc.tests.register !== "function") return;
    FLM.tc.tests.register(FLM_DEBUG_TAB_ID, {
      label: "farm",
      render: () => _debugPanelHtml(),
      onMount: (root) => {
        if (root && !root._flmBound) {
          root._flmBound = true;
          _bindDebug(root);
        }
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Bootstrap
  // ─────────────────────────────────────────────────────────────

  // Re-render the panel when Travian re-renders / navigates (debounced)
  let _mutationTimer = null;
  function _startObserver() {
    const target = document.getElementById("content") || document.body;
    if (!target || typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      if (_mutationTimer) return;
      // Traveling DOM churn during an import / open dialog must not rebuild
      // the panel body — that is exactly what made it "disappear" mid-run.
      if (isImporting() || isDialogVisible()) return;
      _mutationTimer = setTimeout(() => {
        _mutationTimer = null;
        try {
          renderPanel();
        } catch (e) {}
      }, 250);
    });
    obs.observe(target, { childList: true, subtree: true });
  }

  function _registerNovaPlugin() {
    FLM.tc.registerPlugin(FLM_NS, {
      // FLM never owns tasks — this handler only reports readiness to Nova.
      onArrive(ctx) {
        try {
          flmLog("INFO", "onArrive: tt=" + (ctx && ctx.tt) + " gid=" + (ctx && ctx.gid));
          if (isFarmListPage()) renderPanel();
        } catch (e) {}
      },
    });
  }

  async function init() {
    // Wait for the farm-list tab markup (React renders it after document-idle).
    if (isFarmListPage()) {
      try {
        await waitFor(() => !!getPanelHost(), 5000, 100);
        renderPanel();
        startPanelPolling();
        _startObserver();
      } catch (e) {
        console.error("[FLM] panel mount failed", e);
      }
    }

    const nova = await waitForTC(15000);
    if (!nova) {
      console.warn("[FLM] Nova Heartbeat not found — FLM runs in standalone mode (no log mirroring).");
      flmLog("WARN", "Nova Heartbeat not found — running standalone (log is not mirrored to Nova)");
    } else {
      const req = flmRequiresNovaCheck();
      if (!req.ok) flmLog("WARN", "Compatibility: " + req.reason);
      else flmLog("INFO", "Nova " + req.version + " detected");
      _registerNovaPlugin();
      _registerDebugTab();
    }

    try {
      pushFLMBackup("startup");
      pruneBackups();
    } catch (e) {}

    // Travian switches tabs via AJAX — re-check on soft navigation. The host is
    // re-rendered by React on every visit, so the panel must be re-injected.
    let lastHref = location.href;
    setInterval(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      try {
        if (isFarmListPage()) {
          waitFor(() => !!getPanelHost(), 5000, 100).then(() => {
            try {
              renderPanel();
              startPanelPolling();
            } catch (e) {}
          });
        } else {
          removePanel();
          stopPanelPolling();
        }
      } catch (e) {}
    }, 1000);

    if (isDebugEnabled()) {
      // Debug UI lives in Nova's debug box; without Nova the flag only turns
      // on verbose logging.
      if (typeof FLM.tc.tests.register === "function") _registerDebugTab();
      if (typeof FLM.tc.debug?.enable === "function") FLM.tc.debug.enable();
      flmLog("INFO", "Debug mode active (?flm_debug=1)");
    }

    flmLog("INFO", `Nova Farm List Manager ${FLM_VERSION} ready (requires Nova ≥ ${FLM_REQUIRES_NOVA_MIN})`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((e) => console.error("[FLM] init failed", e));
    });
  } else {
    init().catch((e) => console.error("[FLM] init failed", e));
  }
})();
