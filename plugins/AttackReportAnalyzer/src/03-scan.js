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
    function aggregateByVillage(results) { return _sharedAggregateByVillage(results); }
    async function fetchVillageInfo(villageId) { return _sharedFetchVillageInfo(villageId, SHARED_CFG); }

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
        const filtered = state.results.filter((r) => r.lootPercent >= minPct);
        const aggregated = aggregateByVillage(filtered);
        const result = aggregated.filter((v) => {
            if (maxDist === 0) return true;
            if (v.distance == null) return false;
            return v.distance <= maxDist;
        });
        result.sort((a, b) => {
            const da = a.distance ?? 99999;
            const db = b.distance ?? 99999;
            return da - db;
        });
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
            alliance: v.alliance,
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

        if (items.length === 0) {
            const distInfo = state.maxDistance > 0 ? `, distance ≤ ${state.maxDistance}` : "";
            listEl.innerHTML = `<div class="nova-empty">No results (loot ≥ ${state.filterPercent}%${distInfo})</div>`;
            return;
        }

        const rows = items.map((v) => {
            let cls = "p0";
            if (v.lootPercent >= 90) cls = "p90";
            else if (v.lootPercent >= 70) cls = "p70";
            else if (v.lootPercent >= 50) cls = "p50";
            const dist = v.distance != null ? v.distance : "—";
            const coord = (v.x != null && v.y != null) ? `${v.x}|${v.y}` : "—";
            const tribe = v.tribe ? `<span class="nova-tribe-tag">${escapeHtml(v.tribe)}</span>` : "";
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
                <td title="${escapeHtml(v.player || "")}">${escapeHtml(v.player || "—")}</td>
            </tr>`;
        }).join("");

        listEl.innerHTML = `<table class="nova-table">
            <thead><tr>
                <th>Village</th><th>Coord</th><th>Dist</th><th>Loot</th><th>Tribe</th><th>Player</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
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
