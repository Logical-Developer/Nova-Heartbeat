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
