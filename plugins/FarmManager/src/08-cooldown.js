  // ═════════════════════════════════════════════════════════════
  // COOL DOWN SYSTEM
  // ═════════════════════════════════════════════════════════════
  let _cooldownActive = false;
  let _cooldownTimer = null;
  let _cooldownRemaining = 0;
  let _cooldownDurationMs = 0;

  let _fmPanelRef = null;
  let _fmMapBoxRef = null;

  function pickCooldownAttacks(list) {
    const cd = list?.cooldown || {};
    const min = Math.max(1, cd.minAttacks || 7);
    const max = Math.max(min, cd.maxAttacks || 10);
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function pickCooldownDelayMs(list) {
    const cd = list?.cooldown || {};
    const min = Math.max(1000, cd.minDelayMs || 3000);
    const max = Math.max(min, cd.maxDelayMs || 5000);
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function isCooldownActive() {
    return _cooldownActive;
  }

  function openCooldownModal(durationMs, listName) {
    const old = document.getElementById("fm-cooldown-overlay");
    if (old) old.remove();

    _cooldownActive = true;
    _cooldownDurationMs = durationMs;
    _cooldownRemaining = Math.ceil(durationMs / 1000);
    // ⭐ X2: وضعیت cooldown در state ذخیره می‌شود تا با ناوبری/reload گم نشود
    persistCooldownState(durationMs, listName);

    const overlay = document.createElement("div");
    overlay.id = "fm-cooldown-overlay";
    overlay.style.cssText =
      "position:fixed;top:190px;left:8px;right:8px;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding:0;pointer-events:none;";

    const run = fmState().runInProgress;
    const total = run?.planned || 0;
    const done = run ? run.sent + run.failed + run.skipped : 0;
    const remaining = Math.max(0, total - done);
    const pct = total ? Math.round((done / total) * 100) : 0;

    const modal = document.createElement("div");
    modal.style.cssText = `background:linear-gradient(180deg,#f9fbff,#e8eff9);border:2px solid #8a9ac0;border-radius:10px;padding:20px;font-family:Verdana,sans-serif;font-size:13px;color:#1a2050;max-width:440px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:center;pointer-events:none;`;
    modal.innerHTML = `
      <div style="font-weight:bold;font-size:16px;color:#2a4a70;margin-bottom:4px;">⏸ Cool Down</div>
      <div style="font-size:10px;color:#6a7a98;margin-bottom:14px;">List: ${esc(listName || "-")} · v${FM_VERSION}</div>
      <div id="fm-cd-circle" style="width:120px;height:120px;margin:0 auto 14px;border-radius:50%;background:conic-gradient(#7ab04a 0%, #7ab04a 0%, #e0e0e0 0%);display:flex;align-items:center;justify-content:center;position:relative;">
        <div style="width:100px;height:100px;border-radius:50%;background:#f9fbff;display:flex;align-items:center;justify-content:center;flex-direction:column;">
          <span id="fm-cd-count" style="font-size:32px;font-weight:bold;color:#2a4a70;font-family:'Courier New',monospace;">${_cooldownRemaining}</span>
          <span style="font-size:9px;color:#6a7a98;">seconds</span>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="height:10px;background:#e0e0e0;border-radius:5px;overflow:hidden;margin-bottom:6px;">
          <div id="fm-cd-progress" style="width:${pct}%;height:100%;background:linear-gradient(90deg,#7ab04a,#4a7a30);transition:width .5s;"></div>
        </div>
        <div style="font-family:'Courier New',monospace;font-size:11px;color:#4a5a70;">
          Sent: <b>${run?.sent || 0}</b> · Failed: <b>${run?.failed || 0}</b> · Skipped: <b>${run?.skipped || 0}</b>
        </div>
        <div style="font-family:'Courier New',monospace;font-size:11px;color:#4a5a70;margin-top:2px;">
          Progress: <b>${done}/${total}</b> (${pct}%) · Remaining: <b>${remaining}</b>
        </div>
      </div>
      <button type="button" id="fm-cd-cancel" style="padding:8px 20px;background:linear-gradient(180deg,#d04a30,#a03020);color:#fff;border:1px solid #601010;border-radius:5px;font-weight:bold;cursor:pointer;font-size:13px;pointer-events:auto;">⏹ Cancel Raid</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById("fm-cd-cancel").onclick = () => {
      fmLog("INFO", "Cooldown cancelled by user");
      cancelCurrentRun();
      closeCooldownModal();
      clearCooldownFreeze();
      showToast("Raid cancelled", "warn");
    };

    const totalSec = Math.ceil(durationMs / 1000);
    _cooldownTimer = setInterval(() => {
      _cooldownRemaining--;
      const el = document.getElementById("fm-cd-count");
      if (el) el.textContent = Math.max(0, _cooldownRemaining);

      const elapsedPct =
        totalSec > 0 ? ((totalSec - _cooldownRemaining) / totalSec) * 100 : 0;
      const circle = document.getElementById("fm-cd-circle");
      if (circle)
        circle.style.background = `conic-gradient(#7ab04a 0%, #7ab04a ${elapsedPct}%, #e0e0e0 ${elapsedPct}%)`;

      const r2 = fmState().runInProgress;
      if (r2) {
        const d2 = r2.sent + r2.failed + r2.skipped;
        const t2 = r2.planned;
        const p2 = t2 ? Math.round((d2 / t2) * 100) : 0;
        const pb = document.getElementById("fm-cd-progress");
        if (pb) pb.style.width = p2 + "%";
      }
      if (_cooldownRemaining <= 0) {
        clearInterval(_cooldownTimer);
        _cooldownTimer = null;
        closeCooldownModal();
        clearCooldownFreeze();
        // ⭐ فاز ۲: بازگشت به وضعیت RUNNING بعد از پایان cooldown
        const fmRun = fmState().runInProgress;
        if (fmRun && fmRun.status === RUN_STATUS.COOLDOWN) {
          transitionRun(RUN_STATUS.RUNNING, { runId: fmRun.id });
        }
        fmLog("INFO", "Cooldown complete — resuming");
      }
    }, 1000);

    setCooldownFreeze();
    fmLog(
      "INFO",
      `Cool down ${_cooldownRemaining}s started (duration=${durationMs}ms)`,
    );
  }

  function closeCooldownModal() {
    _cooldownActive = false;
    const overlay = document.getElementById("fm-cooldown-overlay");
    if (overlay) overlay.remove();
    if (_cooldownTimer) {
      clearInterval(_cooldownTimer);
      _cooldownTimer = null;
    }
    clearPersistedCooldown();
  }

  // ⭐ X2 — persist/restore وضعیت cooldown
  function persistCooldownState(durationMs, listName) {
    try {
      fmPatch((fm) => {
        fm.cooldown = {
          active: true,
          startedAt: now(),
          durationMs: durationMs,
          until: now() + durationMs,
          listName: listName || null,
        };
      });
    } catch (e) {
      fmLog("WARN", "persistCooldownState failed", e);
    }
  }
  function clearPersistedCooldown() {
    try {
      fmPatch((fm) => {
        fm.cooldown = null;
      });
    } catch (e) {
      fmLog("WARN", "clearPersistedCooldown failed", e);
    }
  }

  // در live() صدا زده می‌شود: اگر ناوبری/reload وسط cooldown رخ داده باشد،
  // مودال و فریز بازگردانده می‌شوند (وگرنه شمارش معکوس بی‌صدا گم می‌شد).
  function restoreCooldownIfActive() {
    if (_cooldownActive || document.getElementById("fm-cooldown-overlay"))
      return;
    const cd = fmState().cooldown;
    if (!cd || cd.active !== true) return;
    const remain = (cd.until || 0) - now();
    if (remain <= 0) {
      fmLog("INFO", "Cooldown state expired on load → clearing freeze");
      clearPersistedCooldown();
      clearCooldownFreeze();
      return;
    }
    fmLog(
      "INFO",
      `Cooldown restored after navigation (${Math.round(remain / 1000)}s left)`,
    );
    openCooldownModal(remain, cd.listName);
  }

  function setCooldownFreeze() {
    try {
      FM.tc.patch?.((s) => {
        if (!s.heartbeat) return;
        s.heartbeat._frozenAt = now();
        s.heartbeat._frozenReason = "fm-cooldown";
      });
    } catch (e) {
      fmLog("WARN", "setCooldownFreeze failed", e);
    }
  }
  function clearCooldownFreeze() {
    try {
      FM.tc.patch?.((s) => {
        if (!s.heartbeat) return;
        if (s.heartbeat._frozenReason === "fm-cooldown") {
          s.heartbeat._frozenAt = null;
          s.heartbeat._frozenReason = null;
        }
      });
    } catch (e) {
      fmLog("WARN", "clearCooldownFreeze failed", e);
    }
  }

  // ⭐ جدید: پاک‌سازی تسک‌های farm یتیم (orphaned)
  function cancelOrphanedFarmTasks(activeRunId) {
    try {
      const s = FM.tc.state();
      const fm = fmState();
      const runId = activeRunId === undefined ? fm._activeRunId : activeRunId;
      if (!runId) {
        // ⭐ X4: هرگز «همه را پاک کن» — بدون runId صریح هیچ‌کاری انجام نمی‌شود
        fmLog(
          "WARN",
          "cancelOrphanedFarmTasks: no runId given/active → skip (no cancel-all)",
        );
        return 0;
      }
      const tasks = s.tasks || [];
      let cancelled = 0;
      for (const t of tasks) {
        const f = t.payload?.farm;
        if (!f) continue;
        // اگر runId با run فعال مطابقت ندارد → orphaned
        if (f.runId !== runId) {
          try {
            FM.tc.cancel(t.id);
            cancelled++;
          } catch (e) {}
        }
      }
      if (cancelled > 0) {
        fmLog("INFO", `Cancelled ${cancelled} orphaned farm task(s)`);
      }
      return cancelled;
    } catch (e) {
      fmLog("WARN", "cancelOrphanedFarmTasks failed", e);
      return 0;
    }
  }

  // ⭐ فاز ۲ (X4): پاکسازی صریح تسک‌های یک run مشخص — هرگز «همه را پاک کن»
  // includeCurrentJob به‌صورت پیش‌فرض false است تا handler جاری (که همین حالا
  // در حال اجراست) وسط کار cancel نشود؛ فقط مسیرهای توقف صریح آن را true می‌کنند.
  function cancelFarmTasksOfRun(runId, includeCurrentJob = false) {
    if (!runId) {
      fmLog("WARN", "cancelFarmTasksOfRun: empty runId → skip");
      return 0;
    }
    let cancelled = 0;
    try {
      const s = FM.tc.state();
      for (const t of s.tasks || []) {
        if (t.payload?.farm?.runId !== runId) continue;
        try {
          FM.tc.cancel(t.id);
          cancelled++;
        } catch (e) {}
      }
      if (
        includeCurrentJob &&
        s.currentJob?.payload?.farm?.runId === runId
      ) {
        try {
          FM.tc.cancel(s.currentJob.id);
          cancelled++;
        } catch (e) {}
      }
    } catch (e) {
      fmLog("WARN", "cancelFarmTasksOfRun failed", e);
    }
    if (cancelled > 0) {
      fmLog("INFO", `Cancelled ${cancelled} farm task(s) of run ${runId}`);
    }
    return cancelled;
  }

  // ⭐ فقط در مسیرهای صریح: شروع run جدید یا boot بدون run فعال
  function cancelAllFarmTasks(reason) {
    let cancelled = 0;
    try {
      const s = FM.tc.state();
      for (const t of s.tasks || []) {
        if (!t.payload?.farm) continue;
        try {
          FM.tc.cancel(t.id);
          cancelled++;
        } catch (e) {}
      }
      if (s.currentJob?.payload?.farm) {
        try {
          FM.tc.cancel(s.currentJob.id);
          cancelled++;
        } catch (e) {}
      }
    } catch (e) {
      fmLog("WARN", "cancelAllFarmTasks failed", e);
    }
    if (cancelled > 0) {
      fmLog(
        "INFO",
        `Cancelled ${cancelled} farm task(s) [${reason || "explicit"}]`,
      );
    }
    return cancelled;
  }

  function cancelCurrentRun() {
    clearPendingRunKey();
    fmPatch((fm) => {
      fm._heartbeatWasEnabled = null;
    });
    // ⭐ فاز ۲: تنها نقطهٔ تغییر وضعیت
    transitionRun(RUN_STATUS.IDLE, { runId: null });
    cancelAllFarmTasks("cancelCurrentRun");
  }
    // ⭐ cancel تمام تسک‌های farm (نه فقط run فعال)


