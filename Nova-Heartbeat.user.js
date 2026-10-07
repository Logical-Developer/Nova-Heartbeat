// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: 2026-10-07T23:07:03.213Z
// Source: src/
// Rebuild: node build.js
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// FILE: 00-header.js (27 lines)
// ═══════════════════════════════════════════════════════════

// ==UserScript==
// @name         Nova Heartbeat (v0.0.1)
// @namespace    https://github.com/Logical-Developer/Nova-Heartbeat
// @version      0.0.1
// @description  Nova Heartbeat — automated page rotation and construct-to-upgrade conversion
// @author       Logical-Developer
// @homepage     https://github.com/Logical-Developer/Nova-Heartbeat
// @supportURL   https://github.com/Logical-Developer/Nova-Heartbeat/issues
// @updateURL    https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js
// @downloadURL  https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js
// @match        https://*.travian.com/*
// @match        https://*.traviantop.com/*
// @match        https://*.international.travian.com/*
// @match        https://*.arabics.travian.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

// ═══════════════════════════════════════════════════════════
// Nova Heartbeat v0.0.1
// Modular source — see src/ folder
// DO NOT EDIT THE BUILT FILE — edit src/ and run: node build.js
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// FILE: 01-config.js (82 lines)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// FILE: 02-utils.js (58 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 02-utils.js
// ═══════════════════════════════════════════════════════════

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clockOf = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); };

  function fmtDuration(input, unit = 'sec') {
    if (!input && input !== 0) return '—';
    const sec = unit === 'ms' ? Math.round(input / 1000) : Math.round(input);
    if (sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h:${String(m).padStart(2,'0')}m:${String(s).padStart(2,'0')}s`;
    return `${m}m:${String(s).padStart(2,'0')}s`;
  }
  const fmtAge   = (ms) => fmtDuration(ms, 'ms');
  const fmtTimer = (ms) => fmtDuration(ms, 'ms');
  const fmtSec   = (sec) => fmtDuration(sec, 'sec');

  function logNormal(min,max){const u=Math.random()||1e-9,v=Math.random();const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);const t=Math.min(1,Math.max(0,(z+3)/6));return Math.round(min+(max-min)*t);}

  function randomDelay(minMs, maxMs) {
    const ms = Math.round(minMs + Math.random() * (maxMs - minMs));
    return delay(ms);
  }

  async function waitFor(condFn, maxMs = 5000, checkMs = 100) {
    const start = now();
    while (now() - start < maxMs) {
      try { if (condFn()) return { ok: true, waited: now() - start }; } catch {}
      await delay(checkMs);
    }
    return { ok: false, waited: now() - start };
  }

  function ssSet(k, v) { try { sessionStorage.setItem(k, String(v)); } catch {} }
  function ssGet(k, dflt = null) { try { const v = sessionStorage.getItem(k); return v === null ? dflt : v; } catch { return dflt; } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch {} }

  function isDebugEnabled() {
    if (window.NOVA_DEBUG === true) return true;
    try {
      const u = new URL(location.href);
      const p = u.searchParams.get('nova_debug');
      if (p === '1') { try { localStorage.setItem(DEBUG_KEY, '1'); } catch {} return true; }
      if (p === '0') { try { localStorage.removeItem(DEBUG_KEY); } catch {} return false; }
    } catch {}
    try { if (localStorage.getItem(DEBUG_KEY) === '1') return true; } catch {}
    return false;
  }

// ═══════════════════════════════════════════════════════════
// FILE: 03-state.js (288 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 03-state.js
// ═══════════════════════════════════════════════════════════

  function recordRotationContext(fromVid) {
    if (!fromVid) return;
    ssSet(SS_ROT_FROM, fromVid);
    ssSet(SS_ROT_AT, now());
  }

  function detectSwitchType(curVid) {
    const prevFrom = ssGet(SS_ROT_FROM);
    if (!prevFrom || String(prevFrom) === String(curVid)) return null;
    const prevMark = ssGet(SS_PAGE_MARK);
    const prevAt = parseInt(ssGet(SS_ROT_AT, '0') || '0', 10);
    const elapsed = prevAt > 0 ? (now() - prevAt) : null;
    const isNova = (prevMark === 'nova') && (elapsed !== null) && (elapsed < ROT_WINDOW_MS);
    return { type: isNova ? 'nova' : 'manual', from: prevFrom, cur: curVid, elapsed };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(SK);
      if (!raw) return JSON.parse(JSON.stringify(DEF));
      const s = JSON.parse(raw);
      for (const k in DEF) if (!(k in s)) s[k] = JSON.parse(JSON.stringify(DEF[k]));
      if (!s.heartbeat) s.heartbeat = { ...DEF.heartbeat };
      if (s.heartbeat.autoUnfreezeMs === undefined) s.heartbeat.autoUnfreezeMs = DEF.heartbeat.autoUnfreezeMs;
      if (s.heartbeat._lastUnfreezeAt === undefined) s.heartbeat._lastUnfreezeAt = 0;
      if (s.heartbeat._lastBusySkipLog === undefined) s.heartbeat._lastBusySkipLog = 0;
      if (typeof s.heartbeat.allowHiddenTab !== 'boolean') s.heartbeat.allowHiddenTab = false;
      if (s.heartbeat._unfreezeFallbackAt === undefined) s.heartbeat._unfreezeFallbackAt = 0;
      if (s.heartbeat._lastRotCheck === undefined) s.heartbeat._lastRotCheck = 0;
      if (!s.plugins) s.plugins = {};
      if (!s.ui) s.ui = { ...DEF.ui };
      return s;
    } catch { return JSON.parse(JSON.stringify(DEF)); }
  }
  function patch(fn) {
    const s = readState();
    fn(s);
    try { localStorage.setItem(SK, JSON.stringify(s)); } catch {}
  }
  function hardReset() {
    try { localStorage.removeItem(SK); } catch {}
    try { sessionStorage.clear(); } catch {}
    log('sys', 'HARD RESET — storage cleared');
    setTimeout(() => location.reload(), 200);
  }

  const SESSION_ID = 'S' + now().toString(36).slice(-5);
  function log(src, msg) {
    if (window.NOVA_VERBOSE) console.log(`%c[NovaHB:${src}]`, 'color:#7a4ab0;font-weight:bold', msg);
    patch(s => {
      if (s.sessionId !== SESSION_ID) {
        s.logs.push({ ts: now(), source: 'sys', sid: 'marker', msg: `══════ SESSION ${SESSION_ID} ══════` });
        s.sessionId = SESSION_ID;
      }
      s.logs.push({ ts: now(), source: src, msg: String(msg).slice(0,300), sid: SESSION_ID });
      if (s.logs.length > LOG_MAX) s.logs.shift();
    });
  }

  function pageType() {
    const p = location.pathname;
    if (p.includes('dorf1.php')) return 'dorf1';
    if (p.includes('dorf2.php')) return 'dorf2';
    if (p.includes('build.php')) return 'build';
    if (p.includes('report')) return 'report';
    if (p.includes('statistics')) return 'statistics';
    if (p.includes('messages')) return 'messages';
    if (p.includes('karte.php')) return 'karte';
    if (p.includes('profile')) return 'profile';
    if (p.includes('options')) return 'options';
    return '?';
  }
  function isHub() { const pt = pageType(); return pt === 'dorf1' || pt === 'dorf2'; }
  function curVillageId() {
    const q = new URL(location.href).searchParams.get('newdid');
    if (q && /^\d+$/.test(q)) return q;
    const el = $('#sidebarBoxVillageList .listEntry.village.active[data-did]') || $('#sidebarBoxActiveVillage .active[data-did]');
    if (el) { const id = el.getAttribute('data-did'); if (id && /^\d+$/.test(id)) return id; }
    const any = $('a[href*="newdid="]');
    if (any) { const m = any.getAttribute('href').match(/newdid=(\d+)/); if (m) return m[1]; }
    return null;
  }
  function scanVillages() {
    const entries = $$('#sidebarBoxVillageList .listEntry.village[data-did]');
    if (!entries.length) return false;
    let changed = false;
    patch(s => {
      for (const el of entries) {
        const vid = el.getAttribute('data-did');
        if (!vid) continue;
        const cur = s.villages[vid] || (s.villages[vid] = {});
        const n = el.querySelector('.name');
        if (n) { const nm = n.textContent.trim(); if (cur.name !== nm) { cur.name = nm; changed = true; } }
        const xEl = el.querySelector('.coordinateX'), yEl = el.querySelector('.coordinateY');
        if (xEl) { const m = (xEl.textContent||'').match(/(-?\d+)/); if (m) cur.x = parseInt(m[1],10); }
        if (yEl) { const m = (yEl.textContent||'').match(/(-?\d+)/); if (m) cur.y = parseInt(m[1],10); }
      }
    });
    return changed;
  }
  function vLabel(vid) {
    if (!vid) return '?';
    const v = readState().villages[String(vid)];
    if (v && v.name) {
      const m = v.name.match(/(\d+)\s*$/);
      if (m) return 'V' + m[1].padStart(2,'0');
      return v.name.length > 8 ? v.name.slice(0, 7) + '…' : v.name;
    }
    return 'V' + String(vid).slice(-2);
  }

  function isResourceGid(gid) { return ['1','2','3','4'].includes(String(gid)); }
  function getTargetHub(gid) { return isResourceGid(gid) ? 'dorf1' : 'dorf2'; }

  function isOnTarget(t, opts = {}) {
    if (!t) return false;
    if (pageType() !== t.page) return false;
    const u = new URL(location.href);
    const urlVid = u.searchParams.get('newdid') || curVillageId();
    if (t.village && String(urlVid) !== String(t.village)) return false;
    if (t.params) {
      if (t.page === 'build') {
        if (opts.relaxBuildParams) return true;
        const wantId = t.params.id, wantGid = t.params.gid;
        const curId = u.searchParams.get('id'), curGid = u.searchParams.get('gid');
        if (wantId && String(curId) !== String(wantId)) return false;
        if (wantGid && String(curGid) !== String(wantGid)) return false;
      } else {
        for (const [k,v] of Object.entries(t.params)) {
          if (u.searchParams.get(k) !== String(v)) return false;
        }
      }
    }
    return true;
  }

  function isDomReadyForBuildPage() {
    return !!($('#build h1.titleInHeader') || $('h1.titleInHeader') || $('#build h1') ||
              $('.upgradeButtonsContainer') || $('.buildingWrapper') || $('.upgradeBuilding') ||
              $('.contentContainer') || $('#content'));
  }
  function isDomReadyForDorf() { return !!document.querySelector('#stockBar'); }

  async function waitForHubStable(maxMs = CFG.HUB_STABLE_MAX_MS) {
    const start = now();
    const r1 = await waitFor(() => document.querySelector('#stockBar'), maxMs);
    if (!r1.ok) return { ok: false, reason: 'no-stockbar', waited: r1.waited };
    await delay(CFG.HUB_STABLE_SETTLE_MS);
    return {
      ok: true,
      hasBuildingList: !!document.querySelector('.buildingList'),
      waited: now() - start,
    };
  }

  function parseNum(t) {
    if (!t) return null;
    const m = String(t).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').match(/(-?[\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g,''),10) : null;
  }
  function readResources() {
    const ids = ['l1','l2','l3','l4'];
    const res = {}; let n = 0;
    for (let i=0;i<4;i++) {
      const el = document.getElementById(ids[i]);
      if (!el) continue;
      const valEl = el.querySelector('.value') || el;
      const v = parseNum(valEl.textContent);
      if (v !== null) { res[i+1] = v; n++; }
    }
    if (n >= 3) {
      const freeCropEl = document.getElementById('stockBarFreeCrop');
      if (freeCropEl) {
        const fc = parseNum(freeCropEl.textContent);
        if (fc !== null) res.freeCrop = fc;
      }
      return res;
    }
    try {
      const st = window.resources?.storage;
      if (st && typeof st.l1 === 'number') {
        const out = { 1: st.l1, 2: st.l2, 3: st.l3, 4: st.l4 };
        const freeCropEl = document.getElementById('stockBarFreeCrop');
        if (freeCropEl) { const fc = parseNum(freeCropEl.textContent); if (fc !== null) out.freeCrop = fc; }
        return out;
      }
    } catch {}
    return null;
  }
  function readMaxStorage() {
    const wh = parseNum($('#stockBar .warehouse .capacity .value')?.textContent);
    const gr = parseNum($('#stockBar .granary .capacity .value')?.textContent);
    if (wh === null && gr === null) return null;
    return { warehouse: wh||0, granary: gr||0 };
  }
  function readMovements() {
    const tbl = $('.villageInfobox.movements #movements');
    if (!tbl) return null;
    const incoming = [], outgoing = [];
    let sec = null;
    for (const row of tbl.querySelectorAll('tr')) {
      const th = row.querySelector('th.troopMovements.header');
      if (th) { const t = (th.textContent||'').toLowerCase(); if (t.includes('incoming')) sec='in'; else if (t.includes('outgoing')) sec='out'; continue; }
      if (!sec) continue;
      const timer = row.querySelector('.dur_r .timer');
      if (!timer) continue;
      const s = parseInt(timer.getAttribute('value')||'0',10);
      if (!s) continue;
      const img = row.querySelector('td.typ img');
      const cls = img ? (img.className||'') : '';
      let type = 'unknown';
      if (/\batt1\b/.test(cls)) type = 'attack-in';
      else if (/\bdef1\b/.test(cls)) type = 'reinf-in';
      else if (/\batt2\b/.test(cls)) type = 'attack-out';
      else if (/\bdef2\b/.test(cls)) type = 'reinf-out';
      const entry = { type, secs: s, label: (row.querySelector('.mov')?.textContent||'').trim() };
      if (sec === 'in') incoming.push(entry); else outgoing.push(entry);
    }
    return { incoming, outgoing };
  }
  function readBuildingList() {
    const bl = document.querySelector('.buildingList');
    if (!bl) return null;
    const els = bl.querySelectorAll('li');
    const out = [];
    for (const li of els) {
      const nameEl = li.querySelector('.name');
      if (!nameEl) continue;
      const clone = nameEl.cloneNode(true);
      const lvlSpan = clone.querySelector('.lvl, span.lvl');
      let lvl = 0;
      if (lvlSpan) { const m = lvlSpan.textContent.match(/(\d+)/); if (m) lvl = parseInt(m[1],10)||0; lvlSpan.remove(); }
      const name = clone.textContent.replace(/\s+/g,' ').trim();
      const timerEl = li.querySelector('.buildDuration .timer');
      const remaining = timerEl ? parseInt(timerEl.getAttribute('value')||timerEl.getAttribute('data-value')||'0',10) : 0;
      const cancelLink = li.querySelector('a[onclick*="showCancelBuildingDialog"]');
      let buildingId = null;
      if (cancelLink) {
        const m = (cancelLink.getAttribute('onclick') || '').match(/showCancelBuildingDialog\(\s*(\d+)/);
        if (m) buildingId = m[1];
      }
      out.push({ name, level: lvl, remaining, buildingId });
    }
    return out;
  }

  function captureCurrentVillage() {
    const vid = curVillageId();
    if (!vid) return false;
    if (!document.querySelector('#stockBar')) return false;
    const pt = pageType();
    const updates = {};
    let hasAny = false;
    const res = readResources();
    if (res) { updates.res = res; hasAny = true; }
    const max = readMaxStorage();
    if (max) { updates.max = max; hasAny = true; }
    if (pt === 'dorf1') {
      const mvt = readMovements();
      if (mvt) { updates.movements = mvt; hasAny = true; }
    }
    if (pt === 'dorf1' || pt === 'dorf2') {
      const bl = readBuildingList();
      if (bl === null) { updates.buildQueue = []; updates.hasBuildingList = false; }
      else { updates.buildQueue = bl; updates.hasBuildingList = true; }
      hasAny = true;
    }
    if (!hasAny) return false;
    patch(s => {
      const v = s.villages[String(vid)] || (s.villages[String(vid)] = {});
      if (updates.res) { v.res = updates.res; v.resAt = now(); }
      if (updates.max) { v.max = updates.max; v.maxAt = now(); }
      if (updates.movements) { v.movements = updates.movements; v.movementsAt = now(); }
      if (updates.buildQueue !== undefined) {
        v.buildQueue = updates.buildQueue;
        v.hasBuildingList = updates.hasBuildingList;
        v.buildQueueAt = now();
      }
      v.lastSeen = now();
      v.lastSeenPage = pt;
    });
    return true;
  }

// ═══════════════════════════════════════════════════════════
// FILE: 04-resolver.js (197 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 04-resolver.js
// ═══════════════════════════════════════════════════════════

  const Resolver = (() => {
    function isElVisible(el) {
      if (!el || !el.isConnected) return false;
      const st = getComputedStyle(el);
      if (st.display==='none' || st.visibility==='hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function hasRealHref(el) {
      if (el.tagName !== 'A') return true;
      const h = el.getAttribute('href');
      return !!(h && h !== '#' && !h.startsWith('javascript:'));
    }
    function getHref(el) {
      const a = el.tagName === 'A' ? el : el.querySelector('a');
      return a ? (a.getAttribute('href') || '') : (el.getAttribute('href') || '');
    }
    function villageSwitch(t, ctx) {
      if (!t.village) return null;
      if (String(t.village) === String(ctx.vid)) return null;
      const el = document.querySelector(`#sidebarBoxVillageList .listEntry.village[data-did="${t.village}"] a`);
      if (!el || !isElVisible(el)) return null;
      return { el, strategy: 'village-switch', isLink: false };
    }
    function headerMenu(t, ctx) {
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      if (t.params && Object.keys(t.params).length) return null;
      const map = { dorf1:'#navigation a.resourceView', dorf2:'#navigation a.buildingView', karte:'#navigation a.map', report:'#navigation a.reports', statistics:'#navigation a.statistics', messages:'#navigation a.messages' };
      const sel = map[t.page]; if (!sel) return null;
      const el = document.querySelector(sel);
      return isElVisible(el) ? { el, strategy: 'header-menu', isLink: true } : null;
    }
    function closeBtn(t, ctx) {
      if (ctx.page !== 'build' || (t.page !== 'dorf2' && t.page !== 'dorf1')) return null;
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      const el = document.querySelector('#closeContentButton');
      return isElVisible(el) ? { el, strategy: 'close-button', isLink: true } : null;
    }
    function tile(t, ctx) {
      if (t.page !== 'build') return null;
      if (ctx.page !== 'dorf1' && ctx.page !== 'dorf2') return null;
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      const slot = t.params?.id, gid = t.params?.gid;
      if (!slot) return null;

      const idRegex = new RegExp(`[?&]id=${slot}(?:&|$|#)`);
      const gidInHrefRegex = /[?&]gid=(\d+)(?:&|$|#)/;

      const legacyEl = document.querySelector(`#building${slot}`);
      if (legacyEl) {
        const href = getHref(legacyEl);
        if (idRegex.test(href)) {
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk) {
            const clk = legacyEl.tagName==='A' ? legacyEl : (legacyEl.querySelector('a') || legacyEl);
            if (isElVisible(clk)) return { el: clk, strategy: 'tile-legacy', isLink: clk.tagName==='A' };
          }
        }
      }

      const slotEl = document.querySelector(`.buildingSlot[data-aid="${slot}"]`);
      if (slotEl) {
        const slotGid = slotEl.getAttribute('data-gid');
        if (gid) {
          if (slotGid && slotGid !== '0' && String(slotGid) !== String(gid)) {
            return null;
          }
        }

        const aEl = slotEl.querySelector('a[href*="build.php"]');
        if (aEl) {
          const href = aEl.getAttribute('href') || '';
          if (idRegex.test(href)) {
            let gidOk = true;
            if (gid) {
              const gidMatch = gidInHrefRegex.exec(href);
              if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
            }
            if (gidOk && isElVisible(aEl)) {
              return { el: aEl, strategy: 'tile-slot-a', isLink: true };
            }
          }
        }

        const paths = slotEl.querySelectorAll('path[onclick]');
        for (const p of paths) {
          const onclick = p.getAttribute('onclick') || '';
          const hrefMatch = onclick.match(/build\.php\?[^'"\s]+/);
          if (!hrefMatch) continue;
          const href = hrefMatch[0];
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && isElVisible(p)) {
            return { el: p, strategy: 'tile-slot-path-onclick', isLink: false };
          }
        }

        const dataHrefPaths = slotEl.querySelectorAll('path[data-href*="build.php"]');
        for (const p of dataHrefPaths) {
          const href = p.getAttribute('data-href') || '';
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && isElVisible(p)) {
            return { el: p, strategy: 'tile-slot-path-datahref', isLink: false };
          }
        }

        if (isElVisible(slotEl)) {
          return { el: slotEl, strategy: 'tile-slot-div', isLink: false };
        }
      }

      const containers = ['#villageContent', '#resourceFieldContainer', '#resourceField', '#village'];
      for (const contSel of containers) {
        const container = document.querySelector(contSel);
        if (!container) continue;
        const links = container.querySelectorAll('a[href*="build.php"]');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && a.isConnected && isElVisible(a)) {
            return { el: a, strategy: 'tile-container-a', isLink: true };
          }
        }
      }

      if (slot && gid) {
        const wallSlots = document.querySelectorAll(`.buildingSlot[data-aid="${slot}"][data-gid="${gid}"]`);
        for (const wallSlot of wallSlots) {
          const clickablePath = wallSlot.querySelector('path[onclick*="build.php"]');
          if (clickablePath && isElVisible(clickablePath)) {
            return { el: clickablePath, strategy: 'tile-wall-path', isLink: false };
          }
          const clickableA = wallSlot.querySelector('a[href*="build.php"]');
          if (clickableA && isElVisible(clickableA)) {
            return { el: clickableA, strategy: 'tile-wall-a', isLink: true };
          }
        }
      }

      return null;
    }
    function card(t, ctx) {
      if (t.page !== 'build' || ctx.page !== 'build') return null;
      if (!t.params?.gid || t.params?.id) return null;
      const card = document.querySelector(`#contract_building${t.params.gid}`);
      if (!card) return null;
      const btn = card.querySelector('button.green.new, button.purple.new, .upgradeButtonsContainer button.green, .upgradeButtonsContainer button.purple');
      return isElVisible(btn) ? { el: btn, strategy: 'construct-card', isLink: false } : null;
    }
    function href(t, ctx) {
      const want = { page: t.page, params: {} };
      if (t.village && String(t.village) !== String(ctx.vid)) want.params.newdid = t.village;
      Object.assign(want.params, t.params || {});
      for (const a of $$('a[href]')) {
        if (!hasRealHref(a) || !isElVisible(a)) continue;
        try {
          const u = new URL(a.href, location.origin);
          if (!u.pathname.includes(want.page)) continue;
          let ok = true;
          for (const [k,v] of Object.entries(want.params)) if (u.searchParams.get(k) !== String(v)) { ok=false; break; }
          if (ok) return { el: a, strategy: 'href-match', isLink: true };
        } catch {}
      }
      return null;
    }
    const STRATS = [villageSwitch, headerMenu, closeBtn, tile, card, href];
    function resolve(t) {
      const ctx = { vid: curVillageId(), page: pageType() };
      for (const fn of STRATS) { try { const r = fn(t, ctx); if (r && r.el) return { ...r, ctx }; } catch {} }
      return null;
    }
    return { resolve, isElVisible };
  })();


// ═══════════════════════════════════════════════════════════
// FILE: 05-navigate.js (125 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 05-navigate.js
// ═══════════════════════════════════════════════════════════

  let _mouse = { x: Math.round(innerWidth/2), y: Math.round(innerHeight/2) };
  let _scriptClick = false;
  let _lastUserClickAt = 0;

  function dispatchMouse(el, type, x, y, extra = {}) {
    el.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, composed:true, view:window,
      clientX:x, clientY:y, screenX:x+(window.screenX||0), screenY:y+(window.screenY||0), button:0, buttons:extra.buttons??0, detail: type==='click'?1:0 }));
  }
  function bezier(from, to, n) {
    const c1 = { x: from.x+(to.x-from.x)*0.3+(Math.random()-0.5)*60, y: from.y+(to.y-from.y)*0.3+(Math.random()-0.5)*60 };
    const c2 = { x: from.x+(to.x-from.x)*0.7+(Math.random()-0.5)*60, y: from.y+(to.y-from.y)*0.7+(Math.random()-0.5)*60 };
    const pts = [];
    for (let i=1;i<=n;i++) {
      const t = i/(n+1), mt = 1-t;
      pts.push({ x: mt*mt*mt*from.x+3*mt*mt*t*c1.x+3*mt*t*t*c2.x+t*t*t*to.x+(Math.random()-0.5)*3,
                 y: mt*mt*mt*from.y+3*mt*mt*t*c1.y+3*mt*t*t*c2.y+t*t*t*to.y+(Math.random()-0.5)*3 });
    }
    return pts;
  }
  function waitNav(ms) {
    return new Promise(r => {
      let done = false;
      const finish = v => { if (!done) { done = true; r(v); } };
      const startHref = location.href;
      const startPath = location.pathname + location.search;
      const onU = () => finish(true);
      window.addEventListener('beforeunload', onU, { once: true });
      const iv = setInterval(() => {
        const curPath = location.pathname + location.search;
        if (document.readyState==='loading' || location.href!==startHref || curPath !== startPath) {
          clearInterval(iv); window.removeEventListener('beforeunload', onU); finish(true);
        }
      }, 50);
      setTimeout(() => { clearInterval(iv); window.removeEventListener('beforeunload', onU); finish(false); }, ms);
    });
  }
  async function humanClick(el, opts = {}) {
    if (!el || !el.isConnected) return { ok: false, reason: 'detached' };
    const st = getComputedStyle(el);
    if (st.display==='none' || st.visibility==='hidden') return { ok: false, reason: 'invisible' };
    if (el.disabled || el.classList.contains('disabled')) return { ok: false, reason: 'disabled' };
    await delay(logNormal(200, 700));
    let rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) { el.scrollIntoView({ behavior:'smooth', block:'center' }); await delay(logNormal(180, 400)); rect = el.getBoundingClientRect(); }
    const tx = rect.left + rect.width * (0.22 + Math.random()*0.56);
    const ty = rect.top + rect.height * (0.22 + Math.random()*0.56);
    const segs = 3 + Math.floor(Math.random()*4);
    for (const p of bezier(_mouse, { x:tx, y:ty }, segs)) { dispatchMouse(el, 'mousemove', p.x, p.y); _mouse = { x:p.x, y:p.y }; await delay(logNormal(25, 70)); }
    dispatchMouse(el, 'mouseover', tx, ty); dispatchMouse(el, 'mouseenter', tx, ty);
    await delay(logNormal(80, 240));
    dispatchMouse(el, 'mousedown', tx, ty, { buttons:1 });
    await delay(logNormal(40, 120));
    dispatchMouse(el, 'mouseup', tx, ty);
    _scriptClick = true;
    const isLink = el.tagName==='A' && el.href && !el.href.startsWith('javascript:');
    const navP = waitNav(opts.navTimeoutMs || CFG.NAV_TIMEOUT_MS);
    dispatchMouse(el, 'click', tx, ty);
    const navigated = await navP;
    setTimeout(() => { _scriptClick = false; }, 150);
    return { ok: true, navigated: !!navigated, isLink: !!isLink, needsFallback: isLink && !navigated, href: isLink ? el.href : null };
  }
  function isPopupOpen() {
    for (const v of document.querySelectorAll('video')) {
      const st = getComputedStyle(v);
      if (st.display==='none' || st.visibility==='hidden' || v.paused) continue;
      const r = v.getBoundingClientRect();
      if (r.width >= 100 && r.height >= 100) return true;
    }
    for (const el of document.querySelectorAll('.videoWrapper, [class*="videoPlayer" i], [class*="videoFeature" i] .modal')) {
      const st = getComputedStyle(el);
      if (st.display==='none' || st.visibility==='hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 300 && r.height >= 200) return true;
    }
    return false;
  }
  function canAct() {
    const s = readState();
    const allowHidden = s.heartbeat?.allowHiddenTab === true;
    if (!allowHidden && document.visibilityState === 'hidden') return { ok: false, reason: 'tab-hidden' };
    if (isPopupOpen()) return { ok: false, reason: 'popup' };
    const fi = freezeInfo();
    if (fi && !fi.expired) return { ok: false, reason: 'page-frozen', freeze: fi };
    if (_lastUserClickAt && now() - _lastUserClickAt < CFG.USER_ACTIVE_WINDOW_MS) return { ok: false, reason: 'user-active' };
    return { ok: true };
  }
  async function navigate(target) {
    const ready = canAct();
    if (!ready.ok) return { ok: false, reason: ready.reason };
    const r = Resolver.resolve(target);
    if (!r) {
      log('nav', `✗ no-link for ${target.page}${target.village ? ' @'+vLabel(target.village) : ''}`);
      return { ok: false, reason: 'no-link-found' };
    }

    if (r.useDirectUrl && r.directUrl) {
      const curVid = curVillageId();
      if (curVid && target.village && String(curVid) !== String(target.village)) {
        recordRotationContext(curVid);
        ssSet(SS_PAGE_MARK, 'nova');
      }
      log('nav', `🎯 direct URL: ${r.directUrl} [${r.strategy}]`);
      await randomDelay(500, 1200);
      location.href = r.directUrl;
      return { ok: true, fallback: true };
    }

    const curVid = curVillageId();
    if (curVid && target.village && String(curVid) !== String(target.village)) {
      recordRotationContext(curVid);
      ssSet(SS_PAGE_MARK, 'nova');
    }
    log('nav', `→ ${target.page}${target.params ? '?'+new URLSearchParams(target.params).toString() : ''} @${vLabel(target.village)} [${r.strategy}]`);
    await delay(logNormal(CFG.DELAY_PRE_CLICK_MIN, CFG.DELAY_PRE_CLICK_MAX));
    const res = await humanClick(r.el, { navTimeoutMs: CFG.NAV_TIMEOUT_MS });
    if (!res.ok) return { ok: false, reason: res.reason };
    if (res.needsFallback) { await delay(logNormal(300, 700)); location.href = res.href; return { ok: true, fallback: true }; }
    return { ok: true, navigated: res.navigated };
  }


// ═══════════════════════════════════════════════════════════
// FILE: 06-runner.js (878 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 06-runner.js
// ═══════════════════════════════════════════════════════════

  function enqueue(task) {
    const id = task.id || ('t_' + now() + '_' + Math.random().toString(36).slice(2,6));
    const s = readState();
    if (s.tasks.some(t => t.id === id) || (s.currentJob && s.currentJob.id === id)) {
      log('queue', `⊘ dup task ${id.slice(-12)} — skipped`);
      return null;
    }
    const t = {
      id, plugin: task.plugin,
      priority: task.priority ?? 5,
      villageId: task.villageId || task.target?.village,
      target: task.target,
      payload: task.payload || {},
      requiresFlag: task.requiresFlag || null,
      createdAt: task.createdAt || now(),
      readyAt: now() + (task.delayMs || 0),
      expiresAt: now() + (task.ttlMs || 30 * 60 * 1000),
      attempts: task.attempts || 0,
      maxAttempts: task.maxAttempts ?? CFG.MAX_ATTEMPTS,
      lastError: null,
    };
    patch(st => st.tasks.push(t));
    log('queue', `+ ${t.plugin} → ${t.target.page}@${vLabel(t.target.village)} (p=${t.priority})`);
    return id;
  }
  function cancelTask(id) {
    const s = readState();
    let removed = false;
    if (s.currentJob && s.currentJob.id === id) {
      log('queue', `✗ cancel currentJob: ${id.slice(-12)}`);
      patch(st => { st.currentJob = null; });
      removed = true;
    }
    const before = s.tasks.length;
    patch(st => { st.tasks = st.tasks.filter(t => t.id !== id); });
    const after = readState().tasks.length;
    if (after !== before) {
      log('queue', `✗ cancel task: ${id.slice(-12)}`);
      removed = true;
    }
    return removed;
  }
  function listTasks() { return readState().tasks.slice(); }

  function isFlagActive(flag, s) {
    if (!flag) return true;
    if (flag === 'heartbeat') return s.heartbeat?.enabled === true;
    const m = /^plugin:(\w+):(\w+)$/.exec(flag);
    if (m) { const plugin = s.plugins[m[1]]; return plugin && plugin[m[2]] === true; }
    return true;
  }

  function isVillageBusy(vid, s) {
    if (!vid) return false;
    const vidStr = String(vid);
    if (s.currentJob && String(s.currentJob.target.village) === vidStr) return true;
    const v = s.villages[vidStr];
    if (!v) return false;
    if (!v.lastSeen || (now() - v.lastSeen) > CFG.VILLAGE_DATA_STALE_MS) return false;
    const bq = v.buildQueue || [];
    const bqAt = v.buildQueueAt || 0;
    const travianPlus = s.plugins?.Builder?.travianPlus === true;
    const maxSlots = travianPlus ? 2 : 1;
    if ((now() - bqAt) < CFG.QUEUE_FRESH_FOR_BUSY_MS && bq.length >= maxSlots) return true;
    return false;
  }

  // ═════ 2.0.2.21: pickRunnableTask — exempt rotation + Builder rotation + Builder ═════
  function pickRunnableTask() {
    const s = readState();
    const n = now();
    const candidates = s.tasks.filter(t => {
      if (t.expiresAt <= n) return false;
      if (!isFlagActive(t.requiresFlag, s)) return false;
      // ═══ rotation tasks: never rejected based on busy ═══
      if (t.payload?.rotation) return true;
      // ═══ Builder tasks: they decide themselves ═══
      if (t.plugin === 'Builder') return true;
      // ═══ other tasks (normal Heartbeat)) ═══
      if (!t.payload?.isVerify && isVillageBusy(t.villageId || t.target?.village, s)) return false;
      return true;
    });
    if (!candidates.length) return null;
    candidates.sort((a,b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const dt = (a.createdAt || 0) - (b.createdAt || 0);
      if (dt !== 0) return dt;
      return String(a.id).localeCompare(String(b.id));
    });
    const first = candidates[0];
    if (!first) return null;
    if (first.readyAt > n) return null;
    return first;
  }


  function setJobState(jobId, newState, extra = {}) {
    patch(s => {
      if (s.currentJob?.id === jobId) {
        s.currentJob.state = newState;
        s.currentJob.stateAt = now();
        Object.assign(s.currentJob, extra);
      }
    });
  }
  function finishJob(jobId, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    log('runner', `✓ done: ${job.plugin} (${reason})`);
    patch(st => { st.currentJob = null; });
    const p = plugins.get(job.plugin);
    if (p?.onComplete) try { p.onComplete({ job }); } catch {}
  }
  function retryOrFail(jobId, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    const attempt = (job.attempts||0) + 1;
    if (attempt >= job.maxAttempts) {
      log('runner', `✗ FAILED after ${attempt}: ${reason}`);
      patch(st => { st.currentJob = null; });
      const p = plugins.get(job.plugin);
      if (p?.onFail) try { p.onFail({ job, reason }); } catch {}
      return;
    }
    const backoff = CFG.RETRY_BACKOFF_MS[Math.min(attempt-1, CFG.RETRY_BACKOFF_MS.length-1)];
    log('runner', `↻ retry in ${backoff/1000}s (attempt ${attempt}): ${reason}`);
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      const moved = { ...st.currentJob, attempts: attempt, lastError: reason };
      moved.readyAt = now() + backoff;
      moved.createdAt = moved.createdAt || now();
      delete moved.state; delete moved.stateAt; delete moved.startedAt; delete moved.snapshotBefore;
      delete moved._hubBounceCount; delete moved._waitLogged;
      st.currentJob = null;
      st.tasks.push(moved);
    });
  }
  function saveCurrentJobAsTask(jobId, newState, extra = {}) {
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      const saved = { ...st.currentJob };
      saved.state = newState;
      saved.stateAt = now();
      saved.readyAt = now() + 2000;
      saved._sessionReset = false;
      Object.assign(saved, extra);
      delete saved.snapshotBefore;
      delete saved._hubBounceCount;
      delete saved._graceLogged;
      delete saved._domWaitLogged;
      st.tasks.push(saved);
      st.currentJob = null;
    });
  }

  function computeRotationInterval(nVillages) {
    if (nVillages < 2) return 5 * 60 * 1000;
    const target = CFG.ROTATION_TARGET_INTERVAL_MS / (nVillages - 1);
    const clamped = Math.max(CFG.ROTATION_MIN_INTERVAL_MS, target);
    const jitter = 1 + (Math.random() * 2 - 1) * CFG.ROTATION_JITTER;
    return Math.round(clamped * jitter);
  }

  // ═════ 2.0.2.21: rotationTick with full fixes ═════
  function rotationTick() {
    const s = readState();
    if (!s.heartbeat.enabled) return;
    const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
    if (vids.length < 2) return;
    if (s.currentJob) return;

    // ═══ FIX: if a rotation task is pending, do not enqueue again ═══
    const existingRotation = (s.tasks || []).find(t => t.payload?.rotation);
    if (existingRotation) {
      const n = now();
      const lastCheck = s.heartbeat._lastRotCheck || 0;
      if ((n - lastCheck) > 60000) {
        log('rotation', `⏳ rotation task pending (expires in ${Math.round((existingRotation.expiresAt - n)/1000)}s)`);
        patch(st => { st.heartbeat._lastRotCheck = n; });
      }
      return;
    }

    const curVid = curVillageId();
    const n = now();
    if (!curVid) return;

    const det = detectSwitchType(curVid);
    if (det) {
      const icon = det.type === 'nova' ? '🔄' : '👤';
      const label = det.type === 'nova' ? 'Nova' : 'manual';
      const elapsedStr = det.elapsed !== null ? `${Math.round(det.elapsed / 1000)}s` : '?';
      log('rotation', `${icon} ${label} village switch (${vLabel(det.from)} → ${vLabel(curVid)}) → reset (${elapsedStr})`);

      patch(st => {
        st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length);
        const v = st.villages[String(curVid)];
        if (v) v.lastSwitch = { type: det.type, from: det.from, at: n, elapsed: det.elapsed };
      });

      recordRotationContext(curVid);
      ssDel(SS_PAGE_MARK);
      return;
    }

    if (!ssGet(SS_ROT_FROM)) {
      recordRotationContext(curVid);
      patch(st => {
        if (!st.heartbeat.nextRotationAt) st.heartbeat.nextRotationAt = n + 5000;
      });
    }

    // ═══ FIX: if all were busy, reschedule 2min later (not skip) skip) ═══
    const freeVillages = vids.filter(v => !isVillageBusy(v, s));
    if (freeVillages.length === 0 && vids.length > 1) {
      if (!s.heartbeat._lastBusySkipLog || (n - s.heartbeat._lastBusySkipLog) > CFG.BUSY_SKIP_LOG_INTERVAL_MS) {
        log('rotation', `⏸ all ${vids.length} villages busy — reschedule in ${CFG.ROTATION_BUSY_RESCHEDULE_MS/60000}m`);
        patch(st => { st.heartbeat._lastBusySkipLog = n; });
      }
      patch(st => {
        st.heartbeat.nextRotationAt = n + CFG.ROTATION_BUSY_RESCHEDULE_MS;
      });
      return;
    }

    const urgent = vids.find(v => {
      if (String(v) === String(curVid)) return false;
      const vv = s.villages[v];
      if (!vv || !vv.lastSeen) return true;
      return (n - vv.lastSeen) > CFG.URGENT_AGE_MS;
    });
    if (urgent) {
      log('rotation', `🚨 urgent visit → ${vLabel(urgent)}`);
      recordRotationContext(curVid);
      ssSet(SS_PAGE_MARK, 'nova');
      enqueue({ plugin: 'Heartbeat', priority: 10, villageId: String(urgent), target: { page: 'dorf1', village: String(urgent) }, payload: { rotation: true, urgent: true }, requiresFlag: 'heartbeat', ttlMs: 3 * 60 * 1000, createdAt: now() });
      return;
    }

    const nextAt = s.heartbeat.nextRotationAt || 0;
    if (n < nextAt) return;

    const others = vids.filter(v => String(v) !== String(curVid));
    if (!others.length) {
      patch(st => st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length));
      recordRotationContext(curVid);
      return;
    }
    others.sort((a,b) => (s.villages[a].lastSeen || 0) - (s.villages[b].lastSeen || 0));
    const target = others[0];
    log('rotation', `⏱ scheduled visit → ${vLabel(target)}`);
    recordRotationContext(curVid);
    ssSet(SS_PAGE_MARK, 'nova');
    enqueue({ plugin: 'Heartbeat', priority: 3, villageId: String(target), target: { page: 'dorf1', village: String(target) }, payload: { rotation: true }, requiresFlag: 'heartbeat', ttlMs: 5 * 60 * 1000, createdAt: now() });
    patch(st => {
      st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length);
    });
  }



  function decideFromHub(job) {
    const s = readState();
    const v = s.villages[String(job.target.village)];
    if (!v) return { action: 'wait', delayMs: 5000, reason: 'no-village-data' };
    const plugin = plugins.get(job.plugin);
    if (plugin?.onDecide) {
      try {
        const decision = plugin.onDecide({ job, village: v });
        if (decision && decision.action) return decision;
      } catch (e) { log('runner', `⚠ onDecide threw: ${e.message}`); }
    }
    const bq = v.buildQueue || [];
    const bqAt = v.buildQueueAt || 0;
    const maxSlots = s.plugins?.Builder?.travianPlus ? 2 : 1;
    if ((now() - bqAt) < CFG.QUEUE_FRESH_FOR_BUSY_MS && bq.length >= maxSlots) {
      return { action: 'wait', delayMs: 60000, reason: 'queue-full-hub' };
    }
    return { action: 'build' };
  }

  async function advanceJob() {
    const s = readState();
    const job = s.currentJob;
    if (!job) return false;
    if (!s.heartbeat.enabled) {
      log('runner', `⏸ Heartbeat OFF — abandoning job ${job.plugin}`);
      patch(st => { st.currentJob = null; });
      return true;
    }
    const elapsed = now() - (job.stateAt || job.startedAt || now());
    const plugin = plugins.get(job.plugin);

    if (!plugin && job.state !== 'HUB_NAVIGATING' && job.state !== 'HUB_VISITING' && job.state !== 'HUB_DECIDING') {
      if (elapsed < CFG.PLUGIN_GRACE_MS) {
        if (!job._graceLogged) {
          log('runner', `⏳ waiting for plugin '${job.plugin}' to load (max ${Math.round(CFG.PLUGIN_GRACE_MS/1000)}s)`);
          patch(st => { if (st.currentJob?.id === job.id) st.currentJob._graceLogged = true; });
        }
        return true;
      }
      log('runner', `✗ plugin '${job.plugin}' not loaded after ${elapsed}ms`);
      retryOrFail(job.id, 'no-plugin');
      return true;
    }

    switch (job.state) {
      case 'HUB_NAVIGATING': {
        const targetGid = job.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        const hubTarget = { page: hubPage, village: job.target.village };
        const curVid = curVillageId();
        const pt = pageType();

        if (isOnTarget(hubTarget)) {
          log('runner', `✓ at hub ${hubPage}@${vLabel(job.target.village)}`);
          setJobState(job.id, 'HUB_VISITING');
          return true;
        }

        if (pt === 'build') {
          const closeBtn = Resolver.resolve({ page: 'dorf2', village: job.target.village });
          if (closeBtn) {
            log('runner', `← closing build.php first`);
            await humanClick(closeBtn.el);
            return true;
          }
        }

        if (isHub() && String(curVid) === String(job.target.village) && pt !== hubPage) {
          const r = Resolver.resolve(hubTarget);
          if (r) {
            log('runner', `→ switching to ${hubPage} [${r.strategy}]`);
            await humanClick(r.el);
            return true;
          }
        }

        if (isHub() && String(curVid) !== String(job.target.village)) {
          const r = Resolver.resolve(hubTarget);
          if (r) {
            log('runner', `↪ switching to ${vLabel(job.target.village)} ${hubPage} [${r.strategy}]`);
            recordRotationContext(curVid);
            ssSet(SS_PAGE_MARK, 'nova');
            await humanClick(r.el);
            return true;
          }
        }

        if (!isHub()) {
          const r = Resolver.resolve(hubTarget);
          if (r) { await humanClick(r.el); return true; }
        }

        if (elapsed > CFG.LIMIT_HUB_NAVIGATING) retryOrFail(job.id, 'hub-nav-timeout');
        return true;
      }

      case 'HUB_VISITING': {
        if (elapsed < 200) return false;
        if (!isDomReadyForDorf()) {
          if (elapsed > CFG.HUB_DOM_READY_MS * 2) {
            log('runner', `⏳ hub DOM not ready after ${elapsed}ms`);
            retryOrFail(job.id, 'hub-dom-timeout');
            return true;
          }
          return false;
        }
        const stable = await waitForHubStable(CFG.HUB_STABLE_MAX_MS);
        if (!stable.ok) {
          if (elapsed > CFG.HUB_DOM_READY_MS + CFG.HUB_STABLE_MAX_MS) {
            log('runner', `⏳ hub not stable after ${elapsed}ms → ${stable.reason}`);
            retryOrFail(job.id, 'hub-stable-timeout');
            return true;
          }
          return false;
        }
        captureCurrentVillage();
        log('runner', `📸 hub captured ${vLabel(job.target.village)} (queue: ${stable.hasBuildingList ? 'present' : 'empty'}, waited ${stable.waited}ms)`);
        setJobState(job.id, 'HUB_DECIDING');
        return true;
      }

      case 'HUB_DECIDING': {
        const decision = decideFromHub(job);
        log('runner', `🤔 decide: ${decision.action}${decision.reason ? ' — ' + decision.reason : ''}`);
        if (decision.action === 'wait') { pauseSimple(job.id, decision.delayMs, decision.reason); return true; }
        if (decision.action === 'done') { finishJob(job.id, decision.reason); return true; }
        if (decision.action === 'skip') { pauseSimple(job.id, decision.delayMs || 30000, decision.reason || 'skipped'); return true; }
        setJobState(job.id, 'BUILD_NAVIGATING');
        return true;
      }

      case 'BUILD_NAVIGATING': {
        if (elapsed < CFG.BUILD_NAV_DELAY_MIN) return false;

        if (isOnTarget(job.target, { relaxBuildParams: true })) {
          log('runner', `✓ arrived at build.php (relaxed)`);
          setJobState(job.id, 'BUILD_EXECUTING');
          return true;
        }
        const targetGid = job.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        if (pageType() === hubPage && String(curVillageId()) === String(job.target.village)) {
          const r = Resolver.resolve(job.target);
          if (r) {
            log('runner', `🎯 tile click → build.php [${r.strategy}]`);
            await humanClick(r.el);
            return true;
          } else {
            log('runner', `✗ tile not found (slot=${job.target.params?.id}, gid=${targetGid})`);
            retryOrFail(job.id, 'no-tile');
            return true;
          }
        }
        if (!job._hubBounceCount) patch(st => { if (st.currentJob?.id === job.id) st.currentJob._hubBounceCount = 0; });
        const bounce = (job._hubBounceCount || 0) + 1;
        patch(st => { if (st.currentJob?.id === job.id) st.currentJob._hubBounceCount = bounce; });
        if (bounce > CFG.MAX_HUB_BOUNCE) {
          log('runner', `✗ too many hub bounces (${bounce}) → fail`);
          retryOrFail(job.id, 'too-many-bounces');
          return true;
        }
        log('runner', `⚠ not in hub for build — going back (bounce ${bounce}/${CFG.MAX_HUB_BOUNCE})`);
        setJobState(job.id, 'HUB_NAVIGATING');
        return true;
      }

      case 'BUILD_EXECUTING': {
        if (!isOnTarget(job.target, { relaxBuildParams: true })) {
          if (isHub()) { setJobState(job.id, 'BUILD_CONFIRMING'); return true; }
          retryOrFail(job.id, 'left-target');
          return true;
        }
        if (!isDomReadyForBuildPage()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS) {
            retryOrFail(job.id, 'build-dom-timeout');
            return true;
          }
          return true;
        }

        if (job.payload?.kind === 'construct') {
          const u = new URL(location.href);
          const curCat = u.searchParams.get('category');
          const curGid = u.searchParams.get('gid');
          const wantCat = String(job.payload.constructCategory || job._catWant || '1');
          const wantGid = String(job.payload.gid);

          if (curGid && curGid === wantGid) {
            log('runner', `⚠ construct task but URL has gid=${curGid} → convert to upgrade`);
            patch(st => {
              if (st.currentJob?.id === job.id) {
                st.currentJob.payload.kind = 'upgrade';
                st.currentJob.target.params.gid = wantGid;
                delete st.currentJob.target.params.category;
                delete st.currentJob.payload.constructCategory;
                st.currentJob.state = 'BUILD_EXECUTING';
                st.currentJob.stateAt = now();
              }
            });
            return true;
          }

          if (String(curCat) !== wantCat) {
            log('runner', `↪ BUILD_EXECUTING: category mismatch (cur=${curCat || 'none'}, want=${wantCat}) → force URL`);
            saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', { _catWant: wantCat, readyAt: now() + 3000 });

            const newU = new URL(location.href);
            newU.searchParams.set('category', wantCat);
            log('runner', `↪ force URL → ${newU.pathname}${newU.search}`);
            location.href = newU.toString();
            return true;
          }
        }

        if (elapsed > CFG.LIMIT_BUILD_EXECUTING) { retryOrFail(job.id, 'exec-timeout'); return true; }
        if (typeof plugin.onArrive !== 'function') { retryOrFail(job.id, 'no-onArrive'); return true; }
        try {
          const mergedPayload = {
            ...job.payload,
            _skipVideo: job._skipVideo === true || job.payload?._skipVideo === true,
            _videoRetries: job._videoRetries ?? job.payload?._videoRetries ?? 0,
          };
          const action = await plugin.onArrive({ job, target: job.target, payload: mergedPayload, isVerify: false });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'onArrive-threw: ' + e.message); }
        return true;
      }

      case 'BUILD_CONFIRMING': {
        if (isPopupOpen()) return false;

        if (!isHub()) {
          if (elapsed < 3000) return false;
          if (elapsed > CFG.BUILD_CONFIRMING_FORCE_NAV_MS) {
            log('runner', `⏱ still on ${pageType()} after ${elapsed}ms → force navigate to hub`);
            const hubPage = getTargetHub(job.target.params?.gid) || 'dorf2';
            const hubTarget = { page: hubPage, village: job.target.village };
            saveCurrentJobAsTask(job.id, 'BUILD_CONFIRMING', { readyAt: now() + 2000 });

            navigate(hubTarget).then(r => {
              if (!r.ok) retryOrFail(job.id, 'confirm-nav: '+r.reason);
            }).catch(e => retryOrFail(job.id, 'confirm-nav-ex: '+e.message));
            return true;
          }
          return false;
        }

        if (!isDomReadyForDorf()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS * 2) {
            log('runner', `⏱ dorf DOM timeout → verify`);
            setJobState(job.id, 'VERIFYING');
            return true;
          }
          return false;
        }
        if (elapsed < 1500) return false;

        if (job.plugin === 'Builder' && !plugins.get('Builder')) {
          if (elapsed > CFG.PLUGIN_GRACE_MS) {
            log('runner', `⏳ Builder plugin still not loaded → verify`);
            setJobState(job.id, 'VERIFYING');
            return true;
          }
          return false;
        }

        captureCurrentVillage();
        const v = readState().villages[String(job.target.village)];
        const bq = v?.buildQueue || [];
        const wantName = (job.payload.name || '').toLowerCase().trim();
        const wantLevel = job.payload.targetLevel || 0;
        const preIds = new Set(job.payload._preQueueIds || []);
        const found = bq.find(b => {
          const bName = (b.name || '').toLowerCase().trim();
          const nameMatch = bName === wantName || bName.includes(wantName) || wantName.includes(bName);
          const levelMatch = b.level === wantLevel;
          if (!nameMatch || !levelMatch) return false;
          if (preIds.size > 0 && b.buildingId && preIds.has(String(b.buildingId))) return false;
          return true;
        });

        if (found) {
          log('runner', `✓ confirmed via queue: ${found.name} L${found.level} (id=${found.buildingId || '?'})`);
          setJobState(job.id, 'BUILDING', {
            buildEndsAt: now() + (found.remaining || 0) * 1000 + 5000,
            confirmedItem: found,
            _confirmMethod: 'queue',
          });
          if (plugin?.onConfirmResult) {
            try { plugin.onConfirmResult({ job, status: 'confirmed', item: found, manualItems: [] }); }
            catch (e) { log('runner', `onConfirmResult threw: ${e.message}`); }
          }
          return true;
        }

        if (bq.length === 0) {
          log('runner', `⏸ queue empty → navigate to build.php to verify level`);
          saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 1000 });
          const targetBuild = {
            page: 'build',
            village: job.target.village,
            params: {
              id: job.target.params?.id,
              gid: job.target.params?.gid,
              category: job.payload?.constructCategory,
            },
          };
          navigate(targetBuild).then(r => {
            if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
          }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
          return true;
        }

        log('runner', `⏸ queue has other items but not ours: ${bq.map(b=>b.name+' L'+b.level).join(', ')}`);
        if (plugin?.onConfirmResult) {
          try { plugin.onConfirmResult({ job, status: 'manual', item: null, manualItems: bq }); }
          catch (e) { log('runner', `onConfirmResult threw: ${e.message}`); }
        }

        if (elapsed > 5000) {
          log('runner', `⏱ not in queue after 5s → verify level`);
          saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 1000 });
          const targetBuild = {
            page: 'build',
            village: job.target.village,
            params: {
              id: job.target.params?.id,
              gid: job.target.params?.gid,
              category: job.payload?.constructCategory,
            },
          };
          navigate(targetBuild).then(r => {
            if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
          }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
          return true;
        }
        return false;
      }

      case 'BUILD_CONFIRMING_VIDEO_WAIT': {
        if (isPopupOpen()) return false;

        if (isHub()) {
          log('runner', `✓ video: reloaded to hub → BUILD_CONFIRMING`);
          setJobState(job.id, 'BUILD_CONFIRMING');
          return true;
        }

        if (elapsed < CFG.VIDEO_WAIT_TIMEOUT_MS) return false;

        const retries = (job._videoRetries || 0) + 1;
        if (retries < CFG.VIDEO_MAX_RETRIES) {
          log('runner', `⏱ video timeout 90s (retry ${retries}/${CFG.VIDEO_MAX_RETRIES}) → reload & retry`);
          saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', {
            _videoRetries: retries,
            _skipVideo: false,
            readyAt: now() + 3000,
          });
          setTimeout(() => location.reload(), 500);
          return true;
        }

        log('runner', `✗ video failed ${retries}x → fallback to GREEN button`);
        saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', {
          _skipVideo: true,
          _videoRetries: 0,
          readyAt: now() + 2000,
        });
        return true;
      }

      case 'BUILDING': {
        captureCurrentVillage();
        if (job.buildEndsAt && now() >= job.buildEndsAt) {
          log('runner', `⏱ build ends → verify`);
          setJobState(job.id, 'VERIFYING');
          return true;
        }
        return false;
      }

      case 'VERIFYING': {
        if (!isOnTarget(job.target, { relaxBuildParams: true })) {
          if (isHub()) {
            log('runner', `🎯 verify: navigate to build.php`);
            saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 2000 });
            const targetBuild = {
              page: 'build',
              village: job.target.village,
              params: {
                id: job.target.params?.id,
                gid: job.target.params?.gid,
                category: job.payload?.constructCategory,
              },
            };
            navigate(targetBuild).then(r => {
              if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
            }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
            return true;
          }
          if (!isHub()) {
            if (elapsed > CFG.LIMIT_VERIFYING) { retryOrFail(job.id, 'verify-nav-timeout'); return true; }
            return true;
          }
          return true;
        }

        if (!isDomReadyForBuildPage()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS) { retryOrFail(job.id, 'verify-dom-timeout'); return true; }
          return true;
        }
        if (elapsed > CFG.LIMIT_VERIFYING) { retryOrFail(job.id, 'verify-timeout'); return true; }
        if (typeof plugin.onArrive !== 'function') { retryOrFail(job.id, 'no-onArrive'); return true; }
        try {
          const action = await plugin.onArrive({ job, target: job.target, payload: job.payload, isVerify: true });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'verify-threw: ' + e.message); }
        return true;
      }
    }
    return false;
  }

  function handleAction(jobId, action) {
    switch (action.type) {
      case 'done': return finishJob(jobId, action.reason || 'done');
      case 'wait': return pauseSimple(jobId, action.delayMs || 30000, action.reason);
      case 'retry': return retryOrFail(jobId, action.reason || 'retry');
      case 'fail': return retryOrFail(jobId, action.reason || 'fail');
      case 'transition': {
        const s = readState();
        if (s.currentJob?.id === jobId) setJobState(jobId, action.state, action.extra || {});
        return;
      }
      default: log('runner', `⚠ unknown action: ${action.type}`); return finishJob(jobId, 'unknown');
    }
  }
  function pauseSimple(jobId, delayMs, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      st.currentJob = null;
      const moved = { ...job };
      moved.readyAt = now() + delayMs;
      moved.lastError = reason || 'wait';
      moved.createdAt = moved.createdAt || now();
      delete moved.state; delete moved.stateAt; delete moved.startedAt;
      delete moved.snapshotBefore; delete moved._graceLogged; delete moved._domWaitLogged;
      delete moved._hubBounceCount; delete moved._waitLogged;
      st.tasks.push(moved);
    });
  }

  async function pickNextJob() {
    const s = readState();
    if (s.currentJob) return;
    if (!s.heartbeat.enabled) return;
    if (s.workerLock && s.workerLock.tabId !== MY_TAB && s.workerLock.expiresAt > now()) return;
    patch(st => { st.workerLock = { tabId: MY_TAB, expiresAt: now() + CFG.WORKER_LOCK_TTL_MS }; });
    if (s.heartbeat.masterPaused) return;
    const ready = canAct();
    if (!ready.ok) return;
    const task = pickRunnableTask();
    if (task) {
      patch(st => {
        st.tasks = st.tasks.filter(t => t.id !== task.id);
        const isHeartbeat = task.plugin === 'Heartbeat';
        const restoredState = (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS))
          ? task.state
          : null;
        const finalState = restoredState || (isHeartbeat ? 'NAVIGATING' : 'HUB_NAVIGATING');

        st.currentJob = {
          ...task,
          state: finalState,
          stateAt: now(),
          startedAt: now(),
          attempts: task.attempts || 0,
          _hubBounceCount: 0,
          _sessionReset: true,
        };
      });
      if (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS)) {
        log('runner', `↩ resume with saved state: ${task.state} — reset stateAt`);
      }
      log('runner', `▶ start: ${task.plugin} → ${task.target.page}@${vLabel(task.target.village)}`);
      if (task.plugin === 'Heartbeat') {
        navigate(task.target).then(r => {
          if (!r.ok) retryOrFail(task.id, 'nav: '+r.reason);
        }).catch(e => retryOrFail(task.id, e.message));
      } else {
        const restoredState = (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS))
          ? task.state
          : null;

        if (restoredState === 'BUILD_EXECUTING' || restoredState === 'VERIFYING') {
          const u = new URL(location.href);
          const curPage = pageType();
          const curId = u.searchParams.get('id');
          const curCat = u.searchParams.get('category');
          const wantId = String(task.target.params?.id || '');
          const wantCat = String(task.payload?.constructCategory || task._catWant || '');

          if (curPage === 'build' && curId === wantId && (wantCat === '' || curCat === wantCat)) {
            log('runner', `✓ already at build.php?id=${curId}&category=${curCat || 'none'} → skip navigation`);
            return;
          }
        }

        if (restoredState === 'BUILD_CONFIRMING' || restoredState === 'BUILD_CONFIRMING_VIDEO_WAIT') {
          if (isHub()) {
            log('runner', `✓ already at hub → skip navigation`);
            return;
          }
        }

        const targetGid = task.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        const hubTarget = { page: hubPage, village: task.target.village };
        if (isOnTarget(hubTarget)) {
          setJobState(task.id, 'HUB_VISITING');
        } else {
          const curVid = curVillageId();
          if (curVid && String(curVid) !== String(task.target.village)) {
            recordRotationContext(curVid);
            ssSet(SS_PAGE_MARK, 'nova');
          }
          navigate(hubTarget).then(r => {
            if (!r.ok) retryOrFail(task.id, 'hub-nav: '+r.reason);
          }).catch(e => retryOrFail(task.id, 'hub-nav-ex: '+e.message));
        }
      }
      return;
    }
    rotationTick();
  }

  async function advanceJobLegacy() {
    const s = readState();
    const job = s.currentJob;
    if (!job) return false;
    if (!s.heartbeat.enabled) { patch(st => { st.currentJob = null; }); return true; }
    const elapsed = now() - (job.stateAt || job.startedAt || now());
    const plugin = plugins.get(job.plugin);
    if (!plugin) { retryOrFail(job.id, 'no-plugin'); return true; }
    switch (job.state) {
      case 'NAVIGATING':
        if (isOnTarget(job.target)) { setJobState(job.id, 'EXECUTING'); return true; }
        if (elapsed > CFG.LIMIT_BUILD_NAVIGATING) retryOrFail(job.id, 'nav-timeout');
        return true;
      case 'EXECUTING':
        if (elapsed > CFG.LIMIT_BUILD_EXECUTING) { retryOrFail(job.id, 'exec-timeout'); return true; }
        try {
          const action = await plugin.onArrive({ job, target: job.target, payload: job.payload });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'onArrive-threw: ' + e.message); }
        return true;
    }
    return false;
  }

  // ═════ 2.0.2.21: watchdog — expire rotation → reschedule ═════
  function watchdog() {
    const s = readState();
    const n = now();
    const expiring = s.tasks.filter(t => t.expiresAt <= n);
    for (const t of expiring) {
      // ═══ FIX: if a rotation task expired, reschedule it ═══
      if (t.payload?.rotation) {
        log('watchdog', `⏱ rotation task expired → reschedule in ${CFG.ROTATION_EXPIRE_RESCHEDULE_MS/1000}s`);
        patch(st => { st.heartbeat.nextRotationAt = n + CFG.ROTATION_EXPIRE_RESCHEDULE_MS; });
      }
      const plugin = plugins.get(t.plugin);
      if (plugin?.onFail) {
        try { plugin.onFail({ job: t, reason: 'ttl-expired' }); } catch (e) { log('watchdog', `onFail threw: ${e.message}`); }
      }
      log('watchdog', `expired task: ${t.plugin}@${vLabel(t.villageId)}`);
    }
    patch(st => {
      const before = st.tasks.length;
      st.tasks = st.tasks.filter(t => t.expiresAt > n);
      if (st.tasks.length !== before) log('watchdog', `cleaned ${before - st.tasks.length} task(s)`);
    });

    if (s.currentJob) {
      const stateAge = n - (s.currentJob.stateAt || n);
      if (stateAge < CFG.WATCHDOG_GRACE_MS) return;
      const state = s.currentJob.state;
      const limits = {
        'HUB_NAVIGATING': CFG.LIMIT_HUB_NAVIGATING,
        'HUB_VISITING': CFG.LIMIT_HUB_VISITING,
        'HUB_DECIDING': CFG.LIMIT_HUB_DECIDING,
        'BUILD_NAVIGATING': CFG.LIMIT_BUILD_NAVIGATING,
        'BUILD_EXECUTING': CFG.LIMIT_BUILD_EXECUTING,
        'BUILD_CONFIRMING': CFG.LIMIT_BUILD_CONFIRMING,
        'BUILD_CONFIRMING_VIDEO_WAIT': CFG.LIMIT_BUILD_CONFIRMING_VIDEO_WAIT,
        'BUILDING': CFG.LIMIT_BUILDING,
        'VERIFYING': CFG.LIMIT_VERIFYING,
      };
      const limit = limits[state] || (CFG.LIMIT_HUB_NAVIGATING * 3);
      if (stateAge > limit) {
        log('watchdog', `job stuck ${Math.round(stateAge/1000)}s in ${state} → retry`);
        retryOrFail(s.currentJob.id, 'watchdog-stuck-' + state);
      }
    }
  }


// ═══════════════════════════════════════════════════════════
// FILE: 07-plugins-api.js (117 lines)
// ═══════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════
// FILE: 08-ui-hbbox.js (318 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 08-ui-hbbox.js
// ═══════════════════════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('nova-hb-style')) return;
    const s = document.createElement('style');
    s.id = 'nova-hb-style';
    s.textContent = `
      #novaHBBox .nova-hb-title { font-size: 14px; cursor: default; }
      #novaHBBox .nova-hb-title .nova-hb-emoji { cursor: default; user-select: none; padding: 0 2px; }
      #novaHBBox .nova-hb-title .nova-hb-emoji.debug-click { cursor: pointer; }
      #novaHBBox .nova-hb-badge { display: block; cursor: pointer; font-size: 16px; opacity: .8; line-height: 1; user-select: none; margin-top: 4px; text-align: center; padding: 2px 0; }
      #novaHBBox .nova-hb-badge:hover { opacity: 1; }
      #novaHBBox .nova-hb-badge.active { color: #2a5ab0; }
      #novaHBBox .nova-hb-chips { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 5px 6px; font-family: 'Courier New', monospace; }
      #novaHBBox .nova-hb-chip { display: flex; flex-direction: column; padding: 3px 5px; border-radius: 3px; background: rgba(255,255,255,.5); line-height: 1.25; overflow: hidden; font-size: 10px; min-width: 0; }
      #novaHBBox .nova-hb-chip.stale { opacity: .7; }
      #novaHBBox .nova-hb-chip.urgent { background: rgba(255,180,180,.55); }
      #novaHBBox .nova-hb-chip.current { box-shadow: inset 0 0 0 1px rgba(80,160,50,.55); }
      #novaHBBox .nova-hb-chip .row { display: flex; align-items: center; gap: 3px; min-width: 0; overflow: hidden; }
      #novaHBBox .nova-hb-chip .row-head { font-weight: bold; margin-bottom: 5px; }
      #novaHBBox .nova-hb-chip .name { font-weight: bold; }
      #novaHBBox .nova-hb-chip .age { opacity: .7; font-size: 9px; margin-left: auto; }
      #novaHBBox .nova-hb-chip .badge { flex-shrink: 0; font-size: 10px; }
      #novaHBBox .nova-hb-chip .cell { flex: 1 1 50%; display: inline-flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
      #novaHBBox .nova-hb-chip i.lumber_small:empty::before { content: '🌲'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-chip i.clay_small:empty::before { content: '🧱'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-chip i.iron_small:empty::before { content: '⚙'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-chip i.crop_small:empty::before { content: '🌾'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-chip i.warehouse_small:empty::before { content: '📦'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-chip i.granary_small:empty::before { content: '🏭'; font-size: 10px; font-style: normal; }
      #novaHBBox .nova-hb-state { padding: 4px 8px; font-size: 10px; color: #2a4a70; background: rgba(80,130,200,.10); border-top: 1px dashed rgba(80,130,200,.25); font-family: 'Courier New', monospace; text-align: center; }
      #novaHBBox .nova-hb-state b { color: #1a3a60; }
      #novaHBBox .nova-hb-state .wait-tag { display: inline-block; background: rgba(255,180,80,.45); color: #7a4000; padding: 1px 5px; border-radius: 3px; font-weight: bold; margin-left: 4px; }
      #novaHBBox .nova-hb-next { padding: 4px 8px; font-size: 10px; text-align: center; color: #4a3a70; font-weight: bold; background: rgba(120,90,180,.10); border-top: 1px solid rgba(120,90,180,.20); font-family: 'Courier New', monospace; }
      #novaHBBox .nova-hb-next.ready { color: #1a5a10; background: rgba(120,200,80,.20); }
      #novaHBBox .nova-hb-next.off { color: #8a7050; background: rgba(200,200,200,.25); }
      #novaHBBox .nova-hb-next.frozen { color: #fff; background: linear-gradient(180deg, #b88070, #8a5040); animation: novaHbPulse 1.5s ease-in-out infinite; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
      #novaHBBox .nova-hb-next .row2 { display: block; margin-top: 2px; opacity: .85; font-weight: normal; }
      #novaHBBox .nova-hb-next.override { color: #fff; background: linear-gradient(180deg, #6a9a4a, #4a7a30); }
      #novaHBBox .nova-hb-tgl-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; background: rgba(255,255,255,.2); border-top: 1px solid rgba(80,130,200,.25); font-size: 11px; color: #2a4a70; }
      #novaHBBox .nova-hb-tgl-row .lbl { font-weight: bold; }
      #novaHBBox .nova-hb-tgl { display: inline-flex; align-items: center; justify-content: center; padding: 3px 10px; min-width: 48px; font-size: 10px; font-weight: bold; cursor: pointer; user-select: none; background: linear-gradient(180deg, #d0d8e8 0%, #b0bcd0 100%); color: #3a4a70; border: 1px solid #8a9ac0; border-radius: 3px; }
      #novaHBBox .nova-hb-tgl.on-blue { background: linear-gradient(180deg, #5a9fd4 0%, #2a6a9c 100%); color: #fff; border-color: #1a4a7c; }
      #novaHBBox .nova-hb-tgl.off-grey { background: linear-gradient(180deg, #b0b0b0 0%, #808080 100%); color: #fff; border-color: #606060; }
      @keyframes novaHbPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(184,128,112,.45); } 50% { box-shadow: 0 0 0 4px rgba(184,128,112,0); } }
      #tcTestPanel .nova-debug-toggle { cursor: pointer; }
    `;
    document.head.appendChild(s);
  }
  function flash(msg) {
    let el = document.getElementById('nova-hb-flash');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'nova-hb-flash';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,#ffe9a8,#f0c860);border:2px solid #7a5c30;border-radius:6px;padding:6px 14px;color:#5a2a08;font-weight:bold;font-size:12px;z-index:2147483601;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  function hbHTML() {
    const debugOn = isDebugEnabled();
    const s = readState();
    const allowHidden = s.heartbeat?.allowHiddenTab === true;
    return `
      <div class="header">
        <div class="buttonsWrapper">
          <a class="layoutButton buttonFramed withIcon round edit gold nova-hb-force" href="#" title="Force rotation now">
            <svg viewBox="0 0 24 24" style="max-width: 22px;max-height: 26px;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></svg>
          </a>
          <a class="layoutButton buttonFramed withIcon round edit nova-hb-toggle" href="#" title="Heartbeat ON/OFF">
            <svg viewBox="0 0 14 16" style="max-width: 18px;max-height: 26px;"><g stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"><path d="M7 1.5v6"></path><path d="M10.6 3.4a5 5 0 1 1-7.2 0"></path></g></svg>
          </a>
        </div>
      </div>
      <div class="content">
        <div class="boxTitle" style="margin-top: 10px;">
          <div class="nova-hb-title">
            <span class="nova-hb-emoji ${debugOn ? '' : 'debug-click'}" title="${debugOn ? '' : 'Click 5x to enable debug'}">💓</span>
            Nova Heartbeat 2.0.2.21
          </div>
          ${debugOn ? '<span class="nova-hb-badge" title="Toggle debug panel">ℹ️</span>' : ''}
        </div>
        <div class="nova-hb-chips">—</div>
        <div class="nova-hb-state">—</div>
        <div class="nova-hb-next">—</div>
        <div class="nova-hb-tgl-row"><span class="lbl">🌙 Active on hidden tab</span><span class="tg nova-hb-tgl ${allowHidden ? 'on-blue' : 'off-grey'}" data-key="allowHiddenTab"><span>${allowHidden ? 'ON' : 'OFF'}</span></span></div>
      </div>
    `;
  }
  function ensureHBBox() {
    let box = document.getElementById('novaHBBox');
    if (box) return box;
    const parent = document.getElementById('sidebarBeforeContent')?.querySelector('.sidebarBoxWrapper');
    if (!parent) return null;
    box = document.createElement('div');
    box.className = 'sidebarBox expanded';
    box.id = 'novaHBBox';
    box.innerHTML = hbHTML();
    const firstChild = parent.firstChild;
    if (firstChild) parent.insertBefore(box, firstChild); else parent.appendChild(box);
    box.querySelector('.nova-hb-toggle').onclick = e => {
      e.preventDefault();
      const s = readState();
      const next = !s.heartbeat.enabled;
      patch(st => {
        st.heartbeat.enabled = next;
        if (!next && st.currentJob) {
          log('sys', `⏸ aborting current job: ${st.currentJob.plugin}`);
          st.currentJob = null;
        }
        if (next && !st.heartbeat.nextRotationAt) {
          st.heartbeat.nextRotationAt = now() + 5000;
        }
      });
      log('sys', `Heartbeat → ${next ? 'ON' : 'OFF'}`);
      flash(next ? '⚡ Heartbeat ON' : '⏸ Heartbeat OFF');
      renderHB();
    };
    box.querySelector('.nova-hb-force').onclick = e => {
      e.preventDefault();
      const s = readState();
      if (!s.heartbeat.enabled) { flash('Heartbeat is OFF'); return; }
      if (s.currentJob) { flash(`Busy: ${s.currentJob.plugin} — try later`); return; }
      const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
      const curVid = curVillageId();
      const others = vids.filter(v => String(v) !== String(curVid));
      if (!others.length) { flash('no other villages'); return; }
      others.sort((a,b) => (s.villages[a].lastSeen || 0) - (s.villages[b].lastSeen || 0));
      const target = others[0];
      patch(st => {
        st.heartbeat.nextRotationAt = 0;
        st.heartbeat._lastBusySkipLog = 0;
        st.heartbeat._lastRotCheck = 0;
      });
      recordRotationContext(curVid);
      ssSet(SS_PAGE_MARK, 'nova');
      enqueue({ plugin: 'Heartbeat', priority: 9, villageId: String(target), target: { page: 'dorf1', village: String(target) }, payload: { rotation: true, forced: true }, requiresFlag: 'heartbeat', ttlMs: 5 * 60 * 1000, createdAt: now() });
      log('rotation', `⚡ forced rotation → ${vLabel(target)}`);
      flash(`⚡ → ${vLabel(target)}`);
      renderHB();
    };
    const badge = box.querySelector('.nova-hb-badge');
    if (badge) badge.onclick = e => { e.preventDefault(); toggleDebugPanel(); };

    box.querySelectorAll('.nova-hb-tgl').forEach(tg => {
      tg.onclick = () => {
        const key = tg.dataset.key;
        const s = readState();
        const next = !s.heartbeat[key];
        patch(st => { st.heartbeat[key] = next; });
        log('sys', `🌙 allowHiddenTab → ${next ? 'ON' : 'OFF'}`);
        flash(`🌙 hidden tab: ${next ? 'ON' : 'OFF'}`);
        updateHBToggleStyles();
      };
    });

    const emoji = box.querySelector('.nova-hb-emoji');
    if (emoji && !isDebugEnabled()) {
      let clickCount = 0;
      let clickTimer = null;
      emoji.onclick = () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1500);
        if (clickCount >= 5) {
          clickCount = 0;
          clearTimeout(clickTimer);
          TC.debug.enable();
        }
      };
    }
    return box;
  }

  function updateHBToggleStyles() {
    const box = document.getElementById('novaHBBox');
    if (!box) return;
    const s = readState();
    box.querySelectorAll('.nova-hb-tgl').forEach(tg => {
      const key = tg.dataset.key;
      const on = s.heartbeat[key] === true;
      tg.classList.remove('on-blue', 'off-grey');
      if (key === 'allowHiddenTab') tg.classList.add(on ? 'on-blue' : 'off-grey');
      const label = tg.querySelector('span');
      if (label) label.textContent = on ? 'ON' : 'OFF';
    });
  }

  function computeWaitState() {
    const s = readState();
    const job = s.currentJob;
    if (!job) return null;
    const elapsed = now() - (job.stateAt || job.startedAt || now());
    const plugin = plugins.get(job.plugin);
    if (!plugin && (job.state === 'HUB_NAVIGATING' || job.state === 'HUB_VISITING' || job.state === 'HUB_DECIDING')) {
      return null;
    }
    if (!plugin) {
      return `wait for plugin '${job.plugin}' (${Math.round(elapsed/1000)}s / ${Math.round(CFG.PLUGIN_GRACE_MS/1000)}s)`;
    }
    if (job.state === 'BUILD_NAVIGATING' && elapsed < CFG.BUILD_NAV_DELAY_MIN) {
      return `wait before resolver (${Math.round(elapsed/1000)}s)`;
    }
    if (job.state === 'BUILD_CONFIRMING_VIDEO_WAIT') {
      const remain = Math.max(0, CFG.VIDEO_WAIT_TIMEOUT_MS - elapsed);
      const retries = job._videoRetries || 0;
      return `video wait (${Math.round(remain/1000)}s, retry ${retries}/3)`;
    }
    return null;
  }

  function renderHB() {
    const box = document.getElementById('novaHBBox');
    if (!box) return;
    const s = readState();
    const n = now();
    const curVid = curVillageId();
    const toggle = box.querySelector('.nova-hb-toggle');
    if (s.heartbeat.enabled) { toggle.classList.add('gold'); toggle.style.color = ''; }
    else { toggle.classList.remove('gold'); toggle.style.color = '#a02020'; }
    const badge = box.querySelector('.nova-hb-badge');
    if (badge) {
      if (s.ui.panelOpen) badge.classList.add('active'); else badge.classList.remove('active');
    }
    const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
    const chipsEl = box.querySelector('.nova-hb-chips');
    if (!vids.length) chipsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#8a7050;font-style:italic;font-size:10px;">no villages yet</div>';
    else {
      chipsEl.innerHTML = vids.map(vid => {
        const v = s.villages[vid] || {};
        const isCur = String(vid) === String(curVid);
        const age = v.lastSeen ? (n - v.lastSeen) : Infinity;
        const isStale = !v.lastSeen || age > 5 * 60 * 1000;
        const isUrgent = !v.lastSeen || age > CFG.URGENT_AGE_MS;
        const icon = !v.lastSeen ? '⚪' : age < 60000 ? '🟢' : age < 5 * 60 * 1000 ? '🟡' : '🔴';
        const res = v.res || {}, max = v.max || {};
        const q = (v.buildQueue || []).length;
        const mvt = v.movements ? (v.movements.incoming?.length || 0) + (v.movements.outgoing?.length || 0) : 0;
        const cls = ['nova-hb-chip'];
        if (isStale) cls.push('stale');
        if (isUrgent) cls.push('urgent');
        if (isCur) cls.push('current');
        return `<div class="${cls.join(' ')}" title="${esc(vLabel(vid))}">
          <div class="row row-head"><span class="badge">${icon}</span><span class="name">${esc(vLabel(vid))}</span><span class="age">${v.lastSeen ? fmtAge(age) : 'never'}</span></div>
          <div class="row"><span class="cell"><i class="lumber_small"></i><span>${res[1] ?? '—'}</span></span><span class="cell"><i class="clay_small"></i><span>${res[2] ?? '—'}</span></span></div>
          <div class="row"><span class="cell"><i class="iron_small"></i><span>${res[3] ?? '—'}</span></span><span class="cell"><i class="crop_small"></i><span>${res[4] ?? '—'}</span></span></div>
          <div class="row"><span class="cell"><i class="warehouse_small"></i><span>${max.warehouse ?? '—'}</span></span><span class="cell"><i class="granary_small"></i><span>${max.granary ?? '—'}</span></span></div>
          <div class="row" style="font-size:9px;opacity:.8;justify-content:space-between;">
            <span>🔨 ${q}</span><span>🚶 ${mvt}</span>
          </div>
        </div>`;
      }).join('');
    }
    const stateEl = box.querySelector('.nova-hb-state');
    const fi = freezeInfo();
    const waitState = computeWaitState();
    if (fi && !fi.expired && fi.reason) stateEl.innerHTML = `❄ <b>FROZEN</b> on ${esc(fi.reason)}`;
    else if (s.currentJob) {
      const el = ((n - (s.currentJob.stateAt || n)) / 1000).toFixed(1);
      let html = `🎯 <b>${esc(s.currentJob.plugin)}</b> → ${esc(s.currentJob.target.page)}@${esc(vLabel(s.currentJob.target.village))} · ${esc(s.currentJob.state)} · ${el}s`;
      if (waitState) html += ` <span class="wait-tag">⏳ ${esc(waitState)}</span>`;
      stateEl.innerHTML = html;
    } else {
      const ready = canAct();
      const st = ready.ok ? '💤 idle' : `⏸ ${ready.reason}`;
      stateEl.innerHTML = `${st} · page: ${esc(pageType())} @ ${esc(vLabel(curVid))}`;
    }
    const nextEl = box.querySelector('.nova-hb-next');
    const override = checkFreezeOverride();

    if (override) {
      nextEl.className = 'nova-hb-next override';
      nextEl.innerHTML = `✅ Plugin Override: ${esc(override.pluginId)}<br><span class="row2">${esc(override.description || 'active')}</span>`;
    }
    else if (fi && !fi.expired && fi.reason) {
      nextEl.className = 'nova-hb-next frozen';
      const frozenMsg = fi.message || s.heartbeat._frozenMessage || 'Frozen';
      nextEl.innerHTML = `${esc(frozenMsg)}<br>⏸ release in ${fmtTimer(fi.remain)}`;
    } else if (!s.heartbeat.enabled) {
      nextEl.className = 'nova-hb-next off';
      nextEl.innerHTML = '⏸ Heartbeat OFF — no navigation';
    } else {
      const tasks = s.tasks.slice().sort((a,b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const dt = (a.createdAt||0) - (b.createdAt||0);
        if (dt !== 0) return dt;
        return String(a.id).localeCompare(String(b.id));
      });
      const runnable = tasks.find(t => isFlagActive(t.requiresFlag, s) && t.expiresAt > n);
      const next = s.heartbeat.nextRotationAt || 0;
      const inMs = Math.max(0, next - n);
      const nextVid = (() => {
        const curVidLocal = curVillageId();
        const allVids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
        const others = allVids.filter(v => String(v) !== String(curVidLocal));
        if (!others.length) return null;
        others.sort((a,b) => (s.villages[a].lastSeen || 0) - (s.villages[b].lastSeen || 0));
        return others[0];
      })();
      const rotLine = nextVid
        ? `⏱ next rotation → ${esc(vLabel(nextVid))} in ${fmtTimer(inMs)}`
        : `⏱ next rotation in ${fmtTimer(inMs)}`;
      if (runnable) {
        const inMsT = Math.max(0, runnable.readyAt - n);
        nextEl.className = 'nova-hb-next ready';
        const waitStr = inMsT > 0 ? ` · wait ${fmtTimer(inMsT)}` : '';
        nextEl.innerHTML = `📋 <b>${esc(runnable.plugin)}</b> → ${esc(runnable.target.page)}@${esc(vLabel(runnable.target.village))}${waitStr}<span class="row2">${rotLine}</span>`;
      } else {
        nextEl.className = 'nova-hb-next';
        nextEl.innerHTML = rotLine;
      }
    }
  }


// ═══════════════════════════════════════════════════════════
// FILE: 09-ui-settings.js (7 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 09-ui-settings.js — Settings Panel (placeholder)
// Will be implemented in v0.1.0
// ═══════════════════════════════════════════════════════════

// TODO: ensureSettingsPanel, renderSettingsPanel, tabs

// ═══════════════════════════════════════════════════════════
// FILE: 10-ui-debug.js (229 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 10-ui-debug.js
// ═══════════════════════════════════════════════════════════

  const _panelTabs = new Map();
  let _panelActiveTab = 'heartbeat';
  function isPanelOpen() { return readState().ui?.panelOpen === true; }
  function setPanelOpen(v) { patch(s => { s.ui = s.ui || {}; s.ui.panelOpen = !!v; }); }
  function toggleDebugPanel() {
    if (!isDebugEnabled()) { flash('Debug OFF — 5x click 💓'); return; }
    const next = !isPanelOpen();
    setPanelOpen(next);
    const p = ensureDebugPanel();
    if (p) {
      if (next) { p.style.display = 'block'; renderDebugPanel(); flash('ℹ️ Debug panel opened'); }
      else { p.style.display = 'none'; flash('ℹ️ Debug panel closed'); }
    }
    renderHB();
  }
  function registerDebugTab(id, cfg) {
    if (!isDebugEnabled()) return;
    _panelTabs.set(id, cfg || {});
    ensureDebugPanel();
    if (isPanelOpen()) renderDebugPanel();
  }
  function ensureDebugPanel() {
    if (!isDebugEnabled()) return null;
    let p = document.getElementById('tcTestPanel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'tcTestPanel';
    p.style.cssText = 'position:fixed;top:110px;left:400px;width:420px;z-index:2147483600;background:linear-gradient(180deg,#f0f5ff,#d0ddf5);border:2px solid #3a4a80;border-radius:6px;font-family:Verdana,sans-serif;font-size:11px;color:#1a2050;box-shadow:0 6px 20px rgba(0,0,0,.4);display:' + (isPanelOpen() ? 'block' : 'none') + ';';
    p.innerHTML = `
      <div style="background:linear-gradient(180deg,#8a9ec4,#5a7098);padding:6px 10px;font-weight:bold;color:#fff;display:flex;align-items:center;gap:6px;">
        <span>🧪 Nova Debug Box</span><span style="flex:1;"></span>
        <button class="tc-tp-close" style="background:rgba(255,255,255,.25);border:1px solid #3a4a80;border-radius:3px;padding:1px 7px;cursor:pointer;color:#fff;font-weight:bold;">×</button>
      </div>
      <div class="tc-tp-body" style="padding:8px 10px;max-height:calc(100vh - 200px);overflow-y:auto;">
        <div class="tc-tp-tabs"></div>
        <div class="tc-tp-content"></div>
      </div>
    `;
    document.body.appendChild(p);
    p.querySelector('.tc-tp-close').onclick = () => toggleDebugPanel();
    return p;
  }
  function renderDebugPanel() {
    const p = document.getElementById('tcTestPanel');
    if (!p) return;
    if (!isDebugEnabled()) { p.remove(); return; }
    if (!isPanelOpen()) { p.style.display = 'none'; return; }
    p.style.display = 'block';
    const tabsEl = p.querySelector('.tc-tp-tabs');
    if (_panelTabs.size === 0) { tabsEl.innerHTML = ''; p.querySelector('.tc-tp-content').innerHTML = '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:8px;">no tabs</div>'; return; }
    if (!_panelTabs.has(_panelActiveTab)) _panelActiveTab = _panelTabs.keys().next().value;
    tabsEl.innerHTML = '<div style="display:flex;background:rgba(58,74,128,.10);border-bottom:1px solid #3a4a80;margin-bottom:6px;">' +
      Array.from(_panelTabs.entries()).map(([id, cfg]) => `<div class="tc-tp-tab" data-tab="${esc(id)}" style="flex:1;padding:6px 8px;text-align:center;cursor:pointer;font-size:10px;font-weight:bold;color:#3a4a80;border-right:1px solid rgba(58,74,128,.20);user-select:none;${id === _panelActiveTab ? 'background:linear-gradient(180deg,#d9e4f5,#a8b8d8);color:#1a2050;' : ''}">${esc(cfg.label || id)}</div>`).join('') + '</div>';
    tabsEl.querySelectorAll('.tc-tp-tab').forEach(t => t.onclick = () => { _panelActiveTab = t.dataset.tab; renderDebugPanel(); });
    const cfg = _panelTabs.get(_panelActiveTab);
    const content = p.querySelector('.tc-tp-content');
    if (cfg && typeof cfg.render === 'function') {
      content.innerHTML = cfg.render();
      if (typeof cfg.onMount === 'function') cfg.onMount(content);
    }
  }

  function renderHBDebug() {
    const s = readState();
    const n = now();
    const LOG_DISPLAY = 20;
    const logs = s.logs
      .filter(l => l.source === 'sys' || l.source === 'runner' || l.source === 'queue' ||
                   l.source === 'nav' || l.source === 'rotation' || l.source === 'watchdog' ||
                   l.sid === 'marker')
      .slice(-LOG_DISPLAY)
      .reverse();
    const logHTML = logs.length
      ? logs.map(l => {
          if (l.sid === 'marker') return `<div style="background:rgba(58,74,128,.15);font-weight:bold;text-align:center;margin:3px 0;padding:2px 0;">${esc(l.msg)}</div>`;
          const cls = /error|fail|✗|🚨/.test(l.msg) ? 'color:#c04030;font-weight:bold;'
                     : /warn|⚠|⏸|❄/.test(l.msg) ? 'color:#b06030;font-weight:bold;'
                     : /✓|confirmed|done/.test(l.msg) ? 'color:#2a7a2a;font-weight:bold;'
                     : /👤/.test(l.msg) ? 'color:#2a5ab0;font-weight:bold;'
                     : /🔄/.test(l.msg) ? 'color:#7a4ab0;font-weight:bold;'
                     : /🎯/.test(l.msg) ? 'color:#a06a30;font-weight:bold;'
                     : '';
          return `<div style="padding:1px 0;border-bottom:1px dashed rgba(58,74,128,.12);font-family:'Courier New',monospace;font-size:9px;"><span style="color:#6a7a98;">${clockOf(l.ts)}</span> <span style="${cls}">[${esc(l.source)}]</span> ${esc(l.msg)}</div>`;
        }).join('')
      : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">no logs</div>';

    const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
    const rowsHTML = vids.length ? vids.map(vid => {
      const v = s.villages[vid] || {};
      const age = v.lastSeen ? (n - v.lastSeen) : Infinity;
      const hasBL = v.hasBuildingList;
      const blIcon = hasBL === true ? '📋' : hasBL === false ? '📭' : '❓';
      const blLabel = hasBL === true ? 'present' : hasBL === false ? 'empty' : 'unknown';
      const bq = v.buildQueue || [];
      const bqStr = bq.length ? bq.map(q => `${q.name} L${q.level} (${fmtDuration(q.remaining)})`).join(' · ') : '';
      const fcStr = v.res && v.res.freeCrop !== undefined
        ? ` · 🌾(${v.res.freeCrop >= 0 ? '+' : ''}${v.res.freeCrop})`
        : '';

      const switchInfo = v.lastSwitch;
      const switchLine = switchInfo && (n - switchInfo.at) < CFG.LAST_SWITCH_DISPLAY_MS
        ? `<div style="margin-top:1px;font-size:8px;opacity:.75;">
            ${switchInfo.type === 'nova' ? '🔄' : '👤'}
            ${switchInfo.type === 'nova' ? 'Nova' : 'Manual'}
            from ${esc(vLabel(switchInfo.from))}
            at ${clockOf(switchInfo.at)}
            ${switchInfo.elapsed !== null ? ` (${Math.round(switchInfo.elapsed/1000)}s)` : ''}
          </div>`
        : '';

      return `<div style="font-family:'Courier New',monospace;font-size:9px;padding:3px 4px;border-bottom:1px dashed rgba(58,74,128,.12);">
        <div style="display:flex;gap:6px;align-items:center;">
          <b>${esc(vLabel(vid))}</b>
          <span style="margin-left:auto;font-size:8px;">${v.lastSeen ? fmtAge(age) : 'never'}</span>
        </div>
        <div style="margin-top:2px;opacity:.85;">
          ${blIcon} ${blLabel} · bq: ${bq.length} · res: ${v.res ? `${v.res[1]}/${v.res[2]}/${v.res[3]}/${v.res[4]}` : '—'}${fcStr}
        </div>
        ${bqStr ? `<div style="margin-top:1px;font-size:8px;opacity:.7;">· ${bqStr}</div>` : ''}
        ${switchLine}
      </div>`;
    }).join('') : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">no villages captured</div>';

    const fi = freezeInfo();
    const freezeHTML = (fi && !fi.expired) ? `
      <div style="margin-top:8px;padding:6px 8px;background:rgba(184,128,112,.30);border-radius:4px;border-left:3px solid #8a5040;">
        <div style="font-weight:bold;color:#5a2010;font-size:10px;">❄ FROZEN</div>
        <div style="font-family:'Courier New',monospace;font-size:9px;color:#5a3a10;margin-top:2px;">
          ${esc(fi.reason)} · release in ${Math.round(fi.remain/1000)}s
        </div>
      </div>
    ` : '';

    const overrides = listFreezeOverrides();
    const overrideHTML = overrides.length ? `
      <div style="margin-top:8px;padding:6px 8px;background:rgba(120,200,80,.20);border-radius:4px;border-left:3px solid #4a7a30;">
        <div style="font-weight:bold;color:#1a5a10;font-size:10px;">✅ Freeze Overrides (${overrides.length})</div>
        ${overrides.map(o => `<div style="font-family:'Courier New',monospace;font-size:9px;color:#2a5a20;margin-top:2px;">· <b>${esc(o.id)}</b> — ${esc(o.description || 'no-desc')}</div>`).join('')}
      </div>
    ` : '';

    const waitState = computeWaitState();
    const waitHTML = waitState ? `
      <div style="margin-top:8px;padding:6px 8px;background:rgba(255,180,80,.30);border-radius:4px;border-left:3px solid #a06a30;">
        <div style="font-weight:bold;color:#7a4000;font-size:10px;">⏳ WAITING</div>
        <div style="font-family:'Courier New',monospace;font-size:9px;color:#5a3a10;margin-top:2px;">
          ${esc(waitState)}
        </div>
      </div>
    ` : '';

    const hbOn = s.heartbeat.enabled;
    const autoOn = s.plugins?.Builder?.auto || false;
    const currentJob = s.currentJob;
    const tasksCount = s.tasks.length;
    const debugOn = isDebugEnabled();
    const allowHidden = s.heartbeat.allowHiddenTab === true;

    return `
      <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
        <span class="nova-debug-toggle" data-hb-action="toggle-debug" style="font-size:9px;padding:2px 6px;background:${debugOn ? 'rgba(80,160,220,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;cursor:pointer;" title="Click to ${debugOn ? 'disable' : 'enable'} debug">debug: ${debugOn ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">logs: ${s.logs.length}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">tasks: ${tasksCount}</span>
        <span style="font-size:9px;padding:2px 6px;background:${hbOn ? 'rgba(120,200,80,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">HB: ${hbOn ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:${autoOn ? 'rgba(120,200,80,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">AUTO: ${autoOn ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:${allowHidden ? 'rgba(80,160,220,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">hidden: ${allowHidden ? 'ON' : 'OFF'}</span>
        ${currentJob ? `<span style="font-size:9px;padding:2px 6px;background:rgba(255,180,80,.45);border-radius:8px;font-weight:bold;">▶ ${esc(currentJob.plugin)}</span>` : ''}
        <span style="cursor:pointer;font-size:9px;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;margin-left:auto;" data-hb-action="copy">📋 copy</span>
        <span style="cursor:pointer;font-size:9px;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;" data-hb-action="clear-logs">🗑 clear</span>
        <span style="cursor:pointer;font-size:9px;padding:2px 6px;background:rgba(200,64,48,.30);border-radius:3px;" data-hb-action="reset" title="Clear ALL Nova data">⚠ reset</span>
      </div>

      <div style="max-height:180px;overflow-y:auto;background:rgba(0,0,0,.06);border-radius:3px;padding:4px 6px;">${logHTML}</div>

      ${freezeHTML}
      ${overrideHTML}
      ${waitHTML}

      <div style="margin-top:8px;padding:6px 8px;background:rgba(255,255,255,.5);border-radius:4px;border-left:3px solid #3a4a80;">
        <div style="font-weight:bold;color:#3a4a80;font-size:10px;margin-bottom:2px;">Villages (${vids.length})</div>
        ${rowsHTML}
      </div>
    `;
  }
  function bindHBDebug(root) {
    root.querySelectorAll('[data-hb-action]').forEach(el => {
      el.onclick = () => handleHBAction(el.dataset.hbAction, root);
    });
  }
  function handleHBAction(act, root) {
    const s = readState();

    if (act === 'copy') {
      const logs = s.logs.slice(-60).map(l => l.sid === 'marker' ? l.msg : `${clockOf(l.ts)} [${l.source}] ${l.msg}`);
      const headerLines = ['# Nova HB 2.0.2.21 Logs'];
      headerLines.push(`# ${new Date().toISOString()}`);
      headerLines.push(`session=${SESSION_ID}`);
      headerLines.push(`debug=${isDebugEnabled()}`);
      headerLines.push('');
      const vSnap = Object.keys(s.villages).map(vid => {
        const v = s.villages[vid] || {};
        const fc = v.res?.freeCrop !== undefined ? ` freeCrop=${v.res.freeCrop}` : '';
        const sw = v.lastSwitch ? ` switch=${v.lastSwitch.type}@${clockOf(v.lastSwitch.at)}` : '';
        return `village ${vid}: hasBL=${v.hasBuildingList} bq=${(v.buildQueue||[]).length} res=${v.res ? Object.values(v.res).join('/') : '—'}${fc}${sw}`;
      });
      const overrides = listFreezeOverrides();
      const ovStr = overrides.map(o => `  · ${o.id}: ${o.description}`).join('\n');
      const text = headerLines.join('\n') + vSnap.join('\n') + (ovStr ? '\n\nfreeze-overrides:\n' + ovStr : '') + '\n\n' + logs.join('\n');
      navigator.clipboard.writeText(text).then(() => flash('📋 copied')).catch(() => console.log(text));
    }
    else if (act === 'clear-logs') {
      patch(st => { st.logs = []; });
      flash('logs cleared');
    }
    else if (act === 'reset') {
      if (!confirm('Reset ALL Nova data?\n\nPage will reload.')) return;
      hardReset();
    }
    else if (act === 'toggle-debug') {
      if (isDebugEnabled()) TC.debug.disable();
      else TC.debug.enable();
    }
  }


// ═══════════════════════════════════════════════════════════
// FILE: 11-api.js (56 lines)
// ═══════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════
// FILE: plugins/Heartbeat.js (8 lines)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// plugins/Heartbeat.js
// ═══════════════════════════════════════════════════════════

  registerPlugin('Heartbeat', {
    onArrive: async (ctx) => { captureCurrentVillage(); return { type: 'done', reason: 'captured' }; }
  });

// ═══════════════════════════════════════════════════════════
// FILE: 12-bootstrap.js (134 lines)
// ═══════════════════════════════════════════════════════════

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
