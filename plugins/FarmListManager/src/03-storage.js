  // ─────────────────────────────────────────────────────────────
  // Storage — independent of Nova state, key: travian_farm_list_manager_v1
  // Shape:
  // {
  //   _version: 1,
  //   settings: { profile: "normal" },
  //   lists: { [listId]: { lastRunAt, lastRunBy: villageId, lastRunStatus, lastRunCount, lastImportAt } },
  //   backups: [ { ts, reason, data } ]   // max 5
  // }
  // ─────────────────────────────────────────────────────────────
  const BACKUP_MAX = 5;
  const BACKUP_TTL_MS = 24 * 60 * 60 * 1000;

  function defaultFLMData() {
    return {
      _version: FLM_STORAGE_VERSION,
      settings: { profile: "normal" },
      lists: {},
      backups: [],
    };
  }

  let _cache = null;
  let _lastRaw = null;

  function _normalizeFLMData(raw) {
    const base = defaultFLMData();
    if (!raw || typeof raw !== "object") return base;
    const out = base;
    if (raw.settings && typeof raw.settings === "object") {
      out.settings.profile = raw.settings.profile === "paranoid" || raw.settings.profile === "fast" ? raw.settings.profile : "normal";
    }
    if (raw.lists && typeof raw.lists === "object") {
      for (const [id, meta] of Object.entries(raw.lists)) {
        if (!meta || typeof meta !== "object") continue;
        out.lists[String(id)] = {
          lastRunAt: Number(meta.lastRunAt) || 0,
          lastRunBy: meta.lastRunBy ? String(meta.lastRunBy) : null,
          lastRunStatus: meta.lastRunStatus ? String(meta.lastRunStatus) : null,
          lastRunCount: Number(meta.lastRunCount) || 0,
          lastRunVillage: meta.lastRunVillage ? String(meta.lastRunVillage) : null,
          lastRunStatusText: meta.lastRunStatusText ? String(meta.lastRunStatusText) : null,
          lastImportAt: Number(meta.lastImportAt) || 0,
          lastImportStatus: meta.lastImportStatus ? String(meta.lastImportStatus) : null,
          lastImportMode: meta.lastImportMode ? String(meta.lastImportMode) : null,
          lastImportCounts: meta.lastImportCounts && typeof meta.lastImportCounts === "object"
            ? {
                total: Number(meta.lastImportCounts.total) || 0,
                done: Number(meta.lastImportCounts.done) || 0,
                failed: Number(meta.lastImportCounts.failed) || 0,
                skipped: Number(meta.lastImportCounts.skipped) || 0,
                deleted: Number(meta.lastImportCounts.deleted) || 0,
              }
            : null,
        };
      }
    }
    if (Array.isArray(raw.backups)) {
      out.backups = raw.backups.filter((b) => b && typeof b === "object").slice(-BACKUP_MAX);
    }
    return out;
  }

  function readFLMData() {
    let rawStr = null;
    try {
      rawStr = localStorage.getItem(FLM_STORAGE_KEY);
    } catch (e) {
      rawStr = null;
    }
    if (_cache && rawStr === _lastRaw) return _cache;
    let parsed = null;
    if (rawStr) {
      try {
        parsed = JSON.parse(rawStr);
      } catch (e) {
        flmLog("WARN", "Corrupted FLM storage — falling back to defaults");
        parsed = null;
      }
    }
    _cache = _normalizeFLMData(parsed);
    _lastRaw = rawStr;
    return _cache;
  }

  function writeFLMData(data) {
    const d = _normalizeFLMData(data);
    d._version = FLM_STORAGE_VERSION;
    try {
      const str = JSON.stringify(d);
      localStorage.setItem(FLM_STORAGE_KEY, str);
      _cache = d;
      _lastRaw = str;
      return true;
    } catch (e) {
      flmLog("ERROR", "Failed to write FLM storage", e);
      return false;
    }
  }

  function mutateFLMData(fn) {
    const d = readFLMData();
    fn(d);
    return writeFLMData(d);
  }

  function listMeta(listId) {
    const d = readFLMData();
    return d.lists[String(listId)] || null;
  }

  function setListMeta(listId, patchObj) {
    mutateFLMData((d) => {
      const key = String(listId);
      d.lists[key] = Object.assign(
        {
          lastRunAt: 0,
          lastRunBy: null,
          lastRunStatus: null,
          lastRunCount: 0,
          lastImportAt: 0,
          lastImportCount: 0,
          lastImportMode: null,
        },
        d.lists[key] || {},
        patchObj || {},
      );
    });
  }

  function pruneBackups() {
    mutateFLMData((d) => {
      const cutoff = now() - BACKUP_TTL_MS;
      d.backups = (d.backups || []).filter((b) => Number(b.ts) > cutoff).slice(-BACKUP_MAX);
    });
  }

  function pushFLMBackup(reason) {
    const d = readFLMData();
    const snapshot = { _version: d._version, settings: { ...d.settings }, lists: JSON.parse(JSON.stringify(d.lists)) };
    mutateFLMData((x) => {
      const cutoff = now() - BACKUP_TTL_MS;
      x.backups = (x.backups || []).filter((b) => Number(b.ts) > cutoff);
      x.backups.push({ ts: now(), reason: String(reason || "manual"), data: snapshot });
      if (x.backups.length > BACKUP_MAX) x.backups = x.backups.slice(-BACKUP_MAX);
    });
  }

  function flmRequiresNovaCheck() {
    const v = FLM.tc.version();
    if (!v) return { ok: false, reason: "Nova Heartbeat not detected on this page" };
    if (compareVer(v, FLM_REQUIRES_NOVA_MIN) < 0)
      return { ok: false, reason: `Nova ${v} is older than required ${FLM_REQUIRES_NOVA_MIN}` };
    return { ok: true, reason: `Nova ${v}`, version: v };
  }
