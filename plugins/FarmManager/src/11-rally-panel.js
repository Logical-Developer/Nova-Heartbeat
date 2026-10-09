  // ─────────────────────────────────────────────────────────────
  // Rally Page Detection
  // ─────────────────────────────────────────────────────────────
  function isRallyOverview() {
    const u = new URL(location.href);
    return (
      u.pathname.includes("build.php") &&
      u.searchParams.get("gid") === "16" &&
      u.searchParams.get("tt") === "1"
    );
  }
  function isRallyManagement() {
    const u = new URL(location.href);
    if (!u.pathname.includes("build.php")) return false;
    if (u.searchParams.get("gid") !== "16") return false;
    const tt = u.searchParams.get("tt");
    return tt === "0" || tt === null || tt === "";
  }
  function isRallySend() {
    const u = new URL(location.href);
    return (
      u.pathname.includes("build.php") &&
      u.searchParams.get("gid") === "16" &&
      u.searchParams.get("tt") === "2"
    );
  }
  function isRallyTt0() {
    const u = new URL(location.href);
    if (!u.pathname.includes("build.php")) return false;
    if (u.searchParams.get("gid") !== "16") return false;
    const tt = u.searchParams.get("tt");
    return tt === "0" || tt === null || tt === "";
  }
  // ⭐ 2.1.2 (باگ #۲): هر تب صفحهٔ کلوبخشی (tt=0 / tt=1 / tt=2 یا بدون tt).
  // بعد از کلیک نهایی «Send troops»، Travian به tt=1 برمی‌گردد، نه tt=2 — و
  // ناوبری به گزارش نهایی فقط از tt=2 انجام می‌شد، پس کاربر در tt=1 گیر می‌کرد.
  function isRallyAnyTab() {
    return isRallyTt0() || isRallyOverview() || isRallySend();
  }
  function shouldShowFarmPanel() {
    return isRallyTt0();
  }

  function renderRallyRunStatus() {
    let panel = document.getElementById("fm-run-status");
    const run = fmState().runInProgress;
    if (!isRallySend() || !run) {
      if (panel) panel.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "fm-run-status";
      panel.style.cssText =
        "position:fixed;top:108px;left:8px;right:8px;z-index:2147483647;margin:0 auto;max-width:900px;padding:8px 10px;background:linear-gradient(180deg,rgba(249,251,255,.98),rgba(232,239,249,.98));border:2px solid #8a9ac0;border-radius:6px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;box-shadow:0 3px 10px rgba(0,0,0,.25);box-sizing:border-box;pointer-events:none;";
      document.body.appendChild(panel);
    }

    const vid = String(FM.tc.village() || "");
    if (run.sourceVid !== vid) {
      panel.remove();
      return;
    }
    const total = Math.max(
      run.planned || 0,
      (run.resumeTargetIds || []).length,
    );
    const done = (run.sent || 0) + (run.failed || 0) + (run.skipped || 0);
    const remaining = Math.max(0, total - done);
    const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    panel.innerHTML = `<div style="display:flex;align-items:center;gap:12px;"><div style="flex:1;min-width:0;"><div style="font-weight:bold;margin-bottom:3px;">${esc(run.listName)} · ${done}/${total} attacks · ${remaining} remaining</div><div style="height:7px;background:#d0d8e8;border-radius:4px;overflow:hidden;"><div style="width:${percent}%;height:100%;background:linear-gradient(90deg,#7ab04a,#4a7a30);transition:width .3s;"></div></div><div style="font-size:10px;color:#5a6a80;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(run.currentTarget || "Preparing next attack")} · ${run.sent || 0} sent, ${run.failed || 0} failed, ${run.skipped || 0} skipped</div></div><button type="button" class="fm-run-stop" style="flex-shrink:0;padding:8px 14px;background:linear-gradient(180deg,#d04a30,#a03020);color:#fff;border:1px solid #601010;border-radius:5px;font-weight:bold;cursor:pointer;pointer-events:auto;">Stop</button></div>`;
    panel.querySelector(".fm-run-stop").onclick = pauseActiveRun;
  }

  function pauseActiveRun() {
    const run = fmState().runInProgress;
    if (!run) return;
    const taskState = FM.tc.state();
    const activeFarm = taskState.currentJob?.payload?.farm;
    const currentTargetId =
      run.currentTargetId ||
      (activeFarm?.runId === run.id ? activeFarm.targetId : null);
    fmPatch((fm) => {
      const list = fm.byVillage[run.sourceVid]?.lists.find(
        (item) => item.id === run.listId,
      );
      if (list) savePausedRun(list, run);
    });
    clearPendingRunKey();
    // ⭐ باگ #۱ / A5-2: تنها نقطهٔ تغییر وضعیت
    transitionRun(RUN_STATUS.IDLE, { runId: run.id });
    // ⭐ X4: فقط تسک‌های همین run (شامل job جاری)
    cancelFarmTasksOfRun(run.id, true);
    closeCooldownModal();
    clearCooldownFreeze();
    restoreHeartbeatAfterRun();
    fmLog(
      "INFO",
      `Run paused manually: ${run.listName}, target=${currentTargetId || "none"}`,
    );
    // ⭐ A5-1: ناوبری با newdid تا اعلان «Paused» در همان روستا دیده شود
    goToReport(run.sourceVid);
  }

  function openEditTargetDialog(srcVid, listId, targetId, onSave) {
    const data = readFMData();
    const list = data.byVillage[String(srcVid)]?.lists.find(
      (l) => l.id === listId,
    );
    const target = list?.targets.find((t) => t.id === targetId);
    if (!target) return;
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
    const dialog = document.createElement("div");
    dialog.style.cssText = `background:linear-gradient(180deg,#f9fbff,#e8eff9);border:1px solid #8a9ac0;border-radius:6px;padding:14px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;max-width:${MAX_WIDTH}px;width:100%;box-shadow:0 6px 30px rgba(0,0,0,.4);`;
    const currentTroops = target.troops || list.troops;
    const currentHeroFollow =
      target.heroFollow !== undefined
        ? target.heroFollow
        : list.heroFollow === true;
    dialog.innerHTML = `
      <div style="font-weight:bold;color:#2a4a70;margin-bottom:8px;font-size:14px;">
        Edit (v${FM_VERSION}): ${esc(target.name)} (${target.x}|${target.y})
      </div>
      <div style="margin-bottom:6px;font-size:10px;color:#5a6a80;">
        Override troops for this target. Leave as is to use list template.
      </div>
      <div class="fm-edit-troops" style="padding:8px;background:rgba(255,255,255,.6);border-radius:4px;margin-bottom:8px;"></div>
      <label style="display:block;font-size:11px;margin-bottom:8px;">
        <input type="checkbox" class="fm-edit-hero" ${currentHeroFollow ? "checked" : ""}> Hero follows
      </label>
      <label style="display:block;font-size:11px;margin-bottom:8px;">
        Troop fill policy:
        <select class="fm-edit-autofill" style="padding:2px 4px;font-size:11px;">
          <option value="default">Use list setting</option>
          <option value="fillAvailable">Fill available (partial)</option>
          <option value="requireExact">Require exact count</option>
        </select>
      </label>
      <div style="margin-bottom:8px;font-size:11px;">
        <label>Notes: <input type="text" class="fm-edit-notes" value="${esc(target.notes || "")}" maxlength="100" style="width:calc(100% - 50px);padding:3px;font-size:11px;"></label>
      </div>
      <div style="display:flex;gap:6px;">
        <button type="button" class="fm-edit-save" style="flex:1;padding:6px 10px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:4px;font-weight:bold;cursor:pointer;">Save</button>
        <button type="button" class="fm-edit-reset" style="padding:6px 10px;background:#f0d0c0;border:1px solid #b07050;border-radius:4px;cursor:pointer;">Reset to template</button>
        <button type="button" class="fm-edit-cancel" style="padding:6px 10px;background:#ddd;border:1px solid #999;border-radius:4px;cursor:pointer;">Cancel</button>
      </div>
    `;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    const troopsBox = dialog.querySelector(".fm-edit-troops");
    troopsBox.innerHTML = troopGridHTML(
      currentTroops,
      currentHeroFollow,
      18,
      "fm-edit-t-",
    );
    attachNumericFilter(troopsBox);
    const heroChk = dialog.querySelector(".fm-edit-hero");
    const autofillSel = dialog.querySelector(".fm-edit-autofill");
    if (autofillSel) autofillSel.value = target.autoFill || "default";
    heroChk.onchange = () => {
      const on = heroChk.checked;
      const heroInp = troopsBox.querySelector(".fm-edit-t-t11");
      if (heroInp) {
        heroInp.disabled = !on;
        if (!on) heroInp.value = 0;
        else if (!parseInt(heroInp.value, 10)) heroInp.value = 1;
      }
    };
    dialog.querySelector(".fm-edit-save").onclick = () => {
      const troops = {};
      Object.keys(TROOP_LABELS).forEach((k) => {
        const inp = troopsBox.querySelector(".fm-edit-t-" + k);
        let v = inp ? parseInt(inp.value, 10) : 0;
        if (isNaN(v) || v < 0) v = 0;
        troops[k] = v;
      });
      if (!heroChk.checked) troops.t11 = 0;
      const notes = dialog.querySelector(".fm-edit-notes").value.trim();
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (l) => l.id === listId,
        );
        if (!ll) return;
        const t = ll.targets.find((x) => x.id === targetId);
        if (!t) return;
        const isSameAsTemplate =
          Object.keys(TROOP_LABELS).every(
            (k) => (troops[k] | 0) === (ll.troops[k] | 0),
          ) && heroChk.checked === (ll.heroFollow === true);
        t.troops = isSameAsTemplate ? null : { ...troops };
        t.heroFollow = heroChk.checked;
        t.notes = notes;
        t.invalid = false;
        // ⭐ باگ #۳: override سطح هدف برای autoFill
        const af = autofillSel ? autofillSel.value : "default";
        t.autoFill =
          af === "requireExact" || af === "fillAvailable" ? af : undefined;
      });
      overlay.remove();
      if (onSave) onSave();
    };
    dialog.querySelector(".fm-edit-reset").onclick = () => {
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (l) => l.id === listId,
        );
        if (!ll) return;
        const t = ll.targets.find((x) => x.id === targetId);
        if (!t) return;
        t.troops = null;
        t.heroFollow = undefined;
        t.autoFill = undefined;
      });
      overlay.remove();
      if (onSave) onSave();
    };
    dialog.querySelector(".fm-edit-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
  }

  function openExportModal(srcVid, listId) {
    const list = fmState().byVillage[String(srcVid)]?.lists.find(
      (item) => item.id === listId,
    );
    if (!list?.targets.length) {
      alert("Nothing to export");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "fm-export-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;";
    const modal = document.createElement("div");
    modal.style.cssText = `background:linear-gradient(180deg,#f9fbff,#e8eff9);border:2px solid #8a9ac0;border-radius:8px;padding:16px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;max-width:600px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto;`;
    modal.innerHTML = `
      <div style="font-weight:bold;font-size:16px;color:#2a4a70;text-align:center;margin-bottom:8px;">Export List (v${FM_VERSION})</div>
      <div style="text-align:center;font-size:12px;margin-bottom:10px;">Formats: <b>JSON</b></div>
      <div style="margin-bottom:8px;color:#5a6a80;">List: <b>${esc(list.name)}</b></div>
      <label style="display:block;margin-bottom:8px;"><input type="checkbox" class="fm-export-selected"> Export selected targets only</label>
      <textarea class="fm-export-json" readonly spellcheck="false" style="width:100%;height:240px;padding:8px;font-family:'Courier New',monospace;font-size:11px;border:1px solid #8a9ac0;border-radius:3px;box-sizing:border-box;resize:vertical;background:#fff;"></textarea>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button type="button" class="fm-export-copy" style="flex:1;padding:8px 12px;background:linear-gradient(180deg,#6a9ee8,#3060b0);color:#fff;border:1px solid #204080;border-radius:4px;font-weight:bold;cursor:pointer;">Copy</button>
        <button type="button" class="fm-export-download" style="flex:1;padding:8px 12px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:4px;font-weight:bold;cursor:pointer;">Download</button>
        <button type="button" class="fm-export-cancel" style="padding:8px 12px;background:#ddd;border:1px solid #999;border-radius:4px;cursor:pointer;">Cancel</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const selectedOnly = modal.querySelector(".fm-export-selected");
    const jsonInput = modal.querySelector(".fm-export-json");
    const updateJson = () => {
      jsonInput.value =
        exportListCompact(srcVid, listId, selectedOnly.checked) || "";
    };
    selectedOnly.onchange = updateJson;
    updateJson();

    modal.querySelector(".fm-export-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(jsonInput.value);
      } catch (e) {
        jsonInput.focus();
        jsonInput.select();
        if (!document.execCommand("copy")) {
          showToast("Copy failed", "warn");
          return;
        }
      }
      showToast("JSON copied", "ok");
    };
    modal.querySelector(".fm-export-download").onclick = () => {
      const blob = new Blob([jsonInput.value], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (list.name || "list").replace(/[^a-z0-9_-]/gi, "_");
      link.href = url;
      link.download = `farm-list-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 100);
      showToast("JSON downloaded", "ok");
    };
    modal.querySelector(".fm-export-cancel").onclick = () => overlay.remove();
    overlay.onclick = (event) => {
      if (event.target === overlay) overlay.remove();
    };
  }

  function openImportModal(srcVid, onDone) {
    let overlay = document.getElementById("fm-import-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "fm-import-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;";
    const modal = document.createElement("div");
    modal.style.cssText = `background:linear-gradient(180deg,#f9fbff,#e8eff9);border:2px solid #8a9ac0;border-radius:8px;padding:16px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;max-width:600px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto;`;
    const bucket = fmState().byVillage[String(srcVid)];
    const listsOptions = (bucket.lists || [])
      .map(
        (l) =>
          `<option value="${esc(l.id)}">${esc(l.name)} (${l.targets.length})</option>`,
      )
      .join("");
    modal.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-weight:bold;font-size:16px;color:#2a4a70;">Import List (v${FM_VERSION})</span>
        <a href="#" class="fm-import-close" style="margin-left:auto;text-decoration:none;color:#a03020;font-size:22px;font-weight:bold;line-height:1;">×</a>
      </div>
      <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,.5);border-radius:4px;">
        <div style="font-weight:bold;color:#2a4a70;font-size:11px;margin-bottom:6px;">📁 From File</div>
        <input type="file" class="fm-import-file" accept=".json,.txt,application/json,text/plain" style="font-size:11px;">
        <div class="fm-import-file-info" style="margin-top:6px;font-size:10px;color:#6a7a98;"></div>
      </div>
      <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,.5);border-radius:4px;">
        <div style="font-weight:bold;color:#2a4a70;font-size:11px;margin-bottom:6px;">📋 Or Paste Text</div>
        <div style="font-size:10px;color:#6a7a98;margin-bottom:6px;">
          Formats: JSON (farm-list-v1) · Plain text <code>-78|-78 VillageName</code>
        </div>
        <textarea class="fm-import-text" placeholder="-78|-78 Aldeia do Griever
-77|-76 Got's village 02" style="width:100%;height:120px;padding:6px;font-family:'Courier New',monospace;font-size:11px;border:1px solid #8a9ac0;border-radius:3px;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
      <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,.5);border-radius:4px;">
        <div style="font-weight:bold;color:#2a4a70;font-size:11px;margin-bottom:8px;">🎯 Target List</div>
        <label style="display:block;margin-bottom:6px;">
          <input type="radio" name="fm-import-mode" value="new" checked>
          <b>New list</b>
        </label>
        <div style="margin-left:24px;margin-bottom:8px;">
          <label style="font-size:11px;">Name:
            <input type="text" class="fm-import-newlist-name" placeholder="Imported List" style="width:200px;padding:3px;font-size:11px;border:1px solid #8a9ac0;border-radius:3px;">
          </label>
        </div>
        <label style="display:block;margin-bottom:6px;">
          <input type="radio" name="fm-import-mode" value="existing" ${bucket.lists.length ? "" : "disabled"}>
          <b>Add to existing list</b> ${bucket.lists.length ? "" : '<span style="color:#888;font-size:10px;">(no lists)</span>'}
        </label>
        <label style="display:block;margin-bottom:6px;">
          <input type="radio" name="fm-import-mode" value="remove" ${bucket.lists.length ? "" : "disabled"}>
          <b>Remove villages with losses</b>
        </label>
        <div style="margin-left:24px;">
          <select class="fm-import-target-list" style="width:100%;padding:3px;font-size:11px;border:1px solid #8a9ac0;border-radius:3px;" disabled>
            ${listsOptions}
          </select>
        </div>
      </div>
      <div class="fm-import-preview" style="margin-bottom:12px;padding:10px;background:rgba(200,220,240,.4);border-radius:4px;display:none;font-size:11px;">
        <div style="font-weight:bold;color:#2a4a70;margin-bottom:6px;">ℹ Preview:</div>
        <div class="fm-import-preview-content"></div>
      </div>
      <div class="fm-import-msg" style="margin-bottom:8px;font-size:11px;padding:6px;border-radius:3px;display:none;"></div>
      <div style="display:flex;gap:6px;">
        <button type="button" class="fm-import-do" style="flex:1;padding:8px 12px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:4px;font-weight:bold;cursor:pointer;font-size:13px;">✓ Import</button>
        <button type="button" class="fm-import-cancel" style="padding:8px 12px;background:#ddd;border:1px solid #999;border-radius:4px;cursor:pointer;">Cancel</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const fileInput = modal.querySelector(".fm-import-file");
    const fileInfo = modal.querySelector(".fm-import-file-info");
    const textArea = modal.querySelector(".fm-import-text");
    const msgEl = modal.querySelector(".fm-import-msg");
    const previewEl = modal.querySelector(".fm-import-preview");
    const previewContent = modal.querySelector(".fm-import-preview-content");
    const newListNameInput = modal.querySelector(".fm-import-newlist-name");
    const targetListSelect = modal.querySelector(".fm-import-target-list");
    const modeRadios = modal.querySelectorAll('input[name="fm-import-mode"]');

    function currentMode() {
      for (const r of modeRadios) if (r.checked) return r.value;
      return "new";
    }
    function currentTargetListId() {
      return currentMode() === "existing" || currentMode() === "remove"
        ? targetListSelect.value
        : null;
    }
    function updateModeUI() {
      const m = currentMode();
      newListNameInput.disabled = m !== "new";
      targetListSelect.disabled = m !== "existing" && m !== "remove";
      modal.querySelector(".fm-import-do").textContent =
        m === "remove" ? "Remove matching targets" : "✓ Import";
    }
    function refreshPreview() {
      const text = textArea.value.trim();
      if (!text) {
        previewEl.style.display = "none";
        return;
      }
      const mode = currentMode();
      const targetId = currentTargetListId();
      if ((mode === "existing" || mode === "remove") && !targetId) {
        previewEl.style.display = "none";
        return;
      }
      if (mode === "remove") {
        const preview = previewLossRemoval(text, srcVid, targetId);
        // ⭐ فاز ۳ (باگ #۳): برخلاف قبل، Preview در حالت remove هرگز پنهان
        // نمی‌شود — خطای پارس هم در همین کادر نمایش داده می‌شود.
        previewEl.style.display = "block";
        if (!preview.ok) {
          previewContent.innerHTML = `<div style="color:#a03020;">⚠ <b>${esc(preview.error)}</b></div>`;
          return;
        }
        let html = "";
        if (preview.format) {
          html += `<div style="color:#5a6a80;">Format: <b>${esc(preview.format)}</b>`;
          if (preview.jsonListName)
            html += ` · list: "<b>${esc(preview.jsonListName)}</b>"`;
          html += `</div>`;
        }
        html += `<div style="color:#a03020;">⚠ <b>${preview.matched}</b> matching targets will be removed from "${esc(preview.listName)}"</div>`;
        html += `<div style="color:#5a6a80;">${preview.notFound} coordinates not found in the selected list</div>`;
        html += `<div style="color:#5a6a80;">Total in file: <b>${preview.total}</b></div>`;
        if (preview.duplicates)
          html += `<div style="color:#8a7050;">${preview.duplicates} duplicate coordinates ignored</div>`;
        if (preview.invalid)
          html += `<div style="color:#a03020;">${preview.invalid} entries without valid coordinates ignored</div>`;
        previewContent.innerHTML = html;
        return;
      }
      const preview = previewImport(text, srcVid, mode, targetId);
      if (!preview.ok) {
        // ⭐ فاز ۳: خطای پارس هم در کادر Preview دیده شود (قبلاً بی‌صدا پنهان می‌شد)
        previewEl.style.display = "block";
        previewContent.innerHTML = `<div style="color:#a03020;">⚠ <b>${esc(preview.error)}</b></div>`;
        return;
      }
      previewEl.style.display = "block";
      let html = "";
      html += `<div style="color:#2a5a10;">✓ <b>${preview.newCount}</b> new targets will be added</div>`;
      if (preview.dupCount > 0)
        html += `<div style="color:#8a7050;">⚠ <b>${preview.dupCount}</b> duplicates (will skip)</div>`;
      if (preview.invalidCount > 0)
        html += `<div style="color:#a03020;">✗ <b>${preview.invalidCount}</b> invalid entries</div>`;
      html += `<div style="color:#5a6a80;margin-top:4px;">Total in file: <b>${preview.totalInFile}</b></div>`;
      if (mode === "existing" && preview.jsonListName && targetId) {
        const targetList = fmState().byVillage[String(srcVid)]?.lists?.find(
          (l) => l.id === targetId,
        );
        if (targetList && preview.jsonListName !== targetList.name) {
          html += `<div style="color:#8a7050;margin-top:6px;padding:4px 6px;background:rgba(255,220,180,.4);border-radius:3px;font-size:10px;">ℹ JSON name: "<b>${esc(preview.jsonListName)}</b>" (ignored — targets go to "<b>${esc(targetList.name)}</b>")</div>`;
        }
      }
      previewContent.innerHTML = html;
    }

    for (const r of modeRadios)
      r.onchange = () => {
        updateModeUI();
        refreshPreview();
      };
    targetListSelect.onchange = refreshPreview;
    textArea.oninput = refreshPreview;

    fileInput.onchange = () => {
      const f = fileInput.files?.[0];
      if (!f) {
        fileInfo.textContent = "";
        return;
      }
      fileInfo.textContent = `Selected: ${f.name} (${f.size} bytes)`;
      const reader = new FileReader();
      reader.onload = () => {
        textArea.value = reader.result;
        fileInfo.textContent = `Selected: ${f.name} — loaded below`;
        refreshPreview();
      };
      reader.readAsText(f);
    };

    function showMsg(text, ok) {
      msgEl.style.display = "block";
      msgEl.style.background = ok
        ? "rgba(200,240,200,.6)"
        : "rgba(240,200,200,.6)";
      msgEl.style.color = ok ? "#2a5a10" : "#7a2010";
      msgEl.textContent = text;
    }

    modal.querySelector(".fm-import-do").onclick = () => {
      const text = textArea.value.trim();
      if (!text) {
        showMsg("Nothing to import", false);
        return;
      }
      const mode = currentMode();
      const targetId = currentTargetListId();
      if (mode === "remove") {
        if (!targetId) {
          showMsg("Please select a target list", false);
          return;
        }
        const preview = previewLossRemoval(text, srcVid, targetId);
        if (!preview.ok) {
          showMsg("Failed: " + preview.error, false);
          return;
        }
        if (
          preview.matched &&
          !confirm(
            `Remove ${preview.matched} matching target(s) from "${preview.listName}"?\n\n${preview.notFound} coordinates will not be found. A backup will be created.`,
          )
        )
          return;
        const res = removeLossTargets(text, srcVid, targetId);
        if (!res.ok) {
          showMsg("Failed: " + res.error, false);
          return;
        }
        showMsg(
          `Removed ${res.removed} target(s); ${res.notFound} coordinates not found, ${res.invalid} invalid, ${res.duplicates} duplicate.`,
          true,
        );
        if (onDone)
          setTimeout(() => {
            overlay.remove();
            onDone({ ...res, mode: "remove" });
          }, 1000);
        return;
      }
      const newName = newListNameInput.value.trim();
      if (mode === "existing" && !targetId) {
        showMsg("Please select a target list", false);
        return;
      }
      const res = importListToTarget(text, srcVid, mode, targetId, newName);
      if (!res.ok) {
        showMsg("Failed: " + res.error, false);
        return;
      }
      let resultMsg = `Imported to "${res.listName}" — ${res.added} added`;
      if (res.dup > 0) resultMsg += `, ${res.dup} skipped (duplicates)`;
      if (res.invalid > 0) resultMsg += `, ${res.invalid} invalid`;
      showMsg(resultMsg, true);
      if (onDone)
        setTimeout(() => {
          overlay.remove();
          onDone({ ...res, mode });
        }, 1000);
    };

    modal.querySelector(".fm-import-cancel").onclick = () => overlay.remove();
    modal.querySelector(".fm-import-close").onclick = (e) => {
      e.preventDefault();
      overlay.remove();
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
    updateModeUI();
  }

  // ─────────────────────────────────────────────────────────────
  // Rally Panel — only in tt=0
  // ─────────────────────────────────────────────────────────────
  function injectFarmPanel() {
    if (!shouldShowFarmPanel()) {
      if (_fmPanelRef && _fmPanelRef.isConnected) _fmPanelRef.remove();
      _fmPanelRef = null;
      return;
    }

    const container = document.getElementById("build");
    if (!container) return;

    if (
      _fmPanelRef &&
      _fmPanelRef.isConnected &&
      container.contains(_fmPanelRef)
    )
      return;

    if (_fmPanelRef && _fmPanelRef.isConnected) {
      fmLog("INFO", "Removing stale farm panel");
      _fmPanelRef.remove();
    }
    document.querySelectorAll(".fm-panel").forEach((p) => p.remove());
    _fmPanelRef = null;

    const srcVid = FM.tc.village();
    if (!srcVid) return;
    ensureVillageBucket(srcVid);

    const wrap = document.createElement("div");
    wrap.className = "data fm-panel";
    wrap.style.cssText =
      "margin:14px 0;padding:12px;background:linear-gradient(180deg,#f9fbff,#e8eff9);border:1px solid #8a9ac0;border-radius:6px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;";
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span style="font-weight:bold;font-size:14px;color:#2a4a70;">Farm Manager (v${FM_VERSION})</span>
        <span style="font-size:10px;color:#6a7a98;">source: ${esc(FM.tc.villageLabel(srcVid))}</span>
        <button class="fm-btn fm-btn-copylog" title="Copy full log + state + diag" style="margin-left:auto;padding:2px 8px;background:linear-gradient(180deg,#a0c0e0,#6080b0);color:#fff;border:1px solid #4060a0;border-radius:3px;cursor:pointer;font-size:10px;">📋 Copy Log</button>
        <button class="fm-btn fm-btn-clearlog" title="Clear FM log buffer" style="padding:2px 8px;background:linear-gradient(180deg,#f0c0a0,#d09070);color:#fff;border:1px solid #a06040;border-radius:3px;cursor:pointer;font-size:10px;">🗑 Clear Log</button>
      </div>
      <div class="fm-paused-run-notice" style="display:none;margin-bottom:8px;padding:7px 9px;background:rgba(255,220,170,.45);border:1px solid #d09030;border-radius:4px;"></div>
      <div class="fm-tabs" style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;"></div>
      <div class="fm-list-toolbar" style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
        <button class="fm-btn fm-btn-new" style="padding:3px 8px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:3px;cursor:pointer;font-weight:bold;">+ New List</button>
        <button class="fm-btn fm-btn-rename" style="padding:3px 8px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;">Rename</button>
        <button class="fm-btn fm-btn-delete" style="padding:3px 8px;background:#f0d0c0;border:1px solid #b07050;border-radius:3px;cursor:pointer;">Delete</button>
        <button class="fm-btn fm-btn-export" style="padding:3px 8px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;">Export</button>
        <button class="fm-btn fm-btn-import" style="padding:3px 8px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;">Import</button>
        <label style="margin-left:auto;font-size:10px;">
          <input type="checkbox" class="fm-hero-global"> Hero follows
        </label>
      </div>
      <div class="fm-profile-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:10px;padding:6px 8px;background:rgba(255,255,255,.5);border-radius:3px;flex-wrap:wrap;">
        <label>Behavior: <select class="fm-profile-select" style="padding:2px 4px;font-size:11px;"><option value="fast">Fast</option><option value="normal">Normal</option><option value="paranoid">Paranoid</option></select></label>
        <label><input type="checkbox" class="fm-sound-toggle"> Sound on complete</label>
        <label><input type="checkbox" class="fm-notif-toggle"> Desktop notifications</label>
        <label title="If Heartbeat was OFF before the run, turn it back OFF when done"><input type="checkbox" class="fm-hb-restore-toggle"> Restore HB after run</label>
      </div>
      <div class="fm-cooldown-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:10px;padding:6px 8px;background:rgba(255,240,220,.5);border-radius:3px;flex-wrap:wrap;">
        <label style="font-weight:bold;">⏸ Cool Down:</label>
        <label><input type="checkbox" class="fm-cd-enabled"> Enabled</label>
        <label>Every
          <input type="number" class="fm-cd-min" min="1" max="50" value="7" style="width:44px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          -
          <input type="number" class="fm-cd-max" min="1" max="50" value="10" style="width:44px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          attacks
        </label>
        <label>Wait
          <input type="number" class="fm-cd-mindelay" min="1" max="60" value="3" style="width:44px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          -
          <input type="number" class="fm-cd-maxdelay" min="1" max="60" value="5" style="width:44px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          sec
        </label>
      </div>
      <div class="fm-troop-editor" style="padding:6px 8px;background:rgba(255,255,255,.5);border-radius:3px;margin-bottom:8px;"></div>
      <div class="fm-targets-toolbar" style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:10px;flex-wrap:wrap;">
        <button class="fm-btn fm-btn-selall" style="padding:2px 6px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;font-size:10px;">Select all</button>
        <button class="fm-btn fm-btn-selnone" style="padding:2px 6px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;font-size:10px;">Select none</button>
        <span style="margin-left:auto;color:#5a6a80;" class="fm-selected-info"></span>
        <label style="margin-left:8px;display:flex;gap:4px;align-items:center;">
          <span>Search:</span>
          <input type="text" class="fm-search-x" placeholder="X" inputmode="numeric" style="width:48px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          <input type="text" class="fm-search-y" placeholder="Y" inputmode="numeric" style="width:48px;padding:2px 4px;font-size:10px;border:1px solid #8a9ac0;border-radius:3px;">
          <button class="fm-btn-search" style="padding:2px 8px;background:linear-gradient(180deg,#a0c0e0,#6080b0);color:#fff;border:1px solid #4060a0;border-radius:3px;cursor:pointer;font-size:10px;">🔍 Search</button>
          <button class="fm-btn-search-clear" style="padding:2px 6px;background:#e0e0e0;border:1px solid #999;border-radius:3px;cursor:pointer;font-size:10px;">✕</button>
        </label>
      </div>
      <div class="fm-targets-wrap" style="max-height:400px;overflow-y:auto;border:1px solid #c0cde0;border-radius:3px;background:#fff;"></div>
      <div class="fm-list-action-summary" style="display:none;margin-top:5px;padding:5px 7px;background:rgba(200,240,200,.5);border-radius:3px;font-size:10px;color:#2a5a10;"></div>
      <div class="fm-runbar" style="margin-top:10px;display:flex;gap:6px;align-items:center;">
        <button class="fm-btn fm-btn-start" style="flex:1;padding:6px 10px;background:linear-gradient(180deg,#d04a30,#a03020);color:#fff;border:1px solid #601010;border-radius:4px;font-weight:bold;cursor:pointer;">Start Raid</button>
        <button class="fm-btn fm-btn-resume" style="flex:1;padding:6px 10px;background:linear-gradient(180deg,#d09030,#a06020);color:#fff;border:1px solid #603010;border-radius:4px;font-weight:bold;cursor:pointer;display:none;">Resume</button>
        <button class="fm-btn fm-btn-restart" style="padding:6px 10px;background:#e0e0e0;border:1px solid #999;border-radius:4px;cursor:pointer;display:none;">Restart All</button>
      </div>
      <div class="fm-progress" style="margin-top:8px;font-size:10px;font-family:'Courier New',monospace;color:#4a5a70;"></div>
      <div class="fm-diag" style="margin-top:6px;font-size:9px;font-family:'Courier New',monospace;color:#8a4a20;background:rgba(255,240,220,.5);padding:4px 6px;border-radius:3px;"></div>
    `;

    container.insertBefore(wrap, container.firstChild);
    _fmPanelRef = wrap;

    const tabsEl = wrap.querySelector(".fm-tabs");
    const troopEditor = wrap.querySelector(".fm-troop-editor");
    const targetsWrap = wrap.querySelector(".fm-targets-wrap");
    const listActionSummary = wrap.querySelector(".fm-list-action-summary");
    const pausedRunNotice = wrap.querySelector(".fm-paused-run-notice");
    const selInfoEl = wrap.querySelector(".fm-selected-info");
    const progressEl = wrap.querySelector(".fm-progress");
    const diagEl = wrap.querySelector(".fm-diag");
    const btnStart = wrap.querySelector(".fm-btn-start");
    const btnResume = wrap.querySelector(".fm-btn-resume");
    const btnRestart = wrap.querySelector(".fm-btn-restart");
    const btnNew = wrap.querySelector(".fm-btn-new");
    const btnRename = wrap.querySelector(".fm-btn-rename");
    const btnDelete = wrap.querySelector(".fm-btn-delete");
    const btnExport = wrap.querySelector(".fm-btn-export");
    const btnImport = wrap.querySelector(".fm-btn-import");
    const btnCopyLog = wrap.querySelector(".fm-btn-copylog");
    const btnClearLog = wrap.querySelector(".fm-btn-clearlog");
    const btnSelAll = wrap.querySelector(".fm-btn-selall");
    const btnSelNone = wrap.querySelector(".fm-btn-selnone");
    const heroGlobal = wrap.querySelector(".fm-hero-global");
    const profileSelect = wrap.querySelector(".fm-profile-select");
    const soundToggle = wrap.querySelector(".fm-sound-toggle");
    const notifToggle = wrap.querySelector(".fm-notif-toggle");
    const hbRestoreToggle = wrap.querySelector(".fm-hb-restore-toggle");
    const searchX = wrap.querySelector(".fm-search-x");
    const searchY = wrap.querySelector(".fm-search-y");

    const cdEnabled = wrap.querySelector(".fm-cd-enabled");
    const cdMin = wrap.querySelector(".fm-cd-min");
    const cdMax = wrap.querySelector(".fm-cd-max");
    const cdMinDelay = wrap.querySelector(".fm-cd-mindelay");
    const cdMaxDelay = wrap.querySelector(".fm-cd-maxdelay");

    let activeListId = fmState().byVillage[String(srcVid)].activeListId;

    function getBucket() {
      return fmState().byVillage[String(srcVid)];
    }
    function activeList() {
      const b = getBucket();
      if (!b.lists.length) return null;
      return b.lists.find((l) => l.id === activeListId) || b.lists[0];
    }
    function setActive(id) {
      if (id === activeListId) return;
      if (
        troopEditor.classList.contains("fm-template-dirty") &&
        !confirm("Discard unsaved template changes?")
      )
        return;
      activeListId = id;
      fmPatch((fm) => {
        fm.byVillage[String(srcVid)].activeListId = id;
      });
      renderAll();
    }
    function sortedTargets(list) {
      const arr = list.targets.slice();
      arr.sort((a, b) => {
        const da = a.distance == null ? 1e9 : a.distance;
        const db = b.distance == null ? 1e9 : b.distance;
        if (da !== db) return da - db;
        return (a.addedAt || 0) - (b.addedAt || 0);
      });
      return arr;
    }

    function renderPausedRunNotice() {
      const paused = getBucket().lists.filter((list) => list.pausedRun);
      if (!paused.length) {
        pausedRunNotice.style.display = "none";
        pausedRunNotice.innerHTML = "";
        return;
      }
      pausedRunNotice.style.display = "block";
      pausedRunNotice.innerHTML =
        '<div style="font-weight:bold;color:#805020;margin-bottom:5px;">One or more farm tasks were stopped</div>' +
        paused
          .map((list) => {
            const targetIds = new Set(list.pausedRun.targetIds || []);
            const targets = list.targets.filter((target) =>
              targetIds.has(target.id),
            );
            const remaining = targets.filter(
              (target) => target.status !== "sent" && target.invalid !== true,
            ).length;
            const total = Math.max(list.pausedRun.planned || 0, targets.length);
            return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;"><span style="flex:1;min-width:0;">${esc(list.name)} · ${total - remaining}/${total} completed · ${remaining} remaining</span><button type="button" data-fm-resume-paused="${esc(list.id)}" style="padding:4px 9px;background:linear-gradient(180deg,#d09030,#a06020);color:#fff;border:1px solid #603010;border-radius:3px;font-weight:bold;cursor:pointer;">Resume</button><button type="button" data-fm-cancel-paused="${esc(list.id)}" title="Cancel resume" aria-label="Cancel resume" style="width:26px;height:26px;padding:0;background:#f0d0c0;color:#8a2010;border:1px solid #b07050;border-radius:3px;font-size:18px;line-height:1;cursor:pointer;">×</button></div>`;
          })
          .join("");
      pausedRunNotice
        .querySelectorAll("[data-fm-resume-paused]")
        .forEach((button) => {
          button.onclick = () => {
            const listId = button.dataset.fmResumePaused;
            if (
              listId !== activeListId &&
              troopEditor.classList.contains("fm-template-dirty") &&
              !confirm("Discard unsaved template changes?")
            )
              return;
            activeListId = listId;
            fmPatch((fm) => {
              fm.byVillage[String(srcVid)].activeListId = listId;
            });
            renderAll();
            startRun("resume");
          };
        });
      pausedRunNotice
        .querySelectorAll("[data-fm-cancel-paused]")
        .forEach((button) => {
          button.onclick = () => {
            const listId = button.dataset.fmCancelPaused;
            const list = getBucket().lists.find((item) => item.id === listId);
            if (!list) return;
            if (
              !confirm(
                `Cancel the saved continuation for "${list.name}"? Use Restart All to send the list again from the beginning.`,
              )
            )
              return;
            fmPatch((fm) => {
              const targetList = fm.byVillage[String(srcVid)].lists.find(
                (item) => item.id === listId,
              );
              if (targetList) targetList.pausedRun = null;
            });
            renderAll();
          };
        });
    }

    btnCopyLog.onclick = () => copyFullLog();
    btnClearLog.onclick = () => clearLogBuffer();

    function renderTabs() {
      const b = getBucket();
      if (!b.lists.length) {
        tabsEl.innerHTML =
          '<span style="font-size:10px;color:#8a7050;font-style:italic;">No lists yet — create one</span>';
        return;
      }
      tabsEl.innerHTML = b.lists
        .map(
          (l) => `
        <div class="fm-tab" data-id="${esc(l.id)}" style="
          padding:4px 10px;border:1px solid ${l.id === activeListId ? "#2a5a10" : "#8a9ac0"};
          background:${l.id === activeListId ? "linear-gradient(180deg,#a0d070,#6aa040)" : "#f0f5ff"};
          color:${l.id === activeListId ? "#fff" : "#2a4a70"};
          border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold;"
          title="Double-click to rename">
          ${esc(l.name)} <span style="opacity:.7;">(${l.targets.length})</span>
        </div>
      `,
        )
        .join("");
      tabsEl.querySelectorAll(".fm-tab").forEach((el) => {
        el.onclick = () => setActive(el.dataset.id);
        el.ondblclick = (e) => {
          e.preventDefault();
          const l = getBucket().lists.find((x) => x.id === el.dataset.id);
          if (!l) return;
          startInlineRename(el, l);
        };
      });
    }

    function startInlineRename(el, list) {
      const originalHTML = el.innerHTML;
      el.innerHTML = "";
      const input = document.createElement("input");
      input.type = "text";
      input.value = list.name;
      input.maxLength = 40;
      input.style.cssText =
        "padding:2px 4px;font-size:10px;border:1px solid #2a5a10;border-radius:3px;width:110px;font-family:Verdana,sans-serif;";
      el.appendChild(input);
      input.focus();
      input.select();
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const newName = input.value.trim();
        if (newName && newName !== list.name) {
          fmPatch((fm) => {
            const ll = fm.byVillage[String(srcVid)].lists.find(
              (x) => x.id === list.id,
            );
            if (ll) ll.name = newName;
          });
          fmLog("INFO", "List renamed:", list.name, "→", newName);
        }
        renderAll();
      };
      input.onblur = commit;
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          committed = true;
          el.innerHTML = originalHTML;
          el.onclick = () => setActive(el.dataset.id);
          el.ondblclick = (e) => {
            e.preventDefault();
            const l2 = getBucket().lists.find((x) => x.id === el.dataset.id);
            if (l2) startInlineRename(el, l2);
          };
        }
      };
    }

    function loadCooldownUI() {
      const l = activeList();
      if (!l) return;
      const cd = l.cooldown || {
        enabled: true,
        minAttacks: 7,
        maxAttacks: 10,
        minDelayMs: 3000,
        maxDelayMs: 5000,
      };
      cdEnabled.checked = cd.enabled !== false;
      cdMin.value = cd.minAttacks || 7;
      cdMax.value = cd.maxAttacks || 10;
      cdMinDelay.value = Math.round((cd.minDelayMs || 3000) / 1000);
      cdMaxDelay.value = Math.round((cd.maxDelayMs || 5000) / 1000);
    }
    function saveCooldownUI() {
      const l = activeList();
      if (!l) return;
      const minA = Math.max(1, Math.min(50, parseInt(cdMin.value, 10) || 7));
      const maxA = Math.max(
        minA,
        Math.min(50, parseInt(cdMax.value, 10) || 10),
      );
      const minD = Math.max(
        1,
        Math.min(60, parseInt(cdMinDelay.value, 10) || 3),
      );
      const maxD = Math.max(
        minD,
        Math.min(60, parseInt(cdMaxDelay.value, 10) || 5),
      );
      cdMin.value = minA;
      cdMax.value = maxA;
      cdMinDelay.value = minD;
      cdMaxDelay.value = maxD;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll) {
          ll.cooldown = {
            enabled: cdEnabled.checked,
            minAttacks: minA,
            maxAttacks: maxA,
            minDelayMs: minD * 1000,
            maxDelayMs: maxD * 1000,
          };
        }
      });
    }
    cdEnabled.onchange = saveCooldownUI;
    cdMin.onchange = saveCooldownUI;
    cdMax.onchange = saveCooldownUI;
    cdMinDelay.onchange = saveCooldownUI;
    cdMaxDelay.onchange = saveCooldownUI;

    function renderTroopEditor() {
      const l = activeList();
      if (!l) {
        troopEditor.innerHTML = "";
        troopEditor.classList.remove("fm-template-dirty");
        return;
      }
      const hf = l.heroFollow === true;
      heroGlobal.checked = hf;
      troopEditor.innerHTML = `
        <div style="font-size:10px;color:#5a6a80;margin-bottom:4px;">
          Troops per attack (template):
          <b class="fm-troop-count" style="color:#2a5a10;margin-left:6px;">${esc(troopCountLabel(l))}</b>
          <span class="fm-template-status" style="margin-left:8px;color:#8a7050;"></span>
        </div>
        ${Object.keys(TROOP_LABELS)
          .map((k) => {
            const isHero = k === "t11";
            return `
            <label title="${esc(TROOP_LABELS[k])}" style="display:inline-flex;align-items:center;width:24%;margin:2px 0;font-size:10px;box-sizing:border-box;padding-right:4px;">
              <span style="display:inline-block;width:16px;font-weight:bold;">${k.replace("t", "")}</span>
              ${troopIconHTML(k, 16)}
              <span style="margin-left:2px;">${numericInputHTML("fm-t-" + k, l.troops[k] || 0, 40, isHero && !hf)}</span>
            </label>
          `;
          })
          .join("")}
        <div style="margin-top:6px;">
          <label title="Skip a target instead of sending fewer troops than the template" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#5a6a80;">
            <input type="checkbox" class="fm-autofill-exact" ${l.autoFill === "requireExact" ? "checked" : ""}> Require exact troop count
          </label>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button type="button" class="fm-btn fm-btn-save-template" style="flex:1;padding:6px 8px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:4px;font-weight:bold;cursor:pointer;">Save Template</button>
          <button type="button" class="fm-btn fm-btn-apply-template" style="flex:1;padding:6px 8px;background:linear-gradient(180deg,#6a9ee8,#3060b0);color:#fff;border:1px solid #204080;border-radius:4px;font-weight:bold;cursor:pointer;">Apply to selected targets</button>
        </div>
      `;
      attachNumericFilter(troopEditor);
      // ⭐ باگ #۳: autoFill حالا از UI قابل تنظیم است (قبلاً dead field بود)
      const exactChk = troopEditor.querySelector(".fm-autofill-exact");
      if (exactChk) {
        exactChk.onchange = () => {
          const value = exactChk.checked ? "requireExact" : "fillAvailable";
          fmPatch((fm) => {
            const list = fm.byVillage[String(srcVid)].lists.find(
              (item) => item.id === l.id,
            );
            if (list) list.autoFill = value;
          });
          fmLog("INFO", `autoFill for "${l.name}" -> ${value}`);
          showToast(
            value === "requireExact"
              ? "Exact troop count required (targets will be skipped if short)"
              : "Partial fill allowed",
            "ok",
          );
        };
      }
      function updateTemplateDirty() {
        const current = fmState().byVillage[String(srcVid)]?.lists.find(
          (item) => item.id === l.id,
        );
        if (!current) return;
        const dirty =
          Object.keys(TROOP_LABELS).some((key) => {
            const input = troopEditor.querySelector(".fm-t-" + key);
            return (
              input &&
              (parseInt(input.value, 10) || 0) !== (current.troops[key] | 0)
            );
          }) || heroGlobal.checked !== (current.heroFollow === true);
        troopEditor.classList.toggle("fm-template-dirty", dirty);
        troopEditor.querySelector(".fm-template-status").textContent = dirty
          ? "Unsaved changes"
          : "Saved";
        troopEditor.querySelector(".fm-btn-save-template").disabled = !dirty;
      }
      troopEditor.oninput = updateTemplateDirty;
      troopEditor.onchange = updateTemplateDirty;
      troopEditor.querySelector(".fm-btn-save-template").onclick = () => {
        const troops = {};
        for (const key of Object.keys(TROOP_LABELS)) {
          const input = troopEditor.querySelector(".fm-t-" + key);
          troops[key] = Math.max(0, parseInt(input?.value, 10) || 0);
        }
        if (!heroGlobal.checked) troops.t11 = 0;
        if (
          Object.values(troops).every((count) => count === 0) &&
          !confirm("Save a template with no troops?")
        )
          return;
        makeBackup(`save troops template for ${l.name}`);
        fmPatch((fm) => {
          const list = fm.byVillage[String(srcVid)].lists.find(
            (item) => item.id === l.id,
          );
          if (!list) return;
          list.troops = troops;
          list.heroFollow = heroGlobal.checked;
        });
        fmLog("INFO", "Troops template saved", l.name, troops);
        showToast("Template saved", "ok");
        renderAll();
      };
      troopEditor.querySelector(".fm-btn-apply-template").onclick = () => {
        if (troopEditor.classList.contains("fm-template-dirty")) {
          showToast("Save the template before applying it", "warn");
          return;
        }
        const selected = l.targets.filter(
          (target) => target.selected !== false,
        );
        if (!selected.length) {
          showToast("No selected targets", "warn");
          return;
        }
        const overrides = selected.filter(
          (target) => target.troops != null || target.heroFollow !== undefined,
        ).length;
        if (
          !confirm(
            `Apply this template to ${selected.length} selected target(s)? ${overrides} custom override(s) will be cleared.`,
          )
        )
          return;
        makeBackup(`apply template to ${selected.length} targets in ${l.name}`);
        fmPatch((fm) => {
          const list = fm.byVillage[String(srcVid)].lists.find(
            (item) => item.id === l.id,
          );
          if (!list) return;
          list.targets.forEach((target) => {
            if (target.selected === false) return;
            target.troops = null;
            target.heroFollow = undefined;
          });
        });
        showToast(`Template applied; ${overrides} override(s) cleared`, "ok");
        renderTargets();
        renderRunbar();
      };
      updateTemplateDirty();
      loadCooldownUI();
    }

    function renderTargets() {
      const l = activeList();
      if (!l) {
        targetsWrap.innerHTML =
          '<div style="padding:20px;text-align:center;color:#8a7050;font-style:italic;">No list selected</div>';
        return;
      }
      if (!l.targets.length) {
        targetsWrap.innerHTML =
          '<div style="padding:20px;text-align:center;color:#8a7050;font-style:italic;">Empty — add villages from the map</div>';
        return;
      }
      const sorted = sortedTargets(l);
      targetsWrap.innerHTML = sorted
        .map((t) => {
          const isInvalid = t.invalid === true;
          const badge = isInvalid
            ? "⊘"
            : t.status === "sent"
              ? "OK"
              : t.status === "partial"
                ? "!"
                : t.status === "failed"
                  ? "X"
                  : t.status === "skipped"
                    ? "–"
                    : "·";
          const last = t.lastRaid
            ? ` · ${t.lastRaid.status} @ ${new Date(t.lastRaid.at).toLocaleTimeString()}`
            : "";
          const partial = t.partialRemaining
            ? ` · remaining: ${Object.entries(t.partialRemaining)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k}:${v}`)
                .join(",")}`
            : "";
          const distStr =
            t.distance != null
              ? `<span style="color:#8a7050;font-weight:bold;">· ${t.distance}f</span>`
              : "";
          const playerStr = t.player
            ? `<span style="color:#6a7a98;">· ${esc(t.player)}</span>`
            : "";
          const invalidStr = isInvalid
            ? `<span style="color:#a03020;font-weight:bold;font-style:italic;">· INVALID</span>`
            : "";
          const troopsForDisplay = t.troops || l.troops;
          const troopsHtml = troopsInlineHTML(troopsForDisplay, 16);
          const karteHref = `/karte.php?x=${t.x}&y=${t.y}`;
          const bg = isInvalid
            ? "rgba(240,220,220,.5)"
            : t.status === "sent"
              ? "rgba(200,240,200,.4)"
              : t.status === "failed"
                ? "rgba(240,200,200,.4)"
                : t.status === "partial"
                  ? "rgba(240,220,180,.4)"
                  : "transparent";
          return `
          <div class="fm-target" data-id="${esc(t.id)}" style="
            display:flex;align-items:center;gap:6px;padding:4px 6px;
            border-bottom:1px dashed #c0cde0;font-size:10px;background:${bg};">
            <input type="checkbox" class="fm-target-cb" ${t.selected !== false ? "checked" : ""} style="margin:0;cursor:pointer;">
            <span style="font-family:monospace;font-weight:bold;width:20px;text-align:center;">${badge}</span>
            <span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;overflow:hidden;">
              <a href="${esc(karteHref)}" target="_blank" style="color:#2a4a70;text-decoration:none;font-weight:bold;white-space:normal;word-break:break-word;" title="Open on map">${esc(t.name)}</a>
              <span style="color:#6a7a98;flex-shrink:0;">(${t.x}|${t.y})</span>
              ${distStr}${playerStr}${invalidStr}${last}${partial}
            </span>
            <span style="display:inline-flex;align-items:center;gap:2px;flex-shrink:0;">${troopsHtml}</span>
            <button class="fm-target-edit" title="Edit" style="padding:0 5px;background:#e0e8f0;border:1px solid #8a9ac0;border-radius:3px;cursor:pointer;font-size:10px;">✎</button>
            <button class="fm-target-remove" title="Remove" style="padding:0 5px;background:#f0d0c0;border:1px solid #b07050;border-radius:3px;cursor:pointer;font-size:10px;">x</button>
          </div>
        `;
        })
        .join("");

      targetsWrap.querySelectorAll(".fm-target").forEach((rowEl) => {
        const id = rowEl.dataset.id;
        const cb = rowEl.querySelector(".fm-target-cb");
        if (cb) {
          cb.onchange = () => {
            fmPatch((fm) => {
              const ll = fm.byVillage[String(srcVid)].lists.find(
                (x) => x.id === l.id,
              );
              if (!ll) return;
              const t = ll.targets.find((x) => x.id === id);
              if (t) {
                t.selected = cb.checked;
                if (cb.checked) t.invalid = false;
              }
            });
            renderSelectedInfo();
            renderRunbar();
          };
        }
        const editBtn = rowEl.querySelector(".fm-target-edit");
        if (editBtn) {
          editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditTargetDialog(srcVid, l.id, id, () => {
              renderTargets();
              renderRunbar();
            });
          };
        }
        const removeBtn = rowEl.querySelector(".fm-target-remove");
        if (removeBtn) {
          removeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!confirm("Remove this target?")) return;
            fmPatch((fm) => {
              const ll = fm.byVillage[String(srcVid)].lists.find(
                (x) => x.id === l.id,
              );
              if (ll) ll.targets = ll.targets.filter((t) => t.id !== id);
            });
            renderAll();
          };
        }
      });
      renderSelectedInfo();
    }

    function renderSelectedInfo() {
      const l = activeList();
      if (!l) {
        selInfoEl.textContent = "";
        return;
      }
      const selected = l.targets.filter(
        (t) => t.selected !== false && !t.invalid,
      );
      const invalid = l.targets.filter((t) => t.invalid).length;
      selInfoEl.textContent = `${selected.length} / ${l.targets.length} selected${invalid ? " (" + invalid + " invalid)" : ""}`;
    }

    function renderRunbar() {
      const l = activeList();
      if (!l) {
        btnStart.style.display = "none";
        btnResume.style.display = "none";
        btnRestart.style.display = "none";
        return;
      }
      const selected = l.targets.filter(
        (t) => t.selected !== false && t.status !== "sent" && !t.invalid,
      );
      const allPending = l.targets.filter(
        (t) => t.status !== "sent" && !t.invalid,
      );
      const hasPending = allPending.length > 0;
      const hasDone = l.targets.some((t) => t.status === "sent");
      const hasPausedRun = !!l.pausedRun;
      if (hasPending) {
        btnStart.style.display = hasDone || hasPausedRun ? "none" : "block";
        btnResume.style.display = hasDone || hasPausedRun ? "block" : "none";
        btnRestart.style.display = hasDone || hasPausedRun ? "block" : "none";
        btnStart.textContent = `Start Raid (${selected.length})`;
        btnResume.textContent = `Resume (${selected.length} remaining)`;
      } else if (l.targets.length > 0) {
        btnStart.style.display = "none";
        btnResume.style.display = "none";
        btnRestart.style.display = "block";
      } else {
        btnStart.style.display = "block";
        btnResume.style.display = "none";
        btnRestart.style.display = "none";
        btnStart.textContent = "Start Raid (0)";
      }
    }

    function renderProgress() {
      const fm = fmState();
      if (!fm.runInProgress) {
        progressEl.textContent = "";
        return;
      }
      const r = fm.runInProgress;
      const total = r.planned;
      const done = r.sent + r.failed + r.skipped;
      const pct = total ? Math.round((done / total) * 100) : 0;
      progressEl.innerHTML = `
        <div style="height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#7ab04a,#4a7a30);"></div>
        </div>
        <div style="margin-top:3px;">
          Run ${esc(r.id.slice(-6))} — ${r.sent}/${total} sent · ${r.failed} failed · ${r.skipped} skipped
          ${r.currentTarget ? `<br>current: ${esc(r.currentTarget)} · ${esc(r.currentState || "")}` : ""}
        </div>
      `;
    }

    function renderDiag() {
      const s = FM.tc.state();
      const fm = fmState();
      const lines = [];
      lines.push(
        `HB=${s.heartbeat?.enabled} | frozen=${s.heartbeat?._frozenAt ? "YES(" + s.heartbeat._frozenReason + ")" : "no"}`,
      );
      lines.push(
        `job=${s.currentJob ? s.currentJob.plugin + "/" + s.currentJob.state : "null"}`,
      );
      lines.push(
        `queuedFarm=${(s.tasks || []).filter((t) => t.payload?.farm).length} | allTasks=${(s.tasks || []).length}`,
      );
      lines.push(
        `page=${FM.tc.page()} | tt=${new URL(location.href).searchParams.get("tt") || "-"}`,
      );
      if (fm.runInProgress) {
        lines.push(
          `run=${fm.runInProgress.id.slice(-6)} state=${fm.runInProgress.currentState || "-"} status=${fm.runInProgress.status || "running"}`,
        );
        const cd = fm.runInProgress._sentSinceCooldown || 0;
        const cdTh = fm.runInProgress._cooldownThreshold || "?";
        lines.push(
          `cooldown: ${cd}/${cdTh}${_cooldownActive ? " [ACTIVE]" : ""}`,
        );
      }
      lines.push(
        `snapshot: age=${snapshotAgeLabel(fm.byVillage[String(srcVid)]?.snapshotAt)} source=${fm.runInProgress?.snapshotSource || "-"} autoFill=${activeList()?.autoFill || "fillAvailable"}`,
      );
      lines.push(`panels=${document.querySelectorAll(".fm-panel").length}`);
      if (fm._pendingFinalReport)
        lines.push(
          `pendingReport=YES navigateTt0=${fm._navigateToTt0AfterRun}`,
        );
      const pendingKey = sessionStorage.getItem(PENDING_RUN_KEY);
      lines.push(`pendingKey=${pendingKey ? "YES" : "no"}`);
      lines.push(`heartbeatWasEnabled=${fm._heartbeatWasEnabled}`);
      lines.push(`endOfRunHandled=${fm._endOfRunHandled}`);
      lines.push(`activeRunId=${fm._activeRunId || "null"}`);
      diagEl.innerHTML = lines.map((l) => esc(l)).join("<br>");
    }

    function renderAll() {
      renderPausedRunNotice();
      renderTabs();
      renderTroopEditor();
      renderTargets();
      renderRunbar();
      renderProgress();
      renderDiag();
    }

    const fms = fmState();
    profileSelect.value = fms.settings.profile || "normal";
    soundToggle.checked = fms.settings.soundEnabled === true;
    notifToggle.checked = fms.settings.notificationsEnabled !== false;
    hbRestoreToggle.checked = fms.settings.restoreHeartbeatAfterRun !== false;

    btnNew.onclick = () => {
      const name = prompt(
        "New list name:",
        "List " + (getBucket().lists.length + 1),
      );
      if (!name) return;
      const l = makeList(name.trim());
      fmPatch((fm) => {
        fm.byVillage[String(srcVid)].lists.push(l);
        fm.byVillage[String(srcVid)].activeListId = l.id;
      });
      setActive(l.id);
    };
    btnRename.onclick = () => {
      const l = activeList();
      if (!l) return;
      const name = prompt("New name:", l.name);
      if (!name || name === l.name) return;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll) ll.name = name.trim();
      });
      renderAll();
    };
    btnDelete.onclick = () => {
      const l = activeList();
      if (!l) return;
      if (!confirm(`Delete list "${l.name}" with ${l.targets.length} targets?`))
        return;
      fmPatch((fm) => {
        const b = fm.byVillage[String(srcVid)];
        b.lists = b.lists.filter((x) => x.id !== l.id);
        b.activeListId = b.lists[0]?.id || null;
      });
      activeListId = getBucket().lists[0]?.id || null;
      renderAll();
    };

    btnExport.onclick = () => {
      const l = activeList();
      if (!l || !l.targets.length) {
        alert("Nothing to export");
        return;
      }
      openExportModal(srcVid, l.id);
    };

    btnImport.onclick = () => {
      openImportModal(srcVid, (result) => {
        activeListId = fmState().byVillage[String(srcVid)].activeListId;
        renderAll();
        if (result?.mode === "remove") {
          listActionSummary.style.display = "block";
          listActionSummary.textContent = `Loss-list cleanup: ${result.removed} target(s) removed from "${result.listName}"; ${result.notFound} coordinates not found; ${result.invalid} invalid and ${result.duplicates} duplicate entries ignored.`;
        }
      });
    };

    btnSelAll.onclick = () => {
      const l = activeList();
      if (!l) return;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll) {
          ll.pausedRun = null;
          ll.targets.forEach((t) => {
            t.selected = true;
            t.invalid = false;
          });
        }
      });
      renderTargets();
      renderRunbar();
    };
    btnSelNone.onclick = () => {
      const l = activeList();
      if (!l) return;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll) ll.targets.forEach((t) => (t.selected = false));
      });
      renderTargets();
      renderRunbar();
    };
    heroGlobal.onchange = () => {
      const heroInput = troopEditor.querySelector(".fm-t-t11");
      if (heroInput) {
        heroInput.disabled = !heroGlobal.checked;
        if (!heroGlobal.checked) heroInput.value = 0;
        else if (!parseInt(heroInput.value, 10)) heroInput.value = 1;
      }
      troopEditor.dispatchEvent(new Event("input", { bubbles: true }));
    };
    profileSelect.onchange = () => {
      fmPatch((fm) => {
        fm.settings.profile = profileSelect.value;
      });
      showToast(`Behavior: ${profileSelect.value}`, "ok");
    };
    soundToggle.onchange = () => {
      fmPatch((fm) => {
        fm.settings.soundEnabled = soundToggle.checked;
      });
      if (soundToggle.checked) playAlarm();
    };
    notifToggle.onchange = () => {
      fmPatch((fm) => {
        fm.settings.notificationsEnabled = notifToggle.checked;
      });
      if (
        notifToggle.checked &&
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      )
        Notification.requestPermission();
    };
    hbRestoreToggle.onchange = () => {
      fmPatch((fm) => {
        fm.settings.restoreHeartbeatAfterRun = hbRestoreToggle.checked;
      });
      showToast(`Restore HB: ${hbRestoreToggle.checked ? "ON" : "OFF"}`, "ok");
    };

    wrap.querySelector(".fm-btn-search").onclick = () => {
      const x = parseInt(searchX.value, 10);
      const y = parseInt(searchY.value, 10);
      if (isNaN(x) || isNaN(y)) {
        showToast("Enter X and Y", "warn");
        return;
      }
      const l = activeList();
      if (!l) return;
      const t = l.targets.find((t) => t.x === x && t.y === y);
      if (!t) {
        showToast(`Not found: (${x}|${y})`, "warn");
        return;
      }
      const el = wrap.querySelector(`.fm-target[data-id="${t.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "3px solid #ffb020";
        setTimeout(() => {
          el.style.outline = "";
        }, 2500);
      }
      showToast(`Found: ${t.name}`, "ok");
    };
    wrap.querySelector(".fm-btn-search-clear").onclick = () => {
      searchX.value = "";
      searchY.value = "";
    };

    btnStart.onclick = () => startRun("start");
    btnResume.onclick = () => startRun("resume");
    btnRestart.onclick = () => {
      const l = activeList();
      if (!l) return;
      if (!confirm(`Reset all ${l.targets.length} targets to pending?`)) return;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll)
          ll.targets.forEach((t) => {
            t.status = "pending";
            t.lastRaid = null;
            t.partialRemaining = null;
            t.lastSkipReason = null;
            t.invalid = false;
          });
      });
      renderAll();
    };

    function startRun(mode) {
      const l = activeList();
      if (!l || !l.targets.length) {
        alert("No targets in list");
        return;
      }

      // ⭐ X3: گارد re-entrancy — جلوگیری از دو run موازی با یک کلیک
      const liveState = fmState();
      if (liveState.runInProgress && isFarmRunActive(liveState.runInProgress.id)) {
        const msg =
          `A farm run is already in progress (${liveState.runInProgress.sent}/${liveState.runInProgress.planned}).\n\n` +
          `Start a new run anyway? The current run will be cancelled.`;
        if (!confirm(msg)) return;
        fmLog("WARN", "startRun: existing run cancelled by user");
      }

      makeBackup("before-run");

      // ⭐ پاک‌سازی تسک‌های orphaned قبل از شروع
      // ⭐ X4: قبل از شروع run جدید، تسک‌های farm باقی‌مانده پاک می‌شوند
      cancelAllFarmTasks("before-start");

      let candidates = l.targets.filter(
        (t) => t.selected !== false && t.invalid !== true,
      );
      if (!candidates.length) {
        alert("All targets are invalid or unselected");
        return;
      }

      const pausedRun = mode === "resume" ? l.pausedRun : null;
      let targets = candidates.filter((t) => t.status !== "sent");
      if (!targets.length) {
        alert("Nothing to send");
        return;
      }

      targets = targets.filter((t) => t.invalid !== true);
      if (!targets.length) {
        alert("All targets are invalid");
        return;
      }

      targets.sort((a, b) => {
        const da = a.distance == null ? 1e9 : a.distance;
        const db = b.distance == null ? 1e9 : b.distance;
        if (da !== db) return da - db;
        return (a.addedAt || 0) - (b.addedAt || 0);
      });

      const villageBucket = fmState().byVillage[String(srcVid)];
      // ⭐ باگ #۲/#۵: منبع تازهٔ سرباز (صفحهٔ tt=2) با اولویت، سپس cache معتبر (TTL)
      const snapInfo = pickStartSnapshot(villageBucket, pausedRun);
      const troopSnapshot = snapInfo.troops;
      if (snapInfo.source === "tt2" && villageBucket) {
        fmPatch((fm) => {
          const b = fm.byVillage[String(srcVid)];
          if (b) {
            b.snapshot = { ...snapInfo.troops };
            b.snapshotAt = snapInfo.at;
          }
        });
      }
      if (!troopSnapshot) {
        fmLog(
          "WARN",
          "startRun: troop snapshot unknown (no tt=2 form and no fresh cache)",
        );
        showToast("Troop counts unknown — verify manually", "warn");
      }
      const resumeTargetIds =
        pausedRun?.targetIds || targets.map((target) => target.id);
      const { maxTargets, limitingKey } = limitTargetsByAvailableTroops(
        l,
        targets,
        troopSnapshot,
        pausedRun,
        snapInfo.source === "tt2",
      );
      if (maxTargets < targets.length) {
        const limitedCount = targets.length - maxTargets;
        const limName = limitingKey ? TROOP_LABELS[limitingKey] : "troops";
        const msg =
          `Only enough ${limName} for ${maxTargets} of ${targets.length} remaining targets.\n\n` +
          `${limitedCount} targets will remain pending and can be resumed later.\n\n` +
          `Continue with ${maxTargets} targets?`;
        if (!confirm(msg)) return;
        targets = targets.slice(0, maxTargets);
      }
      if (!targets.length) {
        alert("No available troops for the remaining targets");
        return;
      }

      const s0 = FM.tc.state();
      const heartbeatBefore = s0.heartbeat?.enabled === true;
      fmPatch((fm) => {
        fm._heartbeatWasEnabled = heartbeatBefore;
      });
      if (mode === "start") {
        fmPatch((fm) => {
          const list = fm.byVillage[String(srcVid)].lists.find(
            (item) => item.id === l.id,
          );
          if (list) list.pausedRun = null;
        });
      }

      if (
        !heartbeatBefore &&
        fmState()?.settings?.autoEnableHeartbeat !== false
      ) {
        try {
          FM.tc.heartbeat.setOn(true);
        } catch (e) {}
        FM.tc.log?.("farm", "auto-enabled Heartbeat");
        fmLog("INFO", "Heartbeat was OFF → auto-enabled");
      } else {
        fmLog("INFO", "Heartbeat was ON → will stay ON");
      }

      const runId = pausedRun?.runId || uid("run");
      const resumeIds = new Set(resumeTargetIds);
      const previouslySent = pausedRun
        ? l.targets.filter(
            (target) =>
              resumeIds.has(target.id) &&
              target.status === "sent" &&
              target.lastRaid &&
              target.lastRaid.at >= (pausedRun.startedAt || 0) &&
              (!target.lastRaid.runId || target.lastRaid.runId === runId),
          ).length
        : 0;
      const runData = {
        id: runId,
        sourceVid: String(srcVid),
        listId: l.id,
        listName: l.name,
        startedAt: pausedRun?.startedAt || now(),
        planned: targets.length + previouslySent,
        sent: previouslySent,
        failed: 0,
        skipped: 0,
        targetIds: targets.map((t) => t.id),
        resumeTargetIds: [...resumeTargetIds],
        currentTarget: null,
        currentTargetId: null,
        currentState: "preparing",
        status: RUN_STATUS.RUNNING,
        troopSnapshot: troopSnapshot ? { ...troopSnapshot } : null,
        troopSnapshotAt: troopSnapshot ? snapInfo.at : 0,
        snapshotSource: snapInfo.source,
        troops: { ...l.troops },
        heroFollow: l.heroFollow === true,
        autoFill: l.autoFill || "fillAvailable",
        listSnapshot: targets.map((t) => ({
          id: t.id,
          name: t.name,
          x: t.x,
          y: t.y,
          troops: t.troops || null,
          distance: t.distance,
          heroFollow: t.heroFollow,
          autoFill: t.autoFill,
        })),
        _sentSinceCooldown: 0,
        _cooldownThreshold: pickCooldownAttacks(l),
      };

      fmPatch((fm) => {
        fm.runInProgress = runData;
      });
      // ⭐ باگ #۱: تنها نقطهٔ تغییر وضعیت (فلگ‌های قدیمی derived نوشته می‌شوند)
      transitionRun(RUN_STATUS.RUNNING, { runId: runId });

      // ⭐ nextRotationAt با سقف امن
      const rotationEstimate = Math.min(
        targets.length * ROTATION_PER_TASK_MS + ROTATION_EXTRA_MS,
        ROTATION_MAX_MS,
      );
      FM.tc.patch((s) => {
        if (s.heartbeat) {
          s.heartbeat.nextRotationAt = safeRotationAt(now() + rotationEstimate);
        }
      });
      fmLog(
        "INFO",
        `startRun: planned=${targets.length}, rotationEstimate=${Math.round(rotationEstimate / 60000)}min`,
      );

      const u = new URL(location.href);
      const isOnRally =
        u.pathname.includes("build.php") &&
        u.searchParams.get("gid") === "16" &&
        u.searchParams.get("tt") === "2";
      const sameVillage = String(FM.tc.village()) === String(srcVid);

      if (isOnRally && sameVillage) {
        enqueueRunTasks(runData);
        renderAll();
        return;
      }

      try {
        sessionStorage.setItem(PENDING_RUN_KEY, JSON.stringify(runData));
      } catch {}
      FM.tc.flash?.("Navigating to Send Troops...");
      FM.tc.log?.("farm", `startRun → tt=2 (${targets.length} targets)`);
      fmLog("INFO", `startRun → tt=2 (${targets.length} targets)`);
      location.href = `/build.php?id=39&gid=16&tt=2&newdid=${srcVid}`;
    }

    renderAll();
    const poll = setInterval(() => {
      if (!document.body.contains(wrap)) {
        clearInterval(poll);
        return;
      }
      renderProgress();
      renderDiag();
    }, 1000);
  }
