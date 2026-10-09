  // ─────────────────────────────────────────────────────────────
  // Debug tab
  // ─────────────────────────────────────────────────────────────
  function registerFarmDebugTab(TC) {
    if (!TC.tests?.register) return;
    TC.tests.register("farm", {
      label: "Farm",
      render: renderFarmDebug,
      onMount: bindFarmDebug,
    });
  }
  function renderFarmDebug() {
    const fm = fmState();
    if (!fm)
      return '<div style="padding:8px;color:#888;">No FarmManager state</div>';
    const s = FM.tc.state();
    const curVid = FM.tc.village();
    const bucket = fm.byVillage[String(curVid)] || {
      lists: [],
      snapshot: null,
    };
    const run = fm.runInProgress;
    const job = s.currentJob;
    const farmTasks = (s.tasks || []).filter((t) => t.payload?.farm);
    const pendingKey = sessionStorage.getItem(PENDING_RUN_KEY);

    let html = "";
    html += `
      <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;font-size:9px;">
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">v${FM_VERSION}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">vid: ${esc(curVid || "?")}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">lists: ${bucket.lists?.length || 0}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">queued: ${farmTasks.length}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">HB: ${s.heartbeat?.enabled ? "ON" : "OFF"}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">panels: ${document.querySelectorAll(".fm-panel").length}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">pending: ${pendingKey ? "YES" : "no"}</span>
        <span style="padding:2px 6px;background:rgba(58,74,128,.15);border-radius:8px;">hbWas: ${fm._heartbeatWasEnabled === null ? "null" : fm._heartbeatWasEnabled}</span>
        ${_cooldownActive ? `<span style="padding:2px 6px;background:rgba(255,180,80,.45);border-radius:8px;font-weight:bold;">CD: ${_cooldownRemaining}s</span>` : ""}
        ${job?.payload?.farm ? `<span style="padding:2px 6px;background:rgba(255,180,80,.45);border-radius:8px;font-weight:bold;">JOB: ${esc(job.state || "?")}</span>` : ""}
      </div>
    `;
    html += `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.5);border-radius:4px;border-left:3px solid #3a4a80;">
      <div style="font-weight:bold;color:#3a4a80;font-size:10px;">Page</div>
      <div style="font-family:monospace;font-size:9px;margin-top:2px;">
        page=${esc(FM.tc.page())} | gid=${esc(new URL(location.href).searchParams.get("gid") || "-")} | tt=${esc(new URL(location.href).searchParams.get("tt") || "-")}<br>
        form1=${detectSendTroopsForm()} | form2=${detectConfirmForm()}
      </div>
    </div>`;
    if (run) {
      html += `<div style="margin-top:6px;padding:6px 8px;background:rgba(120,200,80,.15);border-radius:4px;border-left:3px solid #4a7a30;">
        <div style="font-weight:bold;color:#1a5a10;font-size:10px;">Run ${esc(run.id.slice(-6))}</div>
        <div style="font-family:monospace;font-size:9px;margin-top:2px;">
          ${run.sent}/${run.planned} sent · ${run.failed} failed · ${run.skipped} skipped<br>
          status: ${esc(run.status || "running")} · snapshot: ${esc(run.snapshotSource || "-")} (age ${esc(snapshotAgeLabel(run.troopSnapshotAt))})<br>
          current: ${esc(run.currentTarget || "-")} [${esc(run.currentState || "-")}]<br>
          cooldown counter: ${run._sentSinceCooldown || 0}/${run._cooldownThreshold || "?"}
        </div>
      </div>`;
    }
    if (fm._pendingFinalReport) {
      html += `<div style="margin-top:6px;padding:6px 8px;background:rgba(200,140,60,.15);border-radius:4px;border-left:3px solid #a06020;">
        <div style="font-weight:bold;color:#7a4020;font-size:10px;">Pending Final Report</div>
        <div style="font-family:monospace;font-size:9px;margin-top:2px;">
          ${fm._pendingFinalReport.sent} sent · ${fm._pendingFinalReport.failed} failed · ${fm._pendingFinalReport.skipped} skipped<br>
          stoppedByTroops=${!!fm._pendingFinalReport.stoppedByTroops}<br>
          navigateToTt0=${fm._navigateToTt0AfterRun} · endOfRun=${fm._endOfRunHandled}
        </div>
      </div>`;
    }
    html += `
      <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;font-size:9px;">
        <span data-fm-action="copy" style="cursor:pointer;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;">copy state</span>
        <span data-fm-action="copylog" style="cursor:pointer;padding:2px 6px;background:rgba(58,74,128,.20);border-radius:3px;">📋 copy log</span>
        <span data-fm-action="clearlog" style="cursor:pointer;padding:2px 6px;background:rgba(200,140,60,.30);border-radius:3px;">🗑 clear log</span>
        <span data-fm-action="clear-run" style="cursor:pointer;padding:2px 6px;background:rgba(200,64,48,.30);border-radius:3px;">clear run</span>
        <span data-fm-action="cancel-tasks" style="cursor:pointer;padding:2px 6px;background:rgba(200,64,48,.30);border-radius:3px;">cancel tasks</span>
        <span data-fm-action="cancel-orphaned" style="cursor:pointer;padding:2px 6px;background:rgba(200,64,48,.30);border-radius:3px;">cancel orphaned</span>
        <span data-fm-action="reset-rot" style="cursor:pointer;padding:2px 6px;background:rgba(120,90,180,.30);border-radius:3px;">reset rotation</span>
        <span data-fm-action="clear-cd" style="cursor:pointer;padding:2px 6px;background:rgba(200,140,60,.30);border-radius:3px;">clear cooldown</span>
        <span data-fm-action="clear-pending" style="cursor:pointer;padding:2px 6px;background:rgba(200,64,48,.30);border-radius:3px;">clear pending key</span>
      </div>
    `;
    return html;
  }
  function bindFarmDebug(root) {
    root.querySelectorAll("[data-fm-action]").forEach((el) => {
      el.onclick = () => {
        const act = el.dataset.fmAction;
        if (act === "copy") {
          const txt = JSON.stringify(fmState(), null, 2);
          navigator.clipboard
            .writeText(txt)
            .then(() => FM.tc.flash?.("copied"))
            .catch(() => console.log(txt));
        } else if (act === "copylog") {
          copyFullLog();
        } else if (act === "clearlog") {
          clearLogBuffer();
        } else if (act === "clear-run") {
          fmPatch((fm) => {
            fm._heartbeatWasEnabled = null;
          });
          // ⭐ فاز ۲: تنها نقطهٔ تغییر وضعیت
          transitionRun(RUN_STATUS.IDLE, { runId: null });
          clearPendingRunKey();
          FM.tc.flash?.("run cleared");
        } else if (act === "cancel-tasks") {
          cancelCurrentRun();
          FM.tc.flash?.("tasks cancelled");
        } else if (act === "cancel-orphaned") {
          const activeId = fmState().runInProgress?.id || null;
          const n = activeId
            ? cancelOrphanedFarmTasks(activeId)
            : cancelAllFarmTasks("debug-cancel-all");
          FM.tc.flash?.(`cancelled ${n} task(s)`);
        } else if (act === "reset-rot") {
          FM.tc.patch((s) => {
            if (s.heartbeat) s.heartbeat.nextRotationAt = now() + 5000;
          });
          FM.tc.flash?.("rotation reset");
        } else if (act === "clear-cd") {
          closeCooldownModal();
          clearCooldownFreeze();
          FM.tc.flash?.("cooldown cleared");
        } else if (act === "clear-pending") {
          clearPendingRunKey();
          FM.tc.flash?.("pending key cleared");
        }
      };
    });
  }
