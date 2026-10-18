    // ============================================================
    // STATE
    // ============================================================
    const state = {
        scanning: false,
        results: [],
        filterPercent: 0,
        maxDistance: 0,
        activeTab: "normal",
        debugBuffer: [],

        // ⭐ 1.6.2 — filters / sort (alliance + attacker are shared between modes via
        // the MODE-specific localStorage prefix, see FILTER_KEYS below)
        selectedAlliances: new Set(),
        availableAlliances: [],
        selectedAttackers: new Set(),
        availableAttackers: [],
        sortKey: "distance",
        sortAsc: true,
    };

    // ============================================================
    // FILTER / SORT PERSISTENCE KEYS (1.6.2)
    //   {mode} = "alliance" | "own" — an own scan never overwrites the
    //   alliance selections (same idea as the per-mode cache keys).
    // ============================================================
    const FILTER_KEYS = {
        ally: `nova_ara_${MODE.id}_ally_filter`,
        attacker: `nova_ara_${MODE.id}_attacker_filter`,
        sort: `nova_ara_${MODE.id}_sort`,
    };

    // ============================================================
    // SHARED WRAPPERS — bridge to src/shared/* (no business logic)
    // ============================================================
    const SHARED_CFG = {
        coordsCacheKey: MODE.coordsCacheKey,
        iframeMaxAttempts: CONFIG.iframeMaxAttempts,
        iframeWaitMs: CONFIG.iframeWaitMs,
        logger: (msg, data) => log(msg, data),
        debugPush: (entry) => state.debugBuffer.push(entry),
    };

    // ⭐ 1.6.1: استخراج ردیف به shared منتقل شد تا alliance و own یک پیاده‌سازی
    // داشته باشند (در /report/offensive لینک ردیف «?id=…» نسبی است و reportId در
    // a.reportInfoIcon[href*="reportId="] قرار دارد).
    function extractReportRow(tr) { return _sharedExtractReportRow(tr); }

    function readReportListFromPage() {
        const reports = _sharedReadReportListFromPage(appendLog);
        if (reports.length) return reports;

        // ⭐ 1.6.0: فالبک دوم — اگر جدول ساختار غیرمنتظره‌ای داشت، هر tbody را بگرد.
        appendLog("Shared reader found 0 rows — trying generic fallback...");
        const fallback = [];
        const seen = new Set();
        document.querySelectorAll("tbody tr").forEach((tr) => {
            const r = extractReportRow(tr);
            if (!r || seen.has(r.reportId)) return;
            seen.add(r.reportId);
            fallback.push(r);
        });
        appendLog(`Fallback reader found ${fallback.length} qualifying report(s).`);
        return fallback;
    }

    function parseReportDetail(doc, reportId) { return _sharedParseReportDetail(doc, reportId); }
    async function fetchReportDetail(report) { return _sharedFetchReportDetail(report, parseReportDetail); }

    // ⭐ 1.6.2: اتحادِ روستای هدف (نه اتحاد مهاجم). منبع به ترتیب اولویت:
    //   1. d.mapAlliance  ← از /karte.php?d=<id> (منبع اصلی و معتبر)
    //   2. d.defender.alliance ← اگر صفحهٔ گزارش اتحاد مدافع را داشت
    function targetAllianceOf(d) {
        return (d && (d.mapAlliance || d.defender?.alliance)) || "";
    }

    // ⭐ 1.6.2: فیلد یکنواخت روی نتیجهٔ aggregate — در _sharedAggregateByVillage
    // ذخیره نمی‌شود، پس بعد از آن روی هر آیتم ست می‌کنیم (بدون تغییر shared).
    function stampAlliance(aggregated, results) {
        const byVillage = new Map();
        results.forEach((r) => {
            if (!r.defender || !r.defender.villageId) return;
            const a = targetAllianceOf(r);
            if (!a) return;
            if (!byVillage.has(r.defender.villageId)) byVillage.set(r.defender.villageId, a);
        });
        aggregated.forEach((v) => {
            v.mapAlliance = byVillage.get(v.villageId) || "";
            // فیلد یکنواخت برای جدول/خروجی — اتحاد روستای هدف
            v.alliance = v.mapAlliance || v.alliance || "";
        });
        return aggregated;
    }

    function aggregateByVillage(results) {
        return stampAlliance(_sharedAggregateByVillage(results), results);
    }

    async function fetchVillageInfo(villageId) { return _sharedFetchVillageInfo(villageId, SHARED_CFG); }

    // ============================================================
    // FILTER HELPERS (1.6.2)
    //   Rule: an EMPTY selection set means "no filter" (everything passes).
    //   A selection equal to the full available list also means "no filter".
    //   Otherwise only the checked values pass.
    // ============================================================
    function isSelectionInactive(sel, available) {
        if (!sel || sel.size === 0) return true;
        if (available && sel.size >= available.length) return true;
        return false;
    }

    // Rebuild availableAlliances / availableAttackers from a results array and
    // restore the persisted selections (intersected with what is really there).
    function rebuildFilterOptions(results) {
        const allies = new Set();
        const attackers = new Set();
        results.forEach((r) => {
            const a = targetAllianceOf(r);
            if (a) allies.add(a);
            if (r.attacker && r.attacker.player) attackers.add(r.attacker.player);
        });

        state.availableAlliances = [...allies].sort((a, b) => a.localeCompare(b));
        state.availableAttackers = [...attackers].sort((a, b) => a.localeCompare(b));

        state.selectedAlliances = loadSelection(FILTER_KEYS.ally, allies);
        state.selectedAttackers = loadSelection(FILTER_KEYS.attacker, attackers);
    }

    function loadSelection(key, availableSet) {
        const available = [...availableSet];
        let saved = null;
        try {
            const raw = localStorage.getItem(key);
            if (raw) saved = JSON.parse(raw);
        } catch (e) { saved = null; }
        if (!Array.isArray(saved)) return new Set(available);
        return new Set(saved.filter((x) => availableSet.has(x)));
    }

    function saveSelection(key, set) {
        try { localStorage.setItem(key, JSON.stringify([...set])); } catch (e) {}
    }

    function loadSortPrefs() {
        try {
            const s = JSON.parse(localStorage.getItem(FILTER_KEYS.sort) || "null");
            if (s && s.key) {
                state.sortKey = s.key;
                state.sortAsc = !!s.asc;
            }
        } catch (e) {}
    }

    function saveSortPrefs() {
        try {
            localStorage.setItem(FILTER_KEYS.sort, JSON.stringify({ key: state.sortKey, asc: state.sortAsc }));
        } catch (e) {}
    }

    // ============================================================
    // MAIN SCAN
    // ============================================================
    async function runScan() {
        if (state.scanning) return;

        const reports = readReportListFromPage();
        if (reports.length === 0) {
            appendLog("No qualifying reports found on this page.");
            showToast("No qualifying reports on this page", "error");
            return;
        }

        const capped = reports.slice(0, CONFIG.maxReports);
        state.scanning = true;
        state.results = [];
        state.debugBuffer = [];
        setButtonsEnabled(true);

        appendLog(`--- Starting detailed analysis of ${capped.length} reports ---`);

        const details = [];
        for (let i = 0; i < capped.length; i++) {
            if (!state.scanning) {
                appendLog("Stopped by user.");
                break;
            }
            const r = capped[i];
            setProgress(`(${i + 1}/${capped.length})`);
            appendLog(`[${i + 1}/${capped.length}] ${r.subject}`);

            try {
                const d = await fetchReportDetail(r);
                // ⭐ 1.6.1: اگر صفحهٔ جزئیات loot را نداد، از آیکون carry فهرست
                // گزارش‌ها (alt="26/225") استفاده کن — در /report/offensive موجود است.
                if (!d.lootCap && r.lootFallback && r.lootFallback.cap > 0) {
                    d.lootCurrent = r.lootFallback.current;
                    d.lootCap = r.lootFallback.cap;
                    d.lootPercent = Math.min(100, Math.round((d.lootCurrent / d.lootCap) * 100));
                    d.lootSource = "list-icon";
                }
                d.alliance = r.alliance;
                d.dateTxt = r.dateTxt;
                details.push(d);
                state.debugBuffer.push({
                    phase: "report",
                    reportId: r.reportId,
                    subject: r.subject,
                    loot: `${d.lootPercent}% (${d.lootCurrent}/${d.lootCap})`,
                    defender: d.defender.village,
                    villageId: d.defender.villageId,
                    isNatars: d.isNatars,
                    isOasis: d.isOasis,
                });
            } catch (e) {
                appendLog(`  ✗ report ${r.reportId}: ${e.message}`);
                state.debugBuffer.push({ phase: "report", reportId: r.reportId, error: e.message });
            }
            await sleep(CONFIG.delayBetweenReports);
        }

        const uniqueVillageIds = [...new Set(
            details.map((d) => d.defender.villageId).filter((v) => v && v > 0)
        )];
        appendLog(`--- Fetching coordinates for ${uniqueVillageIds.length} unique villages ---`);

        for (let i = 0; i < uniqueVillageIds.length; i++) {
            if (!state.scanning) break;
            const vid = uniqueVillageIds[i];
            setProgress(`(${i + 1}/${uniqueVillageIds.length}) map`);
            try {
                const info = await fetchVillageInfo(vid);
                const coordStr = (info.x != null && info.y != null) ? `(${info.x}|${info.y})` : "NOT FOUND";
                const distStr = info.distance != null ? info.distance : "-";
                const tribeStr = info.tribe ?? "-";
                appendLog(`  Village ${vid} → ${coordStr} dist=${distStr} tribe=${tribeStr}`);
                details.forEach((d) => {
                    if (d.defender.villageId === vid) {
                        d.x = info.x;
                        d.y = info.y;
                        d.distance = info.distance;
                        d.tribe = info.tribe;
                        d.mapAlliance = info.alliance || ""; // ⭐ 1.6.2 — اتحاد دهکدهٔ هدف
                        if (info.name) d.defender.mapName = info.name;
                    }
                });
            } catch (e) {
                appendLog(`  ✗ map ${vid}: ${e.message}`);
            }
            await sleep(CONFIG.delayBetweenVillages);
        }

        state.results = details;
        state.scanning = false;
        setButtonsEnabled(false);

        // ⭐ 1.6.2 — available alliance/attacker lists + restore persisted selection
        rebuildFilterOptions(details);
        renderAllianceFilter();
        renderAttackerFilter();

        saveCache({
            timestamp: Date.now(),
            scanned: details.length,
            results: details,
        });

        appendLog(`=== Analysis complete ===`);
        appendLog(`✓ Processed ${details.length} report(s).`);

        renderList();
        updateStats();
        showActions(true);
        setProgress("done");

        const exportData = buildFilteredExport();
        appendLog(`- Normal Farms: ${exportData.normal.length}`);
        appendLog(`- Oases: ${exportData.oasis.length}`);
        appendLog(`- Natars: ${exportData.natars.length}`);

        showToast(`✓ Scanned ${details.length} reports`, "success", 2500);
    }

    // ============================================================
    // FILTERED AGGREGATE
    // ============================================================
    function getFilteredAggregated() {
        const minPct = state.filterPercent;
        const maxDist = state.maxDistance;

        // ── 1.6.2: attacker filter at raw-result level (a village may be
        //    attacked by several players, so this must run before aggregate)
        let filtered = state.results.filter((r) => r.lootPercent >= minPct);
        if (!isSelectionInactive(state.selectedAttackers, state.availableAttackers)) {
            filtered = filtered.filter((r) =>
                r.attacker && r.attacker.player && state.selectedAttackers.has(r.attacker.player)
            );
        }

        const aggregated = aggregateByVillage(filtered);

        // ── 1.6.2: alliance filter at aggregated level (target village alliance)
        let result = aggregated;
        if (!isSelectionInactive(state.selectedAlliances, state.availableAlliances)) {
            result = aggregated.filter((v) => {
                const ally = v.mapAlliance || v.alliance || "";
                return ally && state.selectedAlliances.has(ally);
            });
        }

        // ── existing distance filter
        result = result.filter((v) => {
            if (maxDist === 0) return true;
            if (v.distance == null) return false;
            return v.distance <= maxDist;
        });

        result.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999));
        return result;
    }

    // ============================================================
    // EXPORT: ANALYTICAL JSON
    // ============================================================
    function buildFilteredExport() {
        const aggregated = getFilteredAggregated();

        const mkEntry = (v) => ({
            villageId: v.villageId,
            village: v.village,
            player: v.player,
            // ⭐ 1.6.2 — اتحادِ دهکدهٔ هدف (نه اتحاد مهاجم)
            alliance: v.mapAlliance || v.alliance || null,
            tribe: v.tribe,
            x: v.x,
            y: v.y,
            distance: v.distance,
            lootPercent: v.maxLootPercent,
            hits: v.hits,
            attackers: v.attackers,
        });

        const normal = aggregated.filter((v) => !v.isNatars && !v.isOasis);
        const oasis = aggregated.filter((v) => v.isOasis && !v.isNatars);
        const natars = aggregated.filter((v) => v.isNatars);

        const includeNormal = document.getElementById("nova-chk-normal")?.checked ?? true;
        const includeOasis = document.getElementById("nova-chk-oasis")?.checked ?? false;
        const includeNatars = document.getElementById("nova-chk-natars")?.checked ?? false;

        return {
            meta: {
                app: MODE.title,
                mode: MODE.id,
                version: CONFIG.version,
                exportedAt: new Date().toISOString(),
                minLootPercent: state.filterPercent,
                maxDistance: state.maxDistance === 0 ? null : state.maxDistance,
                totalScanned: state.results.length,
                totalFiltered: aggregated.length,
                normalCount: includeNormal ? normal.length : 0,
                oasisCount: includeOasis ? oasis.length : 0,
                natarsCount: includeNatars ? natars.length : 0,
                included: { normal: includeNormal, oasis: includeOasis, natars: includeNatars },
                allianceFilter: [...state.selectedAlliances],
                attackerFilter: [...state.selectedAttackers],
                sort: { key: state.sortKey, asc: state.sortAsc },
            },
            normal: includeNormal ? normal.map(mkEntry) : [],
            oasis: includeOasis ? oasis.map(mkEntry) : [],
            natars: includeNatars ? natars.map(mkEntry) : [],
        };
    }

    // ============================================================
    // EXPORT: FARM-LIST-V1
    // ============================================================
    function buildFarmListV1() {
        const aggregated = getFilteredAggregated();

        const includeNormal = document.getElementById("nova-chk-normal")?.checked ?? true;
        const includeOasis = document.getElementById("nova-chk-oasis")?.checked ?? false;
        const includeNatars = document.getElementById("nova-chk-natars")?.checked ?? false;

        let chosen = [];
        if (includeNormal) chosen = chosen.concat(aggregated.filter((v) => !v.isNatars && !v.isOasis));
        if (includeOasis) chosen = chosen.concat(aggregated.filter((v) => v.isOasis && !v.isNatars));
        if (includeNatars) chosen = chosen.concat(aggregated.filter((v) => v.isNatars));

        chosen.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999));

        const ttInput = document.getElementById("nova-tt-count");
        const ttCount = ttInput ? (parseInt(ttInput.value, 10) || CONFIG.defaultTT) : CONFIG.defaultTT;

        const defaultTroops = {
            t1: 0, t2: 0, t3: 0, t4: ttCount,
            t5: 0, t6: 0, t7: 0, t8: 0, t9: 0, t10: 0, t11: 0,
        };

        const targets = chosen
            .filter((v) => v.x != null && v.y != null)
            .map((v) => _sharedBuildFarmListTarget(v, defaultTroops));

        return _sharedBuildFarmListDocument(MODE.farmListName, defaultTroops, targets);
    }

    // ============================================================
    // SORT (1.6.2) — client-side, applied at render level only so the
    // export order (distance asc) stays exactly as in 1.6.1.
    // ============================================================
    const SORT_KEYS = ["village", "x", "distance", "lootPercent", "tribe", "alliance", "player"];

    function sortValue(v, key) {
        switch (key) {
            case "village": return (v.village || "").toLowerCase();
            case "x": return (v.x != null && v.y != null) ? (v.x * 10000 + v.y) : 99999999;
            case "distance": return v.distance ?? 999999;
            case "lootPercent": return v.lootPercent ?? 0;
            case "tribe": return (v.tribe || "").toLowerCase();
            case "alliance": return (v.alliance || "").toLowerCase();
            case "player": return (v.player || "").toLowerCase();
            default: return 0;
        }
    }

    function sortItems(items, key, asc) {
        if (!SORT_KEYS.includes(key)) return items;
        return [...items].sort((a, b) => {
            const va = sortValue(a, key);
            const vb = sortValue(b, key);
            if (va < vb) return asc ? -1 : 1;
            if (va > vb) return asc ? 1 : -1;
            return 0;
        });
    }

    // ============================================================
    // RENDER
    // ============================================================
    function renderList() {
        const listEl = document.getElementById("nova-ara-a-list");
        if (!listEl) return;

        const data = buildFilteredExport();
        let items = [];
        if (state.activeTab === "normal") items = data.normal;
        else if (state.activeTab === "oasis") items = data.oasis;
        else items = data.natars;

        items = sortItems(items, state.sortKey, state.sortAsc);

        if (items.length === 0) {
            const distInfo = state.maxDistance > 0 ? `, distance ≤ ${state.maxDistance}` : "";
            listEl.innerHTML = `<div class="nova-empty">No results (loot ≥ ${state.filterPercent}%${distInfo})</div>`;
            return;
        }

        const ind = (k) => state.sortKey === k
            ? `<span class="sort-ind">${state.sortAsc ? "▲" : "▼"}</span>`
            : "";

        const rows = items.map((v) => {
            let cls = "p0";
            if (v.lootPercent >= 90) cls = "p90";
            else if (v.lootPercent >= 70) cls = "p70";
            else if (v.lootPercent >= 50) cls = "p50";
            const dist = v.distance != null ? v.distance : "—";
            const coord = (v.x != null && v.y != null) ? `${v.x}|${v.y}` : "—";
            const tribe = v.tribe ? `<span class="nova-tribe-tag">${escapeHtml(v.tribe)}</span>` : "";
            const ally = v.alliance
                ? `<span class="nova-ally-tag" title="${escapeHtml(v.alliance)}">${escapeHtml(v.alliance)}</span>`
                : "—";
            const nat = v.isNatars ? `<span class="nova-nat-tag">NAT</span>` : "";
            const oas = v.isOasis ? `<span class="nova-oasis-tag">OASIS</span>` : "";
            const hits = v.hits > 1 ? `<span class="nova-hits">×${v.hits}</span>` : "";

            const mapUrl = (v.x != null && v.y != null)
                ? `/karte.php?x=${v.x}&y=${v.y}`
                : `/karte.php?d=${v.villageId}`;
            const nameHtml = `<a class="nova-vlink" href="${mapUrl}" target="_blank" rel="noopener">${escapeHtml(cleanVillageName(v.village))}</a>`;

            return `<tr>
                <td>${nameHtml} ${nat}${oas}</td>
                <td>${coord}</td>
                <td>${dist}</td>
                <td><span class="nova-loot-pct ${cls}">${v.lootPercent}%</span>${hits}</td>
                <td>${tribe}</td>
                <td>${ally}</td>
                <td title="${escapeHtml(v.player || "")}">${escapeHtml(v.player || "—")}</td>
            </tr>`;
        }).join("");

        listEl.innerHTML = `<table class="nova-table">
            <thead><tr>
                <th data-sort="village">Village${ind("village")}</th>
                <th data-sort="x">Coord${ind("x")}</th>
                <th data-sort="distance">Dist${ind("distance")}</th>
                <th data-sort="lootPercent">Loot${ind("lootPercent")}</th>
                <th data-sort="tribe">Tribe${ind("tribe")}</th>
                <th data-sort="alliance">Alliance${ind("alliance")}</th>
                <th data-sort="player">Player${ind("player")}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

        listEl.querySelectorAll("th[data-sort]").forEach((th) => {
            th.addEventListener("click", () => {
                const k = th.dataset.sort;
                if (state.sortKey === k) state.sortAsc = !state.sortAsc;
                else { state.sortKey = k; state.sortAsc = true; }
                saveSortPrefs();
                renderList();
            });
        });
    }

    function updateStats() {
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = v;
        };
        const aggregated = getFilteredAggregated();
        const normal = aggregated.filter((v) => !v.isNatars && !v.isOasis);
        const oasis = aggregated.filter((v) => v.isOasis && !v.isNatars);
        const natars = aggregated.filter((v) => v.isNatars);
        set("nova-stat-scanned", state.results.length);
        set("nova-stat-normal", normal.length);
        set("nova-stat-oasis", oasis.length);
        set("nova-stat-natars", natars.length);
    }

    function showActions(visible) {
        const wrap = document.getElementById("nova-ara-a-actions");
        if (wrap) wrap.style.display = visible ? "flex" : "none";
    }
