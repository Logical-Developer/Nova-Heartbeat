  // ─────────────────────────────────────────────────────────────
  // Importer — drives Travian's own dialogs (no direct API calls).
  //
  // Add single target:
  //   td.addTarget a  →  dialog opens (#farmListTargetForm)
  //   → select[name=listId].value = listId (+ change)
  //   → input[name=x] / input[name=y]  (React needs native setter + input event)
  //   → button.save becomes enabled   → click
  //   → dialog closes
  //
  // Bulk delete (replace mode):
  //   every input.selectOne[data-slot-id] in the list → click (select all)
  //   → .farmListFooter button.openContextMenu → .contextMenu button.entry.delete
  //   → Travian confirmation dialog → confirm
  // ─────────────────────────────────────────────────────────────
  let _importing = false;
  let _importSignal = null;
  let _importStats = null;

  function isImporting() {
    return _importing;
  }
  function getImportStats() {
    return _importStats ? { ..._importStats, steps: _importStats.steps.slice() } : null;
  }
  function cancelImport(reason) {
    if (!_importing || !_importSignal) return false;
    _importSignal.cancel();
    flmLog("WARN", "Import cancel requested: " + (reason || "user"));
    return true;
  }

  function _step(stats, kind, label, extra) {
    const entry = Object.assign({ ts: now(), kind, label }, extra || {});
    stats.steps.push(entry);
    if (stats.steps.length > 400) stats.steps.shift();
    const icon = kind === "ok" ? "✓" : kind === "skip" ? "⏭" : kind === "fail" ? "✗" : kind === "warn" ? "!" : "·";
    flmLog(kind === "fail" ? "WARN" : "INFO", `[import ${stats.done + stats.failed + stats.skipped}/${stats.total}] ${icon} ${label}`);
  }

  async function openAddTargetDialog(list, signal, stats) {
    let wrapper = findListWrapper(list.id);
    if (!wrapper) {
      _step(stats, "fail", `List ${list.id} not found in DOM`);
      return false;
    }
    let anchor = wrapper.querySelector("table.slots td.addTarget a");
    if (!anchor) {
      _step(stats, "fail", `List ${list.id} has no "Add target" row`);
      return false;
    }
    // Make sure the list is expanded so the dialog is anchored properly
    const listWrapperEl = wrapper;
    if (listWrapperEl.classList.contains("collapsed")) {
      const exp = listWrapperEl.querySelector(".farmListHeader a.expandCollapse");
      if (exp) await humanClick(exp, signal);
      await waitFor(() => !wrapper.classList.contains("collapsed"), 1500, 80);
      anchor = wrapper.querySelector("table.slots td.addTarget a");
    }
    await humanClick(anchor, signal);
    const opened = await waitFor(() => !!targetForm(), DIALOG_OPEN_TIMEOUT_MS, 80);
    if (!opened.ok) {
      _step(stats, "fail", `Add-target dialog did not open for ${list.name}`);
      await closeAnyDialog();
      return false;
    }
    // The form mounts before React fills the list <select>. Do not let the
    // caller touch the popup until at least one real option exists.
    const formReady = await waitFor(() => {
      const s = dialogListSelect();
      return !!s && !!s.options && s.options.length > 0;
    }, 2000, 80);
    if (!formReady.ok) {
      _step(stats, "fail", `dialog did not render list options for ${list.name}`);
      await closeAnyDialog();
      return false;
    }
    await waitFor(() => !!dialogSaveButton(), 1200, 60);
    return true;
  }

  // The popup <select> is a React controlled component. Accepting a value
  // requires (1) the native HTMLSelectElement setter — otherwise React's value
  // tracker swallows it, (2) an `input` AND a `change` event (both bubbling),
  // and (3) the target <option> actually being rendered. No keyboard events
  // are needed for a select (unlike a text input, which needs char-by-char).
  async function setDialogListId(listId, signal) {
    const want = String(listId);

    // 1) wait for the <select> itself to be in the DOM
    const selRes = await waitFor(() => !!dialogListSelect(), 1500, 60);
    if (!selRes.ok) {
      flmLog("WARN", `select[name=listId] never appeared in the dialog (list #${want})`);
      return false;
    }
    if (signal && signal.cancelled) return false;

    // 2) React renders <option> nodes asynchronously after the dialog mounts —
    //    wait until the option we want actually exists (not just "some option").
    const optRes = await waitFor(() => {
      const s = dialogListSelect();
      if (!s || !s.options) return false;
      const all = Array.from(s.options);
      const real = all.filter((o) => o.value);
      return real.length > 0 && all.some((o) => String(o.value) === want);
    }, 2000, 80);
    if (!optRes.ok) {
      // Fail loudly with the option values we did see — this is the difference
      // between "list not on this page" and "options rendered too late".
      const s = dialogListSelect();
      const seen = s && s.options ? Array.from(s.options).map((o) => String(o.value)).join(",") : "none";
      flmLog("WARN", `dialog <select> never offered list #${want}; options=[${seen}]`);
      return false;
    }
    if (signal && signal.cancelled) return false;

    // 3) already correct → nothing to do (React may have preselected it)
    const sel = dialogListSelect();
    if (!sel) return false;
    if (String(sel.value) === want) return true;

    // 4) native select setter, then both events (bubbling)
    setNativeValueSelect(sel, want);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    // 5) short settle + verify the value actually stuck
    await delay(rnd(IMPORT_STEP_RETRY_MS));
    const sel2 = dialogListSelect();
    const ok = !!sel2 && String(sel2.value) === want;
    if (!ok) flmLog("WARN", `dialog <select> rejected #${want} (value stayed "${sel2 ? sel2.value : "n/a"}")`);
    return ok;
  }

  async function fillCoordinates(x, y, signal) {
    const xi = dialogXInput();
    if (!xi) return { ok: false, reason: "no-x-input" };
    await humanType(xi, String(x), signal);
    if (signal && signal.cancelled) return { ok: false, reason: "cancelled" };
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    let yi = dialogYInput();
    if (!yi) return { ok: false, reason: "no-y-input" };
    await humanType(yi, String(y), signal);
    if (signal && signal.cancelled) return { ok: false, reason: "cancelled" };
    // Force the validation cycle: blur y, then re-dispatch change on both
    yi.dispatchEvent(new Event("change", { bubbles: true }));
    xi.dispatchEvent(new Event("change", { bubbles: true }));
    yi.blur();
    return { ok: true };
  }

  function classifyValidation() {
    const txt = dialogTargetValidationText().toLowerCase();
    if (!txt) return { kind: "none", text: "" };
    if (txt.includes("already") || txt.includes("exists")) return { kind: "dup", text: txt };
    if (txt.includes("coordinate") || txt.includes("village name") || txt.includes("enter"))
      return { kind: "empty", text: txt };
    return { kind: "error", text: txt };
  }

  async function waitSaveEnabled(signal) {
    let last = null;
    const res = await waitFor(
      () => {
        if (isSaveEnabled()) return true;
        last = classifyValidation();
        return false;
      },
      SAVE_ENABLE_TIMEOUT_MS,
      100,
    );
    return { ok: res.ok, waited: res.waited, validation: last };
  }

  // Adds a single target through the dialog. Returns a result object:
  //   { status: "ok" | "dup" | "invalid" | "timeout" | "error" | "cancelled", message }
  async function addTargetViaDialog(listId, target, signal) {
    const list = getListById(listId);
    if (!list) return { status: "error", message: "list is not in the DOM" };
    // Never open a second popup on top of a stale one: findListWrapper() would
    // resolve a different anchor while the old dialog is still mounted.
    if (isDialogVisible()) await closeAnyDialog();
    await delay(rnd([80, 200]));

    const stats = _importStats || { steps: [], total: 0, done: 0, failed: 0, skipped: 0 };
    const opened = await openAddTargetDialog(list, signal, stats);
    if (!opened) return { status: "error", message: "dialog did not open" };

    // Save can exist before React has populated the <select> options and the
    // x/y inputs — selecting the list or typing too early would be dropped.
    const initialised = await waitFor(() => {
      const sel = dialogListSelect();
      return !!sel && !!sel.options && sel.options.length > 0;
    }, 1500, 60);
    if (!initialised.ok) {
      await closeAnyDialog();
      return { status: "error", message: "dialog did not initialise" };
    }

    const listSet = await setDialogListId(listId, signal);
    if (!listSet) {
      await closeAnyDialog();
      return { status: "error", message: "could not select list #" + listId + " in the dialog" };
    }

    const inputsReady = await waitFor(() => {
      const xi = dialogXInput();
      const yi = dialogYInput();
      return !!xi && !!yi && !xi.disabled && !yi.disabled;
    }, 1200, 60);
    if (!inputsReady.ok) {
      await closeAnyDialog();
      return { status: "error", message: "dialog did not initialise" };
    }

    const filled = await fillCoordinates(target.x, target.y, signal);
    if (!filled.ok) {
      await closeAnyDialog();
      return { status: filled.reason === "cancelled" ? "cancelled" : "error", message: filled.reason };
    }

    // Travian's client-side validation already knows the village is in the
    // list. Without this check the save button never enables and we would burn
    // SAVE_ENABLE_TIMEOUT_MS and report a misleading "timeout".
    const preValid = classifyValidation();
    if (preValid.kind === "dup") {
      await closeAnyDialog();
      return { status: "dup", message: "already in list (client validation)" };
    }

    const enabled = await waitSaveEnabled(signal);
    if (!enabled.ok) {
      const v = enabled.validation || classifyValidation();
      await closeAnyDialog();
      if (v.kind === "dup") return { status: "dup", message: "already in list (Travian validation)" };
      if (v.kind === "error" && v.text) return { status: "invalid", message: v.text };
      return { status: "timeout", message: "Save stayed disabled for " + SAVE_ENABLE_TIMEOUT_MS + "ms" };
    }

    const save = dialogSaveButton();
    await humanClick(save, signal);
    const closed = await waitDialogClosed(DIALOG_CLOSE_TIMEOUT_MS);
    if (!closed.ok) {
      // Travian shows a native confirm for "village already in raid list" when
      // the server rejects it (race with our pre-check). Accept, or abort.
      if (isConfirmDialogVisible()) {
        const btn = confirmDialogButton();
        if (btn) await humanClick(btn, signal);
        const closed2 = await waitDialogClosed(DIALOG_CLOSE_TIMEOUT_MS);
        if (closed2.ok) return { status: "ok", message: "added (force-confirmed)" };
      }
      await closeAnyDialog();
      return { status: "error", message: "dialog did not close after Save" };
    }
    // Wait for the list to re-render with the new slot
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    return { status: "ok", message: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Replace mode — delete every slot of the list via Travian's own
  // bulk-delete context menu (selectAll → openContextMenu → delete →
  // confirmation dialog → confirm).
  // ─────────────────────────────────────────────────────────────
  function listContextMenuButton(wrapper) {
    return (
      wrapper.querySelector(".farmListFooter button.openContextMenu") ||
      wrapper.querySelector("table.slots thead th.contextMenu button.openContextMenu") ||
      wrapper.querySelector("table.slots thead th.contextMenu")
    );
  }

  function findVisibleContextMenuEntry(textHint) {
    const candidates = $$(".contextMenu .entry, .contextMenu li, .contextMenu a.entry, [class*='contextMenu'] [class*='entry']");
    const want = String(textHint || "").toLowerCase();
    for (const el of candidates) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (want && !String(el.textContent || "").toLowerCase().includes(want)) continue;
      return el;
    }
    // Fallback: class-based lookup (minified React components keep class names)
    return (
      $$(".contextMenu .entry.delete, .contextMenu button.delete, [class*='contextMenu'] .delete").find((el) => {
        const st = getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden";
      }) || null
    );
  }

  async function selectAllSlots(wrapper, signal) {
    const boxes = $$("table.slots tbody tr.slot input.selectOne", wrapper).filter(
      (cb) => !cb.disabled && !cb.checked,
    );
    for (const cb of boxes) {
      if (signal && signal.cancelled) return false;
      cb.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, buttons: 1 }));
      cb.click();
      await delay(rnd([40, 120]));
    }
    // Some builds only react to the header "select all" checkbox
    const still = $$("table.slots tbody tr.slot input.selectOne:not(:checked)", wrapper).length;
    if (still > 0) {
      const all = wrapper.querySelector("table.slots thead input[data-check-all]");
      if (all) {
        all.click();
        await delay(rnd([120, 260]));
      }
    }
    return true;
  }

  async function deleteAllSlotsInList(listId, signal) {
    const wrapper = findListWrapper(listId);
    if (!wrapper) return { status: "error", message: "list is not in the DOM" };
    const rows = $$("table.slots tbody tr.slot", wrapper);
    if (!rows.length) return { status: "ok", message: "list already empty", deleted: 0 };

    if (isDialogVisible()) await closeAnyDialog();
    if (isConfirmDialogVisible()) {
      const c = confirmDialogCancelButton();
      if (c) await humanClick(c, signal);
      await waitFor(() => !isConfirmDialogVisible(), 1500, 80);
    }

    const waitStart = await waitFor(() => !!findListWrapper(listId), SLOT_COUNT_TIMEOUT_MS, 150);
    if (!waitStart.ok) return { status: "error", message: "list wrapper not ready" };

    await selectAllSlots(wrapper, signal);
    if (signal && signal.cancelled) return { status: "cancelled", message: "cancelled" };

    const menuBtn = listContextMenuButton(wrapper);
    if (!menuBtn) return { status: "error", message: "context-menu button not found" };
    await humanClick(menuBtn, signal);

    let entry = null;
    const menuOpened = await waitFor(() => {
      entry = findVisibleContextMenuEntry("delete");
      return !!entry;
    }, DELETE_CONTEXT_TIMEOUT_MS, 80);
    if (!menuOpened.ok || !entry) {
      await document.body.click();
      return { status: "error", message: "delete entry not found in context menu" };
    }

    await humanClick(entry, signal);
    await waitFor(() => isConfirmDialogVisible(), DELETE_CONTEXT_TIMEOUT_MS, 80);
    const confirmBtn = confirmDialogButton();
    if (!confirmBtn) {
      await closeAnyDialog();
      return { status: "error", message: "delete confirmation dialog not shown" };
    }
    await humanClick(confirmBtn, signal);

    const emptied = await waitFor(() => {
      const w = findListWrapper(listId);
      if (!w) return false;
      return $$("table.slots tbody tr.slot", w).length === 0;
    }, DELETE_APPLY_TIMEOUT_MS, 200);
    if (!emptied.ok) {
      const left = slotCountInDom(listId);
      return { status: "error", message: "slots still present after delete (" + left + ")" };
    }
    await delay(rnd(IMPORT_STEP_DELAY_MS));
    return { status: "ok", message: "", deleted: rows.length };
  }

  // ─────────────────────────────────────────────────────────────
  // Orchestrator — runs a whole import for one list.
  //   opts = { mode: "append"|"replace", dupMode: "skip"|"force"|"abort" }
  // Returns a report object that the UI shows and we persist in meta.
  // ─────────────────────────────────────────────────────────────
  function newImportStats(listId, mode) {
    return {
      listId: String(listId),
      mode,
      startedAt: now(),
      finishedAt: 0,
      total: 0,
      done: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      deleted: 0,
      status: "running",
      steps: [],
      errors: [],
    };
  }

  async function ensureListExpanded(listId, signal) {
    let list = getListById(listId);
    if (!list) return null;
    if (list.wrapper.classList.contains("expanded")) return list;
    const exp = list.wrapper.querySelector(".farmListHeader a.expandCollapse");
    if (!exp) return list;
    await humanClick(exp, signal);
    await waitFor(() => {
      const l = getListById(listId);
      return !!l && l.wrapper.classList.contains("expanded");
    }, 1500, 80);
    return getListById(listId) || list;
  }

  function prepareIncoming(list, parsed, mode, dupMode, stats) {
    let incoming = parsed.targets.slice();
    const cap = capacityCheck(list, incoming.length, mode);
    if (!cap.ok) {
      if (mode === IMPORT_MODE.APPEND && cap.overflow > 0 && cap.free > 0) {
        incoming = incoming.slice(0, cap.free);
        stats.errors.push(`Truncated to ${incoming.length} target(s) to fit free slots.`);
        flmLog("WARN", `Import truncated to ${incoming.length} target(s) (capacity).`);
      } else {
        throw new Error(cap.message);
      }
    }
    if (mode === IMPORT_MODE.APPEND) {
      const dup = analyzeDuplicates(incoming, list.targets);
      stats.duplicates = dup.duplicateCount;
      if (dup.duplicateCount) {
        if (dupMode === DUP_MODE.ABORT) throw new Error(`Aborted: ${dup.duplicateCount} duplicate(s) found`);
        incoming = dup.fresh;
      }
    }
    return incoming;
  }

  async function addOneWithRetry(listId, t, signal, stats) {
    const label = `(${t.x}|${t.y})${t.name ? " " + t.name : ""}`;
    let res = null;
    for (let attempt = 1; attempt <= IMPORT_MAX_ATTEMPTS; attempt++) {
      res = await addTargetViaDialog(listId, t, signal);
      if (res.status === "ok" || res.status === "dup" || res.status === "cancelled") break;
      if (attempt < IMPORT_MAX_ATTEMPTS) {
        _step(stats, "warn", `${label}: ${res.message} — retry ${attempt + 1}/${IMPORT_MAX_ATTEMPTS}`);
        await delay(rnd(IMPORT_STEP_RETRY_MS));
      }
    }
    if (!res) res = { status: "error", message: "no result" };
    if (res.status === "ok") {
      stats.done++;
      _step(stats, "ok", label + (res.message ? " — " + res.message : ""));
    } else if (res.status === "dup") {
      stats.skipped++;
      stats.duplicates++;
      _step(stats, "skip", label + " — duplicate (" + res.message + ")");
    } else if (res.status !== "cancelled") {
      stats.failed++;
      stats.errors.push(label + ": " + res.message);
      _step(stats, "fail", label + " — " + res.message);
    }
    return res.status;
  }

  async function runImport(listId, parsed, opts) {
    if (_importing) return { ok: false, error: "An import is already running." };
    const mode = opts && opts.mode === IMPORT_MODE.REPLACE ? IMPORT_MODE.REPLACE : IMPORT_MODE.APPEND;
    const dupMode = (opts && opts.dupMode) || DUP_MODE.SKIP;

    _importing = true;
    _importSignal = createSignal();
    const signal = _importSignal;
    const stats = newImportStats(listId, mode);
    _importStats = stats;

    try {
      if (!isFarmListPage()) throw new Error("Not on the farm-list page");
      flmLog("INFO", `Import started: list #${listId}, mode=${mode}, targets=${parsed.targets.length}`);

      const list = await ensureListExpanded(listId, signal);
      if (!list) throw new Error("List #" + listId + " is not rendered");

      const incoming = prepareIncoming(list, parsed, mode, dupMode, stats);
      if (!incoming.length) {
        stats.status = "done";
        stats.errors.push("Nothing to add — every target was already present.");
        return finishImport(stats, listId);
      }
      stats.total = incoming.length;

      if (mode === IMPORT_MODE.REPLACE) {
        _step(stats, "info", `Clearing list "${list.name}"…`);
        const del = await deleteAllSlotsInList(listId, signal);
        if (del.status !== "ok") {
          stats.status = del.status === "cancelled" ? "cancelled" : "failed";
          stats.errors.push("Delete step: " + del.message);
          return finishImport(stats, listId);
        }
        stats.deleted = del.deleted || 0;
        _step(stats, "ok", `Deleted ${stats.deleted} slot(s)`);
      }

      for (let i = 0; i < incoming.length; i++) {
        if (signal.cancelled) break;
        const st = await addOneWithRetry(listId, incoming[i], signal, stats);
        if (st === "cancelled") break;
        await delay(rnd(IMPORT_STEP_DELAY_MS));
      }

      if (signal.cancelled) stats.status = "cancelled";
      else if (stats.failed && !stats.done) stats.status = "failed";
      else if (stats.failed) stats.status = "partial";
      else stats.status = "done";
      return finishImport(stats, listId);
    } catch (e) {
      stats.status = "failed";
      stats.errors.push(String((e && e.message) || e));
      flmLog("ERROR", "Import failed: " + ((e && e.message) || e));
      return finishImport(stats, listId);
    } finally {
      _importing = false;
      _importSignal = null;
    }
  }

  function finishImport(stats, listId) {
    stats.finishedAt = now();
    try {
      if (isConfirmDialogVisible()) {
        const c = confirmDialogCancelButton();
        if (c) c.click();
      }
      if (isDialogVisible()) closeAnyDialog();
    } catch (e) {}
    // setListMeta merges with defaults, so it is null-safe for a list that has
    // never been touched before (listMeta() returns null in that case).
    setListMeta(listId, {
      lastImportAt: stats.finishedAt,
      lastImportStatus: stats.status,
      lastImportMode: stats.mode || null,
      lastImportCounts: {
        total: stats.total,
        done: stats.done,
        failed: stats.failed,
        skipped: stats.skipped,
        deleted: stats.deleted,
      },
    });
    const summary = `Import ${stats.status}: ${stats.done}/${stats.total} added, ${stats.skipped} skipped, ${stats.failed} failed`;
    flmLog(stats.status === "done" ? "INFO" : "WARN", summary);
    for (const er of stats.errors) flmLog("WARN", "  · " + er);
    try {
      // The summary is multi-part and worth reading — keep it up longer than a
      // one-line confirmation (success 9s, anything else 12s).
      showToast(
        summary,
        stats.status === "done" ? "ok" : stats.status === "failed" ? "err" : "warn",
        stats.status === "done" ? IMPORT_TOAST_OK_MS : IMPORT_TOAST_MS,
      );
    } catch (e) {}
    try {
      if (typeof onDataChanged === "function") onDataChanged();
    } catch (e) {}
    return stats;
  }
