  // ─────────────────────────────────────────────────────────────
  // Core handler
  // ─────────────────────────────────────────────────────────────
  function detectSendTroopsForm() {
    // ⭐ فاز ۲: ردیف t1 ممکن است وجود نداشته باشد (روستای بدون Phalanx) —
    // هر input از نوع troop[tN] کافی است.
    return !!(
      document.querySelector('#troops input[name^="troop["]') &&
      document.getElementById("ok")
    );
  }
  function detectConfirmForm() {
    return !!document.getElementById("confirmSendTroops");
  }
  function detectInvalidVillageError() {
    const errEls = $$(
      '.error, .errorMessage, .message.error, [class*="error"], [class*="Error"]',
    );
    for (const el of errEls) {
      const t = (el.textContent || "").toLowerCase();
      if (
        t.includes("no village at these coordinates") ||
        t.includes("there is no village") ||
        t.includes("village not found")
      ) {
        return true;
      }
    }
    const body = document.body.textContent || "";
    if (/there is no village at these coordinates/i.test(body)) return true;
    return false;
  }

  function isFarmRunActive(runId) {
    const fm = fmState();
    // ⭐ باگ #۱: وضعیت صریح run ملاک است، نه فلگ جاماندهٔ _endOfRunHandled
    if (fm._endOfRunHandled === true) return false;
    const run = fm.runInProgress;
    if (!run) return false;
    if (run.status === RUN_STATUS.FINISHED) return false;
    if (run.status === RUN_STATUS.PAUSED_NO_TROOPS) return false;
    if (runId && run.id !== runId) return false;
    return true;
  }

  async function handleFarmArrive({ job, target, payload }) {
    const farm = payload.farm;
    if (!farm) return { type: "fail", reason: "no-farm-payload" };

    // ⭐⭐⭐ مهم‌ترین fix: اگر run تمام شده، این task را cancel کن
    // و به tt=0 navigate کن، نه اینکه در صفحه Send Troops گیر کنی
    if (!isFarmRunActive(farm.runId)) {
      fmLog(
        "INFO",
        `handleFarmArrive: run ended → cancelling orphaned task ${farm.targetName}`,
      );
      // ⭐ تمام تسک‌های farm باقی‌مانده را cancel کن
      // ⭐ X4: فقط تسک‌های همین run پاک می‌شوند (نه کل صف farm)
      cancelFarmTasksOfRun(farm.runId);
      // ⭐ به tt=0 برو تا گزارش نهایی نمایش داده شود
      const fmGuard = fmState();
      if (fmGuard._navigateToTt0AfterRun || fmGuard._pendingFinalReport) {
        goToReport(farm.sourceVid);
      }
      return { type: "done", reason: "end-of-run-cleanup" };
    }

    const u = new URL(location.href);
    const isRallySend =
      u.searchParams.get("gid") === "16" && u.searchParams.get("tt") === "2";

    if (isCooldownActive()) {
      return { type: "wait", delayMs: 500, reason: "cool-down-active" };
    }

    if (isRallySend && detectInvalidVillageError()) {
      fmLog("INFO", `Invalid village: (${farm.x}|${farm.y}) → marking INVALID`);
      const report = markTargetInvalidAndMaybeFinish(
        farm,
        "no-village-at-coordinates",
      );
      showToast(`Invalid: (${farm.x}|${farm.y}) — disabled`, "warn");

      const fmAfter = fmState();
      if (fmAfter._navigateToTt0AfterRun || report) {
        fmLog("INFO", "Run finished after invalid — navigating to tt=0");
        goToReport(farm.sourceVid);
      } else {
        fmLog("INFO", "Navigating to tt=2 to reset form");
        try {
          location.href = `/build.php?id=39&gid=16&tt=2&newdid=${farm.sourceVid}`;
        } catch (e) {}
      }
      return { type: "done", reason: "invalid-village" };
    }

    if (!isRallySend) {
      try {
        location.href = `/build.php?id=39&gid=16&tt=2&newdid=${farm.sourceVid}`;
      } catch (e) {}
      return { type: "wait", delayMs: 2500, reason: "navigating-to-tt2" };
    }

    const sendFormExists = detectSendTroopsForm();
    const confirmFormExists = detectConfirmForm();

    if (sendFormExists && !confirmFormExists) {
      const fmNow = fmState();
      const list = fmNow.byVillage?.[farm.sourceVid]?.lists?.find(
        (l) => l.id === farm.listId,
      );
      const run = fmNow.runInProgress;

      if (list?.cooldown?.enabled !== false && run) {
        const sentSince = run._sentSinceCooldown || 0;
        const threshold = run._cooldownThreshold || pickCooldownAttacks(list);

        if (sentSince >= threshold) {
          const durationMs = pickCooldownDelayMs(list);
          fmPatch((fm) => {
            if (fm.runInProgress) {
              fm.runInProgress._sentSinceCooldown = 0;
              fm.runInProgress._cooldownThreshold = pickCooldownAttacks(list);
            }
          });
          transitionRun(RUN_STATUS.COOLDOWN, { runId: farm.runId });
          fmLog(
            "INFO",
            `Cooldown triggered BEFORE task ${farm.targetName} (sent=${sentSince}, threshold=${threshold})`,
          );
          openCooldownModal(durationMs, list.name);
          return { type: "wait", delayMs: 500, reason: "starting-cool-down" };
        }
      }
    }

    fmPatch((fm) => {
      if (fm.runInProgress?.id === farm.runId) {
        fm.runInProgress.currentTarget = farm.targetName;
        fm.runInProgress.currentTargetId = farm.targetId;
        fm.runInProgress.currentState = "filling";
      }
    });

    if (confirmFormExists) {
      if (!isFarmRunActive(farm.runId))
        return { type: "done", reason: "run-paused-before-confirm" };
      const confirmBtn = document.getElementById("confirmSendTroops");
      if (!confirmBtn)
        return { type: "wait", delayMs: 500, reason: "no-confirm-btn" };

      const clickResult = await humanClickNoNav(confirmBtn, () =>
        isFarmRunActive(farm.runId),
      );
      if (!clickResult.ok)
        return { type: "done", reason: "run-paused-before-confirm" };

      const report = applyResultAndMaybeFinish(farm, "sent", null, {
        submittedAt: now(),
      });
      fmLog("INFO", "confirm clicked: " + farm.targetName);

      FM.tc.patch((s) => {
        if (s.heartbeat) {
          s.heartbeat.nextRotationAt = safeRotationAt(
            Math.max(s.heartbeat.nextRotationAt || 0, now() + 5 * 60 * 1000),
          );
        }
      });

      const fmAfter = fmState();
      // ⭐ 2.1.2 (باگ #۲): بعد از آخرین confirm، Travian به tt=1 برمی‌گردد و
      // ناوبری به tt=0 فقط از طریق poll (checkPendingReport) انجام می‌شد که شرط
      // isRallySend (tt=2) داشت → کاربر در tt=1 گیر می‌کرد. حالا مستقیم می‌رویم،
      // ولی اول یک تأخیر کوتاه می‌دهیم تا POST «تأیید ارسال» ارسال شود
      // (ناوبری فوری می‌تواند درخواست در حال ارسال را قطع کند).
      if (fmAfter._navigateToTt0AfterRun || report) {
        fmLog("INFO", "Run finished after last confirm — navigating to tt=0");
        await delay(1200);
        goToReport(farm.sourceVid);
        return { type: "done", reason: "confirmed-and-finished" };
      }
      if (!fmAfter.runInProgress) {
        return { type: "done", reason: "confirmed-and-finished" };
      }
      return { type: "done", reason: "confirmed" };
    }

    if (!sendFormExists) {
      return { type: "wait", delayMs: 1000, reason: "no-form" };
    }

    const plan = computeTroopsToSend(farm);
    if (!plan.ok) {
      const reason = plan.reason || "insufficient-troops";

      if (reason === "no-troops-available") {
        fmLog(
          "WARN",
          `No troops available for ${farm.targetName} → STOPPING run`,
        );
        const report = stopRunDueToNoTroops(farm, reason);
        showToast("⏸ Out of troops — run paused", "warn");

        goToReport(farm.sourceVid);
        return { type: "done", reason: "stopped-no-troops" };
      }

      const report = applyResultAndMaybeFinish(farm, "skipped", reason);
      fmLog("INFO", "skip " + farm.targetName + ": " + reason);

      const fmSkip = fmState();
      if (fmSkip._navigateToTt0AfterRun || report || !fmSkip.runInProgress) {
        goToReport(farm.sourceVid);
        return { type: "done", reason: "skipped-and-finished" };
      }
      return { type: "done", reason: "skipped:" + reason };
    }

    // ⭐ باگ #۳ (نمایان‌سازی): ارسال جزئی دیگر بی‌صدا نیست
    if (plan.partial) {
      fmLog(
        "WARN",
        `Partial fill for ${farm.targetName}: ${JSON.stringify(plan.remaining || {})}`,
      );
      if (!fmState().runInProgress?._partialWarned) {
        fmPatch((fm) => {
          if (fm.runInProgress) fm.runInProgress._partialWarned = true;
        });
        showToast(
          "Partial troops sent — enable \"Require exact troop count\" to skip instead",
          "warn",
        );
      }
    }

    const troopKeys = Object.keys(TROOP_LABELS).filter(
      (k) => (plan.troops[k] | 0) > 0 || k === "t11",
    );
    for (const k of troopKeys) {
      const inp = document.querySelector(`#troops input[name="troop[${k}]"]`);
      if (!inp || inp.disabled) continue;
      await humanType(inp, String(plan.troops[k] | 0));
      await humanTabToNext(inp);
      if (!isFarmRunActive(farm.runId))
        return { type: "done", reason: "run-paused-while-filling" };
    }

    const xInp = document.getElementById("xCoordInput");
    const yInp = document.getElementById("yCoordInput");
    if (!xInp || !yInp) return { type: "fail", reason: "no-coords-input" };
    await humanType(xInp, String(farm.x));
    await humanType(yInp, String(farm.y));

    const raidRadio = document.querySelector(
      'input[name="eventType"][value="4"]',
    );
    if (!raidRadio) return { type: "fail", reason: "no-raid-radio" };
    if (!raidRadio.checked) await humanClickNoNav(raidRadio);

    await delay(logNormal(200, 500));
    if (!isFarmRunActive(farm.runId))
      return { type: "done", reason: "run-paused-before-submit" };
    if (
      parseInt(xInp.value, 10) !== farm.x ||
      parseInt(yInp.value, 10) !== farm.y
    ) {
      return { type: "fail", reason: "coords-mismatch" };
    }

    const okBtn = document.getElementById("ok");
    if (!okBtn) return { type: "fail", reason: "no-ok-btn" };

    fmPatch((fm) => {
      if (fm.runInProgress) fm.runInProgress.currentState = "submitting";
    });
    fmLog("INFO", "submitting " + farm.targetName + " → awaiting confirm");
    const submitResult = await humanClickNoNav(okBtn, () =>
      isFarmRunActive(farm.runId),
    );
    if (!submitResult.ok)
      return { type: "done", reason: "run-paused-before-submit" };

    return { type: "transition", state: "EXECUTING" };
  }
