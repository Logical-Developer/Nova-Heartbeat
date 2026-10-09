  // ─────────────────────────────────────────────────────────────
  // Storage
  // ─────────────────────────────────────────────────────────────
  function readFMData() {
    try {
      const raw = localStorage.getItem(FM_STORAGE_KEY);
      if (!raw) return defaultFarmData();
      const d = JSON.parse(raw);
      const def = defaultFarmData();
      for (const k in def) if (!(k in d)) d[k] = def[k];
      if (!d.settings) d.settings = def.settings;
      if (d.settings.soundEnabled === undefined)
        d.settings.soundEnabled = false;
      if (d.settings.notificationsEnabled === undefined)
        d.settings.notificationsEnabled = true;
      if (d.settings.restoreHeartbeatAfterRun === undefined)
        d.settings.restoreHeartbeatAfterRun = true;
      if (d.settings.profile === undefined) d.settings.profile = "normal";
      if (!d.byVillage) d.byVillage = {};
      if (!d.runs) d.runs = [];
      if (d.runInProgress === undefined) d.runInProgress = null;
      if (!d.backups) d.backups = [];
      if (d._heartbeatWasEnabled === undefined) d._heartbeatWasEnabled = null;
      if (d._pendingFinalReport === undefined) d._pendingFinalReport = null;
      if (d._navigateToTt0AfterRun === undefined)
        d._navigateToTt0AfterRun = false;
      if (d._endOfRunHandled === undefined) d._endOfRunHandled = false;
      if (d._activeRunId === undefined) d._activeRunId = null;
      // ⭐ فاز ۲
      if (d.cooldown === undefined) d.cooldown = null;
      if (d._navigateToTt0At === undefined) d._navigateToTt0At = 0;
      if (d._lastShownReportRunId === undefined) d._lastShownReportRunId = null;

      for (const vid in d.byVillage) {
        const bucket = d.byVillage[vid];
        if (bucket?.lists) {
          for (const l of bucket.lists) {
            if (!l.cooldown) {
              l.cooldown = {
                enabled: true,
                minAttacks: 7,
                maxAttacks: 10,
                minDelayMs: 3000,
                maxDelayMs: 5000,
              };
            }
            if (l.autoFill === undefined) l.autoFill = "fillAvailable";
          }
        }
      }
      return d;
    } catch (e) {
      fmLog("ERROR", "read failed", e);
      return defaultFarmData();
    }
  }
  function writeFMData(d) {
    try {
      d._version = FM_STORAGE_VERSION;
      d._updatedAt = now();
      localStorage.setItem(FM_STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      fmLog("ERROR", "write failed", e);
    }
  }
  function fmPatch(fn) {
    const d = readFMData();
    fn(d);
    writeFMData(d);
  }
  function defaultFarmData() {
    return {
      _version: FM_STORAGE_VERSION,
      _updatedAt: 0,
      enabled: true,
      settings: {
        waveDelayMs: 2500,
        maxWavesPerRun: 100,
        heroFollow: false,
        autoEnableHeartbeat: true,
        restoreHeartbeatAfterRun: true,
        soundEnabled: false,
        notificationsEnabled: true,
        profile: "normal",
      },
      byVillage: {},
      runs: [],
      runInProgress: null,
      backups: [],
      _heartbeatWasEnabled: null,
      _pendingFinalReport: null,
      _navigateToTt0AfterRun: false,
      _endOfRunHandled: false,
      _activeRunId: null,
      // ⭐ فاز ۲
      cooldown: null,
      _navigateToTt0At: 0,
      _lastShownReportRunId: null,
    };
  }
  function fmState() {
    return readFMData();
  }

  function ensureVillageBucket(vid) {
    const vidStr = String(vid);
    let bucket = readFMData().byVillage[vidStr];
    if (bucket) return bucket;
    fmPatch((fm) => {
      if (!fm.byVillage[vidStr]) {
        fm.byVillage[vidStr] = {
          lists: [],
          activeListId: null,
          lastRunAt: 0,
          snapshot: null,
          snapshotAt: 0,
        };
      }
    });
    return readFMData().byVillage[vidStr];
  }

  function makeBackup(reason) {
    fmPatch((fm) => {
      const snapshot = {
        at: now(),
        reason: reason || "auto",
        byVillage: JSON.parse(JSON.stringify(fm.byVillage)),
        settings: JSON.parse(JSON.stringify(fm.settings)),
      };
      fm.backups = fm.backups || [];
      fm.backups.unshift(snapshot);
      fm.backups = fm.backups.slice(0, 5);
    });
  }

  function migrateFromNovaState(TC) {
    try {
      const s = TC.state();
      const old = s.plugins?.[FM_NS];
      if (!old) return false;
      const existing = readFMData();
      const hasData = Object.keys(existing.byVillage || {}).length > 0;
      if (hasData) return false;
      fmPatch((fm) => {
        fm.enabled = old.enabled !== false;
        if (old.settings) fm.settings = { ...fm.settings, ...old.settings };
        fm.byVillage = old.byVillage || {};
        fm.runs = old.runs || [];
        fm.runInProgress = old.runInProgress || null;
      });
      fmLog("INFO", "migrated from Nova state →", FM_STORAGE_KEY);
      return true;
    } catch (e) {
      fmLog("WARN", "migration failed", e);
      return false;
    }
  }

  function migrateV17ToV18() {
    const OLD_KEY = "travian_farm_manager_data_v17";
    const NEW_KEY = "travian_farm_manager_data_v18";
    try {
      const raw = localStorage.getItem(OLD_KEY);
      if (!raw) return false;
      if (localStorage.getItem(NEW_KEY)) return false;
      const old = JSON.parse(raw);
      old._version = 18;
      localStorage.setItem(NEW_KEY, JSON.stringify(old));
      return true;
    } catch (e) {
      return false;
    }
  }
