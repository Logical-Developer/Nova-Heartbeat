  // ═════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — تنها نقطهٔ تغییر وضعیت (فاز ۲ — باگ #۱ / A3 / A5-۲)
  // ═════════════════════════════════════════════════════════════
  // چهار فلگ قدیمی (_endOfRunHandled / _activeRunId / _navigateToTt0AfterRun /
  // _pendingFinalReport) هنوز نوشته می‌شوند تا window.FM.diag() و پنل debug
  // سازگار بمانند، ولی از این پس هیچ نقطهٔ دیگری اجازهٔ نوشتن مستقیم ندارد.
  function runStatus() {
    return fmState().runInProgress?.status || RUN_STATUS.IDLE;
  }

  function transitionRun(next, opts = {}) {
    const report = opts.report || null;
    let applied = false;
    fmPatch((fm) => {
      const run = fm.runInProgress;
      if (opts.runId && run && run.id !== opts.runId) return;

      if (
        next === RUN_STATUS.RUNNING ||
        next === RUN_STATUS.PREPARING ||
        next === RUN_STATUS.COOLDOWN
      ) {
        // وضعیت‌های غیرپایانی: run زنده است
        if (run) run.status = next;
        fm._endOfRunHandled = false;
        fm._activeRunId = run ? run.id : opts.runId || fm._activeRunId;
        if (next !== RUN_STATUS.COOLDOWN) {
          fm._navigateToTt0AfterRun = false;
          fm._pendingFinalReport = null;
        }
        applied = true;
        return;
      }

      if (next === RUN_STATUS.IDLE) {
        // توقف دستی/کنسل: هیچ گزارش نهایی نمایش داده نمی‌شود
        fm.runInProgress = null;
        fm._pendingFinalReport = null;
        fm._navigateToTt0AfterRun = false;
        fm._endOfRunHandled = true;
        fm._activeRunId = null;
        applied = true;
        return;
      }

      // FINISHED / PAUSED_NO_TROOPS — پایان run
      if (run) run.status = next;
      if (report) {
        report.runId = report.runId || (run ? run.id : null);
        report.shownAt = null;
        fm._pendingFinalReport = report;
      }
      fm._navigateToTt0AfterRun = opts.navigate !== false;
      fm._endOfRunHandled = true;
      fm._activeRunId = null;
      if (opts.keepRun !== true) fm.runInProgress = null;
      applied = true;
    });
    if (applied) {
      fmLog(
        "INFO",
        `run transition → ${next}` +
          (report ? ` (report run=${report.runId || "?"})` : ""),
      );
    }
    return report;
  }

  function pendingRunKeyPresent() {
    try {
      return !!sessionStorage.getItem(PENDING_RUN_KEY);
    } catch (e) {
      return false;
    }
  }

  // ═════════════════════════════════════════════════════════════
  // HB Restore
  // ═════════════════════════════════════════════════════════════
  function restoreHeartbeatAfterRun() {
    const fmFresh = readFMData();
    const wasEnabled = fmFresh._heartbeatWasEnabled;

    if (wasEnabled === null || wasEnabled === undefined) {
      fmLog("INFO", "HB restore: already done or unknown, skip");
      return;
    }

    if (fmFresh.settings.restoreHeartbeatAfterRun === false) {
      fmLog("INFO", "HB restore disabled by settings");
      fmPatch((fm) => {
        fm._heartbeatWasEnabled = null;
      });
      return;
    }

    if (wasEnabled !== false) {
      fmLog("INFO", `HB was ON before run — leaving ON`);
      fmPatch((fm) => {
        fm._heartbeatWasEnabled = null;
      });
      return;
    }

    try {
      FM.tc.heartbeat.setOn(false);
      fmLog("INFO", "✓ Heartbeat restored to OFF");
    } catch (e) {
      fmLog("WARN", "restore HB failed", e);
    }

    fmPatch((fm) => {
      fm._heartbeatWasEnabled = null;
    });
  }

  function savePausedRun(list, run) {
    const targetIds = [...new Set(run.resumeTargetIds || run.targetIds || [])];
    const targetIdSet = new Set(targetIds);
    const hasRemaining = list.targets.some(
      (target) =>
        targetIdSet.has(target.id) &&
        target.status !== "sent" &&
        target.invalid !== true,
    );
    if (!hasRemaining) {
      list.pausedRun = null;
      return;
    }
    list.pausedRun = {
      runId: run.id,
      startedAt: run.startedAt,
      planned: targetIds.length,
      targetIds,
      troopSnapshot: run.troopSnapshot ? { ...run.troopSnapshot } : null,
      // ⭐ فاز ۲ (باگ #۵): زمان snapshot هم منتقل می‌شود تا TTL قابل بررسی باشد
      troopSnapshotAt: run.troopSnapshotAt || 0,
      troops: { ...run.troops },
      autoFill: run.autoFill || "fillAvailable",
    };
  }

  // ═════════════════════════════════════════════════════════════
  // ATOMIC RESULT + MAYBE FINISH
  // ═════════════════════════════════════════════════════════════
  function applyResultAndMaybeFinish(farm, status, reason, extra = {}) {
    let reportData = null;
    let runFinished = false;
    fmPatch((fm) => {
      if (!fm.runInProgress || fm.runInProgress.id !== farm.runId) return;
      const b = fm.byVillage[farm.sourceVid];
      if (!b) return;
      const list = b.lists.find((l) => l.id === farm.listId);
      if (!list) return;
      const t = list.targets.find((x) => x.id === farm.targetId);
      if (!t) return;

      t.status = status;
      t.lastRaid = {
        at: now(),
        status,
        reason: reason || null,
        runId: farm.runId,
        ...extra,
      };
      if (extra.partialRemaining) t.partialRemaining = extra.partialRemaining;
      else if (status === "sent") t.partialRemaining = null;
      if (status === "skipped") t.lastSkipReason = reason || "unknown";

      if (fm.runInProgress && fm.runInProgress.id === farm.runId) {
        const r = fm.runInProgress;
        if (status === "sent") {
          r.sent += 1;
          r._sentSinceCooldown = (r._sentSinceCooldown || 0) + 1;
        } else if (status === "skipped" || status === "failed") {
          r.skipped += 1;
        }
        r.currentTarget = null;
        r.currentTargetId = null;
        r.currentState = null;

        const done = r.sent + r.failed + r.skipped;
        if (done >= r.planned) {
          savePausedRun(list, r);
          reportData = {
            runId: r.id,
            sent: r.sent,
            failed: r.failed,
            skipped: r.skipped,
            planned: r.planned,
            elapsedMs: now() - r.startedAt,
            listName: r.listName,
            sourceVid: r.sourceVid,
            stoppedByTroops: false,
          };
          // ⭐ تغییر وضعیت بیرون از این fmPatch انجام می‌شود (transitionRun)
          runFinished = true;
        }
      }
    });

    // ⭐ اگر run تمام شد، تسک‌های باقی‌مانده را cancel کن
    if (runFinished) {
      // ⭐ تنها نقطهٔ تغییر وضعیت (باگ #۱)
      transitionRun(RUN_STATUS.FINISHED, {
        report: reportData,
        runId: farm.runId,
      });
      cancelFarmTasksOfRun(farm.runId);
      clearPendingRunKey();
      restoreHeartbeatAfterRun();
      fmLog("INFO", "Run complete", reportData);
    }
    return reportData;
  }

  function markTargetInvalidAndMaybeFinish(farm, reason) {
    let reportData = null;
    let runFinished = false;
    fmPatch((fm) => {
      if (!fm.runInProgress || fm.runInProgress.id !== farm.runId) return;
      const b = fm.byVillage[farm.sourceVid];
      if (!b) return;
      const list = b.lists.find((l) => l.id === farm.listId);
      if (!list) return;
      const t = list.targets.find((x) => x.id === farm.targetId);
      if (!t) return;

      t.status = "failed";
      t.invalid = true;
      t.selected = false;
      t.lastRaid = {
        at: now(),
        status: "failed",
        reason: reason || "invalid",
        runId: farm.runId,
      };

      if (fm.runInProgress && fm.runInProgress.id === farm.runId) {
        const r = fm.runInProgress;
        r.skipped += 1;
        r.currentTarget = null;
        r.currentTargetId = null;
        r.currentState = null;

        const done = r.sent + r.failed + r.skipped;
        if (done >= r.planned) {
          savePausedRun(list, r);
          reportData = {
            runId: r.id,
            sent: r.sent,
            failed: r.failed,
            skipped: r.skipped,
            planned: r.planned,
            elapsedMs: now() - r.startedAt,
            listName: r.listName,
            sourceVid: r.sourceVid,
            stoppedByTroops: false,
          };
          runFinished = true;
        }
      }
    });

    // cancel تسک این target خاص
    try {
      const s = FM.tc.state();
      const tasks = s.tasks || [];
      let cancelled = 0;
      for (const t of tasks) {
        const f = t.payload?.farm;
        if (!f) continue;
        if (f.targetId === farm.targetId && f.runId === farm.runId) {
          try {
            FM.tc.cancel(t.id);
            cancelled++;
          } catch (e) {}
        }
      }
      if (cancelled > 0) {
        fmLog(
          "INFO",
          `Cancelled ${cancelled} queued task(s) for invalid target ${farm.targetName}`,
        );
      }
      const cj = s.currentJob;
      if (
        cj?.payload?.farm?.targetId === farm.targetId &&
        cj?.payload?.farm?.runId === farm.runId
      ) {
        try {
          FM.tc.cancel(cj.id);
        } catch (e) {}
      }
    } catch (e) {
      fmLog("WARN", "cancel invalid task failed", e);
    }

    if (runFinished) {
      transitionRun(RUN_STATUS.FINISHED, {
        report: reportData,
        runId: farm.runId,
      });
      cancelFarmTasksOfRun(farm.runId);
      clearPendingRunKey();
      restoreHeartbeatAfterRun();
      fmLog("INFO", "Run complete (invalid last)", reportData);
    }
    return reportData;
  }

  function stopRunDueToNoTroops(farm, reason) {
    let reportData = null;
    fmPatch((fm) => {
      const b = fm.byVillage[farm.sourceVid];
      if (!b) return;
      const list = b.lists.find((l) => l.id === farm.listId);
      if (!list) return;

      if (fm.runInProgress && fm.runInProgress.id === farm.runId) {
        const r = fm.runInProgress;
        savePausedRun(list, r);
        const elapsedMs = now() - r.startedAt;
        const pendingLeft = r.planned - r.sent - r.failed - r.skipped;
        reportData = {
          runId: r.id,
          sent: r.sent,
          failed: r.failed,
          skipped: r.skipped,
          planned: r.planned,
          elapsedMs,
          listName: r.listName,
          sourceVid: r.sourceVid,
          stoppedByTroops: true,
          remaining: pendingLeft,
        };
      }
    });

    // ⭐ cancel تمام تسک‌های این run
    try {
      const cancelledTasks = cancelFarmTasksOfRun(farm.runId, true);
      fmLog(
        "INFO",
        `Stopped run: cancelled ${cancelledTasks} queued task(s) (out of troops)`,
      );
    } catch (e) {
      fmLog("WARN", "cancel tasks failed", e);
    }

    if (reportData) {
      // ⭐ باگ #۴: مسیر توقف خودکار هم مثل pauseActiveRun باید مودال و
      // فریز Cool Down را پاک کند، وگرنه ربات تا ۱۰ دقیقه قفل می‌ماند.
      closeCooldownModal();
      clearCooldownFreeze();
      transitionRun(RUN_STATUS.PAUSED_NO_TROOPS, {
        report: reportData,
        runId: farm.runId,
      });
      clearPendingRunKey();
      restoreHeartbeatAfterRun();
      fmLog("WARN", "Run paused (out of troops)", reportData);
    }
    return reportData;
  }

  // ─────────────────────────────────────────────────────────────
  // Enqueue / resume — v1.8.3
  // ─────────────────────────────────────────────────────────────
  function enqueueRunTasks(runData) {
    let count = 0;

    // ⭐ TTL پویا با سقف
    const dynamicTtl = Math.min(
      Math.max(TTL_MIN_MS, runData.listSnapshot.length * TTL_PER_TASK_MS),
      ROTATION_MAX_MS,
    );
    const ttlMin = Math.round(dynamicTtl / 60000);
    fmLog(
      "INFO",
      `enqueueRunTasks: ${runData.listSnapshot.length} tasks, TTL=${ttlMin}min`,
    );

    for (const t of runData.listSnapshot) {
      const bucket = fmState().byVillage[runData.sourceVid];
      const list = bucket?.lists?.find((l) => l.id === runData.listId);
      const targetObj = list?.targets?.find((x) => x.id === t.id);
      if (targetObj?.invalid === true) {
        fmLog(
          "INFO",
          `Skipping invalid target in enqueue: ${t.name} (${t.x}|${t.y})`,
        );
        continue;
      }

      const taskId = `fm_${runData.id}_${t.id}`;
      const res = FM.tc.enqueue({
        id: taskId,
        plugin: DRIVER_PLUGIN,
        priority: 9,
        villageId: runData.sourceVid,
        target: {
          page: "build",
          village: runData.sourceVid,
          params: { gid: "16", tt: "2" },
        },
        payload: {
          rotation: true,
          farm: {
            runId: runData.id,
            listId: runData.listId,
            listName: runData.listName,
            sourceVid: runData.sourceVid,
            targetId: t.id,
            targetName: t.name,
            x: t.x,
            y: t.y,
            troops: t.troops || runData.troops,
            heroFollow:
              t.heroFollow !== undefined ? t.heroFollow : runData.heroFollow,
            autoFill: t.autoFill || runData.autoFill,
          },
        },
        ttlMs: dynamicTtl,
      });
      if (res) count++;
    }
    FM.tc.flash?.(
      `Farm: ${count}/${runData.listSnapshot.length} tasks queued (TTL ${ttlMin}min)`,
    );
    FM.tc.log?.("farm", `enqueued ${count} tasks (TTL ${ttlMin}min)`);
    fmLog("INFO", `enqueued ${count} tasks, TTL=${ttlMin}min`);
    FM.tc.patch((s) => {
      if (s.heartbeat) {
        const target = now() + dynamicTtl;
        s.heartbeat.nextRotationAt = safeRotationAt(
          Math.max(s.heartbeat.nextRotationAt || 0, target),
        );
      }
    });
  }

  function resumeRunIfPending() {
    const fmNow = fmState();
    if (fmNow._endOfRunHandled && !pendingRunKeyPresent()) {
      fmLog(
        "INFO",
        "resumeRunIfPending: endOfRunHandled=true → clearing pending & skip",
      );
      clearPendingRunKey();
      // ⭐ پاک‌سازی تسک‌های orphaned
      cancelAllFarmTasks("resume-stale-no-pending");
      return;
    }
    if (fmNow.runInProgress) {
      const r = fmNow.runInProgress;
      const done = r.sent + r.failed + r.skipped;
      if (done >= r.planned) {
        fmLog(
          "INFO",
          "resumeRunIfPending: runInProgress done → clearing pending & skip",
        );
        clearPendingRunKey();
        return;
      }
    }
    let raw;
    try {
      raw = sessionStorage.getItem(PENDING_RUN_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let runData;
    try {
      runData = JSON.parse(raw);
    } catch {
      clearPendingRunKey();
      return;
    }
    if (
      fmNow.runInProgress &&
      fmNow.runInProgress.id !== runData.id &&
      isFarmRunActive(fmNow.runInProgress.id)
    ) {
      fmLog(
        "WARN",
        `resumeRunIfPending: activeRunId mismatch (${fmNow._activeRunId} !== ${runData.id}) → skip`,
      );
      clearPendingRunKey();
      return;
    }
    const u = new URL(location.href);
    const isOnRally =
      u.pathname.includes("build.php") &&
      u.searchParams.get("gid") === "16" &&
      u.searchParams.get("tt") === "2";
    const sameVillage =
      String(FM.tc.village()) === String(runData.sourceVid);
    if (!isOnRally || !sameVillage) {
      try {
        location.href = `/build.php?id=39&gid=16&tt=2&newdid=${runData.sourceVid}`;
      } catch {}
      return;
    }
    const s = FM.tc.state();
    const hasFarmTasks =
      (s.tasks || []).some((t) => t.payload?.farm?.runId === runData.id) ||
      s.currentJob?.payload?.farm?.runId === runData.id;
    if (hasFarmTasks) {
      clearPendingRunKey();
      return;
    }
    const done =
      (runData.sent || 0) + (runData.failed || 0) + (runData.skipped || 0);
    if (done >= (runData.planned || 0) && runData.planned > 0) {
      fmLog("INFO", "resumeRunIfPending: all done → clearing pending & skip");
      clearPendingRunKey();
      return;
    }
    clearPendingRunKey();
    // ⭐ باگ #۵: snapshot سریالایز‌شدهٔ کهنه با خواندن تازه از صفحهٔ tt=2
    // (و در نبود آن، cache معتبر با TTL ۱۰ دقیقه) جایگزین می‌شود.
    const snapInfo = pickStartSnapshot(
      fmState().byVillage[String(runData.sourceVid)],
      {
        troopSnapshot: runData.troopSnapshot,
        troopSnapshotAt: runData.troopSnapshotAt,
      },
    );
    if (snapInfo.troops) {
      runData.troopSnapshot = { ...snapInfo.troops };
      runData.troopSnapshotAt = snapInfo.at;
      runData.snapshotSource = snapInfo.source;
    } else {
      runData.snapshotSource = "unknown";
    }
    runData.status = RUN_STATUS.RUNNING;
    fmPatch((fm) => {
      fm.runInProgress = runData;
    });
    transitionRun(RUN_STATUS.RUNNING, { runId: runData.id });
    fmLog(
      "INFO",
      `resumeRunIfPending: enqueue ${runData.listSnapshot.length} target(s), snapshot=${snapInfo.source}`,
    );
    FM.tc.log?.(
      "farm",
      `resume on tt=2 → enqueue ${runData.listSnapshot.length}`,
    );
    enqueueRunTasks(runData);
  }
