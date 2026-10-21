  // ─────────────────────────────────────────────────────────────
  // Runner — starts a farm list by clicking Travian's own Start button.
  // A list is only startable when the server allows it (not full/inactive
  // and at least one active slot), so we never force it: we click, then
  // wait for the status text / wrapper class to change.
  // ─────────────────────────────────────────────────────────────
  const RUN_STATUS = {
    IDLE: "idle",
    STARTING: "starting",
    RUNNING: "running",
    DONE: "done",
    FAILED: "failed",
  };

  const _runs = new Map(); // listId -> { status, startedAt, finishedAt, message }

  function getRunState(listId) {
    return _runs.get(String(listId)) || { status: RUN_STATUS.IDLE, startedAt: 0, finishedAt: 0, message: "" };
  }

  function _setRunState(listId, patchObj) {
    const key = String(listId);
    const next = Object.assign({}, getRunState(key), patchObj);
    _runs.set(key, next);
    return next;
  }

  function isListRunning(listId) {
    const st = getRunState(listId).status;
    return st === RUN_STATUS.STARTING || st === RUN_STATUS.RUNNING;
  }

  function anyRunActive() {
    for (const v of _runs.values()) {
      if (v.status === RUN_STATUS.STARTING || v.status === RUN_STATUS.RUNNING) return true;
    }
    return false;
  }

  // Travian marks a started list with `started` on the wrapper and replaces the
  // status text ("Farm list started" / remaining time). Either signal counts.
  function _listStartedSignal(listId, prevStatusText) {
    const list = getListById(listId);
    if (!list) return false;
    if (list.wrapper.classList.contains("started")) return true;
    if (list.statusText && list.statusText !== prevStatusText) return true;
    return false;
  }

  function lastRunSummary(list) {
    if (!list.lastRunAt) return { text: "never", cls: "never", ago: null };
    const ago = now() - list.lastRunAt;
    return { text: formatElapsed(ago), cls: ago < 6 * 3600 * 1000 ? "recent" : "old", ago };
  }

  // Stale-run janitor: a "starting" state older than 60s is considered lost
  // (page reload mid-start), so we reset it instead of blocking the button.
  function sweepRunStates() {
    const t = now();
    for (const [key, v] of _runs) {
      if (v.status === RUN_STATUS.STARTING && t - v.startedAt > 60000) {
        _setRunState(key, { status: RUN_STATUS.FAILED, finishedAt: t, message: "start timed out" });
      } else if (v.status === RUN_STATUS.DONE && t - (v.finishedAt || v.startedAt) > 5 * 60000) {
        _runs.delete(key);
      }
    }
  }

  async function startList(listId, opts) {
    const key = String(listId);
    if (!isFarmListPage()) return { ok: false, error: "Not on the farm-list page" };
    if (_importing) return { ok: false, error: "An import is running — wait for it to finish." };
    if (isListRunning(key)) return { ok: false, error: "This list is already starting." };

    const list = getListById(key);
    if (!list) return { ok: false, error: "List #" + key + " is not rendered" };
    if (!list.startBtn) return { ok: false, error: "Start button not found for this list" };
    if (list.startDisabled) {
      return { ok: false, error: "Travian reports this list as not startable (empty / inactive / no troops)" };
    }
    if (!list.used) return { ok: false, error: "List has no active slots" };

    const prevStatus = list.statusText;
    _setRunState(key, { status: RUN_STATUS.STARTING, startedAt: now(), finishedAt: 0, message: "" });
    flmLog("INFO", `Starting farm list "${list.name}" (#${key}) of ${list.villageName || "?"}`);

    try {
      const click = await humanClick(list.startBtn);
      if (!click.ok) throw new Error("Start button not clickable (" + click.reason + ")");

      const confirmed = await waitFor(() => _listStartedSignal(key, prevStatus), 6000, 120);
      if (!confirmed.ok && isConfirmDialogVisible()) {
        const btn = confirmDialogButton();
        if (btn) {
          await humanClick(btn);
          await waitFor(() => _listStartedSignal(key, prevStatus), 6000, 120);
        }
      }

      const nowList = getListById(key) || list;
      const started =
        nowList.wrapper.classList.contains("started") || (nowList.statusText && nowList.statusText !== prevStatus);
      const status = started ? RUN_STATUS.RUNNING : RUN_STATUS.DONE;

      // listMeta() is null for a list with no history yet — merge via setListMeta.
      const meta = listMeta(key) || {};
      setListMeta(key, {
        lastRunAt: now(),
        lastRunStatus: started ? "started" : "unknown",
        lastRunVillage: nowList.villageName || meta.lastRunVillage || "",
        lastRunBy: (opts && opts.by) || "manual",
        lastRunCount: nowList.targetsCount,
        lastRunStatusText: nowList.statusText || "",
      });

      _setRunState(key, { status, message: nowList.statusText || "" });
      flmLog("INFO", `Farm list "${nowList.name}" started.`);
      try {
        showToast(`Started "${nowList.name}" (${nowList.targetsCount} targets)`, "ok");
      } catch (e) {}
      try {
        if (typeof onDataChanged === "function") onDataChanged();
      } catch (e) {}
      return { ok: true, status, list: nowList };
    } catch (e) {
      const msg = String((e && e.message) || e);
      _setRunState(key, { status: RUN_STATUS.FAILED, finishedAt: now(), message: msg });
      flmLog("ERROR", `Start failed for "${list.name}": ${msg}`);
      try {
        showToast(`Start failed: ${msg}`, "err");
      } catch (err) {}
      return { ok: false, error: msg };
    }
  }

  // Starts every startable list found on the page (per village, DOM order).
  async function startAllVisible(opts) {
    const lists = scanFarmLists().filter((l) => l.canStart);
    if (!lists.length) return { ok: false, started: 0, total: 0, errors: ["No startable list found"] };
    flmLog("INFO", `Start all: ${lists.length} startable list(s) found`);
    let started = 0;
    const errors = [];
    for (const l of lists) {
      if (isImporting()) break;
      const r = await startList(l.id, opts);
      if (r.ok) started++;
      else errors.push(`${l.name}: ${r.error}`);
      await delay(rnd(IMPORT_STEP_DELAY_MS));
    }
    return { ok: started > 0, started, total: lists.length, errors };
  }
