  // ⭐ فاز ۲ (A5-1): ناوبری یکسان به گزارش نهایی — همیشه با newdid
  function goToReport(sourceVid) {
    const fm = fmState();
    let sid =
      sourceVid ||
      fm._pendingFinalReport?.sourceVid ||
      fm.runInProgress?.sourceVid ||
      null;
    if (!sid) {
      try {
        sid = String(FM.tc.village());
      } catch (e) {}
    }
    const url = `/build.php?id=39&gid=16&tt=0${sid ? `&newdid=${sid}` : ""}`;
    fmLog("INFO", `goToReport -> ${url}`);
    try {
      location.href = url;
    } catch (e) {}
  }

  function markReportShown(data) {
    fmPatch((fmm) => {
      fmm._lastShownReportRunId = data?.runId || null;
      fmm._navigateToTt0At = 0;
    });
    fmLog("INFO", `final report shown (runId=${data?.runId || "?"})`);
  }

  let _reportRenderToken = 0;

  function checkPendingReport() {
    const fm = fmState();
    if (!fm._pendingFinalReport && !fm._navigateToTt0AfterRun) return;

    if (isRallyTt0()) {
      restoreHeartbeatAfterRun();

      const data = fm._pendingFinalReport;
      // ⭐ A3: فلگ‌های persisted بلافاصله پاک می‌شوند تا حلقهٔ ناوبری نسازند،
      // ولی رندر گزارش با توکن محافظت می‌شود تا گم نشود.
      fmPatch((fmm) => {
        fmm._pendingFinalReport = null;
        fmm._navigateToTt0AfterRun = false;
        fmm._navigateToTt0At = 0;
      });
      if (!data) return;
      if (data.runId && data.runId === fmState()._lastShownReportRunId) {
        fmLog(
          "INFO",
          `final report for run ${data.runId} already shown -> skip (dedupe)`,
        );
        return;
      }
      const token = ++_reportRenderToken;
      fmLog("INFO", "Showing pending final report");
      setTimeout(() => {
        if (token !== _reportRenderToken) return;
        showFinalReport(data);
        notifyRunComplete(data);
        markReportShown(data);
      }, 300);
      return;
    }

    // ⭐ 2.1.2 (باگ #۲): از هر تب کلوبخشی به گزارش نهایی می‌رویم (قبلاً فقط tt=2).
    if (isRallyAnyTab() && fm._navigateToTt0AfterRun && !detectConfirmForm()) {
      // ⭐ S2/A3: گارد ضدِ حلقهٔ tt=2 -> tt=0 (حداکثر یک ناوبری در هر ۴ ثانیه)
      const lastNav = fm._navigateToTt0At || 0;
      if (now() - lastNav < 4000) return;
      fmPatch((fmm) => {
        fmm._navigateToTt0At = now();
      });
      let sid = null;
      if (fm._pendingFinalReport?.sourceVid)
        sid = fm._pendingFinalReport.sourceVid;
      else sid = String(FM.tc.village());
      fmLog("INFO", `Navigating to tt=0 (sid=${sid}) to show report`);
      goToReport(sid);
    }
  }

  function notifyRunComplete(runData) {
    const fm = readFMData();
    const {
      sent,
      failed,
      skipped,
      planned,
      elapsedMs,
      stoppedByTroops,
      remaining,
    } = runData;
    const durStr = fmtDuration(Math.round(elapsedMs / 1000));

    let title, body, toastKind;
    if (stoppedByTroops) {
      title = "⏸ Farm Run Paused — Out of Troops";
      body = `${sent}/${planned} sent · ${remaining || planned - sent - failed - skipped} targets remaining · ${durStr}`;
      toastKind = "warn";
    } else if (failed === 0 && skipped === 0) {
      title = "Farm Run Complete";
      body = `${sent}/${planned} sent · ${durStr}`;
      toastKind = "ok";
    } else {
      title =
        failed > 0 ? "Farm Run Finished (with failures)" : "Farm Run Finished";
      body = `${sent}/${planned} sent${failed ? ` · ${failed} failed` : ""}${skipped ? ` · ${skipped} skipped` : ""} · ${durStr}`;
      toastKind = failed > 0 ? "warn" : "ok";
    }

    if (fm.settings.notificationsEnabled) {
      showToast(`${title} — ${body}`, toastKind);
      if (typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          try {
            new Notification(title, { body, icon: "/favicon.ico" });
          } catch (e) {}
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((p) => {
            if (p === "granted")
              try {
                new Notification(title, { body });
              } catch (e) {}
          });
        }
      }
    }
    playAlarm();
  }

  // ═════════════════════════════════════════════════════════════
  // FINAL REPORT MODAL
  // ═════════════════════════════════════════════════════════════
  function showFinalReport(runData) {
    const {
      sent,
      failed,
      skipped,
      planned,
      elapsedMs,
      listName,
      sourceVid,
      stoppedByTroops,
      remaining,
    } = runData;
    const old = document.getElementById("fm-final-overlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "fm-final-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;";

    let headerColor, headerBg, title;
    if (stoppedByTroops) {
      headerColor = "#a06020";
      headerBg = "rgba(240,180,80,.35)";
      title = "⏸ Farm Run Paused — Out of Troops";
    } else if (failed === 0 && skipped === 0) {
      headerColor = "#4a7a30";
      headerBg = "rgba(120,200,80,.30)";
      title = "✅ Farm Run Complete";
    } else if (failed > 0) {
      headerColor = "#a03020";
      headerBg = "rgba(200,80,60,.30)";
      title = "⚠ Farm Run Finished (with errors)";
    } else {
      headerColor = "#a06020";
      headerBg = "rgba(200,140,60,.30)";
      title = "✔ Farm Run Finished";
    }

    let villageLabel = sourceVid;
    try {
      villageLabel = FM.tc.villageLabel(sourceVid) || sourceVid;
    } catch (e) {}

    const pendingLeft = stoppedByTroops
      ? remaining != null
        ? remaining
        : planned - sent - failed - skipped
      : 0;

    const modal = document.createElement("div");
    modal.style.cssText = `background:linear-gradient(180deg,#f9fbff,#e8eff9);border:2px solid #8a9ac0;border-radius:10px;padding:20px;font-family:Verdana,sans-serif;font-size:13px;color:#1a2050;max-width:520px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.55);text-align:center;`;

    let extraInfo = "";
    if (stoppedByTroops) {
      extraInfo = `
        <div style="background:rgba(255,240,200,.5);border-radius:6px;padding:10px;margin-bottom:12px;text-align:left;font-size:11px;line-height:1.5;">
          <b style="color:#8a5010;">Why stopped?</b><br>
          All available troops were used. Remaining targets are kept as <b>pending</b>.<br>
          When you have more troops, click <b>Start Raid</b> again (or Resume) to continue from where it stopped.
        </div>
      `;
    }

    modal.innerHTML = `
      <div style="background:${headerBg};border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:bold;font-size:16px;color:${headerColor};">${esc(title)}</div>
        <div style="font-size:10px;color:#5a6a80;margin-top:4px;">List: <b>${esc(listName || "-")}</b> · Source: <b>${esc(villageLabel)}</b></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
        <div style="padding:10px;background:rgba(200,240,200,.4);border-radius:5px;">
          <div style="font-size:22px;font-weight:bold;color:#2a7a2a;">${sent}</div>
          <div style="font-size:9px;color:#4a7a30;">Sent</div>
        </div>
        <div style="padding:10px;background:rgba(240,200,200,.4);border-radius:5px;">
          <div style="font-size:22px;font-weight:bold;color:#a03020;">${failed}</div>
          <div style="font-size:9px;color:#7a2010;">Failed</div>
        </div>
        <div style="padding:10px;background:rgba(240,220,180,.4);border-radius:5px;">
          <div style="font-size:22px;font-weight:bold;color:#a06020;">${skipped}</div>
          <div style="font-size:9px;color:#7a4020;">Skipped</div>
        </div>
      </div>
      ${
        stoppedByTroops
          ? `
        <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:14px;">
          <div style="padding:10px;background:rgba(255,220,150,.5);border-radius:5px;">
            <div style="font-size:22px;font-weight:bold;color:#a06020;">${pendingLeft}</div>
            <div style="font-size:9px;color:#7a4020;">Targets Pending (will resume later)</div>
          </div>
        </div>
      `
          : ""
      }
      <div style="font-family:'Courier New',monospace;font-size:11px;color:#4a5a70;margin-bottom:14px;text-align:left;padding:0 8px;">
        <div>Total planned: <b>${planned}</b></div>
        <div>Duration: <b>${fmtDuration(Math.round(elapsedMs / 1000))}</b></div>
        <div>Success rate: <b>${planned ? Math.round((sent / planned) * 100) : 0}%</b></div>
      </div>
      ${extraInfo}
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" id="fm-final-close" style="flex:1;min-width:120px;padding:10px 20px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:5px;font-weight:bold;cursor:pointer;font-size:13px;">✓ Close</button>
        <button type="button" id="fm-final-copylog" style="padding:10px 14px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:5px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Copy Log</button>
        <button type="button" id="fm-final-clearlog" style="padding:10px 14px;background:#f0d0c0;border:1px solid #b07050;border-radius:5px;font-weight:bold;cursor:pointer;font-size:12px;">🗑 Clear Log</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById("fm-final-close").onclick = () => {
      closeFinalReportModal();
    };
    document.getElementById("fm-final-copylog").onclick = () => copyFullLog();
    document.getElementById("fm-final-clearlog").onclick = () =>
      clearLogBuffer();
  }

  function closeFinalReportModal() {
    const overlay = document.getElementById("fm-final-overlay");
    if (overlay) overlay.remove();
  }

  // ─────────────────────────────────────────────────────────────
  // Snapshot
  // ─────────────────────────────────────────────────────────────
  function readOwnTroopsSnapshot() {
    const tables = $$(".rallyPointOverviewContainer table.troop_details");
    const out = {};
    for (const tbl of tables) {
      const role =
        tbl.querySelector("thead td.troopHeadline a")?.textContent || "";
      if (!/Own troops/i.test(role)) continue;
      const vid = tbl.dataset.did || tbl.dataset.vid;
      if (!vid) continue;
      const cells = $$("tbody.units.last tr td.unit", tbl);
      const troops = {};
      const order = [
        "t1",
        "t2",
        "t3",
        "t4",
        "t5",
        "t6",
        "t7",
        "t8",
        "t9",
        "t10",
        "t11",
      ];
      for (let i = 0; i < order.length; i++) {
        const c = cells[i];
        troops[order[i]] = c
          ? parseInt(c.textContent.replace(/[^\d]/g, ""), 10) || 0
          : 0;
      }
      out[String(vid)] = troops;
    }
    return out;
  }
  function captureSnapshot() {
    if (!isRallyOverview()) return null;
    const snap = readOwnTroopsSnapshot();
    const srcVid = FM.tc.village();
    if (!srcVid || !snap[String(srcVid)]) return null;
    fmPatch((fm) => {
      const b = fm.byVillage[String(srcVid)];
      if (b) {
        b.snapshot = snap[String(srcVid)];
        b.snapshotAt = now();
      }
    });
    return snap[String(srcVid)];
  }
