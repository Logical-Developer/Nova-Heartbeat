  function installHeartbeatWrapper(TC) {
    TC.registerPlugin("Heartbeat", {
      onArrive: async (ctx) => {
        if (ctx.payload?.farm) return await handleFarmArrive(ctx);
        TC.captureCurrentVillage();
        return { type: "done", reason: "captured" };
      },
    });
    TC.log?.("sys", `Heartbeat wrapper installed (v${FM_VERSION})`);
    fmLog("INFO", "Heartbeat wrapper installed");
  }

  function findActiveFarmTask() {
    const s = FM.tc.state();
    const tasks = s.tasks || [];
    const n = now();
    return (
      tasks.find((t) => t.payload?.farm && t.expiresAt > n) ||
      (s.currentJob?.payload?.farm ? s.currentJob : null)
    );
  }
  function installFreezeOverride(TC) {
    TC.freezeOverride.register(
      FM_NS,
      (pt, u) => {
        // ⭐ FIX (X1): در بازهٔ Cool Down هیچ override‌ای داده نمی‌شود.
        // Nova در هر tick (۱.۵ ثانیه) با override=true فریزِ ست‌شده را پاک می‌کند
        // (src/07-plugins-api.js:81-95) و همین باعث می‌شد Cool Down بی‌اثر شود.
        // با برگرداندن false، فریزِ fm-cooldown حفظ می‌شود.
        if (_cooldownActive) return false;
        if (pt !== "build") return false;
        if (u.searchParams.get("gid") !== "16") return false;
        if (u.searchParams.get("tt") !== "2") return false;
        return !!findActiveFarmTask();
      },
      "FarmManager raid in progress",
    );
  }

  // ⭐ فاز ۳ (باگ #۱): قفل صف Nova در طول run.
  // چرا: Nova در pickNextJob() وقتی task قابل‌اجرایی نیست rotationTick() را صدا
  // می‌زند و «urgent visit» را با priority=10 صف می‌کند — بالاتر از priority=9
  // تسک‌های farm — پس وسط run به دهکدهٔ دیگری می‌رفت (تعویض دهکده).
  // با قفل، Nova نه rotation/urgent می‌زند و نه تسک پلاگین دیگری را برمی‌دارد.
  let _lockMemo = { at: 0, val: false };
  function farmLockActive() {
    const n = now();
    if (n - _lockMemo.at < 500) return _lockMemo.val;
    _lockMemo.val = isFarmRunActive(null);
    _lockMemo.at = n;
    return _lockMemo.val;
  }

  function installPluginLock(TC) {
    const ok = FM.tc.pluginLock.register(FM_NS, {
      active: () => farmLockActive(),
      ownsTask: (t) => !!t?.payload?.farm,
      label: "Farm Manager",
      description: "farm run in progress",
    });
    if (ok === false) {
      fmLog(
        "WARN",
        "plugin-lock not available in this Nova build (needs 0.0.3+) — rotation cannot be paused",
      );
    } else {
      fmLog("INFO", "Plugin lock registered (Nova rotation paused during runs)");
    }
    return ok;
  }
