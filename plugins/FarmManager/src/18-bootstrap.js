  // ─────────────────────────────────────────────────────────────
  // Styles + live
  // ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("fm-style")) return;
    const st = document.createElement("style");
    st.id = "fm-style";
    st.textContent = `
      .fm-btn { font-family: Verdana, sans-serif; }
      .fm-target:hover { background: rgba(200,220,240,.25) !important; }
      .fm-troop-editor input, .fm-map-troops input, .fm-edit-troops input { -moz-appearance: textfield; }
      .fm-troop-editor input::-webkit-outer-spin-button,
      .fm-troop-editor input::-webkit-inner-spin-button,
      .fm-map-troops input::-webkit-outer-spin-button,
      .fm-map-troops input::-webkit-inner-spin-button,
      .fm-edit-troops input::-webkit-outer-spin-button,
      .fm-edit-troops input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .fm-troop-editor img.unit,
      .fm-map-troops img.unit,
      .fm-target img.unit,
      .fm-edit-troops img.unit { vertical-align: middle; width: 16px; height: 16px; }
      .fm-target a { text-decoration: none; }
      .fm-target a:hover { text-decoration: underline; }
      .fm-tab input { font-family: Verdana, sans-serif; }
    `;
    document.head.appendChild(st);
  }

  let _lastMapDialogSig = "";
  function mapDialogSignature() {
    const t = document.querySelector(
      '.dialogWrapper[data-context="map"] #tileDetails h1',
    );
    return t ? t.textContent.slice(0, 80) : "";
  }

  let _mapObserverAttached = false;
  function attachMapObserver() {
    if (_mapObserverAttached) return;
    _mapObserverAttached = true;
    let _pending = false;
    const obs = new MutationObserver(() => {
      if (_pending) return;
      _pending = true;
      setTimeout(() => {
        _pending = false;
        if (
          document.querySelector(
            '.dialogWrapper[data-context="map"] #tileDetails',
          )
        ) {
          injectFarmBoxOnMap();
        }
      }, 200);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  let _rallyObserverAttached = false;
  function attachRallyObserver() {
    if (_rallyObserverAttached) return;
    _rallyObserverAttached = true;
    let _pending = false;
    const obs = new MutationObserver(() => {
      if (_pending) return;
      _pending = true;
      setTimeout(() => {
        _pending = false;
        if (shouldShowFarmPanel()) injectFarmPanel();
      }, 200);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function live() {
    try {
      const sig = mapDialogSignature();
      if (sig && sig !== _lastMapDialogSig) {
        _lastMapDialogSig = sig;
        setTimeout(injectFarmBoxOnMap, 80);
      } else if (sig === "") {
        _lastMapDialogSig = "";
      }
      injectFarmBoxOnMap();
      injectFarmPanel();
      renderRallyRunStatus();
      checkPendingReport();
      restoreCooldownIfActive();
      if (isRallyOverview()) captureSnapshot();
      if (isRallySend()) resumeRunIfPending();
    } catch (e) {
      fmLog("ERROR", "live error", e);
    }
    setTimeout(live, POLL_MS);
  }

  // ─────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────
  (async function boot() {
    fmLog("INFO", "booting v" + FM_VERSION);
    const TC = await waitForTC(25000);
    if (!TC) {
      fmLog("WARN", "Nova-HB not found");
      return;
    }
    fmLog("INFO", "Nova found, registering...");
    injectStyles();
    migrateV17ToV18();

    migrateFromNovaState(TC);
    fmPatch((fm) => {
      fm.enabled = true;
    });

    installHeartbeatWrapper(TC);
    installFreezeOverride(TC);
    installPluginLock(TC);
    registerFarmDebugTab(TC);

    // ⭐ فاز ۳: بررسی سازگاری نسخهٔ Nova (بخش ۱۱.۳ قواعد)
    const novaVer = FM.tc.version();
    if (novaVer && compareVer(novaVer, FM_REQUIRES_NOVA_MIN) < 0) {
      console.warn(
        `[FM] Nova Heartbeat ${novaVer} < required ${FM_REQUIRES_NOVA_MIN} — plugin lock unavailable`,
      );
      fmLog(
        "WARN",
        `Nova ${novaVer} is older than required ${FM_REQUIRES_NOVA_MIN} — update Nova core`,
      );
    }

    // ⭐ پاک‌سازی تسک‌های orphaned در boot
    setTimeout(() => {
      const fmNow = fmState();
      const liveRunId = fmNow.runInProgress?.id || null;
      let n = 0;
      if (liveRunId) {
        // run فعال وجود دارد → فقط تسک‌های runهای دیگر (orphan) پاک می‌شوند
        n = cancelOrphanedFarmTasks(liveRunId);
      } else if (fmNow._endOfRunHandled || !fmNow.runInProgress) {
        // هیچ run فعالی نیست → تسک‌های farm باقی‌مانده از runهای تمام‌شده
        n = cancelAllFarmTasks("boot-no-active-run");
      }
      if (n > 0) {
        fmLog("INFO", `Boot cleanup: cancelled ${n} farm task(s)`);
      }
    }, 3000);

    installPublicApi(TC);

    attachMapObserver();
    attachRallyObserver();
    if (!FM.tc.version()) {
      console.warn("[FM] Nova Heartbeat not found — Farm Manager disabled");
      return;
    }
    live();
    fmLog("INFO", "ready v" + FM_VERSION);
  })();
})();
