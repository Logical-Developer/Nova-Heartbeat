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
