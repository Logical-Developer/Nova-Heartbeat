  // ─────────────────────────────────────────────────────────────
  // Troops
  // ─────────────────────────────────────────────────────────────
  const TROOP_LABELS = {
    t1: "Phalanx",
    t2: "Swordsman",
    t3: "Pathfinder",
    t4: "Theutates Thunder",
    t5: "Druidrider",
    t6: "Haeduan",
    t7: "Ram",
    t8: "Trebuchet",
    t9: "Chieftain",
    t10: "Settler",
    t11: "Hero",
  };
  const TROOP_ICON_CLASS = {
    t1: "u21",
    t2: "u22",
    t3: "u23",
    t4: "u24",
    t5: "u25",
    t6: "u26",
    t7: "u27",
    t8: "u28",
    t9: "u29",
    t10: "u30",
    t11: "uhero",
  };
  function troopIconHTML(k, size = 16) {
    return `<img class="unit ${TROOP_ICON_CLASS[k]}" src="/img/x.gif" alt="${esc(TROOP_LABELS[k])}" title="${esc(TROOP_LABELS[k])}" style="width:${size}px;height:${size}px;vertical-align:middle;">`;
  }
  function troopsInlineHTML(troops, size = 16) {
    if (!troops) return "";
    const parts = [];
    for (const k of Object.keys(TROOP_LABELS)) {
      const v = troops[k] | 0;
      if (!v) continue;
      parts.push(
        `<span style="display:inline-flex;align-items:center;gap:2px;margin-right:5px;" title="${esc(TROOP_LABELS[k])} ${v}">${troopIconHTML(k, size)}<b style="font-size:10px;color:#2a5a10;">${v}</b></span>`,
      );
    }
    return parts.join("");
  }
  function troopGridHTML(troops, heroFollow, size = 18, prefix = "fm-t-") {
    const items = Object.keys(TROOP_LABELS)
      .map((k) => {
        const isHero = k === "t11";
        const disabled = isHero && !heroFollow;
        const v = troops[k] | 0;
        return `
        <label title="${esc(TROOP_LABELS[k])}" style="display:flex;align-items:center;gap:2px;font-size:11px;padding:2px 1px;">
          <span style="display:inline-block;width:14px;font-weight:bold;text-align:right;">${k.replace("t", "")}</span>
          ${troopIconHTML(k, size)}
          <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
            class="${prefix}${k}" value="${v}" maxlength="6"
            style="width:48px;padding:2px 4px;font-size:11px;text-align:center;border:1px solid #8a9ac0;border-radius:3px;box-sizing:border-box;${disabled ? "background:#e8e8e8;color:#888;" : ""}"
            ${disabled ? "disabled" : ""}>
        </label>
      `;
      })
      .join("");
    return `<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:2px;">${items}</div>`;
  }
  function numericInputHTML(cls, value, width = 44, disabled = false) {
    return `<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
      class="${cls}" value="${value}" maxlength="6"
      style="width:${width}px;padding:2px 4px;font-size:11px;text-align:center;border:1px solid #8a9ac0;border-radius:3px;box-sizing:border-box;${disabled ? "background:#e8e8e8;color:#888;" : ""}"
      ${disabled ? "disabled" : ""}>`;
  }
  function attachNumericFilter(root) {
    root.querySelectorAll('input[inputmode="numeric"]').forEach((inp) => {
      if (inp.dataset.fmNumAttached) return;
      inp.dataset.fmNumAttached = "1";
      inp.addEventListener("input", () => {
        const cleaned = inp.value.replace(/[^\d]/g, "").slice(0, 6);
        if (cleaned !== inp.value) inp.value = cleaned;
      });
    });
  }
  function troopCountLabel(list) {
    const parts = [];
    for (const k of Object.keys(TROOP_LABELS)) {
      const v = list.troops[k] || 0;
      if (!v) continue;
      parts.push(`${v}×${k.replace("t", "")}`);
    }
    return parts.length ? parts.join("+") : "0";
  }
  function makeList(name) {
    return {
      id: uid("L"),
      name: name || "New List",
      troops: {
        t1: 0,
        t2: 0,
        t3: 0,
        t4: 0,
        t5: 0,
        t6: 0,
        t7: 0,
        t8: 0,
        t9: 0,
        t10: 0,
        t11: 0,
      },
      autoFill: "fillAvailable",
      heroFollow: false,
      targets: [],
      createdAt: now(),
      cooldown: {
        enabled: true,
        minAttacks: 7,
        maxAttacks: 10,
        minDelayMs: 3000,
        maxDelayMs: 5000,
      },
    };
  }
  function makeTarget(v) {
    return {
      id: uid("T"),
      name: v.name,
      x: v.x,
      y: v.y,
      player: v.player || null,
      playerId: v.playerId || null,
      tribe: v.tribe || null,
      population: v.population || null,
      distance: typeof v.distance === "number" ? v.distance : null,
      isOasis: !!v.isOasis,
      addedAt: now(),
      status: "pending",
      lastRaid: null,
      lastSkipReason: null,
      partialRemaining: null,
      troops: null,
      selected: true,
      invalid: false,
    };
  }

  function limitTargetsByAvailableTroops(
    list,
    targets,
    snapshot,
    pausedRun,
    snapshotFresh,
  ) {
    if (!snapshot) return { maxTargets: targets.length, limitingKey: null };
    const targetIds = new Set(pausedRun?.targetIds || []);
    const reserved = {};
    // ⭐ فاز ۲: اگر snapshot تازه از صفحهٔ tt=2 خوانده شده باشد، سربازهای
    // ارسال‌شدهٔ همین run قبلاً از صفحه کم شده‌اند؛ کم‌کردن دوبارهٔ reserved غلط است.
    if (pausedRun && snapshotFresh !== true) {
      for (const target of list.targets) {
        if (!targetIds.has(target.id) || target.status !== "sent") continue;
        if (!target.lastRaid || target.lastRaid.at < (pausedRun.startedAt || 0))
          continue;
        if (target.lastRaid.runId && target.lastRaid.runId !== pausedRun.runId)
          continue;
        const used = target.troops || pausedRun.troops || list.troops;
        for (const key of Object.keys(TROOP_LABELS))
          reserved[key] = (reserved[key] | 0) + (used[key] | 0);
      }
    }

    let maxTargets = Infinity;
    let limitingKey = null;
    for (const key of Object.keys(TROOP_LABELS)) {
      const need = list.troops[key] | 0;
      if (need <= 0) continue;
      const available = Math.max(0, (snapshot[key] | 0) - (reserved[key] | 0));
      const canDo = Math.floor(available / need);
      if (canDo < maxTargets) {
        maxTargets = canDo;
        limitingKey = key;
      }
    }
    return { maxTargets: Math.min(targets.length, maxTargets), limitingKey };
  }

  // ─────────────────────────────────────────────────────────────
  // ⭐ فاز ۲ — منابع snapshot سرباز (خواندن تازه + TTL)
  // ─────────────────────────────────────────────────────────────
  // TTL دادهٔ cache‌شده (bucket.snapshot / run.troopSnapshot)
  const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

  function isSnapshotFresh(at) {
    return !!at && now() - at <= SNAPSHOT_TTL_MS;
  }

  function snapshotAgeLabel(at) {
    if (!at) return "unknown";
    const age = now() - at;
    if (age < 60000) return `${Math.round(age / 1000)}s`;
    return `${Math.round(age / 60000)}min`;
  }

  // ⭐ خواندن تعداد موجود سرباز از صفحهٔ Send Troops (tt=2).
  // مارک‌آپ واقعی Travian (private-doc/travian-document/Rally Point-tt2.txt):
  //   <input name="troop[t1]" value="" maxlength="6">&nbsp;/&nbsp;<a ...>11</a>
  // عدد «موجود» در لینک <a> کنار input است، نه در value.
  // اگر ساختار قابل‌اعتماد نباشد null برمی‌گردد تا رفتار قبلی حفظ شود
  // (هیچ‌وقت «همه صفر» استنباط نمی‌شود).
  function readTroopsFromSendTroopsPage() {
    const tbl = document.getElementById("troops");
    if (!tbl || !document.getElementById("ok")) return null;
    const out = {};
    let rows = 0;
    let links = 0;
    for (const k of Object.keys(TROOP_LABELS)) {
      const inp = tbl.querySelector(`input[name="troop[${k}]"]`);
      if (!inp) {
        out[k] = 0;
        continue;
      }
      rows++;
      let avail = null;
      const link = inp.nextElementSibling;
      if (link && link.tagName === "A") {
        links++;
        avail = cleanInt(link.textContent);
      }
      if (avail == null) avail = cleanInt(inp.value);
      out[k] = inp.disabled ? 0 : Math.max(0, avail || 0);
    }
    if (!rows || !links) return null;
    return out;
  }

  // ⭐ منبع حقیقت سرباز در لحظهٔ تصمیم (باگ #۲):
  // ۱) صفحهٔ tt=2 (تازه) ۲) cache فقط اگر TTL آن نگذشته باشد ۳) «نامعلوم»
  function resolveTroopSnapshot(farm) {
    const fresh = readTroopsFromSendTroopsPage();
    if (fresh) {
      const srcVid = String(farm?.sourceVid || "");
      if (srcVid) {
        fmPatch((fm) => {
          const b = fm.byVillage[srcVid];
          if (b) {
            b.snapshot = fresh;
            b.snapshotAt = now();
          }
        });
      }
      return { troops: fresh, at: now(), source: "tt2" };
    }
    const fm = fmState();
    const bucket = fm.byVillage?.[String(farm?.sourceVid || "")];
    const run = fm.runInProgress;
    const candidates = [
      { troops: run?.troopSnapshot, at: run?.troopSnapshotAt, source: "run" },
      { troops: bucket?.snapshot, at: bucket?.snapshotAt, source: "cache" },
    ];
    for (const c of candidates) {
      if (c.troops && isSnapshotFresh(c.at)) return c;
    }
    return { troops: null, at: 0, source: "unknown" };
  }

  // ⭐ انتخاب snapshot در زمان شروع/ادامهٔ run (باگ #۵)
  function pickStartSnapshot(bucket, pausedRun) {
    const fresh = readTroopsFromSendTroopsPage();
    if (fresh) return { troops: fresh, at: now(), source: "tt2" };
    const candidates = [
      {
        troops: pausedRun?.troopSnapshot,
        at: pausedRun?.troopSnapshotAt,
        source: "paused",
      },
      { troops: bucket?.snapshot, at: bucket?.snapshotAt, source: "cache" },
    ];
    for (const c of candidates) {
      if (c.troops && isSnapshotFresh(c.at)) return c;
    }
    return { troops: null, at: 0, source: "unknown" };
  }

  // ═════════════════════════════════════════════════════════════
  // Troop computation
  // ═════════════════════════════════════════════════════════════
  function getReservedInRun(runId, sourceVid, excludeTargetId) {
    const fm = fmState();
    const run = fm.runInProgress;
    if (!run || run.id !== runId) return {};

    const bucket = fm.byVillage[sourceVid];
    if (!bucket) return {};
    const list = bucket.lists.find((l) => l.id === run.listId);
    if (!list) return {};

    const reserved = {};
    const runStartedAt = run.startedAt || 0;

    for (const t of list.targets) {
      if (t.id === excludeTargetId) continue;
      if (t.status !== "sent" && t.status !== "partial") continue;
      if (!t.lastRaid || t.lastRaid.at < runStartedAt) continue;
      if (t.lastRaid.runId && t.lastRaid.runId !== runId) continue;

      const usedTroops = t.troops || list.troops;
      for (const [k, v] of Object.entries(usedTroops)) {
        reserved[k] = (reserved[k] | 0) + (v | 0);
      }
    }

    return reserved;
  }

  function computeTroopsToSend(farm) {
    const want = farm.troops || {};
    // ⭐ فاز ۲: autoFill دیگر dead field نیست.
    // اولویت: override سطح هدف (farm.autoFill) > مقدار run/list.
    const autoFill =
      farm.autoFill === "requireExact" ? "requireExact" : "fillAvailable";
    const resolved = resolveTroopSnapshot(farm);
    const snapshot = resolved.troops;
    // ⭐ snapshot تازهٔ tt=2 خودش سربازهای ارسال‌شده را کم کرده است.
    const freshFromPage = resolved.source === "tt2";
    const reserved = freshFromPage
      ? {}
      : getReservedInRun(farm.runId, farm.sourceVid, farm.targetId);
    const out = {};
    const missing = {};
    let partial = false;
    let noTroops = false;
    const remaining = {};

    // ⭐ حالت «تعداد دقیق لازم است» با snapshot نامعلوم → هیچ ارسالی انجام نمی‌شود.
    if (!snapshot && autoFill === "requireExact") {
      return {
        ok: false,
        reason: "troop-unknown",
        missing: { ...want },
        snapshotSource: resolved.source,
      };
    }

    for (const k of Object.keys(TROOP_LABELS)) {
      const wantN = Math.max(0, want[k] | 0);
      if (!wantN) {
        out[k] = 0;
        continue;
      }
      const known = !!snapshot;
      const have = known ? snapshot[k] | 0 : Infinity;
      const used = known ? reserved[k] | 0 : 0;
      const available = known ? Math.max(0, have - used) : wantN;

      // ⭐ باگ #۳: در حالت requireExact به‌جای ارسال جزئی، هدف رد می‌شود
      // و هیچ سربازی از reserved مصرف نمی‌شود.
      if (autoFill === "requireExact" && available < wantN) {
        out[k] = 0;
        missing[k] = wantN - available;
        continue;
      }

      if (wantN <= available) out[k] = wantN;
      else if (available > 0) {
        out[k] = available;
        remaining[k] = wantN - available;
        partial = true;
      } else {
        out[k] = 0;
        remaining[k] = wantN;
        if (known) noTroops = true;
        partial = true;
      }
    }
    if (farm.heroFollow && want.t11 > 0) {
      const haveHero = snapshot ? snapshot.t11 | 0 : 1;
      if (haveHero > 0 && !(reserved.t11 > 0)) out.t11 = 1;
      else {
        out.t11 = 0;
        remaining.t11 = 1;
        partial = true;
      }
    } else {
      out.t11 = 0;
    }

    // ⭐ باگ #۳: در حالت requireExact کمبود ⇒ رد هدف (skip) به‌جای ارسال جزئی
    if (Object.keys(missing).length) {
      return {
        ok: false,
        reason: "insufficient-troops",
        missing,
        remaining: missing,
        snapshotSource: resolved.source,
      };
    }

    const total = Object.values(out).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return {
        ok: false,
        reason: noTroops ? "no-troops-available" : "insufficient-troops",
        remaining: partial ? remaining : null,
        snapshotSource: resolved.source,
      };
    }
    return {
      ok: true,
      troops: out,
      partial,
      remaining: partial ? remaining : null,
      snapshotSource: resolved.source,
    };
  }
