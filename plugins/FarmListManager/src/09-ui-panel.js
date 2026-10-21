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
