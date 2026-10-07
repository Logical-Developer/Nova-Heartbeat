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

