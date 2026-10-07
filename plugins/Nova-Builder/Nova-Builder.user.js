// ==UserScript==
// @name         Nova Builder
// @version      2.0.3.15
// @namespace    https://github.com/Logical-Developer/Nova-Heartbeat
// @description  Nova Builder — external plugin for Nova-Heartbeat (construct-to-upgrade via h1 title check)
// @author       Logical-Developer
// @match        https://*.travian.com/*
// @match        https://*.traviantop.com/*
// @match        https://*.international.travian.com/*
// @match        https://*.arabics.travian.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js
// @downloadURL  https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = 'Nova-Builder-2.0.3.15';
  const PLUGIN_ID = 'Builder';
  const DEBUG_KEY = 'nova_debug';

  const CFG = {
    TICK_MS: 1500,
    WAIT_NO_RES_MS: 90 * 1000,
    WAIT_NO_RES_MAX_TRIES: 3,
    WAIT_QUEUE_FULL_MS: 60 * 1000,
    WAIT_QUEUE_FULL_MAX_MS: 4 * 60 * 60 * 1000,
    WAIT_QUEUE_FULL_MARGIN_SEC: 30,
    WAIT_VERIFY_MS: 60 * 1000,
    PRIORITY_UPGRADE: 6,
    PRIORITY_RETURN_HUB: 7,
    TTL_TASK_MS: 60 * 60 * 1000,
    MAX_POSTPONES: 3,
    MAX_WRONG_GID: 3,
    MANUAL_ITEM_TTL_MS: 60 * 60 * 1000,
    MANUAL_ITEM_MAX: 30,
    CONFIRMED_ID_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    POST_CLICK_MIN_MS: 3000,
    POST_CLICK_MAX_MS: 5000,
    INIT_DELAY_MIN_MS: 1000,
    INIT_DELAY_MAX_MS: 2000,
    AUTO_DONE_TIMEOUT_MS: 30 * 1000,
    AUTO_CONFIRM_TIMEOUT_MS: 15 * 1000,
    DISABLED_CLEAR_MS: 6 * 60 * 60 * 1000,
    TAB_CLICK_SETTLE_MS: 800,
    TAB_URL_FORCE_WAIT_MS: 3000,
    VIDEO_PLAYING_WAIT_MS: 30 * 1000,
    VIDEO_MAX_RETRIES: 3,
    ORPHAN_PENDING_SENT_MS: 90 * 1000,
    STUCK_CONFIRMING_MS: 120 * 1000,
    NO_BUTTON_WAIT_MS: 90 * 1000,
    RETURN_HUB_AFTER_IDLE_MS: 5000,
  };

  let TC = null;
  let _registered = false;
  let _lastIdleCheckAt = 0;

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => 'bld_' + now() + '_' + Math.random().toString(36).slice(2,7);
  const normName = s => (s || '').toLowerCase().trim();
  const namesMatch = (a, b) => a === b || a.includes(b) || b.includes(a);
  const clockOf = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); };
  const delay = ms => new Promise(r => setTimeout(r, ms));

  function randomDelay(minMs, maxMs) {
    const ms = Math.round(minMs + Math.random() * (maxMs - minMs));
    return delay(ms);
  }

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
  function fmtDurationSafe(input, unit = 'sec') {
    if (TC && typeof TC.fmtDuration === 'function') return TC.fmtDuration(input, unit);
    return fmtDuration(input, unit);
  }
  const fmtTime  = (sec) => fmtDurationSafe(sec, 'sec');
  const fmtSec   = (sec) => fmtDurationSafe(sec, 'sec');
  const fmtTimer = (ms)  => fmtDurationSafe(ms, 'ms');

  function log(msg) {
    try {
      if (TC && typeof TC.log === 'function') {
        TC.log('Builder', msg);
      } else {
        console.log('[Builder]', msg);
      }
    } catch (e) { console.error('[Builder] log error:', e); }
  }
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

  function readBuildingInfo() {
    const buildDiv = document.querySelector('#build');
    let gidFromClass = null;
    let levelFromClass = null;
    if (buildDiv) {
      const cls = buildDiv.className || '';
      const gidMatch = cls.match(/\bgid(\d+)\b/);
      const lvlMatch = cls.match(/\blevel(\d+)\b/);
      if (gidMatch) gidFromClass = gidMatch[1];
      if (lvlMatch) levelFromClass = parseInt(lvlMatch[1], 10);
    }
    const h1 = $('#build h1.titleInHeader') || $('h1.titleInHeader') || $('#build h1') || $('h1');
    if (!h1) return { name: null, currentLevel: levelFromClass || 0, nextTarget: 0, gid: gidFromClass };
    const clone = h1.cloneNode(true);
    const lvl = clone.querySelector('span.level, span[class*="level" i]');
    if (lvl) lvl.remove();
    let name = clone.textContent
      .replace(/^\d+\.\s*/, '')
      .replace(/\s*Level\s*\d+\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^construct new building$/i.test(name)) name = null;
    let currentLevel = levelFromClass ?? 0;
    if (!currentLevel && lvl) {
      const m = lvl.textContent.match(/(\d+)/);
      if (m) currentLevel = parseInt(m[1], 10) || 0;
    }
    let nextTarget = 0;
    const greenBtn = document.querySelector(
      '.upgradeButtonsContainer button.green.build, ' +
      '.upgradeButtonsContainer button.green, ' +
      '.upgradeButtonsContainer button.green.new'
    );
    if (greenBtn) {
      const txt = (greenBtn.textContent || '') + ' ' + (greenBtn.getAttribute('value') || '');
      const m = txt.match(/level\s+(\d+)/i);
      if (m) nextTarget = parseInt(m[1],10) || 0;
    }
    return { name: name || null, currentLevel, nextTarget: nextTarget || (currentLevel + 1), gid: gidFromClass };
  }
  function readCost(wrapper) {
    const w = wrapper || $('.upgradeBuilding .inlineIconList.resourceWrapper') || $('.inlineIconList.resourceWrapper');
    if (!w) return null;
    const icons = w.querySelectorAll('.inlineIcon.resource');
    if (icons.length < 4) return null;
    const cost = { lumber: 0, clay: 0, iron: 0, crop: 0 };
    const map = { r1:'lumber', r2:'clay', r3:'iron', r4:'crop' };
    let found = 0;
    icons.forEach(ic => {
      const i = ic.querySelector('i'); if (!i) return;
      const m = /\br(\d)/.exec(i.className||''); if (!m) return;
      const key = map['r'+m[1]]; if (!key) return;
      const v = ic.querySelector('.value'); if (!v) return;
      const n = parseInt((v.textContent||'').replace(/[^\d]/g,''), 10);
      if (!isNaN(n)) { cost[key] = n; found++; }
    });
    return found >= 4 ? cost : null;
  }
  function readDuration() {
    const d = $('.upgradeBuilding .inlineIcon.duration .value, .inlineIcon.duration .value');
    if (!d) return 0;
    const t = String(d.textContent).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').trim();
    const m = /(\d+):(\d+):(\d+)/.exec(t);
    return m ? parseInt(m[1])*3600 + parseInt(m[2])*60 + parseInt(m[3]) : 0;
  }
  function findClickableButton(useVideo) {
    if (useVideo) {
      const p = document.querySelector('button.purple.videoFeatureButton, button.purple.build, .upgradeButtonsContainer .section2 button.purple');
      if (p && !p.disabled && !p.classList.contains('disabled')) return p;
    }
    for (const sel of [
      '.upgradeButtonsContainer button.green.build',
      '.upgradeButtonsContainer .section1 button.green',
      'button.green.build',
      '.upgradeButtonsContainer button.green.new',
      'button.green.new',
      'button.green',
    ]) {
      const el = document.querySelector(sel);
      if (el && !el.disabled && !el.classList.contains('disabled')) return el;
    }
    if (!useVideo) {
      const p = document.querySelector('button.purple.videoFeatureButton, button.purple.build');
      if (p && !p.disabled && !p.classList.contains('disabled')) return p;
    }
    return null;
  }

  function findConstructButton(card, useVideo) {
    if (!card) return null;

    if (useVideo) {
      const videoSels = [
        'button.purple.videoFeatureButton',
        '.upgradeButtonsContainer .section2 button.purple.videoFeatureButton',
        '.upgradeButtonsContainer .section2 button.purple',
        'button.purple.new',
        'button.purple',
      ];
      for (const sel of videoSels) {
        const p = card.querySelector(sel);
        if (p && !p.disabled && !p.classList.contains('disabled')) {
          return p;
        }
      }
    }

    const greenSels = [
      'button.green.new',
      'button.green.build',
      '.upgradeButtonsContainer .section1 button.green',
      '.upgradeButtonsContainer button.green',
      'button.green',
    ];
    for (const sel of greenSels) {
      const el = card.querySelector(sel);
      if (el && !el.disabled && !el.classList.contains('disabled')) {
        return el;
      }
    }

    if (!useVideo) {
      const videoSels = [
        'button.purple.videoFeatureButton',
        'button.purple.new',
        'button.purple',
      ];
      for (const sel of videoSels) {
        const p = card.querySelector(sel);
        if (p && !p.disabled && !p.classList.contains('disabled')) {
          return p;
        }
      }
    }

    return null;
  }

  function isCardBuildable(card) {
    if (!card) return false;
    const errCond = card.querySelector('.buildingCondition.error');
    if (errCond) return false;

    const btns = card.querySelectorAll('button');
    for (const b of btns) {
      const cls = b.className || '';
      const val = b.getAttribute('value') || '';
      if (val === 'Travian Plus') continue;
      if (cls.includes('exchange')) continue;
      if (cls.includes('plusAdvertising')) continue;
      return true;
    }
    return false;
  }
  function snapshotBuildQueue() {
    const list = TC.readBuildingList();
    if (list === null) return { present: false, items: [] };
    return {
      present: true,
      items: list.map(b => ({
        name: b.name, level: b.level, remaining: b.remaining, buildingId: b.buildingId || null,
      })),
    };
  }

  function defaultPluginState() {
    return {
      auto: false, useVideo: true, travianPlus: false, allVillages: true,
      queue: [], manualItems: [], confirmedIds: {},
    };
  }
  function getPluginState() {
    const s = TC.state();
    s.plugins = s.plugins || {};
    if (!s.plugins[PLUGIN_ID]) s.plugins[PLUGIN_ID] = defaultPluginState();
    const p = s.plugins[PLUGIN_ID];
    if (typeof p.auto !== 'boolean') p.auto = false;
    if (typeof p.useVideo !== 'boolean') p.useVideo = true;
    if (typeof p.travianPlus !== 'boolean') p.travianPlus = false;
    if (typeof p.allVillages !== 'boolean') p.allVillages = true;
    if (!Array.isArray(p.queue)) p.queue = [];
    if (!Array.isArray(p.manualItems)) p.manualItems = [];
    if (!p.confirmedIds || typeof p.confirmedIds !== 'object') p.confirmedIds = {};
    return p;
  }
  function patchPlugin(fn) {
    TC.patch(s => {
      s.plugins = s.plugins || {};
      if (!s.plugins[PLUGIN_ID]) s.plugins[PLUGIN_ID] = defaultPluginState();
      fn(s.plugins[PLUGIN_ID]);
    });
  }
  function canAfford(cost, res) {
    if (!cost || !res) return true;
    return (res[1]||0) >= (cost.lumber||0) && (res[2]||0) >= (cost.clay||0)
        && (res[3]||0) >= (cost.iron||0) && (res[4]||0) >= (cost.crop||0);
  }

  // Reset an item to PENDING so Heartbeat can re-send it on the next tick.
  function resetItemForRetry(it) {
    it.state = 'PENDING';
    it.stateAt = now();
    it._sentToHeartbeat = false;
    it._wrongGidCount = 0;
    it.pausedResTries = 0;
    it.lastError = null;
    it._skipVideo = false;
    it._videoRetries = 0;
  }

  // Find a build-queue entry matching a building name (fuzzy) and level.
  function findQueueItem(bq, name, level) {
    return (bq || []).find(q =>
      namesMatch(normName(q.name), normName(name)) && Number(q.level) === Number(level)
    );
  }

  // Build-queue entries that are new for `item` (not present in its pre-click snapshot).
  function findNewQueueItems(bq, preIds, item) {
    return (bq || []).filter(q => {
      if (!q.buildingId) return false;
      if (preIds.has(String(q.buildingId))) return false;
      return namesMatch(normName(q.name), normName(item.name)) && Number(q.level) === Number(item.targetLevel);
    });
  }

  function cancelAllTasksForItem(itemId) {
    const s = TC.state();
    const prefixUp = 'bld_' + itemId + '_up';
    const prefixVerify = 'bld_' + itemId + '_v_';
    let cancelled = 0;
    if (s.currentJob && (s.currentJob.id === prefixUp || s.currentJob.id.startsWith(prefixVerify))) {
      TC.cancel(s.currentJob.id);
      cancelled++;
    }
    const toRemove = s.tasks.filter(t => t.id === prefixUp || t.id.startsWith(prefixVerify));
    for (const t of toRemove) {
      TC.cancel(t.id);
      cancelled++;
    }
    return cancelled;
  }

  function addUpgradeItem() {
    try {
      const u = new URL(location.href);
      const gid = u.searchParams.get('gid');
      const slotId = u.searchParams.get('id');
      if (!gid || !slotId) { TC.flash('no gid/slotId'); return; }
      const vid = TC.village();
      if (!vid) { TC.flash('no village'); return; }
      const info = readBuildingInfo();
      if (!info.name) { TC.flash('cannot read building'); return; }
      const cost = readCost();
      const duration = readDuration();
      const kind = ['1','2','3','4'].includes(String(gid)) ? 'field' : 'upgrade';

      let target = info.currentLevel + 1;
      let duplicate = false;
      {
        const p = getPluginState();
        const existing = p.queue.filter(q =>
          String(q.villageId) === String(vid) && String(q.gid) === String(gid) &&
          String(q.slotId) === String(slotId) && q.state !== 'DONE'
        );
        const maxTarget = existing.length ? Math.max(...existing.map(x => x.targetLevel || 0)) : info.currentLevel;
        target = maxTarget + 1;
        if (existing.some(x => x.targetLevel === target)) duplicate = true;
      }
      if (duplicate) { TC.flash('Already queued for L' + target); return; }

      const item = {
        id: uid(), plugin: PLUGIN_ID,
        villageId: String(vid), villageLabel: TC.villageLabel(vid),
        slotId: String(slotId), gid: String(gid),
        name: info.name, kind,
        targetLevel: target, currentLevelAtCreation: info.currentLevel,
        cost: cost || null, estimatedDurationSec: duration || 0,
        addedAt: now(), state: 'PENDING', stateAt: now(),
        buildEndsAt: 0, pausedResTries: 0, _wrongGidCount: 0,
        lastError: null, _sentToHeartbeat: false, _confirmedBuildingId: null,
        _preQueueIds: null,
        _skipVideo: false, _videoRetries: 0,
      };
      patchPlugin(p => { p.queue.push(item); });
      log(`+ ${item.name} L${target} @${TC.villageLabel(vid)} #${slotId} · gid${gid}`);
      TC.flash(`+ ${item.name} → L${target}`);
      refreshPageButtons();
      renderBuilderBox();
      if (getPluginState().auto) maybeSendPendingToHeartbeat();
    } catch (e) {
      console.error('[NovaBld] addUpgradeItem error:', e);
      TC.flash('Error: ' + e.message);
    }
  }

  function addConstructItem(card) {
    try {
      if (!card) return;
      const u = new URL(location.href);
      const slotId = u.searchParams.get('id');
      const category = u.searchParams.get('category') || '1';
      const vid = TC.village();
      if (!vid) { TC.flash('no village'); return; }
      const m = /contract_building(\d+)/.exec(card.id);
      if (!m) return;
      const gid = m[1];
      const h2 = card.querySelector('.build_desc h2');
      const name = h2 ? h2.textContent.trim().replace(/^\d+\.\s*/, '') : 'Building';
      const cost = readCost(card.querySelector('.inlineIconList.resourceWrapper'));
      const duration = readDuration();
      {
        const p = getPluginState();
        if (p.queue.some(q => String(q.villageId) === String(vid) && String(q.gid) === String(gid) && q.kind === 'construct' && q.state !== 'DONE')) {
          TC.flash('Already queued'); return;
        }
      }
      const item = {
        id: uid(), plugin: PLUGIN_ID,
        villageId: String(vid), villageLabel: TC.villageLabel(vid),
        slotId: slotId ? String(slotId) : null, gid: String(gid),
        name, kind: 'construct', targetLevel: 1, currentLevelAtCreation: 0,
        cost: cost || null, estimatedDurationSec: duration || 0,
        addedAt: now(), state: 'PENDING', stateAt: now(),
        buildEndsAt: 0, pausedResTries: 0, _wrongGidCount: 0, lastError: null,
        _constructCategory: String(category), _sentToHeartbeat: false,
        _confirmedBuildingId: null, _preQueueIds: null,
        _skipVideo: false, _videoRetries: 0,
      };
      patchPlugin(p => { p.queue.push(item); });
      log(`+ construct ${name} @${TC.villageLabel(vid)} #${slotId||'?'} · gid${gid} · cat=${category}`);
      TC.flash(`+ ${name}`);
      refreshPageButtons();
      renderBuilderBox();
      if (getPluginState().auto) maybeSendPendingToHeartbeat();
    } catch (e) {
      console.error('[NovaBld] addConstructItem error:', e);
      TC.flash('Error: ' + e.message);
    }
  }

  function maybeSendPendingToHeartbeat() {
    const p = getPluginState();
    if (!p.auto) return;
    const toSend = p.queue.filter(it =>
      (it.state === 'PENDING' || it.state === 'WAITING_SLOT') && !it._sentToHeartbeat
    );
    toSend.sort((a,b) => (a.addedAt || 0) - (b.addedAt || 0));
    for (const item of toSend) sendItemToHeartbeat(item);
  }

  function sendItemToHeartbeat(item) {
    let target;
    if (item.kind === 'construct') {
      if (item.slotId) {
        target = {
          page: 'build',
          village: item.villageId,
          params: {
            id: item.slotId,
            gid: item.gid,
            category: item._constructCategory || '1',
          },
        };
      } else {
        target = { page: 'dorf2', village: item.villageId };
      }
    } else {
      target = { page: 'build', village: item.villageId, params: { id: item.slotId, gid: item.gid } };
    }
    const taskId = 'bld_' + item.id + '_up';
    const sent = TC.enqueue({
      id: taskId, plugin: PLUGIN_ID,
      priority: CFG.PRIORITY_UPGRADE, villageId: item.villageId, target,
      payload: {
        itemId: item.id, name: item.name, slotId: item.slotId, gid: item.gid,
        targetLevel: item.targetLevel, currentLevelAtCreation: item.currentLevelAtCreation,
        kind: item.kind, cost: item.cost, isVerify: false,
        constructCategory: item._constructCategory || '1',
        _skipVideo: item._skipVideo === true,
        _videoRetries: item._videoRetries || 0,
        _preQueueIds: item._preQueueIds || null,
      },
      requiresFlag: 'plugin:Builder:auto', ttlMs: CFG.TTL_TASK_MS,
      createdAt: item.addedAt,
    });
    if (sent === null) {
      patchPlugin(p => {
        const f = p.queue.find(x => x.id === item.id);
        if (f) { f.state = 'PENDING_SENT'; f.stateAt = now(); }
      });
      log(`⊘ ${item.name} already queued in HB — skip`);
      return false;
    }
    patchPlugin(p => {
      const fresh = p.queue.find(x => x.id === item.id);
      if (fresh) { fresh._sentToHeartbeat = true; fresh.state = 'PENDING_SENT'; fresh.stateAt = now(); }
    });
    log(`→ sent ${item.name}`);
    return true;
  }

  function onDecide(ctx) {
    const { job, village } = ctx;
    const payload = job.payload;
    if (!village) return { action: 'wait', delayMs: 5000, reason: 'no-village' };

    const p = getPluginState();
    const item = p.queue.find(x => x.id === payload.itemId);
    const isRunning = item && (
      item.state === 'CONFIRMING' ||
      item.state === 'BUILDING' ||
      item.state === 'VERIFYING'
    );

    const bq = village.buildQueue || [];
    const bqAt = village.buildQueueAt || 0;
    const bqFresh = (now() - bqAt) < 60000;

    const wantName = (payload.name || '').toLowerCase().trim();
    const wantLevel = payload.targetLevel || 0;

    if (bqFresh && bq.length > 0) {
      if (isRunning) {
        const oursExact = bq.find(b =>
          namesMatch(normName(b.name), wantName) && b.level === wantLevel
        );

        if (oursExact) {
          log(`✓ already queued (running): ${oursExact.name} L${oursExact.level} → mark done`);
          markItemDone(payload.itemId, wantLevel);
          return { action: 'done', reason: 'already-queued-at-target' };
        }
      }

      const oursLower = bq.find(b =>
        namesMatch(normName(b.name), wantName) && b.level < wantLevel
      );

      if (oursLower && isRunning) {
        const remaining = oursLower.remaining || 0;
        log(`⏸ our lower level in queue: ${oursLower.name} L${oursLower.level} (${fmtDuration(remaining)})`);
        return { action: 'wait', delayMs: Math.max(60000, remaining * 1000 + 10000), reason: 'our-item-building-lower-level' };
      }

      const maxSlots = getPluginState().travianPlus ? 2 : 1;
      if (bq.length >= maxSlots) {
        const topItem = bq[0];
        const remainingSec = topItem.remaining || 60;
        const delayMs = Math.min(
          CFG.WAIT_QUEUE_FULL_MAX_MS,
          Math.max(CFG.WAIT_QUEUE_FULL_MS, (remainingSec + CFG.WAIT_QUEUE_FULL_MARGIN_SEC) * 1000)
        );
        log(`⏸ queue full with other: ${bq.map(b => b.name + ' L' + b.level).join(', ')} (remaining ${fmtDuration(remainingSec)}) → wait ${fmtDuration(delayMs, 'ms')}`);
        return { action: 'wait', delayMs, reason: 'queue-full-other' };
      }
    }

    const cost = payload.cost;
    const res = village.res;
    if (cost && res && !canAfford(cost, res)) {
      log(`🤔 decide: no resources for ${payload.name}`);
      return { action: 'wait', delayMs: CFG.WAIT_NO_RES_MS, reason: 'no-res-hub' };
    }

    log(`🤔 decide: proceed to build.php for ${payload.name}`);
    return { action: 'build' };
  }

  async function onArrive(ctx) {
    const { job, payload, isVerify } = ctx;
    const p = getPluginState();
    const useVideo = p.useVideo;

    if (isVerify) {
      const info = readBuildingInfo();
      const curLvl = info.currentLevel || 0;
      if (curLvl >= payload.targetLevel) {
        log(`✓ verify ${payload.name} L${curLvl} ≥ L${payload.targetLevel}`);
        markItemDone(payload.itemId, curLvl);
        maybeReturnToHubWhenIdle();
        return { type: 'done', reason: 'verified' };
      }
      const p2 = getPluginState();
      const v = TC.state().villages[String(payload.villageId)];
      const bq = v?.buildQueue || [];
      const inQueue = bq.find(b => {
        const bn = (b.name || '').toLowerCase().trim();
        const pn = (payload.name || '').toLowerCase().trim();
        return bn === pn && Number(b.level) === Number(payload.targetLevel);
      });
      if (inQueue) {
        log(`✓ verify: ${payload.name} L${payload.targetLevel} found in queue`);
        markItemDone(payload.itemId, payload.targetLevel);
        maybeReturnToHubWhenIdle();
        return { type: 'done', reason: 'verify-in-queue' };
      }
      log(`✗ verify: ${payload.name} still L${curLvl}, not in queue`);
      return { type: 'fail', reason: 'verify-level-not-up' };
    }

    if (payload.kind === 'construct') {
      const u = new URL(location.href);
      const curCategory = u.searchParams.get('category');
      const wantCategory = String(payload.constructCategory || '1');

      if (String(curCategory) !== wantCategory) {
        const catMap = { '1': 'infrastructure', '2': 'military', '3': 'resources' };
        const tabClass = catMap[wantCategory];
        if (!tabClass) {
          log(`✗ unknown category ${wantCategory}`);
          return { type: 'fail', reason: 'unknown-category' };
        }
        const tab = document.querySelector(`.contentNavi.subNavi .tabItem.${tabClass}`);
        if (!tab) {
          log(`⏸ tab .${tabClass} not found — wait`);
          return { type: 'wait', delayMs: 2000, reason: 'tab-not-found' };
        }
        log(`🎯 click tab → ${tabClass} (want=${wantCategory}, cur=${curCategory || 'none'})`);
        const clicked = await TC.humanClick(tab);
        if (!clicked.ok) {
          log(`✗ tab click failed: ${clicked.reason}`);
          return { type: 'retry', delayMs: 3000, reason: 'tab-click-failed' };
        }

        await delay(CFG.TAB_CLICK_SETTLE_MS);

        const afterClick = new URL(location.href);
        if (String(afterClick.searchParams.get('category')) === wantCategory) {
          log(`✓ URL updated by Travian → wait for reload`);
          return { type: 'wait', delayMs: 2500, reason: 'url-updated-by-travian' };
        }

        log(`↪ forcing URL with category=${wantCategory}`);

        TC.patch(st => {
          if (st.currentJob?.id === job.id) {
            const saved = { ...st.currentJob };
            saved.state = 'BUILD_EXECUTING';
            saved.stateAt = now();
            saved.readyAt = now() + CFG.TAB_URL_FORCE_WAIT_MS;
            saved._catWant = wantCategory;
            saved.payload = { ...saved.payload, constructCategory: wantCategory };
            delete saved.snapshotBefore;
            delete saved._hubBounceCount;
            delete saved._graceLogged;
            delete saved._domWaitLogged;
            st.tasks.push(saved);
            st.currentJob = null;
          }
        });

        afterClick.searchParams.set('category', wantCategory);
        location.href = afterClick.toString();
        return { type: 'done', reason: 'forcing-category-url' };
      }

      const card = document.querySelector(`#contract_building${payload.gid}`);
      if (!card) {
        const info = readBuildingInfo();
        if (info.name && info.currentLevel > 0) {
          log(`✓ construct ${payload.name}: already built (${info.name} L${info.currentLevel}) → done`);
          markItemDone(payload.itemId, info.currentLevel);
          maybeReturnToHubWhenIdle();
          return { type: 'done', reason: 'already-built-as-construct' };
        }

        const urlGid = u.searchParams.get('gid');
        const urlId = u.searchParams.get('id');
        if (urlGid && String(urlGid) === String(payload.gid) && String(urlId) === String(payload.slotId)) {
          if (info.name && info.currentLevel >= 1) {
            log(`✓ construct ${payload.name}: found on upgrade page at L${info.currentLevel} → done`);
            markItemDone(payload.itemId, info.currentLevel);
            maybeReturnToHubWhenIdle();
            return { type: 'done', reason: 'already-built-on-upgrade-page' };
          }
        }

        const hasNavi = !!document.querySelector('.contentNavi.subNavi');
        const cardsCount = document.querySelectorAll('.buildingWrapper[id^="contract_building"]').length;
        const cardIds = Array.from(document.querySelectorAll('.buildingWrapper[id^="contract_building"]'))
          .map(c => c.id.replace('contract_building', '')).join(', ');
        log(`⏸ card #contract_building${payload.gid} not found (cat=${curCategory}, navi=${hasNavi}, cards=${cardsCount} [${cardIds}]) — wait`);
        return { type: 'wait', delayMs: 2000, reason: 'card-not-found' };
      }

      const shouldSkipVideo = payload._skipVideo === true;
      const effectiveUseVideo = useVideo && !shouldSkipVideo;

      const btn = findConstructButton(card, effectiveUseVideo);
      if (!btn) {
        const allBtns = card.querySelectorAll('button');
        const btnVals = Array.from(allBtns).map(b => b.getAttribute('value') || b.className.split(' ')[0]).join(' | ');
        log(`⏸ construct ${payload.name}: no green/purple button (buttons: ${btnVals}) → wait ${CFG.NO_BUTTON_WAIT_MS/1000}s`);
        markItemNoButton(payload.itemId, 'no-build-button');
        return { type: 'wait', delayMs: CFG.NO_BUTTON_WAIT_MS, reason: 'no-build-button' };
      }
      if (btn.disabled || btn.classList.contains('disabled')) {
        const errCond = card.querySelector('.buildingCondition.error');
        const reason = errCond ? 'construct-prereq-error' : 'construct-btn-disabled';
        log(`⏸ construct ${payload.name}: ${reason}`);
        markItemPausedRes(payload.itemId, reason);
        return { type: 'wait', delayMs: CFG.WAIT_NO_RES_MS, reason };
      }

      const isVideo = btn.classList.contains('purple') || btn.classList.contains('videoFeatureButton');
      const btnClass = btn.className.substring(0, 60);

      const snapBefore = snapshotBuildQueue();
      const preIds = snapBefore.items.map(x => x.buildingId).filter(x => x);
      patchPlugin(pp => {
        const it = pp.queue.find(x => x.id === payload.itemId);
        if (it) { it._preQueueIds = preIds; }
      });

      if (isVideo) {
        log(`▶ construct ${payload.name} → VIDEO click (cat=${wantCategory}, class="${btnClass}", retry=${payload._videoRetries||0})`);
        try {
          btn.click();
          log(`✓ btn.click() called → waiting for video dialog (${CFG.VIDEO_PLAYING_WAIT_MS / 1000}s)`);
          patchPlugin(pp => {
            const it = pp.queue.find(x => x.id === payload.itemId);
            if (it) {
              it.state = 'CONFIRMING'; it.stateAt = now();
              it.lastClickedAt = now(); it.lastError = null;
            }
          });
          renderBuilderBox();
          return { type: 'transition', state: 'BUILD_CONFIRMING_VIDEO_WAIT', extra: { _videoWaitStart: now() } };
        } catch (e) {
          log(`✗ btn.click() failed: ${e.message} — falling back to humanClick`);
        }
      }

      log(`▶ construct ${payload.name} → human-click (cat=${wantCategory}, video=${isVideo}, class="${btnClass}")`);
      const clicked = await TC.humanClick(btn);
      if (!clicked.ok) {
        log(`✗ construct click failed: ${clicked.reason}`);
        return { type: 'retry', delayMs: 5000, reason: clicked.reason };
      }

      log(`✓ construct clicked → waiting ${CFG.POST_CLICK_MIN_MS}-${CFG.POST_CLICK_MAX_MS}ms`);
      await randomDelay(CFG.POST_CLICK_MIN_MS, CFG.POST_CLICK_MAX_MS);

      patchPlugin(pp => {
        const it = pp.queue.find(x => x.id === payload.itemId);
        if (it) {
          it.state = 'CONFIRMING'; it.stateAt = now();
          it.lastClickedAt = now(); it.lastError = null;
        }
      });
      renderBuilderBox();
      log(`✓ construct transition → CONFIRMING`);
      return { type: 'transition', state: 'BUILD_CONFIRMING' };
    }

    const info = readBuildingInfo();
    if (!info.name) {
      log(`⏸ page not ready — wait`);
      return { type: 'wait', delayMs: 3000, reason: 'dom-not-ready' };
    }

    if (info.gid && payload.gid) {
      if (String(info.gid) !== String(payload.gid)) {
        const u = new URL(location.href);
        const curId = u.searchParams.get('id');
        log(`✗ WRONG gid: expected ${payload.gid} (slot=${payload.slotId}), on ${info.gid} (URL id=${curId})`);
        const it = getPluginState().queue.find(x => x.id === payload.itemId);
        const wrongCount = (it?._wrongGidCount || 0) + 1;
        patchPlugin(pp => {
          const item = pp.queue.find(x => x.id === payload.itemId);
          if (item) {
            item._wrongGidCount = wrongCount;
            if (wrongCount >= CFG.MAX_WRONG_GID) {
              item.state = 'DISABLED';
              item.lastError = `wrong-gid-${wrongCount}x (disabled)`;
              log(`🔒 ${payload.name} disabled after ${wrongCount} wrong-gid`);
            } else {
              item._sentToHeartbeat = false;
              item.state = 'PENDING';
              item.stateAt = now();
              item.lastError = `wrong-gid (${wrongCount}/${CFG.MAX_WRONG_GID})`;
            }
          }
        });
        return { type: 'done', reason: 'wrong-gid-reset' };
      }
    } else if (info.name && payload.name) {
      const wantName = payload.name.toLowerCase().trim();
      const pageName = info.name.toLowerCase().trim();
      if (!pageName.includes(wantName.split(' ')[0]) && !wantName.includes(pageName.split(' ')[0])) {
        log(`✗ WRONG building: expected "${payload.name}", on "${info.name}"`);
        patchPlugin(pp => {
          const it = pp.queue.find(x => x.id === payload.itemId);
          if (it) {
            it._sentToHeartbeat = false;
            it.state = 'PENDING';
            it.stateAt = now();
            it.lastError = 'wrong-building';
          }
        });
        return { type: 'done', reason: 'wrong-building-reset' };
      }
    }

    const s = TC.state();
    const v = s.villages[String(payload.villageId)];
    const bq = v?.buildQueue;
    const bqAt = v?.buildQueueAt || 0;
    const bqFresh = (now() - bqAt) < 60000;
    const maxSlots = p.travianPlus ? 2 : 1;
    if (bqFresh && Array.isArray(bq)) {
      const ours = bq.find(b => {
        if (!b.name || !payload.name) return false;
        const bn = b.name.toLowerCase();
        const pn = payload.name.toLowerCase();
        return bn.includes(pn.split(' ')[0]) || pn.includes(bn.split(' ')[0]);
      });
      if (ours) {
        const remaining = ours.remaining || 0;
        log(`⏸ our building in progress (${ours.name} L${ours.level}, ${fmtDuration(remaining)}) — wait`);
        return { type: 'wait', delayMs: Math.max(10000, remaining * 1000 + 5000), reason: 'building-in-progress' };
      }
      if (bq.length >= maxSlots) {
        log(`⏸ queue full (${bq.length}/${maxSlots}) — wait`);
        return { type: 'wait', delayMs: CFG.WAIT_QUEUE_FULL_MS, reason: 'queue-full' };
      }
    }

    if (info.currentLevel >= payload.targetLevel) {
      log(`✓ already L${info.currentLevel} ≥ L${payload.targetLevel}`);
      markItemDone(payload.itemId, info.currentLevel);
      maybeReturnToHubWhenIdle();
      return { type: 'done', reason: 'already-at-level' };
    }

    const shouldSkipVideo2 = payload._skipVideo === true;
    const effectiveUseVideo2 = useVideo && !shouldSkipVideo2;

    const btn = findClickableButton(effectiveUseVideo2);
    if (!btn) {
      const miss = getMissingReason(payload);
      log(`⏸ no button — ${miss.reason}`);
      markItemPausedRes(payload.itemId, miss.reason);
      const it = getPluginState().queue.find(x => x.id === payload.itemId);
      if (it && it.state === 'PAUSED_RES') {
        return { type: 'wait', delayMs: CFG.WAIT_NO_RES_MS, reason: miss.reason };
      }
      return { type: 'done', reason: 'paused-long-no-button' };
    }

    const isVideo2 = btn.classList.contains('purple') || btn.classList.contains('videoFeatureButton');
    const snapshotBefore = snapshotBuildQueue();
    const preIds = snapshotBefore.items.map(x => x.buildingId).filter(x => x);
    patchPlugin(pp => {
      const it = pp.queue.find(x => x.id === payload.itemId);
      if (it) { it._preQueueIds = preIds; }
    });
    log(`📸 snapshot: present=${snapshotBefore.present}, ${snapshotBefore.items.length} item(s), preIds=[${preIds.join(',')}]`);
    log(`▶ click ${payload.name} L${info.currentLevel}→L${payload.targetLevel} (video=${isVideo2})`);

    if (isVideo2) {
      try {
        btn.click();
        log(`✓ btn.click() called → VIDEO dialog`);
        patchPlugin(pp => {
          const it = pp.queue.find(x => x.id === payload.itemId);
          if (it) {
            it.state = 'CONFIRMING'; it.stateAt = now();
            it.lastClickedAt = now(); it.lastError = null;
          }
        });
        renderBuilderBox();
        return { type: 'transition', state: 'BUILD_CONFIRMING_VIDEO_WAIT', extra: { _videoWaitStart: now() } };
      } catch (e) {
        log(`✗ btn.click() failed: ${e.message}`);
      }
    }

    const clicked = await TC.humanClick(btn);
    if (!clicked.ok) {
      log(`✗ click failed: ${clicked.reason}`);
      return { type: 'retry', delayMs: 5000, reason: clicked.reason };
    }

    log(`✓ clicked → waiting ${CFG.POST_CLICK_MIN_MS}-${CFG.POST_CLICK_MAX_MS}ms for reload`);
    await randomDelay(CFG.POST_CLICK_MIN_MS, CFG.POST_CLICK_MAX_MS);

    patchPlugin(pp => {
      const it = pp.queue.find(x => x.id === payload.itemId);
      if (it) {
        it.state = 'CONFIRMING'; it.stateAt = now();
        it.lastClickedAt = now(); it.lastError = null;
      }
    });
    renderBuilderBox();
    log(`✓ transition → CONFIRMING`);
    return { type: 'transition', state: 'BUILD_CONFIRMING', extra: { snapshotBefore } };
  }

  function onConfirmResult(ctx) {
    const { job, status, item, manualItems } = ctx;
    if (!job || !job.payload) return;
    const itemId = job.payload.itemId;
    const vid = job.target.village;
    log(`📩 confirm result: ${status}`);

    if (status === 'confirmed') {
      patchPlugin(p => {
        const it = p.queue.find(x => x.id === itemId);
        if (it) {
          it.state = 'BUILDING';
          it.stateAt = now();
          it.buildEndsAt = now() + (item.remaining || 0) * 1000 + 5000;
          it._confirmedBuildingId = item.buildingId || null;
          it._wrongGidCount = 0;
          it.lastError = null;
          it._skipVideo = false;
          it._videoRetries = 0;
        }
        if (item.buildingId) {
          p.confirmedIds = p.confirmedIds || {};
          p.confirmedIds[String(item.buildingId)] = {
            villageId: String(vid), name: item.name, level: item.level, at: now(),
          };
        }
      });
      if (manualItems && manualItems.length) addManualItems(vid, manualItems);
    }
    else if (status === 'manual') {
      if (manualItems && manualItems.length) addManualItems(vid, manualItems);
    }
    else if (status === 'no-match') {
      log(`⚠ no-match: queue didn't change after click`);
    }
    renderBuilderBox();
  }

  function addManualItems(villageId, items) {
    if (!items || !items.length) return;
    patchPlugin(p => {
      p.manualItems = p.manualItems || [];
      for (const m of items) {
        const exists = p.manualItems.some(x =>
          String(x.villageId) === String(villageId) &&
          String(x.name) === String(m.name) &&
          Number(x.level) === Number(m.level)
        );
        if (!exists) {
          p.manualItems.push({
            villageId: String(villageId), name: m.name, level: m.level,
            remaining: m.remaining, buildingId: m.buildingId || null, detectedAt: now(),
          });
        }
      }
      if (p.manualItems.length > 20) p.manualItems = p.manualItems.slice(-20);
    });
    log(`👤 +${items.length} manual item(s) @${TC.villageLabel(villageId)}`);
  }

  // ═════ 2.0.3.15: sync — بهبود isOwned با بررسی slotId ═════
  function syncManualItemsFromQueue() {
    const s = TC.state();
    const p = getPluginState();
    const now_ = now();

    const detected = [];
    for (const vid in s.villages) {
      const v = s.villages[vid];
      if (!Array.isArray(v.buildQueue)) continue;
      for (const q of v.buildQueue) {
        if (!q.name) continue;
        detected.push({
          villageId: String(vid),
          name: q.name,
          level: q.level,
          remaining: q.remaining,
          buildingId: q.buildingId || null,
        });
      }
    }
    if (!detected.length) return;

    const ownedIds = new Set();
    const ownedSigs = new Set();
    for (const it of p.queue) {
      if (it.state === 'DONE') continue;
      if (it._confirmedBuildingId) ownedIds.add(String(it._confirmedBuildingId));
      const sig = `${it.villageId}|${(it.name || '').toLowerCase().trim()}|${it.targetLevel}`;
      ownedSigs.add(sig);
    }

    const isOwned = (q) => {
      if (q.buildingId && ownedIds.has(String(q.buildingId))) return true;
      const sig = `${q.villageId}|${(q.name || '').toLowerCase().trim()}|${q.level}`;
      if (ownedSigs.has(sig)) return true;
      const sigLower = `${q.villageId}|${(q.name || '').toLowerCase().trim()}`;
      for (const os of ownedSigs) {
        if (!os.startsWith(sigLower + '|')) continue;
        const osLvl = parseInt(os.split('|')[2], 10);
        if (!isNaN(osLvl) && osLvl >= q.level) return true;
      }
      return false;
    };

    let added = 0, updated = 0;
    patchPlugin(pp => {
      pp.manualItems = pp.manualItems || [];
      for (const q of detected) {
        if (isOwned(q)) continue;

        const existingIdx = pp.manualItems.findIndex(m =>
          String(m.villageId) === q.villageId &&
          String(m.name) === q.name &&
          Number(m.level) === q.level &&
          String(m.buildingId || '') === String(q.buildingId || '')
        );
        if (existingIdx >= 0) {
          const ex = pp.manualItems[existingIdx];
          if (ex.remaining !== q.remaining) {
            ex.remaining = q.remaining;
            updated++;
          }
          ex._lastSyncAt = now_;
        } else {
          pp.manualItems.push({
            villageId: q.villageId, name: q.name, level: q.level,
            remaining: q.remaining, buildingId: q.buildingId,
            detectedAt: now_, _lastSyncAt: now_,
          });
          added++;
          log(`👤 manual detected: ${q.name} L${q.level} @${TC.villageLabel(q.villageId)}${q.buildingId ? ` id:${q.buildingId}` : ''}`);
        }
      }
      const seen = new Set();
      pp.manualItems = pp.manualItems.filter(m => {
        const key = `${m.villageId}|${m.name}|${m.level}|${m.buildingId || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (pp.manualItems.length > CFG.MANUAL_ITEM_MAX) {
        pp.manualItems = pp.manualItems.slice(-CFG.MANUAL_ITEM_MAX);
      }
    });
    if (added || updated) {
      if (added) log(`👤 +${added} manual detected (updated ${updated})`);
    }
  }

  function pruneManualItems() {
    const s = TC.state();
    const now_ = now();
    patchPlugin(p => {
      if (!p.manualItems || !p.manualItems.length) return;
      const before = p.manualItems.length;
      p.manualItems = p.manualItems.filter(m => {
        if ((now_ - m.detectedAt) > CFG.MANUAL_ITEM_TTL_MS) return false;
        const v = s.villages[String(m.villageId)];
        if (!v || !Array.isArray(v.buildQueue)) return true;
        const bqAt = v.buildQueueAt || 0;
        const isFresh = (now_ - bqAt) < 300000;
        if (!isFresh) return true;
        const found = v.buildQueue.some(q => {
          if (m.buildingId && q.buildingId && String(q.buildingId) === String(m.buildingId)) return true;
          return namesMatch(normName(q.name), normName(m.name)) && Number(q.level) === Number(m.level);
        });
        if (!found) {
          log(`👤 manual removed (done): ${m.name} L${m.level} @${TC.villageLabel(m.villageId)}`);
          return false;
        }
        return true;
      });
      if (p.manualItems.length !== before) {
        log(`👤 manual cleanup: ${before} → ${p.manualItems.length}`);
      }
    });
  }

  function pruneConfirmedIds() {
    const s = TC.state();
    const now_ = now();
    patchPlugin(p => {
      if (!p.confirmedIds || !Object.keys(p.confirmedIds).length) return;
      const alive = new Set();
      for (const vid in s.villages) {
        const v = s.villages[vid];
        if (!Array.isArray(v.buildQueue)) continue;
        for (const q of v.buildQueue) {
          if (q.buildingId) alive.add(String(q.buildingId));
        }
      }
      for (const bid of Object.keys(p.confirmedIds)) {
        const c = p.confirmedIds[bid];
        if (!c) { delete p.confirmedIds[bid]; continue; }
        const age = now_ - (c.at || 0);
        if (age > CFG.CONFIRMED_ID_TTL_MS) { delete p.confirmedIds[bid]; continue; }
        if (!alive.has(String(bid))) delete p.confirmedIds[bid];
      }
    });
  }

  function removeManualItem(buildingId) {
    patchPlugin(p => {
      p.manualItems = (p.manualItems || []).filter(m =>
        String(m.buildingId || '') !== String(buildingId || '')
      );
    });
    renderBuilderBox();
  }

  function getMissingReason(payload) {
    const s = TC.state();
    const v = s.villages[String(payload.villageId)];
    const res = v?.res;
    if (res && payload.cost) {
      const missing = [];
      if ((res[1]||0) < (payload.cost.lumber||0)) missing.push('wood');
      if ((res[2]||0) < (payload.cost.clay||0)) missing.push('clay');
      if ((res[3]||0) < (payload.cost.iron||0)) missing.push('iron');
      if ((res[4]||0) < (payload.cost.crop||0)) missing.push('crop');
      if (missing.length) return { reason: 'no-res:' + missing.join('+'), missing };
    }
    return { reason: 'prereq-or-disabled' };
  }

  function markItemDone(itemId, level) {
    patchPlugin(p => {
      const it = p.queue.find(x => x.id === itemId);
      if (it) { it.state = 'DONE'; it.stateAt = now(); it.finalLevel = level; }
    });
    setTimeout(() => {
      patchPlugin(p => { p.queue = p.queue.filter(x => x.id !== itemId); });
      renderBuilderBox();
      maybeReturnToHubWhenIdle();
    }, 3000);
    renderBuilderBox();
  }

  function markItemPausedRes(itemId, reason) {
    patchPlugin(p => {
      const it = p.queue.find(x => x.id === itemId);
      if (!it) return;
      it.pausedResTries = (it.pausedResTries || 0) + 1;
      it.lastError = reason;
      it.stateAt = now();
      it._sentToHeartbeat = true;
      if (it.pausedResTries >= CFG.MAX_POSTPONES) {
        it.state = 'DISABLED';
        it.lastError = reason + ' (disabled after ' + CFG.MAX_POSTPONES + ' tries)';
      } else {
        it.state = 'PAUSED_RES';
      }
    });
    renderBuilderBox();
  }

  function markItemNoButton(itemId, reason) {
    patchPlugin(p => {
      const it = p.queue.find(x => x.id === itemId);
      if (!it) return;
      it.lastError = reason;
      it.stateAt = now();
      it._sentToHeartbeat = true;
      it.state = 'PAUSED_RES';
    });
    renderBuilderBox();
  }

  function onFail(ctx) {
    const job = ctx.job;
    const reason = ctx.reason || '';
    if (!job || !job.payload) return;
    const isTtl = reason === 'ttl-expired';
    const isRes = reason.includes('no-res');
    const isBusy = reason.includes('queue-full') || reason.includes('busy') || reason.includes('manual') || reason.includes('lower-level');
    const isNotFound = reason.includes('no-tile') || reason.includes('not-in-village');
    const isVideoFail = reason.includes('video-timeout') || reason.includes('video-failed');

    patchPlugin(p => {
      const it = p.queue.find(x => x.id === job.payload.itemId);
      if (!it) return;
      it.stateAt = now();
      it._sentToHeartbeat = false;
      it.lastError = reason;

      if (isNotFound) {
        it.state = 'DISABLED';
        it.lastError = reason + ' (building not found in village)';
        log(`🔒 ${it.name} disabled — ${reason}`);
      } else if (isVideoFail) {
        it.pausedResTries = (it.pausedResTries || 0) + 1;
        if (it.pausedResTries >= CFG.MAX_POSTPONES) {
          it.state = 'DISABLED';
          it.lastError = reason + ' (disabled)';
        } else {
          it.state = 'PENDING';
          it._skipVideo = true;
        }
      } else if (isTtl || isRes || isBusy) {
        it.pausedResTries = (it.pausedResTries || 0) + 1;
        if (it.pausedResTries >= CFG.MAX_POSTPONES) {
          it.state = 'DISABLED';
          it.lastError = reason + ' (disabled)';
        } else {
          it.state = 'PENDING';
        }
      } else {
        it.state = 'FAILED';
      }
    });
    log(`✗ task failed: ${reason} → ${job.payload.name}`);
    renderBuilderBox();
  }

  function onComplete(ctx) {}

  function maybeReturnToHubWhenIdle() {
    try {
      const s = TC.state();
      const p = getPluginState();
      if (!p.auto) return;
      if (p.queue.length > 0) return;
      const hasBuilderTask = (s.tasks || []).some(t => t.plugin === PLUGIN_ID);
      if (hasBuilderTask) return;
      if (s.currentJob && s.currentJob.plugin === PLUGIN_ID) return;

      const now_ = now();
      if (now_ - _lastIdleCheckAt < 3000) return;
      _lastIdleCheckAt = now_;

      const curVid = TC.village();
      if (!curVid) return;

      log(`🏠 queue empty → Autoplay OFF + return to dorf1 @${TC.villageLabel(curVid)}`);
      patchPlugin(pp => { pp.auto = false; });

      TC.enqueue({
        plugin: 'Heartbeat',
        priority: CFG.PRIORITY_RETURN_HUB,
        villageId: String(curVid),
        target: { page: 'dorf1', village: String(curVid) },
        payload: { rotation: false, returnHome: true },
        requiresFlag: 'heartbeat',
        ttlMs: 5 * 60 * 1000,
        createdAt: now(),
      });
    } catch (e) {
      console.error('[NovaBld] maybeReturnToHubWhenIdle error:', e);
    }
  }

  function onTick() {
    const p = getPluginState();
    const s = TC.state();
    const now_ = now();

    if (p.auto) {
      patchPlugin(pp => { recoverStuckItems(s, pp, now_); });
    }

    patchPlugin(pp => {
      for (const it of pp.queue) {
        if (it.state === 'DONE') continue;

        const v = s.villages[String(it.villageId)];
        const bq = Array.isArray(v?.buildQueue) ? v.buildQueue : null;
        const bqAt = v?.buildQueueAt || 0;
        const bqFresh = (now_ - bqAt) < 120000;

        if (it.state === 'BUILDING' && bqFresh && bq !== null) {
          const found = findQueueItem(bq, it.name, it.targetLevel);
          if (!found && (now_ - it.stateAt) > CFG.AUTO_DONE_TIMEOUT_MS) {
            log(`✓ auto-done: ${it.name} L${it.targetLevel} (no longer in queue)`);
            it.state = 'DONE';
            it.stateAt = now_;
            it.finalLevel = it.targetLevel;
          }
        }

        if (it.state === 'CONFIRMING' && bqFresh && bq !== null) {
          const preIds = new Set(it._preQueueIds || []);
          const newItems = findNewQueueItems(bq, preIds, it);
          const foundByNameOnly = findQueueItem(bq, it.name, it.targetLevel);

          const confirmedItem = newItems[0] || (preIds.size === 0 ? foundByNameOnly : null);
          if (confirmedItem && (now_ - it.stateAt) > CFG.AUTO_CONFIRM_TIMEOUT_MS) {
            log(`✓ auto-confirm: ${it.name} L${it.targetLevel} → BUILDING (id=${confirmedItem.buildingId || '?'})`);
            it.state = 'BUILDING';
            it.stateAt = now_;
            it.buildEndsAt = now_ + (confirmedItem.remaining || 0) * 1000 + 5000;
            it._confirmedBuildingId = confirmedItem.buildingId || null;
            it._skipVideo = false;
            it._videoRetries = 0;
            if (confirmedItem.buildingId) {
              pp.confirmedIds = pp.confirmedIds || {};
              pp.confirmedIds[String(confirmedItem.buildingId)] = {
                villageId: String(it.villageId),
                name: it.name,
                level: it.targetLevel,
                at: now_,
              };
            }
          }
        }

        if (it.state === 'DISABLED' && (now_ - it.stateAt) > CFG.DISABLED_CLEAR_MS) {
          log(`✗ auto-clear DISABLED (${it.name}): > 6h`);
          it.state = 'FAILED';
          it.stateAt = now_;
          it.lastError = 'auto-cleared-disabled';
        }
      }
    });

    if (p.auto) {
      const toRetry = p.queue.filter(it =>
        it.state === 'PAUSED_RES' && (now_ - it.stateAt) > CFG.WAIT_NO_RES_MS
      );
      for (const it of toRetry) {
        patchPlugin(pp => {
          const fresh = pp.queue.find(x => x.id === it.id);
          if (fresh) { fresh._sentToHeartbeat = false; fresh.state = 'PENDING'; }
        });
      }
      maybeSendPendingToHeartbeat();
    }

    patchPlugin(pp => {
      const before = pp.queue.length;
      pp.queue = pp.queue.filter(it => {
        if (it.state === 'DONE' && (now_ - it.stateAt) > 3000) return false;
        return true;
      });
      if (pp.queue.length !== before) {
        log(`cleaned ${before - pp.queue.length} DONE item(s)`);
      }
    });

    syncManualItemsFromQueue();
    pruneManualItems();
    pruneConfirmedIds();
    refreshPageButtons();
    renderBuilderBox();

    maybeReturnToHubWhenIdle();
  }

  function recoverStuckItems(s, p, now_) {
    const hb = s;
    const activeJobItemId = hb.currentJob?.payload?.itemId || null;
    const queuedItemIds = new Set(
      (hb.tasks || [])
        .filter(t => t.plugin === PLUGIN_ID && t.payload?.itemId)
        .map(t => t.payload.itemId)
    );

    for (const it of p.queue) {
      if (it.state === 'DONE') continue;

      if (it.state === 'PENDING_SENT') {
        const age = now_ - (it.stateAt || it.addedAt || now_);
        if (age > CFG.ORPHAN_PENDING_SENT_MS) {
          const inHB = (activeJobItemId === it.id) || queuedItemIds.has(it.id);
          if (!inHB) {
            it.pausedResTries = (it.pausedResTries || 0) + 1;
            if (it.pausedResTries >= CFG.MAX_POSTPONES) {
              it.state = 'DISABLED';
              it.lastError = 'orphan-pending-sent (disabled)';
              log(`🔒 ${it.name} disabled — orphan PENDING_SENT ×${it.pausedResTries}`);
            } else {
              it.state = 'PENDING';
              it._sentToHeartbeat = false;
              it.stateAt = now_;
              it.lastError = 'orphan-pending-sent → retry';
              log(`↻ ${it.name} orphan PENDING_SENT → PENDING (try ${it.pausedResTries}/${CFG.MAX_POSTPONES})`);
            }
          }
        }
      }

      if (it.state === 'CONFIRMING') {
        const age = now_ - (it.stateAt || it.lastClickedAt || now_);
        if (age > CFG.STUCK_CONFIRMING_MS) {
          const inHB = (activeJobItemId === it.id) || queuedItemIds.has(it.id);
          if (!inHB) {
            const v = s.villages[String(it.villageId)];
            const bq = Array.isArray(v?.buildQueue) ? v.buildQueue : null;
            const bqAt = v?.buildQueueAt || 0;
            const bqFresh = (now_ - bqAt) < 120000;
            const preIds = new Set(it._preQueueIds || []);
            const newItems = (bqFresh && bq) ? findNewQueueItems(bq, preIds, it) : [];
            const inQueue = newItems.length > 0;

            if (inQueue) {
              it.state = 'BUILDING';
              it.stateAt = now_;
              it._confirmedBuildingId = newItems[0].buildingId || null;
              log(`✓ ${it.name} CONFIRMING → BUILDING (found in queue after stuck)`);
            } else {
              it.pausedResTries = (it.pausedResTries || 0) + 1;
              if (it.pausedResTries >= CFG.MAX_POSTPONES) {
                it.state = 'DISABLED';
                it.lastError = 'stuck-confirming (disabled)';
                log(`🔒 ${it.name} disabled — stuck CONFIRMING ×${it.pausedResTries}`);
              } else {
                it.state = 'PENDING';
                it._sentToHeartbeat = false;
                it.stateAt = now_;
                it.lastError = 'stuck-confirming → retry';
                log(`↻ ${it.name} stuck CONFIRMING → PENDING (try ${it.pausedResTries}/${CFG.MAX_POSTPONES})`);
              }
            }
          }
        }
      }
    }
  }

  function refreshPageButtons() {
    if (!/build\.php/.test(location.pathname)) return;
    try {
      const u = new URL(location.href);
      const gid = u.searchParams.get('gid');
      const slotId = u.searchParams.get('id');
      const cards = $$('.buildingWrapper[id^="contract_building"]');
      if (cards.length) {
        for (const card of cards) {
          if (card._novaBldBound) { updateConstructBtn(card); continue; }
          card._novaBldBound = true;
          const h2 = card.querySelector('.build_desc h2');
          if (!h2) continue;
          const m = /contract_building(\d+)/.exec(card.id);
          if (!m) continue;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'nova-bld-qbtn';
          btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); addConstructItem(card); };
          h2.parentNode.insertBefore(btn, h2);
          updateConstructBtn(card);
        }
        return;
      }
      if (!gid || !slotId) return;
      const contentContainer = $('.contentContainer');
      const content = $('#content');
      const target = contentContainer || content?.parentNode;
      if (!target) return;
      let btn = document.querySelector('.nova-bld-queue-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nova-bld-queue-btn';
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); addUpgradeItem(); };
        if (content && target.contains(content)) target.insertBefore(btn, content);
        else target.appendChild(btn);
      }
      updateUpgradeBtn(btn, gid, slotId);
    } catch (e) {
      console.error('[NovaBld] refreshPageButtons error:', e);
    }
  }

  function updateUpgradeBtn(btn, gid, slotId) {
    const vid = TC.village();
    const info = readBuildingInfo();
    const p = getPluginState();
    const existing = p.queue.filter(x =>
      String(x.villageId) === String(vid) && String(x.gid) === String(gid) &&
      String(x.slotId) === String(slotId) && x.state !== 'DONE'
    );
    if (!existing.length) {
      btn.textContent = `+ Queue → L${info.nextTarget || (info.currentLevel + 1)}`;
      btn.classList.remove('queued');
    } else {
      const maxTarget = Math.max(...existing.map(x => x.targetLevel || 0));
      btn.textContent = `✓ queued → L${maxTarget}  ·  click = L${maxTarget + 1}`;
      btn.classList.add('queued');
    }
  }

  function updateConstructBtn(card) {
    const m = /contract_building(\d+)/.exec(card.id);
    if (!m) return;
    const gid = m[1];
    const vid = TC.village();
    const btn = card.querySelector('.nova-bld-qbtn');
    if (!btn) return;
    const p = getPluginState();
    const existing = p.queue.filter(x => String(x.villageId) === String(vid) && String(x.gid) === String(gid) && x.kind === 'construct' && x.state !== 'DONE');
    const buildable = isCardBuildable(card);
    if (existing.length) { btn.textContent = '✓ Queued'; btn.classList.add('queued'); btn.classList.remove('disabled'); btn.disabled = false; }
    else if (!buildable) { btn.textContent = '+ Queue (locked)'; btn.classList.add('disabled'); btn.disabled = true; }
    else { btn.textContent = '+ Queue'; btn.classList.remove('queued', 'disabled'); btn.disabled = false; }
  }

  function boxHTML() {
    return `
      <div class="header">
        <div class="buttonsWrapper">
          <a class="layoutButton buttonFramed withIcon round edit gold nova-bld-heal" href="#" title="Reset paused/failed/disabled items + sync HB tasks">
            <svg viewBox="0 0 24 24" style="max-width: 22px;max-height: 26px;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></svg>
          </a>
        </div>
      </div>
      <div class="content">
        <div class="boxTitle" style="margin-top: 10px;">
          <span class="nova-bld-title">🔨 Queue Builder 2.0.3.15</span>
          <span class="nova-bld-village" style="font-size:10px;color:#6a4a20;">—</span>
        </div>
        <ul class="nova-bld-list"></ul>
        <div class="nova-bld-state">—</div>
        <div class="nova-bld-tgl-row"><span class="lbl">▶ Autoplay</span><span class="tg nova-bld-tgl" data-key="auto"><span>OFF</span></span></div>
        <div class="nova-bld-tgl-row"><span class="lbl">🎬 Watch video</span><span class="tg nova-bld-tgl" data-key="useVideo"><span>ON</span></span></div>
        <div class="nova-bld-tgl-row"><span class="lbl">➕ Travian Plus</span><span class="tg nova-bld-tgl" data-key="travianPlus"><span>OFF</span></span></div>
        <div class="nova-bld-tgl-row"><span class="lbl">🏘 All Villages</span><span class="tg nova-bld-tgl" data-key="allVillages"><span>ON</span></span></div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('nova-bld-style')) return;
    const s = document.createElement('style');
    s.id = 'nova-bld-style';
    s.textContent = `
      #novaBldBox .nova-bld-title { font-size: 14px; padding-right: 8px; }
      #novaBldBox .nova-bld-village { font-size: 10px; color: #6a4a20; font-weight: normal; margin-left: 4px; }
      #novaBldBox .nova-bld-list { list-style: none; padding: 6px 8px; margin: 0; max-height: 45vh; overflow-y: auto; }
      #novaBldBox .nova-bld-vsep { padding: 5px 8px; margin: 6px 0 3px; background: rgba(122,92,48,.18); border-top: 1px dashed rgba(122,92,48,.45); border-radius: 3px; }
      #novaBldBox .nova-bld-vsep:first-child { margin-top: 0; }
      #novaBldBox .nova-bld-vrow-1 { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: bold; color: #3a2a10; }
      #novaBldBox .nova-bld-vrow-1 .dot { font-size: 12px; }
      #novaBldBox .nova-bld-vrow-1 .name { font-size: 12px; }
      #novaBldBox .nova-bld-vrow-1 .slots { margin-left: auto; font-family: 'Courier New', monospace; font-size: 10px; opacity: .85; color: #5a3a10; }
      #novaBldBox .nova-bld-vrow-2 { font-family: 'Courier New', monospace; font-size: 10px; margin-top: 3px; color: #5a3a10; white-space: nowrap; }
      #novaBldBox .nova-bld-item { padding: 6px 8px; border-bottom: 1px dashed #c9b185; background: rgba(255,252,245,.55); border-radius: 4px; margin-bottom: 3px; position: relative; }
      #novaBldBox .nova-bld-item:last-child { border-bottom: none; }
      #novaBldBox .nova-bld-item.first { background: rgba(190,240,170,.35); border: 1px solid rgba(120,200,80,.35); }
      #novaBldBox .nova-bld-item.running { border-left: 4px solid #d08000; background: rgba(255,220,120,.35); animation: novaBldPulse 1.6s ease-in-out infinite; }
      #novaBldBox .nova-bld-item.paused { border-left: 4px solid #8a8a8a; background: rgba(230,230,230,.55); }
      #novaBldBox .nova-bld-item.disabled { border-left: 4px solid #5a5a5a; background: rgba(180,180,180,.65); opacity: .65; }
      #novaBldBox .nova-bld-item.failed { border-left: 4px solid #c0392b; background: rgba(255,200,200,.55); }
      #novaBldBox .nova-bld-item.manual { border-left: 4px solid #2a5ab0; background: rgba(200,220,255,.45); }
      #novaBldBox .nova-bld-item.unknown { border-left: 4px solid #a06a30; background: rgba(255,235,200,.45); }
      @keyframes novaBldPulse { 0%,100% { background: rgba(255,220,120,.30); } 50% { background: rgba(255,220,120,.50); } }
      #novaBldBox .nova-bld-line1 { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
      #novaBldBox .nova-bld-name { font-weight: bold; color: #4a2a08; font-size: 12px; }
      #novaBldBox .nova-bld-slot { font-size: 9px; color: #7a5a30; background: rgba(180,150,100,.22); padding: 0 4px; border-radius: 3px; font-family: 'Courier New', monospace; font-weight: normal; flex-shrink: 0; }
      #novaBldBox .nova-bld-del { margin-left: auto; cursor: pointer; color: #a02020; font-weight: bold; font-size: 15px; line-height: 1; user-select: none; }
      #novaBldBox .nova-bld-refresh { cursor: pointer; color: #2a7a2a; font-weight: bold; font-size: 13px; line-height: 1; user-select: none; }
      #novaBldBox .nova-bld-line2 { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 10px; }
      #novaBldBox .nova-bld-vbadge { display: inline-block; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 3px; background: rgba(80,130,200,.28); color: #2a4a70; }
      #novaBldBox .nova-bld-vbadge.cur { background: rgba(120,200,80,.35); color: #1a5a10; }
      #novaBldBox .nova-bld-lvl { color: #1a6a10; font-weight: bold; background: rgba(120,200,80,.28); padding: 1px 6px; border-radius: 3px; font-size: 10px; display: inline-block; }
      #novaBldBox .nova-bld-lvl.blinking { background: #d08000; color: #fff; font-weight: 900; animation: novaBldLvlBlink 0.9s steps(1) infinite; }
      @keyframes novaBldLvlBlink { 0% { background: #d08000; color: #fff; } 50% { background: #ffe680; color: #5a2a00; } 100% { background: #d08000; color: #fff; } }
      #novaBldBox .nova-bld-time { font-size: 10px; color: #8a4a00; background: rgba(255,220,120,.60); padding: 0 5px; border-radius: 3px; font-weight: bold; font-family: 'Courier New', monospace; }
      #novaBldBox .nova-bld-time.building { color: #fff; background: #d08000; }
      #novaBldBox .nova-bld-time.paused { color: #fff; background: #8a8a8a; }
      #novaBldBox .nova-bld-time.disabled { color: #fff; background: #5a5a5a; }
      #novaBldBox .nova-bld-time.failed { color: #fff; background: #c0392b; }
      #novaBldBox .nova-bld-time.sent { color: #fff; background: #4a8228; }
      #novaBldBox .nova-bld-time.wronggid { color: #fff; background: #a06a30; }
      #novaBldBox .nova-bld-time.video { color: #fff; background: #7a3a9c; }
      #novaBldBox .nova-bld-manual-tag { font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 3px; background: linear-gradient(180deg, #4a7ab0, #2a5a90); color: #fff; text-transform: uppercase; letter-spacing: .5px; }
      #novaBldBox .nova-bld-unknown-tag { font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 3px; background: linear-gradient(180deg, #a06a30, #7a4a20); color: #fff; text-transform: uppercase; letter-spacing: .5px; }
      #novaBldBox .nova-bld-line3 { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; padding-top: 2px; border-top: 1px dashed rgba(122,92,48,.20); font-size: 10px; }
      #novaBldBox .nova-bld-res { padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,.45); color: #4a3a20; font-weight: bold; font-family: 'Courier New', monospace; }
      #novaBldBox .nova-bld-res.need { background: rgba(240,150,60,.55); color: #7a2800; }
      #novaBldBox .nova-bld-state { padding: 5px 10px; font-size: 10px; text-align: center; font-weight: bold; color: #2a4a10; background: rgba(255,255,255,.4); border-top: 1px solid #c9b185; line-height: 1.5; }
      #novaBldBox .nova-bld-state.paused { color: #7a4a00; background: linear-gradient(180deg, #f0e0c0 0%, #dcc8a0 100%); font-style: italic; }
      #novaBldBox .nova-bld-state.run { color: #8a4a00; background: linear-gradient(180deg, #ffe9a8 0%, #f0c860 100%); }
      #novaBldBox .nova-bld-state.off { color: #8a7050; background: rgba(200,200,200,.25); }
      #novaBldBox .nova-bld-state .state-row { display: block; text-align: left; font-family: 'Courier New', monospace; font-size: 10px; margin-top: 1px; }
      #novaBldBox .nova-bld-state .state-row.head { text-align: center; font-weight: bold; margin-bottom: 2px; }
      #novaBldBox .nova-bld-state .state-row.rot { color: #4a3a70; opacity: .85; font-weight: normal; }
      #novaBldBox .nova-bld-tgl-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; background: rgba(255,255,255,.2); border-top: 1px solid rgba(122,92,48,.25); font-size: 11px; color: #5a3a10; }
      #novaBldBox .nova-bld-tgl-row .lbl { font-weight: bold; }
      #novaBldBox .nova-bld-tgl { display: inline-flex; align-items: center; justify-content: center; padding: 3px 10px; min-width: 48px; font-size: 10px; font-weight: bold; cursor: pointer; user-select: none; background: linear-gradient(180deg, #e0d4b8 0%, #c8b898 100%); color: #6a5a40; border: 1px solid #b09878; border-radius: 3px; }
      #novaBldBox .nova-bld-tgl.on-green { background: linear-gradient(180deg, #7bc554 0%, #4a8c28 100%); color: #fff; border-color: #3a6a18; }
      #novaBldBox .nova-bld-tgl.on-orange { background: linear-gradient(180deg, #ffae44 0%, #cc7722 100%); color: #fff; border-color: #994400; }
      #novaBldBox .nova-bld-tgl.on-purple { background: linear-gradient(180deg, #b380d9 0%, #7a3a9c 100%); color: #fff; border-color: #5a2a70; }
      #novaBldBox .nova-bld-tgl.on-blue { background: linear-gradient(180deg, #5a9fd4 0%, #2a6a9c 100%); color: #fff; border-color: #1a4a7c; }
      #novaBldBox .nova-bld-tgl.off-grey { background: linear-gradient(180deg, #b0b0b0 0%, #808080 100%); color: #fff; border-color: #606060; }
      #novaBldBox .nova-bld-empty { color: #8a7050; font-style: italic; text-align: center; padding: 8px; font-size: 10px; }
      #novaBldBox .nova-bld-pending { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #d02020; box-shadow: 0 0 4px rgba(208,32,32,.6); animation: novaBldPendPulse 1.2s ease-in-out infinite; flex-shrink: 0; }
      #novaBldBox .nova-bld-pending.paused { background: #8a8a8a; box-shadow: 0 0 4px rgba(138,138,138,.5); animation: none; }
      #novaBldBox .nova-bld-pending.failed { background: #c0392b; box-shadow: 0 0 4px rgba(192,57,43,.6); animation: none; }
      #novaBldBox .nova-bld-pending.disabled { background: #5a5a5a; box-shadow: none; animation: none; }
      @keyframes novaBldPendPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(0.8); } }
      #novaBldBox .nova-bld-tries { display: inline-block; font-size: 9px; font-weight: bold; color: #a02020; background: rgba(208,32,32,.18); padding: 0 4px; border-radius: 3px; font-family: 'Courier New', monospace; flex-shrink: 0; }
      .nova-bld-queue-btn { display: inline-block; margin: 6px 0 6px 8px; padding: 6px 14px; cursor: pointer; background: linear-gradient(180deg, #6ba844 0%, #4a8228 100%); color: #fff; border: 1px solid #3a6a18; border-radius: 4px; font-size: 12px; font-weight: bold; text-shadow: 0 1px 1px rgba(0,0,0,.35); }
      .nova-bld-queue-btn.queued { background: linear-gradient(180deg, #d09030 0%, #a06020 100%); border-color: #804010; }
      .nova-bld-qbtn { display: inline-block; margin: 4px 0 6px 6px; padding: 4px 12px; cursor: pointer; background: linear-gradient(180deg, #6ba844 0%, #4a8228 100%); color: #fff; border: 1px solid #3a6a18; border-radius: 4px; font-size: 11px; font-weight: bold; }
      .nova-bld-qbtn.queued { background: linear-gradient(180deg, #d09030 0%, #a06020 100%); border-color: #804010; }
      .nova-bld-qbtn.disabled { background: linear-gradient(180deg, #b0b0b0 0%, #808080 100%); border-color: #606060; cursor: not-allowed; opacity: .75; }
    `;
    document.head.appendChild(s);
  }

  function ensureBox() {
    let box = document.getElementById('novaBldBox');
    if (box) return box;
    const parent = document.getElementById('sidebarBeforeContent')?.querySelector('.sidebarBoxWrapper');
    if (!parent) return null;
    box = document.createElement('div');
    box.className = 'sidebarBox expanded';
    box.id = 'novaBldBox';
    box.innerHTML = boxHTML();
    const hb = document.getElementById('novaHBBox');
    if (hb && hb.parentNode === parent) parent.insertBefore(box, hb.nextSibling);
    else { const alliance = parent.querySelector('#sidebarBoxAlliance'); if (alliance) parent.insertBefore(box, alliance); else parent.appendChild(box); }
    box.querySelector('.nova-bld-heal').onclick = e => { e.preventDefault(); healQueue(); };
    box.querySelectorAll('.nova-bld-tgl').forEach(tg => {
      tg.onclick = () => {
        const key = tg.dataset.key;
        const p = getPluginState();
        const next = !p[key];
        patchPlugin(pp => { pp[key] = next; });
        if (key === 'auto' && next) {
          log('Autoplay ON — resending pending items');
          patchPlugin(pp => {
            pp.queue.forEach(it => {
              if (it.state === 'PENDING' || it.state === 'WAITING_SLOT' || it.state === 'PAUSED_RES' || it.state === 'FAILED' || it.state === 'DISABLED') {
                it._sentToHeartbeat = false;
                it._wrongGidCount = 0;
                it.pausedResTries = 0;
                it.state = 'PENDING';
              }
            });
          });
          maybeSendPendingToHeartbeat();
        }
        if (key === 'auto' && !next) log('Autoplay OFF — Heartbeat will skip Builder tasks');
        updateToggleStyles();
      };
    });
    return box;
  }

  function updateToggleStyles() {
    const box = document.getElementById('novaBldBox');
    if (!box) return;
    const p = getPluginState();
    box.querySelectorAll('.nova-bld-tgl').forEach(tg => {
      const key = tg.dataset.key;
      const on = !!p[key];
      tg.classList.remove('on-green', 'on-orange', 'on-purple', 'on-blue', 'off-grey');
      if (key === 'auto') tg.classList.add(on ? 'on-green' : 'off-grey');
      else if (key === 'useVideo') tg.classList.add(on ? 'on-purple' : 'off-grey');
      else if (key === 'travianPlus') tg.classList.add(on ? 'on-orange' : 'off-grey');
      else if (key === 'allVillages') tg.classList.add(on ? 'on-blue' : 'off-grey');
      const label = tg.querySelector('span');
      if (label) label.textContent = on ? 'ON' : 'OFF';
    });
  }

  function healQueue() {
    const s = TC.state();
    const p = getPluginState();

    const hbTasks = s.tasks.filter(t => t.plugin === 'Builder');
    const hbCurrentJob = (s.currentJob && s.currentJob.plugin === 'Builder') ? s.currentJob : null;

    const bldItems = p.queue;
    const bldItemIds = new Set(bldItems.map(i => i.id));

    let cancelledHB = 0;
    for (const t of hbTasks) {
      const itemId = t.payload?.itemId;
      if (!itemId || !bldItemIds.has(itemId)) {
        log(`🗑 orphan HB task: ${t.id} (no Builder item)`);
      } else {
        log(`🗑 cancel HB task for reset: ${t.id} (${t.payload?.name || '?'})`);
      }
      TC.cancel(t.id);
      cancelledHB++;
    }
    if (hbCurrentJob) {
      const itemId = hbCurrentJob.payload?.itemId;
      if (!itemId || !bldItemIds.has(itemId)) {
        log(`🗑 orphan HB currentJob: ${hbCurrentJob.id}`);
      } else {
        log(`🗑 cancel HB currentJob for reset: ${hbCurrentJob.id}`);
      }
      TC.cancel(hbCurrentJob.id);
      cancelledHB++;
    }

    let resetCount = 0;
    let resyncedCount = 0;
    const toReenqueue = [];

    patchPlugin(pp => {
      for (const it of pp.queue) {
        if (it.state === 'DONE') continue;
        if (it.state === 'CONFIRMING' || it.state === 'BUILDING') continue;

        if (['PAUSED_RES', 'FAILED', 'DISABLED', 'PENDING_SENT', 'PENDING'].includes(it.state)) {
          const wasReset = it.state !== 'PENDING';
          resetItemForRetry(it);
          if (wasReset) resetCount++;
          else resyncedCount++;
          toReenqueue.push(it.id);
        }
      }
    });

    let enqueuedCount = 0;
    if (p.auto) {
      for (const itemId of toReenqueue) {
        const it = getPluginState().queue.find(x => x.id === itemId);
        if (it && it.state === 'PENDING' && !it._sentToHeartbeat) {
          const sent = sendItemToHeartbeat(it);
          if (sent === true) enqueuedCount++;
        }
      }
    }

    TC.flash(`🔄 reset:${resetCount} resync:${resyncedCount} cancel:${cancelledHB} enqueue:${enqueuedCount}`);
    log(`🔄 Heal complete:`);
    log(`  - reset: ${resetCount} items`);
    log(`  - resynced: ${resyncedCount} items`);
    log(`  - cancelled: ${cancelledHB} HB tasks`);
    log(`  - enqueued: ${enqueuedCount} tasks`);

    renderBuilderBox();
  }

  function detectItemIcon(buildItem, villageId) {
    const p = getPluginState();
    const itemName = normName(buildItem.name);
    const itemLevel = buildItem.level;
    const itemBuildingId = buildItem.buildingId;

    if (itemBuildingId && p.confirmedIds && p.confirmedIds[String(itemBuildingId)]) {
      return '🔨';
    }

    const novaItem = p.queue.find(x => {
      if (String(x.villageId) !== String(villageId)) return false;
      const xn = normName(x.name);
      if (!xn || !itemName) return false;
      if (!namesMatch(xn, itemName)) return false;
      const levelMatch = Number(x.targetLevel) >= Number(itemLevel);
      if (!levelMatch) return false;
      const validState = x.state === 'BUILDING'
                      || x.state === 'CONFIRMING'
                      || x.state === 'PENDING_SENT';
      return validState;
    });
    if (novaItem) return '🔨';

    const manualItem = (p.manualItems || []).find(x => {
      if (String(x.villageId) !== String(villageId)) return false;
      if (itemBuildingId && x.buildingId && String(x.buildingId) === String(itemBuildingId)) return true;
      const xn = normName(x.name);
      const levelMatch = Number(x.level) === Number(itemLevel);
      return namesMatch(xn, itemName) && levelMatch;
    });
    if (manualItem) return '👤';

    return '❓';
  }

  function renderPendingIndicator(it, isRunning) {
    const confirmed = (it.state === 'CONFIRMING' || it.state === 'BUILDING' || it.state === 'DONE') || isRunning;
    if (confirmed) return { dot: '', tries: '' };
    const tries = (it.pausedResTries || 0) + (it._wrongGidCount || 0);
    const cls = it.state === 'DISABLED' ? 'nova-bld-pending disabled' :
                it.state === 'FAILED'   ? 'nova-bld-pending failed' :
                it.state === 'PAUSED_RES' ? 'nova-bld-pending paused' :
                'nova-bld-pending';
    const tip = it.lastError
      ? esc(it.lastError)
      : (it.state === 'PENDING_SENT' ? 'sent to HB — not clicked yet'
         : it.state === 'PENDING' ? 'pending — waiting for HB'
         : 'not yet confirmed');
    const triesHtml = tries > 0 ? `<span class="nova-bld-tries" title="total tries">×${tries}</span>` : '';
    return { dot: `<span class="${cls}" title="${tip}"></span>`, tries: triesHtml };
  }

  function renderBuilderBox() {
    try {
      const box = document.getElementById('novaBldBox');
      if (!box) return;
      const s = TC.state();
      const p = getPluginState();
      const curVid = TC.village();
      const vLabelEl = box.querySelector('.nova-bld-village');
      if (vLabelEl) vLabelEl.textContent = curVid ? `(${TC.villageLabel(curVid)})` : '—';

      const runningItemIds = new Set();
      for (const vid in s.villages) {
        const v = s.villages[vid];
        const bq = v?.buildQueue;
        const bqAt = v?.buildQueueAt || 0;
        const bqFresh = (now() - bqAt) < 120000;
        if (!bqFresh || !Array.isArray(bq)) continue;
        for (const q of bq) {
          if (!q.name) continue;
          const qn = q.name.toLowerCase();
          for (const it of p.queue) {
            if (String(it.villageId) !== String(vid)) continue;
            if (it.state === 'DONE') continue;
            if (!it.name) continue;
            const iname = it.name.toLowerCase();
            if (qn === iname && q.level === it.targetLevel) { runningItemIds.add(it.id); continue; }
            if (it._confirmedBuildingId && q.buildingId && String(it._confirmedBuildingId) === String(q.buildingId)) runningItemIds.add(it.id);
          }
        }
      }

      const byVid = {};
      for (const it of p.queue) { const v = String(it.villageId); (byVid[v] = byVid[v] || []).push(it); }
      const manualByVid = {};
      for (const m of (p.manualItems || [])) { const v = String(m.villageId); (manualByVid[v] = manualByVid[v] || []).push(m); }

      const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
      const allVids = Array.from(new Set([...vids, ...Object.keys(byVid), ...Object.keys(manualByVid)]));
      const showAll = p.allVillages !== false;
      const visibleVids = showAll
        ? allVids
        : allVids.filter(vid => {
            const hasTasks = (byVid[vid] || []).length > 0;
            const hasManual = (manualByVid[vid] || []).length > 0;
            const v = s.villages[vid];
            const hasBq = v && (v.buildQueue || []).length > 0;
            const isCurrent = String(vid) === String(curVid);
            return hasTasks || hasManual || hasBq || isCurrent;
          });

      const parts = [];

      if (!visibleVids.length) parts.push('<li class="nova-bld-empty">no villages to show</li>');
      else {
        for (const vid of visibleVids) {
          const v = s.villages[vid] || {};
          const res = v.res || {};
          // ═════ 2.0.3.15: Nova items sort by addedAt ═════
          const items = (byVid[vid] || []).sort((a,b) => {
            const dt = (a.addedAt || 0) - (b.addedAt || 0);
            if (dt !== 0) return dt;
            return String(a.id).localeCompare(String(b.id));
          });
          // ═════ 2.0.3.15: manual items sort by detectedAt (اول = قدیمی‌تر) ═════
          const manualItems = (manualByVid[vid] || []).sort((a,b) => {
            const dt = (a.detectedAt || 0) - (b.detectedAt || 0);
            if (dt !== 0) return dt;
            return String(a.name).localeCompare(String(b.name));
          });
          const isCur = String(vid) === String(curVid);
          const dot = !v.lastSeen ? '⚪'
                   : (now() - v.lastSeen) < 60000 ? '🟢'
                   : (now() - v.lastSeen) < 5*60*1000 ? '🟡'
                   : '🔴';
          const maxSlots = p.travianPlus ? 2 : 1;
          const queueLen = (v.buildQueue || []).length;
          const resStr = [
            `🌲${res[1] ?? '?'}`,
            `🧱${res[2] ?? '?'}`,
            `⚙${res[3] ?? '?'}`,
            (res.freeCrop !== undefined)
              ? `🌾${res[4] ?? '?'} (${res.freeCrop >= 0 ? '+' : ''}${res.freeCrop})`
              : `🌾${res[4] ?? '?'}`,
          ].join('  ');

          parts.push(`<li class="nova-bld-vsep">
            <div class="nova-bld-vrow-1">
              <span class="dot">${dot}</span>
              <span class="name">${esc(TC.villageLabel(vid))}</span>
              <span class="slots">🚶 ${queueLen}/${maxSlots}</span>
            </div>
            <div class="nova-bld-vrow-2">${resStr}</div>
          </li>`);

          // ═══════════════════════════════════════════════════════════
          //  2.0.3.15: ترتیب جدید نمایش:
          //  1) Manual items (اول — چون در صف Travian فعال هستند)
          //  2) Nova items (بعد — در انتظار)
          // ═══════════════════════════════════════════════════════════

          // ─── 1. Manual items ───
          for (const m of manualItems) {
            const timer = m.remaining ? fmtTime(m.remaining) : '—';
            const slotTag = m.buildingId ? `id:${m.buildingId}` : '';
            parts.push(`<li class="nova-bld-item manual">
              <div class="nova-bld-line1">
                <span class="nova-bld-name">👤 Manual: ${esc(m.name)}</span>
                ${slotTag ? `<span class="nova-bld-slot">${esc(slotTag)}</span>` : ''}
                <span class="nova-bld-del" data-del-manual="${esc(m.buildingId || m.name + '|' + m.level)}" title="Hide">×</span>
              </div>
              <div class="nova-bld-line2">
                <span class="nova-bld-vbadge${isCur ? ' cur' : ''}">${esc(TC.villageLabel(vid))}</span>
                <span class="nova-bld-lvl">[L${m.level}]</span>
                <span class="nova-bld-time building">🔨 ${timer}</span>
                <span class="nova-bld-manual-tag">Manual</span>
              </div>
            </li>`);
          }

          // ─── 2. Nova items ───
          const firstId = items[0]?.id;
          for (const it of items) {
            const cls = ['nova-bld-item'];
            if (it.id === firstId && manualItems.length === 0) cls.push('first');
            const isRunning = runningItemIds.has(it.id);
            const isConfirming = it.state === 'CONFIRMING' || it.state === 'BUILDING';
            if (isRunning || isConfirming) cls.push('running');
            if (it.state === 'PAUSED_RES') cls.push('paused');
            if (it.state === 'DISABLED') cls.push('disabled');
            if (it.state === 'FAILED') cls.push('failed');
            const res2 = v.res || {};
            const perRes = it.cost ? {
              lumber: (res2[1]||0) >= (it.cost.lumber||0),
              clay: (res2[2]||0) >= (it.cost.clay||0),
              iron: (res2[3]||0) >= (it.cost.iron||0),
              crop: (res2[4]||0) >= (it.cost.crop||0),
            } : null;
            const stateBadge = renderStateBadge(it, isRunning);
            const pend = renderPendingIndicator(it, isRunning);
            const currentLvl = it.currentLevelAtCreation ?? 0;
            const lvlText = `L${currentLvl}→L${it.targetLevel}`;
            const lvlCls = (isRunning || isConfirming) ? 'nova-bld-lvl blinking' : 'nova-bld-lvl';
            const refreshBtn = (it.state === 'PAUSED_RES' || it.state === 'FAILED')
              ? `<span class="nova-bld-refresh" data-heal="${esc(it.id)}" title="Retry now">🔄</span>`
              : (it.state === 'DISABLED'
                ? `<span class="nova-bld-refresh" data-heal="${esc(it.id)}" title="Click to heal (reset counter)">🔒</span>`
                : '');
            const slotTag = it.slotId ? `#${it.slotId}` : '';
            const gidTag = it.gid ? `gid${it.gid}` : '';
            const slotText = slotTag && gidTag ? `${slotTag} · ${gidTag}` : (slotTag || gidTag);
            parts.push(`<li class="${cls.join(' ')}">
              <div class="nova-bld-line1">
                ${pend.dot}
                <span class="nova-bld-name">🔨 ${esc(it.name)}</span>
                ${slotText ? `<span class="nova-bld-slot">${esc(slotText)}</span>` : ''}
                ${pend.tries}
                ${refreshBtn}
                <span class="nova-bld-del" data-del="${esc(it.id)}" title="Remove">×</span>
              </div>
              <div class="nova-bld-line2">
                <span class="nova-bld-vbadge${isCur ? ' cur' : ''}">${esc(TC.villageLabel(vid))}</span>
                <span class="${lvlCls}" title="${esc(lvlText)}">[${esc(lvlText)}]</span>
                ${stateBadge}
              </div>
              ${it.cost ? `<div class="nova-bld-line3">
                <span class="nova-bld-res${perRes.lumber ? '' : ' need'}">🌲${it.cost.lumber || 0}</span>
                <span class="nova-bld-res${perRes.clay ? '' : ' need'}">🧱${it.cost.clay || 0}</span>
                <span class="nova-bld-res${perRes.iron ? '' : ' need'}">⚙${it.cost.iron || 0}</span>
                <span class="nova-bld-res${perRes.crop ? '' : ' need'}">🌾${it.cost.crop || 0}</span>
              </div>` : ''}
            </li>`);
          }

          // ─── 3. Unknown items ───
          const bqForVid = (v.buildQueue || []);
          for (const q of bqForVid) {
            const qIcon = detectItemIcon(q, vid);
            if (qIcon !== '❓') continue;
            const timer = q.remaining ? fmtTime(q.remaining) : '—';
            parts.push(`<li class="nova-bld-item unknown">
              <div class="nova-bld-line1">
                <span class="nova-bld-name">❓ ${esc(q.name)}</span>
                <span class="nova-bld-del" data-del-unknown="${esc(q.buildingId || '')}" title="Unknown">×</span>
              </div>
              <div class="nova-bld-line2">
                <span class="nova-bld-vbadge${isCur ? ' cur' : ''}">${esc(TC.villageLabel(vid))}</span>
                <span class="nova-bld-lvl">[L${q.level}]</span>
                <span class="nova-bld-time building">🔨 ${timer}</span>
                <span class="nova-bld-unknown-tag">Unknown</span>
              </div>
            </li>`);
          }
        }
      }

      box.querySelector('.nova-bld-list').innerHTML = parts.join('');

      box.querySelectorAll('[data-del]').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.del;
          const cancelledCount = cancelAllTasksForItem(id);
          patchPlugin(pp => { pp.queue = pp.queue.filter(x => x.id !== id); });
          TC.flash(`removed (${cancelledCount} HB tasks)`);
          log(`✗ removed ${id.slice(-6)} + ${cancelledCount} HB tasks`);
          renderBuilderBox();
        };
      });
      box.querySelectorAll('[data-del-manual]').forEach(el => {
        el.onclick = () => removeManualItem(el.dataset.delManual);
      });
      box.querySelectorAll('[data-del-unknown]').forEach(el => {
        el.onclick = () => TC.flash('cannot hide — unknown item');
      });
      box.querySelectorAll('[data-heal]').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.heal;
          patchPlugin(pp => {
            const it = pp.queue.find(x => x.id === id);
            if (it) resetItemForRetry(it);
          });
          TC.flash('retry');
          if (getPluginState().auto) maybeSendPendingToHeartbeat();
          renderBuilderBox();
        };
      });

      updateToggleStyles();

      const stateEl = box.querySelector('.nova-bld-state');
      const hbOn = s.heartbeat?.enabled === true;
      const autoOn = p.auto;

      const buildingLines = [];
      let hasAnyBuilding = false;
      for (const vid of vids) {
        const v = s.villages[vid];
        const bq = v.buildQueue || [];
        if (bq.length === 0) {
          buildingLines.push(`🏘 ${esc(TC.villageLabel(vid))}: idle`);
          continue;
        }
        hasAnyBuilding = true;
        const parts2 = [];
        for (const q of bq) {
          const icon = detectItemIcon(q, vid);
          const timer = q.remaining ? fmtTime(q.remaining) : '0s';
          parts2.push(`${icon} ${esc(q.name)} [${timer}]`);
        }
        buildingLines.push(`🏘 ${esc(TC.villageLabel(vid))}: ${parts2.join(' · ')}`);
      }

      let rotLine = null;
      if (hbOn && s.heartbeat?.nextRotationAt) {
        const inMs = Math.max(0, s.heartbeat.nextRotationAt - now());
        const curVidLocal = TC.village();
        const allVids2 = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
        const others = allVids2.filter(v => String(v) !== String(curVidLocal));
        let nextVid = null;
        if (others.length) {
          others.sort((a,b) => (s.villages[a].lastSeen || 0) - (s.villages[b].lastSeen || 0));
          nextVid = others[0];
        }
        rotLine = nextVid
          ? `⏱ next rotation → ${TC.villageLabel(nextVid)} in ${fmtTimer(inMs)}`
          : `⏱ next rotation in ${fmtTimer(inMs)}`;
      }

      if (!hbOn) {
        stateEl.className = 'nova-bld-state off';
        if (hasAnyBuilding) {
          stateEl.innerHTML = `<span class="state-row head">⏸ Heartbeat OFF — navigation paused</span>` +
            buildingLines.map(l => `<span class="state-row">${l}</span>`).join('');
        } else {
          stateEl.textContent = `⏸ Heartbeat OFF — navigation paused · 🏘 ${vids.length} villages idle`;
        }
      }
      else if (!autoOn) {
        stateEl.className = 'nova-bld-state paused';
        if (hasAnyBuilding) {
          stateEl.innerHTML = `<span class="state-row head">⏸ Autoplay OFF</span>` +
            buildingLines.map(l => `<span class="state-row">${l}</span>`).join('') +
            (rotLine ? `<span class="state-row rot">${rotLine}</span>` : '');
        } else {
          stateEl.textContent = `⏸ Autoplay OFF · 🏘 ${vids.length} villages idle`;
        }
      }
      else {
        const active = p.queue.find(x => x.state === 'CONFIRMING' || x.state === 'BUILDING' || runningItemIds.has(x.id));
        const disabledCount = p.queue.filter(x => x.state === 'DISABLED').length;
        if (active) {
          stateEl.className = 'nova-bld-state run';
          let head = `🎯 ${esc(TC.villageLabel(active.villageId))} · ${esc(active.name)} L${active.currentLevelAtCreation}→L${active.targetLevel} · ${active.state}`;
          if (hasAnyBuilding) {
            stateEl.innerHTML = `<span class="state-row head">${head}</span>` +
              buildingLines.map(l => `<span class="state-row">${l}</span>`).join('') +
              (rotLine ? `<span class="state-row rot">${rotLine}</span>` : '');
          } else {
            stateEl.textContent = head;
          }
        }
        else if (disabledCount > 0) {
          stateEl.className = 'nova-bld-state paused';
          stateEl.textContent = `🔒 ${disabledCount} disabled — click 🔒 or heal`;
        }
        else if (hasAnyBuilding) {
          stateEl.className = 'nova-bld-state run';
          stateEl.innerHTML = `<span class="state-row head">🟢 ready · ${p.queue.length} item(s)</span>` +
            buildingLines.map(l => `<span class="state-row">${l}</span>`).join('') +
            (rotLine ? `<span class="state-row rot">${rotLine}</span>` : '');
        }
        else {
          stateEl.className = 'nova-bld-state';
          if (rotLine) {
            stateEl.innerHTML = `<span class="state-row">🟢 ready · ${p.queue.length} item(s) · 🏘 ${vids.length} villages idle</span>` +
              `<span class="state-row rot">${rotLine}</span>`;
          } else {
            stateEl.textContent = `🟢 ready · ${p.queue.length} item(s) · 🏘 ${vids.length} villages idle`;
          }
        }
      }
    } catch (e) {
      console.error('[NovaBld] renderBuilderBox error:', e);
    }
  }

  function renderStateBadge(it, isRunning) {
    const n = now();
    if (it.state === 'CONFIRMING') return `<span class="nova-bld-time building">⏳ confirming…</span>`;
    if (isRunning || it.state === 'BUILDING') {
      const s = TC.state();
      const v = s.villages[String(it.villageId)];
      const bq = v?.buildQueue || [];
      let remaining = 0;
      for (const q of bq) {
        if (!q.name || !it.name) continue;
        const qn = q.name.toLowerCase();
        const iname = it.name.toLowerCase();
        if (qn === iname && q.level === it.targetLevel) { remaining = q.remaining || 0; break; }
      }
      if (!remaining && it.buildEndsAt) remaining = Math.max(0, Math.ceil((it.buildEndsAt - n) / 1000));
      if (remaining > 0) return `<span class="nova-bld-time building">🔨 ${fmtTime(remaining)}</span>`;
      return `<span class="nova-bld-time building">🔨 building…</span>`;
    }
    if (it._wrongGidCount > 0 && it.state !== 'DISABLED' && it.state !== 'FAILED') {
      return `<span class="nova-bld-time wronggid">⚠ wrong-gid (${it._wrongGidCount}/${CFG.MAX_WRONG_GID})</span>`;
    }
    if (it._skipVideo && it.state !== 'DISABLED') {
      return `<span class="nova-bld-time video">🎬 skip-video</span>`;
    }
    if (it.state === 'PAUSED_RES') return `<span class="nova-bld-time paused">⏸ no-res (${it.pausedResTries || 0}/${CFG.MAX_POSTPONES})</span>`;
    if (it.state === 'DISABLED') {
      if (it._wrongGidCount >= CFG.MAX_WRONG_GID) {
        return `<span class="nova-bld-time disabled">🔒 wrong-gid (${it._wrongGidCount}/${CFG.MAX_WRONG_GID})</span>`;
      }
      return `<span class="nova-bld-time disabled">🔒 disabled</span>`;
    }
    if (it.state === 'FAILED') return `<span class="nova-bld-time failed">✗ failed</span>`;
    if (it.state === 'PENDING_SENT') return `<span class="nova-bld-time sent">→ sent</span>`;
    if (it.state === 'DONE') return `<span class="nova-bld-time sent">✓ done</span>`;
    if (it.estimatedDurationSec) return `<span class="nova-bld-time">⏱~${fmtTime(it.estimatedDurationSec)}</span>`;
    return `<span class="nova-bld-time">pending</span>`;
  }

  function tickLoop() {
    try { if (!TC) return; ensureBox(); onTick(); }
    catch (e) { console.error('[NovaBld] tick error:', e); }
    setTimeout(tickLoop, CFG.TICK_MS);
  }

  function waitForHeartbeat(ms) {
    return new Promise(r => {
      const start = now();
      const iv = setInterval(() => {
        if (window.TC && window.TC.registerPlugin) {
          clearInterval(iv); r(window.TC);
        } else if (now() - start > ms) {
          clearInterval(iv); r(null);
        }
      }, 50);
    });
  }

  function renderBuilderDebug() {
    const s = TC.state();
    const b = getPluginState();
    const n = now();
    const LOG_DISPLAY = 15;

    const logs = s.logs
      .filter(l => l.source === 'Builder' || l.sid === 'marker')
      .slice(-LOG_DISPLAY)
      .reverse();

    const logHTML = logs.length
      ? logs.map(l => {
          if (l.sid === 'marker') return `<div style="background:rgba(58,74,128,.15);font-weight:bold;text-align:center;margin:3px 0;padding:2px 0;">${esc(l.msg)}</div>`;
          const cls = /error|fail|✗/.test(l.msg) ? 'color:#c04030;font-weight:bold;'
                     : /warn|⚠|⏸/.test(l.msg) ? 'color:#b06030;font-weight:bold;'
                     : /✓|sent|confirmed/.test(l.msg) ? 'color:#2a7a2a;font-weight:bold;'
                     : /👤/.test(l.msg) ? 'color:#2a5ab0;font-weight:bold;'
                     : '';
          return `<div style="padding:1px 0;border-bottom:1px dashed rgba(58,74,128,.12);font-family:'Courier New',monospace;font-size:9px;"><span style="color:#6a7a98;">${clockOf(l.ts)}</span> <span style="${cls}">[${esc(l.source)}]</span> ${esc(l.msg)}</div>`;
        }).join('')
      : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">no Builder logs</div>';

    const queue = b.queue || [];
    const manualItems = b.manualItems || [];
    const confirmedIds = b.confirmedIds || {};

    const itemsHTML = queue.length ? queue.map(it => {
      const age = it.addedAt ? Math.round((n - it.addedAt)/1000) : 0;
      const tries = it.pausedResTries || 0;
      const triesStr = tries > 0 ? ` · tries:${tries}` : '';
      const wrongStr = it._wrongGidCount > 0 ? ` · wgid:${it._wrongGidCount}` : '';
      const errStr = it.lastError ? ` · <i style="color:#a02020;">${esc(it.lastError)}</i>` : '';
      const sentStr = it._sentToHeartbeat ? ' · sent' : ' · unsent';
      const cbid = it._confirmedBuildingId ? ` · cbId:${esc(it._confirmedBuildingId)}` : '';
      const catStr = it._constructCategory ? ` · cat=${esc(it._constructCategory)}` : '';
      const videoStr = it._skipVideo ? ' · skip-video' : '';
      const vRetryStr = it._videoRetries ? ` · vRetry:${it._videoRetries}` : '';
      const stateColor = it.state === 'DISABLED' ? '#5a5a5a'
                      : it.state === 'FAILED' ? '#c0392b'
                      : it.state === 'BUILDING' ? '#d08000'
                      : it.state === 'PAUSED_RES' ? '#8a8a8a'
                      : it.state === 'CONFIRMING' ? '#d08000'
                      : '#2a7a2a';
      return `<div style="font-family:'Courier New',monospace;font-size:9px;padding:3px 4px;border-bottom:1px dashed rgba(58,74,128,.12);">
        · <b>${esc(it.name)}</b> L${it.targetLevel} @${esc(TC.villageLabel(it.villageId))} #${esc(it.slotId||'?')}
        · kind=${esc(it.kind)}${catStr} gid=${esc(it.gid)}
        · <b style="color:${stateColor};">${esc(it.state)}</b>${triesStr}${wrongStr}${sentStr}${errStr}${cbid}${videoStr}${vRetryStr}
        <span style="float:right;opacity:.5;font-size:8px;">${age}s</span>
      </div>`;
    }).join('') : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">queue empty</div>';

    const manualHTML = manualItems.length ? manualItems.map(m => {
      const age = m.detectedAt ? Math.round((n - m.detectedAt)/1000) : 0;
      const timer = m.remaining ? fmtSec(m.remaining) : '—';
      return `<div style="font-family:'Courier New',monospace;font-size:9px;padding:3px 4px;border-bottom:1px dashed rgba(80,130,200,.20);background:rgba(200,220,255,.20);">
        👤 <b>${esc(m.name)}</b> L${m.level} @${esc(TC.villageLabel(m.villageId))}
        · 🔨${timer}
        ${m.buildingId ? ` · id:${esc(m.buildingId)}` : ''}
        <span style="float:right;opacity:.5;font-size:8px;">${age}s</span>
      </div>`;
    }).join('') : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">no manual items detected</div>';

    const vidsAll = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
    const buildQueueHTML = vidsAll.length ? vidsAll.map(vid => {
      const v = s.villages[vid] || {};
      const bq = v.buildQueue || [];
      const bqAt = v.buildQueueAt || 0;
      const bqAge = bqAt ? Math.round((n - bqAt)/1000) : null;
      const hasBL = v.hasBuildingList;
      const blIcon = hasBL === true ? '🟢' : hasBL === false ? '📭' : '❓';
      const itemsHTML2 = bq.length ? bq.map(q => {
        const icon = detectItemIcon(q, vid);
        const timer = q.remaining ? fmtSec(q.remaining) : '—';
        const bid = q.buildingId ? ` id:${esc(q.buildingId)}` : '';
        return `<div style="padding-left:12px;opacity:.85;">· ${icon} ${esc(q.name)} L${q.level} (${timer})${bid}</div>`;
      }).join('') : '<div style="padding-left:12px;opacity:.5;font-style:italic;">· (empty)</div>';
      const ageStr = bqAge !== null ? ` · ${bqAge}s ago` : '';
      return `<div style="font-family:'Courier New',monospace;font-size:9px;padding:3px 4px;border-bottom:1px dashed rgba(80,130,200,.12);">
        <div><b>${esc(TC.villageLabel(vid))}</b> · ${blIcon} bq: ${bq.length}${ageStr}</div>
        ${itemsHTML2}
      </div>`;
    }).join('') : '<div style="text-align:center;color:#6a7a98;font-style:italic;padding:6px;">no villages captured</div>';

    const stats = {
      total: queue.length,
      pending: queue.filter(x => x.state === 'PENDING' || x.state === 'PENDING_SENT').length,
      paused: queue.filter(x => x.state === 'PAUSED_RES').length,
      disabled: queue.filter(x => x.state === 'DISABLED').length,
      failed: queue.filter(x => x.state === 'FAILED').length,
      building: queue.filter(x => x.state === 'BUILDING' || x.state === 'CONFIRMING').length,
      confirmed: Object.keys(confirmedIds).length,
      wrongGid: queue.filter(x => (x._wrongGidCount || 0) > 0).length,
      skipVideo: queue.filter(x => x._skipVideo).length,
    };

    return `
      <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-size:9px;padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">queue: ${stats.total}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(120,200,80,.30);border-radius:8px;">pend: ${stats.pending}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(160,160,160,.30);border-radius:8px;">paused: ${stats.paused}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(90,90,90,.35);border-radius:8px;">disabled: ${stats.disabled}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(200,64,48,.25);border-radius:8px;">failed: ${stats.failed}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(255,180,80,.35);border-radius:8px;">bld: ${stats.building}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(80,160,220,.30);border-radius:8px;">cId: ${stats.confirmed}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(160,106,48,.30);border-radius:8px;">wgid: ${stats.wrongGid}</span>
        <span style="font-size:9px;padding:2px 6px;background:rgba(180,120,220,.30);border-radius:8px;">skipV: ${stats.skipVideo}</span>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-size:9px;padding:2px 6px;background:${b.auto ? 'rgba(120,200,80,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">auto: ${b.auto ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:${b.useVideo ? 'rgba(180,120,220,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">video: ${b.useVideo ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:${b.travianPlus ? 'rgba(255,180,80,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">plus: ${b.travianPlus ? 'ON' : 'OFF'}</span>
        <span style="font-size:9px;padding:2px 6px;background:${b.allVillages ? 'rgba(80,160,220,.35)' : 'rgba(200,200,200,.35)'};border-radius:8px;">allV: ${b.allVillages ? 'ON' : 'OFF'}</span>
        <span style="cursor:pointer;font-size:9px;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;margin-left:auto;" data-bld-act="copy">📋</span>
        <span style="cursor:pointer;font-size:9px;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;" data-bld-act="clear-logs">🗑</span>
      </div>

      <div style="max-height:180px;overflow-y:auto;background:rgba(0,0,0,.06);border-radius:3px;padding:4px 6px;">${logHTML}</div>

      <div style="margin-top:8px;padding:6px 8px;background:rgba(255,255,255,.5);border-radius:4px;border-left:3px solid #3a4a80;">
        <div style="font-weight:bold;color:#3a4a80;font-size:10px;margin-bottom:2px;">Queue (${queue.length})</div>
        ${itemsHTML}
      </div>

      <div style="margin-top:8px;padding:6px 8px;background:rgba(200,220,255,.25);border-radius:4px;border-left:3px solid #2a5ab0;">
        <div style="font-weight:bold;color:#2a4a70;font-size:10px;margin-bottom:2px;">👤 Manual items (detected) (${manualItems.length})</div>
        ${manualHTML}
      </div>

      <div style="margin-top:8px;padding:6px 8px;background:rgba(220,240,220,.30);border-radius:4px;border-left:3px solid #2a8a50;">
        <div style="font-weight:bold;color:#1a5a30;font-size:10px;margin-bottom:2px;">🔨 Build Queue (from Hub) (${vidsAll.length} villages)</div>
        ${buildQueueHTML}
      </div>
    `;
  }
  function bindBuilderDebug(root) {
    root.querySelectorAll('[data-bld-act]').forEach(el => {
      el.onclick = () => handleBuilderDebugAction(el.dataset.bldAct);
    });
  }
  function handleBuilderDebugAction(act) {
    const s = TC.state();
    const b = getPluginState();

    if (act === 'copy') {
      const logs = s.logs.filter(l => l.source === 'Builder' || l.sid === 'marker').slice(-40);
      const lines = logs.map(l => l.sid === 'marker' ? l.msg : `${clockOf(l.ts)} [${l.source}] ${l.msg}`);
      const headerLines = ['# Nova Builder 2.0.3.15 Logs'];
      headerLines.push(`# ${new Date().toISOString()}`);
      headerLines.push(`session=${TC.sessionId}`);
      headerLines.push('');
      const queueDump = (b.queue || []).map(it =>
        `Q: ${it.name} L${it.targetLevel} kind=${it.kind} cat=${it._constructCategory||'-'} gid=${it.gid} slot=${it.slotId} state=${it.state} tries=${it.pausedResTries||0} wgid=${it._wrongGidCount||0} skipV=${it._skipVideo||false} vRetry=${it._videoRetries||0}`
      );
      const manualDump = (b.manualItems || []).map(m => `M: ${m.name} L${m.level} @${m.villageId} id=${m.buildingId||'-'}`);
      const text = headerLines.join('\n') + '\n' + queueDump.join('\n') + '\n' + manualDump.join('\n') + '\n\n' + lines.join('\n');
      navigator.clipboard.writeText(text).then(() => TC.flash('📋 copied')).catch(() => console.log(text));
    }
    else if (act === 'clear-logs') {
      TC.patch(st => { st.logs = st.logs.filter(l => l.source !== 'Builder'); });
      TC.flash('Builder logs cleared');
    }
  }

  async function init() {
    TC = await waitForHeartbeat(10000);
    if (!TC) { console.error('[Nova Builder] Heartbeat not loaded within 10s'); return; }
    if (_registered) return;
    _registered = true;

    await randomDelay(CFG.INIT_DELAY_MIN_MS, CFG.INIT_DELAY_MAX_MS);

    console.log(`%c[Nova Builder] ${VERSION} ready`, 'color:#b06030;font-weight:bold');
    injectStyles();
    ensureBox();
    TC.registerPlugin(PLUGIN_ID, {
      onArrive,
      onComplete,
      onFail,
      onDecide,
      onConfirmResult,
    });

    if (isDebugEnabled() && TC.tests) {
      const tryRegister = (attempt = 0) => {
        if (!isDebugEnabled()) return;
        if (!TC.tests) return;
        if (!document.getElementById('tcTestPanel')) {
          if (attempt < 10) setTimeout(() => tryRegister(attempt + 1), 500);
          return;
        }
        try {
          TC.tests.register('builder', {
            label: '🔨 Builder',
            render: renderBuilderDebug,
            onMount: bindBuilderDebug,
          });
        } catch (e) {
          console.error('[NovaBld] register debug tab failed:', e);
        }
      };
      tryRegister();
    }

    tickLoop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();