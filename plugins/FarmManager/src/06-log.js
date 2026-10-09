  function _logKey(level, msg) {
    // پیام را نرمالایز کن (اعداد را حذف کن برای dedup)
    return level + "|" + msg.replace(/\d+/g, "#").slice(0, 120);
  }

  function fmLog(level, ...args) {
    const ts = new Date().toISOString().slice(11, 23);
    const msg = args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "object") {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(" ");

    // ⭐ Dedupe: پیام‌های تکراری در بازه 5 ثانیه فقط یک بار لاگ می‌شوند
    const key = _logKey(level, msg);
    const nowMs = Date.now();
    const prev = _logDedupMap.get(key);
    if (prev && nowMs - prev.lastTs < LOG_DEDUP_WINDOW_MS) {
      prev.count++;
      prev.lastTs = nowMs;
      // به‌روزرسانی آخرین خط لاگ به جای اضافه کردن خط جدید
      const lastIdx = _logBuffer.length - 1;
      if (lastIdx >= 0 && _logBuffer[lastIdx].includes(msg.slice(0, 80))) {
        _logBuffer[lastIdx] = `[${ts}] [${level}] ${msg} (×${prev.count})`;
      }
      return;
    }
    _logDedupMap.set(key, { count: 1, lastTs: nowMs });

    const line = `[${ts}] [${level}] ${msg}`;
    _logBuffer.push(line);
    if (_logBuffer.length > LOG_BUFFER_MAX) _logBuffer.shift();
    const fn =
      level === "ERROR"
        ? console.error
        : level === "WARN"
          ? console.warn
          : console.log;
    fn(`[FM]`, ...args);
  }

  function clearLogBuffer() {
    const n = _logBuffer.length;
    _logBuffer.length = 0;
    _logDedupMap.clear();
    showToast("Log cleared (" + n + " lines)", "ok");
    fmLog("INFO", "Log buffer cleared by user");
    if (_fmPanelRef && _fmPanelRef.isConnected) {
      const diag = _fmPanelRef.querySelector(".fm-diag");
      if (diag) diag.innerHTML = "";
    }
  }

  function getFullLog() {
    const header = [
      "═══════════════════════════════════════════",
      `  Nova Farm Manager v${FM_VERSION} — Log Dump`,
      `  Time: ${new Date().toISOString()}`,
      `  URL: ${location.href}`,
      `  UserAgent: ${navigator.userAgent}`,
      "═══════════════════════════════════════════",
      "",
    ].join("\n");

    let diagStr = "";
    try {
      diagStr =
        "\n\n──── DIAG ────\n" +
        JSON.stringify(window.FM?.diag?.() || {}, null, 2);
    } catch (e) {}
    let stateStr = "";
    try {
      const s = readFMData();
      stateStr =
        "\n\n──── FM STATE (summary) ────\n" +
        JSON.stringify(
          {
            version: s._version,
            settings: s.settings,
            villages: Object.keys(s.byVillage || {}),
            currentVillageBucket: s.byVillage?.[String(FM.tc.village?.())]
              ? {
                  lists: s.byVillage[String(FM.tc.village())].lists.map(
                    (l) => ({
                      id: l.id,
                      name: l.name,
                      targets: l.targets.length,
                      pausedRun: l.pausedRun ? "(set)" : null,
                    }),
                  ),
                }
              : null,
            runInProgress: s.runInProgress,
            runStatus: runStatus(),
            pendingFinalReport: s._pendingFinalReport ? "(set)" : null,
            navigateToTt0AfterRun: s._navigateToTt0AfterRun,
            endOfRunHandled: s._endOfRunHandled,
            activeRunId: s._activeRunId,
            lastShownReportRunId: s._lastShownReportRunId || null,
            cooldown: s.cooldown || null,
            backupsCount: (s.backups || []).length,
            _heartbeatWasEnabled: s._heartbeatWasEnabled,
          },
          null,
          2,
        );
    } catch (e) {}
    let novaStr = "";
    try {
      const ns = FM.tc.state?.();
      novaStr =
        "\n\n──── NOVA STATE (summary) ────\n" +
        JSON.stringify(
          {
            heartbeat: ns?.heartbeat,
            currentJob: ns?.currentJob
              ? `${ns.currentJob.plugin}/${ns.currentJob.state}`
              : null,
            totalTasks: (ns?.tasks || []).length,
            farmTasks: (ns?.tasks || []).filter((t) => t.payload?.farm).length,
            farmTaskSample: (ns?.tasks || [])
              .filter((t) => t.payload?.farm)
              .slice(0, 5)
              .map((t) => ({
                id: t.id,
                state: t.state,
                runId: t.payload?.farm?.runId,
                target: t.payload?.farm?.targetName,
                expiresAt: t.expiresAt,
              })),
          },
          null,
          2,
        );
    } catch (e) {}
    let pendingStr = "";
    try {
      const raw = sessionStorage.getItem(PENDING_RUN_KEY);
      pendingStr =
        "\n\n──── PENDING_RUN_KEY ────\n" +
        (raw ? raw.slice(0, 500) : "(empty)");
    } catch (e) {}

    return (
      header + _logBuffer.join("\n") + diagStr + stateStr + novaStr + pendingStr
    );
  }

  async function copyFullLog() {
    const txt = getFullLog();
    try {
      await navigator.clipboard.writeText(txt);
      showToast("Log copied (" + txt.length + " chars)", "ok");
      fmLog("INFO", "Log copied, length=" + txt.length);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        showToast("Log copied (fallback)", "ok");
        return true;
      } catch (e2) {
        fmLog("ERROR", "Copy failed", e2);
        showToast("Copy failed — see console", "warn");
        console.log(txt);
        return false;
      }
    }
  }
