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
