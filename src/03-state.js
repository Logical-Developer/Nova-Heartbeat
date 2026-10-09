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
      if (s.heartbeat._lastLockLog === undefined) s.heartbeat._lastLockLog = null;
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
