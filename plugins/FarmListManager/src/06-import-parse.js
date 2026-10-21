  // ─────────────────────────────────────────────────────────────
  // Import payload parsing / validation
  //
  // Accepted shapes:
  //  1) farm-list-v1 (AttackReportAnalyzer export)
  //     { _format: "farm-list-v1", list: { name, troops, targets: [{name,x,y}] }, blacklist: [...] }
  //  2) { targets: [ {x, y, name} ], name?: string }
  //  3) [ {x, y, name} ]  |  [ [x, y] ]  |  [ "123|456" ]
  //  4) { blacklist: [...] } — blacklist only, nothing to import
  // ─────────────────────────────────────────────────────────────
  const MAP_LIMIT = 400;

  function _coerceTarget(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return { x: cleanInt(raw[0]), y: cleanInt(raw[1]), name: String(raw[2] || "") };
    }
    if (typeof raw === "object") {
      const x = cleanInt(raw.x ?? raw.X ?? raw.coordX);
      const y = cleanInt(raw.y ?? raw.Y ?? raw.coordY);
      return { x, y, name: String(raw.name ?? raw.village ?? raw.villageName ?? "").trim() };
    }
    if (typeof raw === "string") {
      const m = stripInvisible(raw).match(/(-?\d+)\s*[|:,;\s]\s*(-?\d+)/);
      if (m) return { x: parseInt(m[1], 10), y: parseInt(m[2], 10), name: "" };
    }
    return null;
  }

  function parseImportPayload(text) {
    const result = {
      ok: false,
      format: null,
      listName: "",
      targets: [],
      blacklist: [],
      errors: [],
      warnings: [],
      totalRaw: 0,
    };
    let data;
    try {
      data = JSON.parse(String(text || "").trim());
    } catch (e) {
      result.errors.push("Invalid JSON: " + (e && e.message ? e.message : "parse error"));
      return result;
    }
    let rawTargets = null;
    if (Array.isArray(data)) {
      result.format = "array";
      rawTargets = data;
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.targets)) {
        result.format = data._format ? String(data._format) : "object.targets";
        rawTargets = data.targets;
        result.listName = String(data.name || (data.list && data.list.name) || "").trim();
      } else if (data.list && Array.isArray(data.list.targets)) {
        result.format = String(data._format || "farm-list-v1");
        rawTargets = data.list.targets;
        result.listName = String(data.list.name || "").trim();
      } else if (Array.isArray(data.blacklist)) {
        result.format = "blacklist-only";
        rawTargets = [];
      }
      if (Array.isArray(data.blacklist)) {
        result.blacklist = data.blacklist.map(_coerceTarget).filter(Boolean);
      }
    }
    if (!result.format) {
      result.errors.push("Unrecognised payload. Expected farm-list-v1, {targets:[...]} or an array of {x,y}.");
      return result;
    }
    if (rawTargets === null) {
      result.errors.push("No `targets` array found in payload.");
      return result;
    }
    result.totalRaw = rawTargets.length;
    const seen = new Set();
    const blackset = new Set(result.blacklist.map((b) => b.x + "|" + b.y));
    for (let i = 0; i < rawTargets.length; i++) {
      const t = _coerceTarget(rawTargets[i]);
      if (!t) {
        result.warnings.push(`#${i + 1}: unreadable entry (skipped)`);
        continue;
      }
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) {
        result.warnings.push(`#${i + 1}: missing coordinates (skipped)`);
        continue;
      }
      if (Math.abs(t.x) > MAP_LIMIT || Math.abs(t.y) > MAP_LIMIT) {
        result.warnings.push(`#${i + 1}: (${t.x}|${t.y}) out of map bounds (skipped)`);
        continue;
      }
      const key = t.x + "|" + t.y;
      if (blackset.has(key)) {
        result.warnings.push(`#${i + 1}: (${t.x}|${t.y}) is blacklisted (skipped)`);
        continue;
      }
      if (seen.has(key)) {
        result.warnings.push(`#${i + 1}: duplicate inside payload (${t.x}|${t.y}) — skipped`);
        continue;
      }
      seen.add(key);
      result.targets.push({ x: t.x, y: t.y, name: t.name || "" });
    }
    if (result.targets.length > MAX_IMPORT_TARGETS) {
      result.warnings.push(`Payload has ${result.targets.length} targets — only the first ${MAX_IMPORT_TARGETS} are kept.`);
      result.targets = result.targets.slice(0, MAX_IMPORT_TARGETS);
    }
    result.ok = result.targets.length > 0;
    if (!result.ok && !result.errors.length) result.errors.push("No valid targets after validation.");
    // One-line summary so a failed import can be diagnosed from the log alone.
    flmLog(
      "INFO",
      `parse ok: format=${result.format} targets=${result.targets.length} warnings=${result.warnings.length}`,
    );
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Duplicate analysis against a scanned list
  // ─────────────────────────────────────────────────────────────
  const DUP_MODE = { SKIP: "skip", FORCE: "force", ABORT: "abort" };

  function analyzeDuplicates(parsedTargets, existingTargets) {
    const existing = new Set((existingTargets || []).map((t) => t.x + "|" + t.y));
    const dup = [];
    const fresh = [];
    for (const t of parsedTargets || []) {
      if (existing.has(t.x + "|" + t.y)) dup.push(t);
      else fresh.push(t);
    }
    return { fresh, duplicates: dup, duplicateCount: dup.length };
  }

  function capacityCheck(list, incomingCount, mode) {
    const capacity = (list && list.capacity) || SLOT_CAPACITY;
    const free = Math.max(0, capacity - ((list && list.used) || 0));
    const usable = mode === IMPORT_MODE.REPLACE ? capacity : free;
    if (incomingCount > usable) {
      return {
        ok: false,
        free,
        capacity,
        overflow: incomingCount - usable,
        message:
          mode === IMPORT_MODE.REPLACE
            ? `${incomingCount} targets exceed the list capacity (${capacity}).`
            : `Only ${free} free slot(s) in this list — ${incomingCount} targets requested.`,
      };
    }
    return { ok: true, free, capacity, overflow: 0 };
  }

  function summarizeTargets(targets) {
    const t = targets || [];
    if (!t.length) return "-";
    return t
      .slice(0, 3)
      .map((x) => `(${x.x}|${x.y})`)
      .join(", ") + (t.length > 3 ? ` +${t.length - 3}` : "");
  }

  // Converts a full list scan into the same JSON shape we accept for import
  // (handy for building a payload from the current list / copying between lists).
  function exportListAsPayload(list) {
    return {
      _format: "farm-list-v1",
      list: {
        name: list.name,
        village: list.villageName,
        targets: (list.targets || []).map((t) => ({ name: t.name, x: t.x, y: t.y })),
      },
    };
  }
