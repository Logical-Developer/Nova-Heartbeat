  // ─────────────────────────────────────────────────────────────
  // Map dialog
  // ─────────────────────────────────────────────────────────────
  function extractMapTarget(tileEl) {
    if (!tileEl) return null;
    const isOasis = tileEl.classList.contains("oasis");
    const titleEl = tileEl.querySelector("h1.titleInHeader");
    let name = "";
    if (titleEl) {
      const clone = titleEl.cloneNode(true);
      clone
        .querySelectorAll("span.mainVillage, span.coordinates, span.clear, a")
        .forEach((e) => e.remove());
      name = clone.textContent.replace(/\s+/g, " ").trim();
    }
    const xEl = tileEl.querySelector(".coordinates .coordinateX");
    const yEl = tileEl.querySelector(".coordinates .coordinateY");
    const x = xEl ? cleanInt(xEl.textContent) : null;
    const y = yEl ? cleanInt(yEl.textContent) : null;
    if (x === null || y === null) return null;

    let player = null,
      playerId = null;
    const pLink = tileEl.querySelector(
      '#village_info td.player a[href*="/profile/"]',
    );
    if (pLink) {
      player = pLink.textContent.trim();
      const m = pLink.getAttribute("href").match(/\/profile\/(\d+)/);
      if (m) playerId = m[1];
    }

    let tribe = null,
      population = null,
      distance = null;
    for (const r of tileEl.querySelectorAll("#village_info tr")) {
      const th = r.querySelector("th");
      const td = r.querySelector("td");
      if (!th || !td) continue;
      const key = th.textContent.trim().toLowerCase();
      if (key === "tribe") tribe = td.textContent.trim();
      if (key === "population") {
        const pop = parseInt(td.textContent.trim(), 10);
        if (!isNaN(pop)) population = pop;
      }
      if (key === "distance") {
        const m = td.textContent.match(/(\d+)/);
        if (m) distance = parseInt(m[1], 10);
      }
    }
    return {
      name,
      x,
      y,
      player,
      playerId,
      tribe,
      population,
      distance,
      isOasis,
    };
  }

  function injectFarmBoxOnMap() {
    const dialog = document.querySelector('.dialogWrapper[data-context="map"]');
    if (!dialog) {
      if (_fmMapBoxRef && _fmMapBoxRef.isConnected) _fmMapBoxRef.remove();
      _fmMapBoxRef = null;
      return;
    }
    const tile = dialog.querySelector("#tileDetails");
    if (!tile) return;
    if (tile.classList.contains("oasis")) return;
    const target = extractMapTarget(tile);
    if (!target) return;
    const srcVid = FM.tc.village();
    if (!srcVid) return;

    if (
      _fmMapBoxRef &&
      _fmMapBoxRef.isConnected &&
      dialog.contains(_fmMapBoxRef)
    )
      return;
    if (_fmMapBoxRef && _fmMapBoxRef.isConnected) _fmMapBoxRef.remove();
    dialog.querySelectorAll(".fm-map-box").forEach((p) => {
      if (p !== _fmMapBoxRef) p.remove();
    });
    _fmMapBoxRef = null;

    ensureVillageBucket(srcVid);

    const box = document.createElement("div");
    box.className = "fm-map-box";
    box.style.cssText = `margin:12px 0 0 0;padding:12px;background:linear-gradient(180deg,#f5f8ff,#e3ecf7);border:1px solid #8a9ac0;border-radius:5px;font-family:Verdana,sans-serif;font-size:12px;color:#1a2050;box-sizing:border-box;max-width:${MAX_WIDTH}px;width:100%;`;
    box.innerHTML = `
      <div style="font-weight:bold;color:#2a4a70;margin-bottom:8px;display:flex;align-items:center;gap:6px;font-size:13px;">
        <span>Farm Manager (v${FM_VERSION})</span>
        <span style="font-size:10px;color:#6a7a98;font-weight:normal;">source: ${esc(FM.tc.villageLabel(srcVid))}</span>
      </div>
      <div class="fm-map-fields">
        <label style="display:block;margin-bottom:6px;">
          <span style="display:inline-block;width:55px;font-weight:bold;">List:</span>
          <select class="fm-map-list" style="width:calc(100% - 110px);padding:3px;font-size:12px;"></select>
          <a href="#" class="fm-map-newlist" style="font-size:11px;margin-left:6px;color:#2a5a10;font-weight:bold;text-decoration:none;">+ new</a>
        </label>
        <div class="fm-map-status" style="margin-bottom:6px;font-size:10px;font-style:italic;color:#8a7050;"></div>
        <div class="fm-map-troops" style="margin-top:8px;padding:8px;background:rgba(255,255,255,.55);border-radius:4px;"></div>
        <label style="display:block;margin-top:8px;font-size:11px;">
          <input type="checkbox" class="fm-map-hero"> Hero follows
        </label>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button type="button" class="fm-map-add" style="flex:1;padding:6px 10px;background:linear-gradient(180deg,#7ab04a,#4a7a30);color:#fff;border:1px solid #2a5a10;border-radius:4px;font-weight:bold;cursor:pointer;font-size:12px;">Add to list</button>
          <button type="button" class="fm-map-remove" style="padding:6px 12px;background:linear-gradient(180deg,#d04a30,#a03020);color:#fff;border:1px solid #601010;border-radius:4px;cursor:pointer;font-size:12px;" disabled>Remove</button>
        </div>
        <div class="fm-map-msg" style="margin-top:8px;font-size:11px;color:#4a7a30;display:none;"></div>
      </div>
    `;

    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn && btn.type !== "button") btn.type = "button";
    });
    box.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          const t = e.target;
          if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      },
      true,
    );

    tile.parentNode.insertBefore(box, tile.nextSibling);
    _fmMapBoxRef = box;

    const listSelect = box.querySelector(".fm-map-list");
    const statusEl = box.querySelector(".fm-map-status");
    const troopsBox = box.querySelector(".fm-map-troops");
    const heroChk = box.querySelector(".fm-map-hero");
    const msg = box.querySelector(".fm-map-msg");
    const addBtn = box.querySelector(".fm-map-add");
    const removeBtn = box.querySelector(".fm-map-remove");

    function getBucket() {
      return fmState().byVillage[String(srcVid)];
    }
    function currentList() {
      const b = getBucket();
      return b.lists.find((l) => l.id === listSelect.value) || b.lists[0];
    }
    function targetInList(list) {
      if (!list) return null;
      return (
        list.targets.find((t) => t.x === target.x && t.y === target.y) || null
      );
    }
    function listsContainingVillage() {
      const b = getBucket();
      return b.lists.filter((l) =>
        l.targets.some((t) => t.x === target.x && t.y === target.y),
      );
    }

    function refreshListOptions(selectedId) {
      const b = getBucket();
      if (!b.lists.length) {
        const l = makeList("List 1");
        fmPatch((fm) => {
          const bb = fm.byVillage[String(srcVid)];
          bb.lists.push(l);
          bb.activeListId = l.id;
        });
      }
      const b2 = getBucket();
      listSelect.innerHTML = b2.lists
        .map(
          (l) =>
            `<option value="${esc(l.id)}" ${l.id === (selectedId || b2.activeListId) ? "selected" : ""}>${esc(l.name)} (${l.targets.length})</option>`,
        )
        .join("");
      renderStatus();
      renderTroopFields();
    }

    function renderStatus() {
      const listsWith = listsContainingVillage();
      if (listsWith.length === 0) {
        statusEl.textContent = "";
        statusEl.style.display = "none";
        return;
      }
      statusEl.style.display = "block";
      const names = listsWith.map((l) => esc(l.name)).join(", ");
      statusEl.innerHTML = `Already in: <b>${names}</b>`;
    }

    function renderTroopFields() {
      const l = currentList();
      if (!l) {
        troopsBox.innerHTML = "";
        return;
      }
      const inList = targetInList(l);
      removeBtn.disabled = !inList;
      let troops, hf;
      if (inList) {
        troops = inList.troops || l.troops;
        hf =
          inList.heroFollow !== undefined
            ? inList.heroFollow
            : l.heroFollow === true;
      } else {
        troops = l.troops;
        hf = l.heroFollow === true;
      }
      heroChk.checked = hf;
      troopsBox.innerHTML = troopGridHTML(troops, hf, 18);
      attachNumericFilter(troopsBox);
      const heroInp = troopsBox.querySelector(".fm-t-t11");
      if (heroInp) {
        heroInp.disabled = !hf;
        if (!hf) heroInp.value = 0;
      }
      if (inList) {
        addBtn.textContent = "Edit item";
        addBtn.style.background = "linear-gradient(180deg,#d09030,#a06020)";
        addBtn.style.borderColor = "#603010";
      } else {
        addBtn.textContent = "Add to list";
        addBtn.style.background = "linear-gradient(180deg,#7ab04a,#4a7a30)";
        addBtn.style.borderColor = "#2a5a10";
      }
    }

    listSelect.onchange = () => {
      fmPatch((fm) => {
        fm.byVillage[String(srcVid)].activeListId = listSelect.value;
      });
      renderStatus();
      renderTroopFields();
      msg.style.display = "none";
    };
    heroChk.onchange = () => {
      const l = currentList();
      if (!l) return;
      const on = heroChk.checked;
      const inList = targetInList(l);
      if (!inList) {
        fmPatch((fm) => {
          const ll = fm.byVillage[String(srcVid)].lists.find(
            (x) => x.id === l.id,
          );
          if (ll) ll.heroFollow = on;
        });
      }
      const heroInp = troopsBox.querySelector(".fm-t-t11");
      if (heroInp) {
        heroInp.disabled = !on;
        if (!on) heroInp.value = 0;
        else if (!parseInt(heroInp.value, 10)) heroInp.value = 1;
      }
    };
    box.querySelector(".fm-map-newlist").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = prompt(
        "New list name:",
        "List " + getBucket().lists.length + 1,
      );
      if (!name) return false;
      const l = makeList(name.trim());
      fmPatch((fm) => {
        fm.byVillage[String(srcVid)].lists.push(l);
      });
      refreshListOptions(l.id);
      return false;
    });
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const l = currentList();
      const existing = targetInList(l);
      if (!existing) return false;
      if (
        !confirm(
          `Remove "${existing.name}" (${existing.x}|${existing.y}) from "${l.name}"?`,
        )
      )
        return false;
      fmPatch((fm) => {
        const list = fm.byVillage[String(srcVid)].lists.find(
          (item) => item.id === l.id,
        );
        if (list)
          list.targets = list.targets.filter((item) => item.id !== existing.id);
      });
      msg.style.display = "block";
      msg.style.color = "#a03020";
      msg.textContent = `Removed ${existing.name} from ${l.name}`;
      refreshListOptions(l.id);
      return false;
    });

    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const l = currentList();
      if (!l) {
        msg.style.display = "block";
        msg.textContent = "No list";
        return false;
      }
      const troops = {};
      Object.keys(TROOP_LABELS).forEach((k) => {
        const inp = troopsBox.querySelector(".fm-t-" + k);
        let v = inp ? parseInt(inp.value, 10) : 0;
        if (isNaN(v) || v < 0) v = 0;
        troops[k] = v;
      });
      if (troops.t11 && !heroChk.checked) troops.t11 = 0;
      const existing = targetInList(l);
      if (existing) {
        fmPatch((fm) => {
          const ll = fm.byVillage[String(srcVid)].lists.find(
            (x) => x.id === l.id,
          );
          if (!ll) return;
          const tt = ll.targets.find((x) => x.id === existing.id);
          if (!tt) return;
          const isSameAsTemplate =
            Object.keys(TROOP_LABELS).every(
              (k) => (troops[k] | 0) === (ll.troops[k] | 0),
            ) && heroChk.checked === (ll.heroFollow === true);
          tt.troops = isSameAsTemplate ? null : { ...troops };
          tt.heroFollow = heroChk.checked;
        });
        msg.style.display = "block";
        msg.style.color = "#4a7a30";
        msg.textContent = `Updated in ${l.name}`;
        setTimeout(() => {
          const cancelBtn = dialog.querySelector(".dialogCancelButton");
          if (cancelBtn) cancelBtn.click();
        }, 500);
        return false;
      }
      const t = makeTarget(target);
      t.troops = { ...troops };
      t.heroFollow = heroChk.checked;
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (x) => x.id === l.id,
        );
        if (ll) ll.targets.push(t);
      });
      msg.style.display = "block";
      msg.style.color = "#4a7a30";
      msg.textContent = `Added: ${target.name}${target.distance != null ? " (" + target.distance + "f)" : ""} → ${l.name}`;
      setTimeout(() => {
        const cancelBtn = dialog.querySelector(".dialogCancelButton");
        if (cancelBtn) cancelBtn.click();
      }, 500);
      return false;
    });

    refreshListOptions();
  }
