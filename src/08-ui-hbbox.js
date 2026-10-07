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

