  function installPublicApi(TC) {
    window.FM = {
      version: FM_VERSION,
      tc: FM.tc,
      state: fmState,
      patch: fmPatch,
      storageKey: FM_STORAGE_KEY,
      log: getFullLog,
      copyLog: copyFullLog,
      clearLog: clearLogBuffer,
      logBuffer: () => _logBuffer.slice(),
      start: (mode) => {
        const btn = document.querySelector(
          mode === "resume" ? ".fm-btn-resume" : ".fm-btn-start",
        );
        if (btn) btn.click();
      },
      snapshot: () => fmState()?.byVillage?.[TC.village()]?.snapshot,
      readSnapshot: captureSnapshot,
      export: (listId, onlySelected) =>
        exportListCompact(TC.village(), listId, onlySelected),
      import: (text) => importListFromText(text, TC.village()),
      importTo: (text, mode, listId, newName) =>
        importListToTarget(text, TC.village(), mode, listId, newName),
      previewImport: (text, mode, listId) =>
        previewImport(text, TC.village(), mode, listId),
      backup: makeBackup,
      sound: (on) => {
        fmPatch((fm) => {
          fm.settings.soundEnabled = !!on;
        });
        if (on) playAlarm();
      },
      heartbeatRestore: (on) => {
        fmPatch((fm) => {
          fm.settings.restoreHeartbeatAfterRun = !!on;
        });
      },
      cooldown: {
        isActive: isCooldownActive,
        remaining: () => _cooldownRemaining,
        clear: () => {
          closeCooldownModal();
          clearCooldownFreeze();
        },
      },
      panelCount: () => document.querySelectorAll(".fm-panel").length,
      removeStalePanels: () => {
        document.querySelectorAll(".fm-panel").forEach((p) => {
          if (p !== _fmPanelRef) p.remove();
        });
      },
      clearPendingRunKey: clearPendingRunKey,
      restoreHbNow: restoreHeartbeatAfterRun,
      cancelOrphaned: (runId) => cancelOrphanedFarmTasks(runId),
      // ⭐ فاز ۲ (additive)
      cancelRunTasks: (runId) => cancelFarmTasksOfRun(runId),
      cancelAllFarmTasks: (reason) => cancelAllFarmTasks(reason),
      goToReport: (sourceVid) => goToReport(sourceVid),
      // ⭐ فاز ۳: وضعیت قفل صف Nova (rotation paused while run active)
      lockActive: () => farmLockActive(),
      lockInfo: () => FM.tc.pluginLock.check(),
      forceNavigateTt0: () => {
        const fm = fmState();
        let sid =
          fm.runInProgress?.sourceVid ||
          fm._pendingFinalReport?.sourceVid ||
          String(TC.village());
        try {
          location.href = `/build.php?id=39&gid=16&tt=0&newdid=${sid}`;
        } catch (e) {}
      },
      diag: () => {
        const s = TC.state();
        const fm = fmState();
        let pendingKeyRaw = null;
        try {
          pendingKeyRaw = sessionStorage.getItem(PENDING_RUN_KEY);
        } catch (e) {}
        return {
          version: FM_VERSION,
          heartbeatOn: s.heartbeat?.enabled,
          heartbeatFrozen: s.heartbeat?._frozenAt
            ? s.heartbeat._frozenReason
            : null,
          nextRotationAt: s.heartbeat?.nextRotationAt,
          currentJob: s.currentJob
            ? `${s.currentJob.plugin}/${s.currentJob.state}`
            : null,
          queuedFarm: (s.tasks || []).filter((t) => t.payload?.farm).length,
          allTasks: (s.tasks || []).length,
          page: TC.page(),
          tt: new URL(location.href).searchParams.get("tt"),
          storageVillages: Object.keys(fm.byVillage || {}).length,
          backups: (fm.backups || []).length,
          cooldownActive: _cooldownActive,
          cooldownRemaining: _cooldownRemaining,
          // ⭐ فاز ۲ (additive)
          cooldownPersistedUntil: fm.cooldown?.until || 0,
          runStatus: runStatus(),
          // ⭐ فاز ۳: قفل صف Nova
          lockActive: farmLockActive(),
          lockLabel: FM.tc.pluginLock.check()?.label || null,
          novaVersion: TC.version(),
          snapshotAge: snapshotAgeLabel(
            fm.byVillage?.[String(TC.village())]?.snapshotAt,
          ),
          lastShownReportRunId: fm._lastShownReportRunId || null,
          pendingFinalReport: !!fm._pendingFinalReport,
          navigateToTt0AfterRun: !!fm._navigateToTt0AfterRun,
          endOfRunHandled: !!fm._endOfRunHandled,
          activeRunId: fm._activeRunId,
          heartbeatWasEnabled: fm._heartbeatWasEnabled,
          pendingRunKeyPresent: !!pendingKeyRaw,
          fmPanelPresent: !!document.querySelector(".fm-panel"),
          fmPanelCount: document.querySelectorAll(".fm-panel").length,
          fmPanelRefConnected: _fmPanelRef ? _fmPanelRef.isConnected : null,
          mapBoxPresent: !!document.querySelector(".fm-map-box"),
          logBufferSize: _logBuffer.length,
          runInProgress: fm.runInProgress
            ? {
                id: fm.runInProgress.id,
                sent: fm.runInProgress.sent,
                failed: fm.runInProgress.failed,
                skipped: fm.runInProgress.skipped,
                planned: fm.runInProgress.planned,
                sentSinceCooldown: fm.runInProgress._sentSinceCooldown || 0,
                cooldownThreshold: fm.runInProgress._cooldownThreshold || 0,
                status: fm.runInProgress.status || "running",
                snapshotSource: fm.runInProgress.snapshotSource || null,
                troopSnapshotAt: fm.runInProgress.troopSnapshotAt || 0,
                autoFill: fm.runInProgress.autoFill || "fillAvailable",
              }
            : null,
        };
      },
      clearFarmData: () => {
        if (!confirm("Clear Farm Manager data (Nova untouched)?")) return;
        try {
          localStorage.removeItem(FM_STORAGE_KEY);
        } catch {}
        clearPendingRunKey();
        location.reload();
      },
      clearNovaState: () => {
        if (!confirm("Clear Nova HB state (Farm data preserved)?")) return;
        try {
          localStorage.removeItem("travian_nova_hb_v1");
        } catch {}
        try {
          sessionStorage.clear();
        } catch {}
        location.reload();
      },
    };
  }
