  // ─────────────────────────────────────────────────────────────
  // Page detection
  // ─────────────────────────────────────────────────────────────
  function isFarmListPage() {
    try {
      const sp = new URL(location.href).searchParams;
      if (sp.get("gid") !== "16") return false;
      if (sp.get("tt") !== FARM_LIST_TT) return false;
      return !!document.getElementById("rallyPointFarmList");
    } catch (e) {
      return false;
    }
  }

  function farmListUrl() {
    try {
      const sp = new URL(location.href).searchParams;
      const id = sp.get("id") || "39";
      return "/build.php?id=" + encodeURIComponent(id) + "&gid=16&tt=" + FARM_LIST_TT;
    } catch (e) {
      return "/build.php?id=39&gid=16&tt=" + FARM_LIST_TT;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Village list (id ↔ name map) — needed because .villageWrapper has
  // no data-did; only the sidebar list entries carry it.
  // ─────────────────────────────────────────────────────────────
  function villageNameToId() {
    const map = Object.create(null);
    $$("#sidebarBoxVillageList .listEntry.village[data-did]").forEach((el) => {
      const n = el.querySelector(".name");
      const name = (n ? n.textContent : "").trim();
      const id = el.getAttribute("data-did");
      if (name && id) map[name.toLowerCase()] = id;
    });
    return map;
  }

  function parseSlotsText(text) {
    // Travian wraps numbers with LTR/RTL marks: "\u202d\u202d2\u202c/\u202d100\u202c\u202c"
    const m = stripInvisible(text).match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { used: parseInt(m[1], 10), capacity: parseInt(m[2], 10) };
  }

  function readListWrapper(wrapper, villageName, nameMap) {
    const listEl = wrapper.querySelector(".farmListHeader .dragAndDrop[data-list]");
    if (!listEl) return null;
    const id = listEl.getAttribute("data-list");
    if (!id) return null;
    const nameEl = wrapper.querySelector(".farmListHeader .farmListName .name");
    const name = (nameEl ? nameEl.textContent : "").trim() || "List " + id;
    const statusEl = wrapper.querySelector(".farmListHeader .farmListStatus span");
    const statusText = stripInvisible(statusEl ? statusEl.textContent : "").replace(/\s+/g, " ").trim();

    const headBtn = wrapper.querySelector(".farmListHeader button.startFarmList");
    const footBtn = wrapper.querySelector(".farmListFooter button.startFarmList");
    const startBtn = footBtn || headBtn;
    const startDisabled = !!(startBtn && startBtn.classList.contains("disabled"));

    const addTd = wrapper.querySelector("table.slots td.addTarget");
    const counts = parseSlotsText(addTd ? addTd.textContent : "");
    const rows = $$("table.slots tbody tr.slot", wrapper);

    const targets = [];
    for (const tr of rows) {
      const cb = tr.querySelector("input.selectOne, input[name='selectOne']");
      const link = tr.querySelector("td.target a[href]");
      if (!link) continue;
      let x = null;
      let y = null;
      try {
        const q = new URL(link.getAttribute("href"), location.origin).searchParams;
        x = parseInt(q.get("x"), 10);
        y = parseInt(q.get("y"), 10);
      } catch (e) {}
      const nameSpan = link.querySelector("span");
      const targetName = ((nameSpan ? nameSpan.textContent : link.textContent) || "").trim();
      const popEl = tr.querySelector("td.population span");
      const distEl = tr.querySelector("td.distance span");
      targets.push({
        slotId: cb ? cb.getAttribute("data-slot-id") : null,
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null,
        name: targetName,
        population: popEl ? cleanInt(popEl.textContent) : null,
        distance: distEl ? parseFloat(cleanNum(distEl.textContent)) || null : null,
      });
    }

    // Travian renders deactivated slots too (slotsStates), so trust the
    // larger of: parsed "used/capacity" text and rendered slot rows.
    const used = Math.max(counts ? counts.used : 0, rows.length);
    const capacity = (counts && counts.capacity) || SLOT_CAPACITY;
    const meta = listMeta(id) || {};

    return {
      id: String(id),
      name,
      villageName,
      villageId: nameMap[String(villageName || "").toLowerCase()] || null,
      used,
      capacity,
      full: used >= capacity,
      targetsCount: rows.length,
      targets,
      statusText,
      startDisabled,
      canStart: !!startBtn && !startDisabled && used > 0,
      lastRunAt: Number(meta.lastRunAt) || 0,
      lastRunBy: meta.lastRunBy || null,
      lastRunStatus: meta.lastRunStatus || null,
      lastImportAt: Number(meta.lastImportAt) || 0,
      wrapper,
      startBtn,
      addTargetAnchor: wrapper.querySelector("table.slots td.addTarget a"),
    };
  }

  function scanFarmLists() {
    const root = document.getElementById("rallyPointFarmList");
    if (!root) return [];
    const nameMap = villageNameToId();
    const out = [];
    $$(".villageWrapper", root).forEach((wrapper) => {
      const vNameEl = wrapper.querySelector(":scope > .villageHeader .villageName");
      const villageName = (vNameEl ? vNameEl.textContent : "").trim();
      $$(".farmListWrapper", wrapper).forEach((lw) => {
        const row = readListWrapper(lw, villageName, nameMap);
        if (row) out.push(row);
      });
    });
    return out;
  }

  function getListById(listId) {
    const want = String(listId);
    return scanFarmLists().find((l) => l.id === want) || null;
  }

  function findListWrapper(listId) {
    const want = String(listId);
    return (
      $$(".farmListWrapper").find((w) => {
        const el = w.querySelector(".farmListHeader .dragAndDrop[data-list]");
        return !!el && el.getAttribute("data-list") === want;
      }) || null
    );
  }

  // Slot rows currently rendered for a list (deactivated slots included)
  function slotCountInDom(listId) {
    const w = findListWrapper(listId);
    return w ? $$("table.slots tbody tr.slot", w).length : 0;
  }

  // Number of slots we can actually address in the DOM (used right after a
  // delete/append so we do not trust a stale "X/100" counter)
  function listSlotRows(listId) {
    const w = findListWrapper(listId);
    return w ? $$("table.slots tbody tr.slot", w) : [];
  }

  // ─────────────────────────────────────────────────────────────
  // Dialog helpers — the Add-Target / Edit-Slot dialog
  // (#reactDialogWrapper > #dialogOverlay.dialogVisible > .dialog.slotDialog
  //  > .contentV2 > #farmListTargetForm.formV2)
  // ─────────────────────────────────────────────────────────────
  function dialogRoot() {
    return document.getElementById("reactDialogWrapper");
  }
  function isDialogVisible() {
    const ov = document.getElementById("dialogOverlay");
    return !!ov && ov.classList.contains("dialogVisible");
  }
  function targetForm() {
    return document.getElementById("farmListTargetForm");
  }
  function dialogSaveButton() {
    const form = targetForm();
    return form ? form.querySelector(".actionButtons button.save") : null;
  }
  function dialogCancelButton() {
    const form = targetForm();
    return form ? form.querySelector(".actionButtons button.cancel") : null;
  }
  function dialogXInput() {
    const f = targetForm();
    return f ? f.querySelector("input[name='x']") : null;
  }
  function dialogYInput() {
    const f = targetForm();
    return f ? f.querySelector("input[name='y']") : null;
  }
  function dialogListSelect() {
    const f = targetForm();
    return f ? f.querySelector("select[name='listId']") : null;
  }
  function dialogTargetValidationText() {
    const f = targetForm();
    if (!f) return "";
    const v = f.querySelector(".targetSelectionValidation");
    return stripInvisible(v ? v.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function isSaveEnabled() {
    const btn = dialogSaveButton();
    return !!btn && !btn.disabled && !btn.classList.contains("disabled");
  }

  // ─────────────────────────────────────────────────────────────
  // Travian confirmation dialogs (React API `oi({...})`):
  // rendered inside #reactDialogWrapper as .dialogWrapper[.confirm]
  // with a red/green confirm button; the cancel button carries .cancel.
  // ─────────────────────────────────────────────────────────────
  function confirmDialogRoot() {
    const roots = $$("#reactDialogWrapper .dialogWrapper");
    for (const r of roots) {
      if (r.querySelector("#farmListTargetForm")) continue;
      if (r.querySelector(".actionButtons button.save")) continue;
      if (r.querySelector("button.confirm, button.greenConfirm, button.redConfirm")) return r;
    }
    return null;
  }
  function isConfirmDialogVisible() {
    return !!confirmDialogRoot();
  }
  function confirmDialogButton() {
    const r = confirmDialogRoot();
    return r ? r.querySelector("button.confirm, button.greenConfirm, button.redConfirm") : null;
  }
  function confirmDialogCancelButton() {
    const r = confirmDialogRoot();
    return r ? r.querySelector("button.cancel, button.cancelButton") : null;
  }

  function waitDialogClosed(maxMs) {
    if (!isDialogVisible()) return Promise.resolve({ ok: true, waited: 0 });
    return waitFor(() => !isDialogVisible(), maxMs || DIALOG_CLOSE_TIMEOUT_MS, 80);
  }

  async function closeAnyDialog() {
    if (isConfirmDialogVisible()) {
      const c = confirmDialogCancelButton();
      if (c) await humanClick(c);
      await waitFor(() => !isConfirmDialogVisible(), 2000, 80);
    }
    if (isDialogVisible()) {
      const c = dialogCancelButton() || document.querySelector("#dialogOverlay .dialogCancelButton");
      if (c) await humanClick(c);
      await waitDialogClosed(2000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Human input (local copy — Nova 0.0.3 exposes no humanType())
  // React inputs need the native value setter + input event to update
  // their internal state (otherwise the Save button never enables).
  // ─────────────────────────────────────────────────────────────
  function humanProfile() {
    const p = readFLMData().settings.profile;
    if (p === "fast") return { charDelay: [8, 25], microDelay: [40, 120] };
    if (p === "paranoid") return { charDelay: [60, 180], microDelay: [300, 900] };
    return { charDelay: HUMAN_PROFILE.charDelay, microDelay: HUMAN_PROFILE.microDelay };
  }

  function setNativeValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(input, String(value));
    else input.value = String(value);
  }

  // React keeps its own value tracker on the element instance. Writing to the
  // prototype setter bypasses it, so React sees a real change on the next
  // input/change event. A <select> needs the HTMLSelectElement descriptor —
  // the input one silently does nothing on it.
  function setNativeValueSelect(sel, value) {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (desc && desc.set) desc.set.call(sel, String(value));
    else sel.value = String(value);
  }

  function createSignal() {
    return {
      cancelled: false,
      cancelledAt: 0,
      cancel() {
        this.cancelled = true;
        this.cancelledAt = now();
      },
    };
  }

  async function humanType(input, value, signal) {
    if (!input || !input.isConnected) return false;
    const prof = humanProfile();
    input.focus();
    await delay(rnd(prof.microDelay));
    if (input.value) {
      try {
        input.select();
      } catch (e) {}
      await delay(rnd(prof.charDelay));
      setNativeValue(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const ch of String(value)) {
      if (signal && signal.cancelled) return false;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true }));
      await delay(rnd(prof.charDelay));
      setNativeValue(input, input.value + ch);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true, cancelable: true }));
      await delay(rnd(prof.charDelay));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function humanClick(el, signal) {
    if (!el || !el.isConnected) return { ok: false, reason: "gone" };
    let st;
    try {
      st = getComputedStyle(el);
    } catch (e) {
      st = null;
    }
    if (st && (st.display === "none" || st.visibility === "hidden")) return { ok: false, reason: "hidden" };
    if (el.disabled) return { ok: false, reason: "disabled" };
    const prof = humanProfile();
    await delay(rnd(prof.microDelay));
    if (signal && signal.cancelled) return { ok: false, cancelled: true };
    const rect = el.getBoundingClientRect();
    const tx = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const ty = rect.top + rect.height * (0.3 + Math.random() * 0.4);
    const opts = { bubbles: true, cancelable: true, clientX: tx, clientY: ty };
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mousemove", opts));
    el.dispatchEvent(new MouseEvent("mousedown", Object.assign({ buttons: 1 }, opts)));
    await delay(rnd(prof.charDelay));
    if (signal && signal.cancelled) return { ok: false, cancelled: true };
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.click();
    return { ok: true };
  }
