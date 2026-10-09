  function exportListCompact(srcVid, listId, onlySelected) {
    const data = readFMData();
    const bucket = data.byVillage[String(srcVid)];
    const list = bucket?.lists.find((l) => l.id === listId);
    if (!list) return null;
    let targets = list.targets;
    if (onlySelected) targets = targets.filter((t) => t.selected !== false);
    return JSON.stringify(
      {
        _format: "farm-list-v1",
        _exported: now(),
        list: {
          name: list.name,
          troops: { ...list.troops },
          heroFollow: list.heroFollow === true,
          autoFill: list.autoFill || "fillAvailable",
          cooldown: list.cooldown ? { ...list.cooldown } : undefined,
          targets: targets.map((t) => {
            const out = { name: t.name, x: t.x, y: t.y, distance: t.distance };
            if (t.troops && Object.values(t.troops).some((v) => v > 0))
              out.troops = { ...t.troops };
            if (t.heroFollow !== undefined) out.heroFollow = t.heroFollow;
            if (t.autoFill) out.autoFill = t.autoFill;
            return out;
          }),
        },
      },
      null,
      2,
    );
  }

  function parseImportText(text) {
    if (!text || !text.trim()) return { ok: false, error: "Empty input" };
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.list && Array.isArray(parsed.list.targets))
          return { ok: true, list: parsed.list };
        if (Array.isArray(parsed))
          return {
            ok: true,
            list: {
              name: "Imported",
              targets: parsed,
              troops: null,
              heroFollow: false,
            },
          };
      } catch (e) {}
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const targets = [];
    for (const line of lines) {
      const m = line.match(/(-?\d+)\s*[|,\s]\s*(-?\d+)/);
      if (!m) continue;
      const x = parseInt(m[1], 10);
      const y = parseInt(m[2], 10);
      if (isNaN(x) || isNaN(y)) continue;
      let name = line
        .replace(m[0], "")
        .replace(/^[():,;\-\s]+|[():,;\-\s]+$/g, "")
        .trim();
      if (!name) name = `${x}|${y}`;
      targets.push({ name, x, y });
    }
    if (!targets.length) return { ok: false, error: "No coordinates found" };
    return {
      ok: true,
      list: { name: "Imported", targets, troops: null, heroFollow: false },
    };
  }

  // ⭐ فاز ۳ (باگ #۳): تشخیص شکل JSON ورودی — farm-list-v1 هم پذیرفته می‌شود
  function extractLossEntries(parsed) {
    if (Array.isArray(parsed))
      return { entries: parsed, format: "array", jsonListName: null };
    if (!parsed || typeof parsed !== "object")
      return { entries: null, format: null, jsonListName: null };
    if (parsed.list && Array.isArray(parsed.list.targets)) {
      return {
        entries: parsed.list.targets,
        format:
          parsed._format === "farm-list-v1" ? "farm-list-v1" : "list.targets",
        jsonListName: parsed.list.name || null,
      };
    }
    for (const key of ["blacklist", "targets", "villages", "coordinates"]) {
      if (Array.isArray(parsed[key]))
        return { entries: parsed[key], format: key, jsonListName: null };
    }
    return { entries: null, format: null, jsonListName: null };
  }

  function parseLossCoordinates(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: "Invalid JSON" };
    }
    const { entries, format, jsonListName } = extractLossEntries(parsed);
    if (!entries)
      return {
        ok: false,
        error:
          "Unsupported JSON — expected farm-list-v1, { blacklist: [...] }, { targets: [...] } or an array of villages",
      };

    const coordinates = [];
    const seen = new Set();
    let invalid = 0,
      duplicates = 0;
    for (const entry of entries) {
      const coords = entry?.coords || entry?.coordinates || entry;
      const rawX = String(coords?.x ?? "").trim();
      const rawY = String(coords?.y ?? "").trim();
      if (!/^-?\d+$/.test(rawX) || !/^-?\d+$/.test(rawY)) {
        invalid++;
        continue;
      }
      const x = Number(rawX),
        y = Number(rawY);
      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        invalid++;
        continue;
      }
      const key = `${x}|${y}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      coordinates.push({ x, y });
    }
    if (!coordinates.length)
      return { ok: false, error: "No valid village coordinates found" };
    return {
      ok: true,
      coordinates,
      invalid,
      duplicates,
      total: entries.length,
      // ⭐ فاز ۳: شکل ورودی برای نمایش در Preview
      format,
      jsonListName,
    };
  }

  function previewLossRemoval(text, srcVid, targetListId) {
    const parsed = parseLossCoordinates(text);
    if (!parsed.ok) return parsed;
    const list = readFMData().byVillage[String(srcVid)]?.lists.find(
      (l) => l.id === targetListId,
    );
    if (!list) return { ok: false, error: "Target list not found" };
    const targetCoords = new Set(list.targets.map((t) => `${t.x}|${t.y}`));
    const matched = parsed.coordinates.filter((c) =>
      targetCoords.has(`${c.x}|${c.y}`),
    ).length;
    return {
      ...parsed,
      matched,
      notFound: parsed.coordinates.length - matched,
      listName: list.name,
    };
  }

  function removeLossTargets(text, srcVid, targetListId) {
    const preview = previewLossRemoval(text, srcVid, targetListId);
    if (!preview.ok) return preview;
    if (!preview.matched) return { ...preview, removed: 0 };

    const coordinateSet = new Set(
      preview.coordinates.map((c) => `${c.x}|${c.y}`),
    );
    makeBackup(`remove loss targets from ${preview.listName}`);
    let removed = 0;
    fmPatch((fm) => {
      const list = fm.byVillage[String(srcVid)]?.lists.find(
        (l) => l.id === targetListId,
      );
      if (!list) return;
      const before = list.targets.length;
      list.targets = list.targets.filter(
        (t) => !coordinateSet.has(`${t.x}|${t.y}`),
      );
      removed = before - list.targets.length;
    });
    return {
      ...preview,
      removed,
      notFound: preview.notFound,
    };
  }

  function previewImport(text, srcVid, mode, targetListId) {
    const parsed = parseImportText(text);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const data = readFMData();
    const bucket = data.byVillage[String(srcVid)];
    if (!bucket) return { ok: false, error: "No village bucket" };

    let existingCoords = new Set();
    if (mode === "existing" && targetListId) {
      const targetList = bucket.lists.find((l) => l.id === targetListId);
      if (targetList)
        existingCoords = new Set(
          targetList.targets.map((t) => `${t.x}|${t.y}`),
        );
    }

    let newCount = 0,
      dupCount = 0,
      invalidCount = 0;
    const seenInFile = new Set();

    for (const t of parsed.list.targets) {
      if (typeof t.x !== "number" || typeof t.y !== "number") {
        invalidCount++;
        continue;
      }
      const key = `${t.x}|${t.y}`;
      if (existingCoords.has(key)) {
        dupCount++;
        continue;
      }
      if (seenInFile.has(key)) {
        dupCount++;
        continue;
      }
      seenInFile.add(key);
      newCount++;
    }

    return {
      ok: true,
      newCount,
      dupCount,
      invalidCount,
      totalInFile: parsed.list.targets.length,
      jsonListName: parsed.list.name || null,
    };
  }

  function importListToTarget(text, srcVid, mode, targetListId, newListName) {
    const parsed = parseImportText(text);
    if (!parsed.ok) return parsed;

    ensureVillageBucket(srcVid);
    const data = readFMData();
    const bucket = data.byVillage[String(srcVid)];

    let targetList;
    let finalName;
    let finalId;

    if (mode === "new") {
      let baseName =
        (newListName && newListName.trim()) ||
        parsed.list.name ||
        "Imported List";
      finalName = baseName;
      let counter = 1;
      const existingNames = new Set(bucket.lists.map((l) => l.name));
      while (existingNames.has(finalName))
        finalName = `${baseName} (${counter++})`;

      finalId = uid("L");
      targetList = {
        id: finalId,
        name: finalName,
        troops: parsed.list.troops || {
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
        autoFill:
          parsed.list.autoFill === "requireExact"
            ? "requireExact"
            : "fillAvailable",
        heroFollow: parsed.list.heroFollow === true,
        cooldown: parsed.list.cooldown || {
          enabled: true,
          minAttacks: 7,
          maxAttacks: 10,
          minDelayMs: 3000,
          maxDelayMs: 5000,
        },
        targets: [],
        createdAt: now(),
      };
    } else {
      targetList = bucket.lists.find((l) => l.id === targetListId);
      if (!targetList) return { ok: false, error: "Target list not found" };
      finalName = targetList.name;
      finalId = targetList.id;
    }

    const existingCoords = new Set(
      mode === "existing" ? targetList.targets.map((t) => `${t.x}|${t.y}`) : [],
    );
    const seenInFile = new Set();

    let added = 0,
      dup = 0,
      invalid = 0;
    const newTargets = [];

    for (const t of parsed.list.targets) {
      if (typeof t.x !== "number" || typeof t.y !== "number") {
        invalid++;
        continue;
      }
      const key = `${t.x}|${t.y}`;
      if (existingCoords.has(key)) {
        dup++;
        continue;
      }
      if (seenInFile.has(key)) {
        dup++;
        continue;
      }
      seenInFile.add(key);

      const newTarget = {
        id: uid("T"),
        name: t.name || `${t.x}|${t.y}`,
        x: t.x,
        y: t.y,
        player: t.player || null,
        playerId: t.playerId || null,
        tribe: null,
        population: null,
        distance: typeof t.distance === "number" ? t.distance : null,
        isOasis: false,
        addedAt: now(),
        status: "pending",
        lastRaid: null,
        lastSkipReason: null,
        partialRemaining: null,
        troops: t.troops || null,
        heroFollow: t.heroFollow,
        autoFill:
          t.autoFill === "requireExact" || t.autoFill === "fillAvailable"
            ? t.autoFill
            : undefined,
        selected: true,
        invalid: false,
      };
      newTargets.push(newTarget);
      added++;
    }

    if (mode === "new") {
      targetList.targets = newTargets;
      fmPatch((fm) => {
        fm.byVillage[String(srcVid)].lists.push(targetList);
        fm.byVillage[String(srcVid)].activeListId = targetList.id;
      });
    } else {
      fmPatch((fm) => {
        const ll = fm.byVillage[String(srcVid)].lists.find(
          (l) => l.id === targetListId,
        );
        if (ll) ll.targets = ll.targets.concat(newTargets);
        fm.byVillage[String(srcVid)].activeListId = targetListId;
      });
    }

    return {
      ok: true,
      listId: finalId,
      listName: finalName,
      added,
      dup,
      invalid,
      mode,
      jsonListName: parsed.list.name || null,
    };
  }

  function importListFromText(text, srcVid) {
    const res = importListToTarget(text, srcVid, "new", null, null);
    if (!res.ok) return res;
    return {
      ok: true,
      listId: res.listId,
      listName: res.listName,
      targetCount: res.added,
      skipped: res.dup + res.invalid,
    };
  }
