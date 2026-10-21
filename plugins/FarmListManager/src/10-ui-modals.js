  // ─────────────────────────────────────────────────────────────
  // Import modal — pick mode, paste JSON, see the parsed preview,
  // then hand over to runImport(). Single instance, own style block.
  // ─────────────────────────────────────────────────────────────
  const MODAL_CSS = `
.flm-backdrop{position:fixed;inset:0;background:rgba(30,22,10,.55);z-index:2147483090;display:flex;
  align-items:center;justify-content:center;font:12px/1.5 Verdana,Arial,sans-serif}
.flm-modal{width:560px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;background:#f7f3e8;color:#3d2f1f;
  border:1px solid #a08a63;border-radius:6px;box-shadow:0 10px 34px rgba(0,0,0,.45);overflow:hidden}
.flm-modal-head{padding:8px 10px;background:linear-gradient(#7d6a48,#5c4a2c);color:#f4e9cf;font-weight:bold;
  display:flex;justify-content:space-between;align-items:center;gap:8px}
.flm-modal-head button{background:#efe3c6;border:1px solid #8c784f;border-radius:3px;color:#3d2f1f;font:11px Verdana;padding:2px 7px;cursor:pointer}
.flm-modal-body{padding:10px;overflow:auto;flex:1 1 auto}
.flm-modal-foot{padding:8px 10px;border-top:1px solid #d8c9a8;background:#f1e8d3;display:flex;gap:8px;justify-content:flex-end}
.flm-modal-foot button{font:11px Verdana,Arial,sans-serif;border:1px solid #8c784f;background:#efe3c6;color:#3d2f1f;
  border-radius:3px;padding:4px 12px;cursor:pointer}
.flm-modal-foot button:hover{background:#fff6e0}
.flm-modal-foot button:disabled{opacity:.5;cursor:default}
.flm-modal-foot button.flm-primary{background:#d7e7cf;border-color:#5f8a4f}
.flm-field{margin-bottom:8px}
.flm-field label{display:block;font-weight:bold;font-size:11px;margin-bottom:3px;color:#6a5940}
.flm-field textarea{width:100%;box-sizing:border-box;height:140px;font:11px Consolas,monospace;border:1px solid #b9a884;
  border-radius:3px;padding:5px;resize:vertical;background:#fffdf5;color:#3d2f1f}
.flm-field select,.flm-field input[type=text]{font:11px Verdana;border:1px solid #b9a884;border-radius:3px;padding:3px 4px;background:#fffdf5}
.flm-modes{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.flm-modes label{display:inline-flex;align-items:center;gap:4px;font-weight:normal;font-size:11px;color:#3d2f1f}
.flm-preview{border:1px solid #d8c9a8;background:#fffdf5;border-radius:4px;padding:6px 8px;font-size:11px}
.flm-preview .flm-k{color:#6a5940}
.flm-preview ul{margin:4px 0 0;padding-left:16px}
.flm-preview li{color:#8a5a09}
.flm-preview li.err{color:#8d2b22}
`;

  let _modalEl = null;
  let _modalCtx = null;

  function ensureModalStyle() {
    const id = FLM_STYLE_ID + "-modal";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = MODAL_CSS;
    document.head.appendChild(st);
  }

  function closeImportModal() {
    if (_modalEl) {
      if (_modalCtx && _modalCtx.onClose) {
        try {
          _modalCtx.onClose();
        } catch (e) {}
      }
      _modalEl.remove();
      _modalEl = null;
    }
    _modalCtx = null;
  }

  function _modalTemplate(list, lists) {
    const optHtml = lists
      .map(
        (l) =>
          `<option value="${esc(l.id)}"${String(l.id) === String(list.id) ? " selected" : ""}>${esc(l.villageName || "?")} → ${esc(l.name)} (${l.used}/${l.capacity})</option>`,
      )
      .join("");
    return `
<div class="flm-backdrop" id="flm-import-backdrop">
  <div class="flm-modal" role="dialog" aria-modal="true" aria-labelledby="flm-modal-title">
    <div class="flm-modal-head">
      <span id="flm-modal-title">Import targets → ${esc(list.name)}</span>
      <button type="button" data-mact="close" title="close">✕</button>
    </div>
    <div class="flm-modal-body">
      <div class="flm-field">
        <label for="flm-target-list">Target farm list</label>
        <select id="flm-target-list">${optHtml}</select>
      </div>
      <div class="flm-field">
        <label>Mode</label>
        <div class="flm-modes">
          <label><input type="radio" name="flm-mode" value="append" checked /> Append (keep existing slots)</label>
          <label><input type="radio" name="flm-mode" value="replace" /> Replace (delete all slots first)</label>
        </div>
      </div>
      <div class="flm-field">
        <label>Duplicate handling</label>
        <div class="flm-modes">
          <label><input type="radio" name="flm-dup" value="skip" checked /> Skip</label>
          <label><input type="radio" name="flm-dup" value="force" /> Force (let Travian decide)</label>
          <label><input type="radio" name="flm-dup" value="abort" /> Abort if any</label>
        </div>
      </div>
      <div class="flm-field">
        <label for="flm-json">JSON payload</label>
        <textarea id="flm-json" spellcheck="false" placeholder='{"_format":"farm-list-v1","list":{"targets":[{"name":"x","x":12,"y":-34}]}}'></textarea>
      </div>
      <div class="flm-field">
        <div class="flm-modes">
          <button type="button" data-mact="validate">Validate &amp; preview</button>
          <label style="margin-left:auto"><input type="checkbox" id="flm-export-cur" /> load current list targets</label>
        </div>
      </div>
      <div class="flm-preview" id="flm-preview"><span class="flm-k">Paste JSON and press “Validate &amp; preview”.</span></div>
      <div class="flm-k" style="margin-top:6px">The modal closes when the import starts — progress and the step log move to the panel above the list.</div>
    </div>
    <div class="flm-modal-foot">
      <button type="button" data-mact="cancel">Cancel</button>
      <button type="button" class="flm-primary" data-mact="run" disabled>Start import</button>
    </div>
  </div>
</div>`;
  }

  function _modalEl_(sel) {
    return _modalEl ? _modalEl.querySelector(sel) : null;
  }

  function _modalMode() {
    const r = _modalEl ? _modalEl.querySelector("input[name='flm-mode']:checked") : null;
    return r ? r.value : IMPORT_MODE.APPEND;
  }

  function _modalDupMode() {
    const r = _modalEl ? _modalEl.querySelector("input[name='flm-dup']:checked") : null;
    return r ? r.value : DUP_MODE.SKIP;
  }

  function _modalCurrentListId() {
    const sel = _modalEl_("#flm-target-list");
    return sel ? sel.value : null;
  }

  function _renderPreview() {
    const box = _modalEl_("#flm-preview");
    if (!box) return;
    const ctx = _modalCtx;
    if (!ctx || !ctx.parsed) {
      box.innerHTML = `<span class="flm-k">Paste JSON and press “Validate &amp; preview”.</span>`;
      return;
    }
    const p = ctx.parsed;
    const listId = _modalCurrentListId();
    const list = listId ? getListById(listId) : null;
    const mode = _modalMode();
    const cap = list ? capacityCheck(list, p.targets.length, mode) : null;
    const dup = list ? analyzeDuplicates(p.targets, list.targets) : { duplicateCount: 0, fresh: p.targets };

    const rows = [];
    rows.push(`<div><span class="flm-k">format:</span> ${esc(p.format)}</div>`);
    rows.push(
      `<div><span class="flm-k">targets:</span> <b>${p.targets.length}</b> valid of ${p.totalRaw} (${esc(summarizeTargets(p.targets))})</div>`,
    );
    if (p.listName) rows.push(`<div><span class="flm-k">payload list name:</span> ${esc(p.listName)}</div>`);
    if (list) {
      rows.push(
        `<div><span class="flm-k">target list:</span> ${esc(list.name)} — ${list.used}/${list.capacity} slots${mode === IMPORT_MODE.REPLACE ? " (will be cleared first)" : ""}</div>`,
      );
      rows.push(
        `<div><span class="flm-k">duplicates in list:</span> <b>${dup.duplicateCount}</b>${dup.duplicateCount && mode === IMPORT_MODE.APPEND && _modalDupMode() === DUP_MODE.SKIP ? ` → ${dup.fresh.length} will be added` : ""}</div>`,
      );
    }
    if (cap && !cap.ok) rows.push(`<div class="flm-k" style="color:#8d2b22">⚠ ${esc(cap.message)}</div>`);

    const warn = p.warnings.slice(0, 8);
    if (warn.length) {
      rows.push(`<div class="flm-k" style="margin-top:4px">warnings:</div><ul>`);
      for (const w of warn) rows.push(`<li>${esc(w)}</li>`);
      if (p.warnings.length > warn.length) rows.push(`<li>… ${p.warnings.length - warn.length} more</li>`);
      rows.push(`</ul>`);
    }
    if (p.errors.length) {
      rows.push(`<div class="flm-k" style="margin-top:4px;color:#8d2b22">errors:</div><ul>`);
      for (const e of p.errors) rows.push(`<li class="err">${esc(e)}</li>`);
      rows.push(`</ul>`);
    }
    box.innerHTML = rows.join("");

    const runBtn = _modalEl_("button[data-mact='run']");
    if (runBtn) runBtn.disabled = !(p.ok && list && (!cap || cap.ok)) || isImporting();
  }

  function _validateModalPayload() {
    const ta = _modalEl_("#flm-json");
    if (!_modalCtx) return;
    _modalCtx.parsed = parseImportPayload(ta ? ta.value : "");
    if (_modalCtx.parsed.errors.length) {
      flmLog("WARN", "Import payload rejected: " + _modalCtx.parsed.errors[0]);
    } else {
      flmLog(
        "INFO",
        `Payload parsed (${_modalCtx.parsed.format}): ${_modalCtx.parsed.targets.length} target(s), ${_modalCtx.parsed.warnings.length} warning(s)`,
      );
    }
    _renderPreview();
  }

  async function _runModalImport(ev) {
    if (!_modalCtx || !_modalCtx.parsed || !_modalCtx.parsed.ok) return;
    const listId = _modalCurrentListId();
    if (!listId) return;
    const mode = _modalMode();
    const dupMode = _modalDupMode();
    const total = _modalCtx.parsed.targets.length;

    if (mode === IMPORT_MODE.REPLACE) {
      const list = getListById(listId);
      const ok = window.confirm(
        `Replace mode will DELETE all ${list ? list.used : "?"} slot(s) of "${list ? list.name : "#" + listId}" before importing.\n\nContinue?`,
      );
      if (!ok) {
        flmLog("WARN", "Replace import cancelled by user at the delete confirmation");
        return;
      }
    }

    // Capture everything the run needs BEFORE closing: closeImportModal()
    // drops _modalCtx, so reading it afterwards would import nothing.
    const parsed = _modalCtx.parsed;
    flmLog("INFO", `importing ${total} target(s), mode=${mode}, dup=${dupMode}`);

    // The run drives Travian's own dialogs and needs the page, not the modal —
    // hand it off and close so the user watches progress on the main panel.
    closeImportModal();
    renderPanel();

    let report = null;
    try {
      report = await runImport(listId, parsed, { mode, dupMode });
    } catch (e) {
      flmLog("ERROR", "Import crashed: " + ((e && e.message) || e));
      showToast("Import failed: " + ((e && e.message) || e), "err");
    } finally {
      renderPanel();
    }
    if (report) {
      flmLog(
        report.status === "done" ? "INFO" : "WARN",
        `Import done: ${report.done}/${report.total} added, ${report.skipped} skipped, ${report.failed} failed`,
      );
    }
  }

  function _onModalClick(ev) {
    const btn = ev.target.closest("button[data-mact]");
    if (!btn) return;
    const act = btn.getAttribute("data-mact");
    if (act === "close" || act === "cancel") {
      ev.preventDefault();
      if (isImporting()) {
        cancelImport("user closed the modal");
        flmLog("WARN", "Import cancellation requested — finishing the current step first");
      }
      closeImportModal();
      renderPanel();
    } else if (act === "validate") {
      ev.preventDefault();
      _validateModalPayload();
    } else if (act === "run") {
      ev.preventDefault();
      _runModalImport(ev);
    }
  }

  function _onModalChange(ev) {
    if (!_modalCtx) return;
    if (ev.target && ev.target.id === "flm-export-cur") {
      const ta = _modalEl_("#flm-json");
      if (ev.target.checked && ta) {
        const list = getListById(_modalCurrentListId());
        if (list) {
          ta.value = JSON.stringify(exportListAsPayload(list), null, 2);
          _validateModalPayload();
        }
      }
      return;
    }
    _renderPreview();
  }

  function openImportModal(listId) {
    const lists = scanFarmLists();
    const list = lists.find((l) => String(l.id) === String(listId));
    if (!list) {
      showToast("List #" + listId + " is not on this page", "err");
      return;
    }
    if (isImporting()) {
      showToast("An import is already running", "warn");
      return;
    }
    closeImportModal();
    ensurePanelStyle();
    ensureModalStyle();
    const holder = document.createElement("div");
    holder.innerHTML = _modalTemplate(list, lists);
    // The template starts with a newline, so firstElementChild is not
    // guaranteed to be the backdrop — resolve it explicitly.
    let backdrop = holder.firstElementChild;
    if (!backdrop || !backdrop.classList.contains("flm-backdrop")) {
      const all = holder.querySelectorAll("*");
      backdrop = Array.prototype.find.call(all, (n) => n.classList && n.classList.contains("flm-backdrop"));
    }
    if (!backdrop) {
      flmLog("ERROR", "Import modal template did not produce a backdrop node");
      showToast("Could not open the import dialog", "err");
      return;
    }
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop && !isImporting()) closeImportModal();
    });
    backdrop.addEventListener("click", _onModalClick);
    backdrop.addEventListener("change", _onModalChange);
    document.body.appendChild(backdrop);
    _modalEl = backdrop;
    _modalCtx = { listId: String(list.id), parsed: null, onClose: null };
    flmLog("INFO", `Import modal opened for "${list.name}" (#${list.id})`);
    const ta = _modalEl_("#flm-json");
    if (ta) ta.focus();
  }
