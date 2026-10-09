// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: 2026-10-09T18:59:38.090Z
// Source: src/ + ../../src/shared/
// Rebuild: node build.js
// ═══════════════════════════════════════════════════════════
// ==UserScript==
// @name         Nova Attack Report Analyzer - Alliance (V 1.6.1)
// @name:fa      نوا آنالایزر گزارش حملات اتحاد
// @namespace    https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer
// @version      1.6.1
// @description  Analyze attack reports (alliance + own). Extract farm targets with loot %, distance, coordinates, tribe. Separate Natars and Oases. Export as farm-list-v1 (compatible with Farm Manager) or analytical JSON.
// @description:fa  تحلیل گزارش‌های حمله (اتحاد و شخصی). استخراج فارم‌ها با درصد غارت، فاصله، مختصات و نژاد. خروجی farm-list-v1 (سازگار با Farm Manager) یا JSON تحلیلی.
// @author       Nova
// @match        *://*.travian.com/alliance/reports*
// @match        *://*.travian.com/report/offensive*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer
// @supportURL   https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer/issues
// @updateURL    https://raw.githubusercontent.com/Logical-Developer/Nova-Attack-Report-Analyzer/main/Nova-Attack-Report-Analyzer-Alliance.user.js
// @downloadURL  https://raw.githubusercontent.com/Logical-Developer/Nova-Attack-Report-Analyzer/main/Nova-Attack-Report-Analyzer-Alliance.user.js
// ==/UserScript==

(function () {
    "use strict";
// ═══════════════════════════════════════════════════════════
// src/shared/01-utils.js — pure string / coord / format helpers.
// No IIFE, no globals, no plugin config. Every symbol is prefixed
// with `_shared` so it is collision-safe when concatenated into a plugin.
// ═══════════════════════════════════════════════════════════

function _sharedEscapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function _sharedStripBidi(s) {
    return String(s ?? "").replace(
        /[\u202A-\u202E\u200E\u200F\u2066-\u2069\u200B\u200C\u200D\uFEFF]/g,
        ""
    );
}

function _sharedCleanVillageName(name) {
    if (!name) return "Unknown";
    return _sharedStripBidi(name).trim().replace(/\s+/g, " ");
}

function _sharedParseCoord(str) {
    if (str === null || str === undefined) return NaN;
    let cleaned = _sharedStripBidi(str);
    cleaned = cleaned
        .replace(/\u2212/g, "-")
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2043\uFE63\uFF0D]/g, "-");
    cleaned = cleaned.replace(/[^\d-]/g, "");
    const m = cleaned.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : NaN;
}

function _sharedExtractVillageId(url) {
    if (!url) return null;
    const m = url.match(/[?&]d=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

function _sharedTimestampSuffix() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function _sharedSleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
// ═══════════════════════════════════════════════════════════
// src/shared/02-storage.js — pure localStorage cache helpers.
// Storage keys and TTLs are always passed in by the caller
// (no plugin-specific key is hardcoded here).
// ═══════════════════════════════════════════════════════════

function _sharedSaveCache(key, data, logger) {
    try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
        if (typeof logger === "function") logger("cache save failed", e);
    }
}

function _sharedLoadCache(key, ttlMs) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.data) return null;
        if (Date.now() - obj.ts > ttlMs) return null;
        return { ...obj.data, _cachedAt: obj.ts };
    } catch (e) { return null; }
}

function _sharedClearCacheKey(key) {
    localStorage.removeItem(key);
}

function _sharedLoadCoordsCache(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function _sharedSaveCoordsCache(key, c) {
    try { localStorage.setItem(key, JSON.stringify(c)); } catch (e) {}
}
    // ============================================================
    // PHASE 3: FETCH MAP DETAIL
    // ============================================================
    async function _sharedFetchVillageInfo(villageId, cfg) {
        const cache = _sharedLoadCoordsCache(cfg.coordsCacheKey);
        const key = String(villageId);
        if (cache[key] && cache[key].x != null && cache[key].y != null
            && cache[key].distance != null && cache[key].tribe) {
            cfg.logger(`cache hit full ${villageId}`, cache[key]);
            return cache[key];
        }

        let info = { x: null, y: null, distance: null, name: null, tribe: null };

        try {
            const url = `/karte.php?d=${villageId}`;
            const res = await fetch(url, { credentials: "include" });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const hasTD = !!doc.querySelector("#tileDetails");
            cfg.debugPush({
                phase: "map-fetch", villageId, url,
                htmlLength: html.length,
                hasTileDetails: hasTD,
            });
            if (hasTD) {
                info = _sharedParseMapDetail(doc);
            }
        } catch (e) {
            cfg.logger(`fetch failed ${villageId}`, e.message);
        }

        if (info.x != null && info.y != null && info.distance != null && info.tribe) {
            cache[key] = info;
            _sharedSaveCoordsCache(cfg.coordsCacheKey, cache);
            return info;
        }

        const iframeInfo = await _sharedFetchVillageInfoViaIframe(villageId, cfg);
        if (iframeInfo) {
            if (info.x == null) info.x = iframeInfo.x;
            if (info.y == null) info.y = iframeInfo.y;
            if (info.distance == null) info.distance = iframeInfo.distance;
            if (!info.tribe) info.tribe = iframeInfo.tribe;
            if (!info.name) info.name = iframeInfo.name;
        }

        if (info.x != null && info.y != null) {
            cache[key] = info;
            _sharedSaveCoordsCache(cfg.coordsCacheKey, cache);
        }
        return info;
    }

    function _sharedFetchVillageInfoViaIframe(villageId, cfg) {
        return new Promise((resolve) => {
            let done = false;
            const finish = (info) => {
                if (done) return;
                done = true;
                try {
                    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
                } catch (e) {}
                cfg.debugPush({ phase: "map-iframe", villageId, ...info });
                resolve(info);
            };

            const iframe = document.createElement("iframe");
            iframe.style.cssText =
                "position:fixed;left:-9999px;top:-9999px;width:800px;height:800px;visibility:hidden;";
            iframe.src = `/karte.php?d=${villageId}`;

            let attempts = 0;
            const check = () => {
                attempts++;
                let iDoc = null;
                try { iDoc = iframe.contentDocument; } catch (e) {}
                if (iDoc) {
                    const tileDetails = iDoc.querySelector("#tileDetails");
                    const mapDetails = iDoc.querySelector("#map_details");
                    if (tileDetails && mapDetails) {
                        const h1 = tileDetails.querySelector("h1.titleInHeader");
                        const h1Text = h1 ? _sharedStripBidi(h1.textContent) : "";
                        const looksLikeMap = /^map$/i.test(h1Text.trim());
                        if (!looksLikeMap) {
                            const info = _sharedParseMapDetail(iDoc);
                            cfg.logger(`iframe parsed ${villageId}`, info);
                            finish(info);
                            return;
                        }
                    }
                }
                if (attempts >= cfg.iframeMaxAttempts) {
                    finish({ x: null, y: null, distance: null, name: null, tribe: null });
                    return;
                }
                setTimeout(check, cfg.iframeWaitMs);
            };

            iframe.onload = () => setTimeout(check, 250);
            iframe.onerror = () => finish({ x: null, y: null, distance: null, name: null, tribe: null });
            document.body.appendChild(iframe);

            setTimeout(() => {
                if (!done) finish({ x: null, y: null, distance: null, name: null, tribe: null });
            }, cfg.iframeMaxAttempts * cfg.iframeWaitMs + 2000);
        });
    }

    function _sharedParseMapDetail(doc) {
        const out = { x: null, y: null, distance: null, name: null, tribe: null };

        const tileDetails = doc.querySelector("#tileDetails");
        const scope = tileDetails || doc;

        const cx = scope.querySelector(".coordinateX");
        const cy = scope.querySelector(".coordinateY");
        if (cx && cy) {
            const x = _sharedParseCoord(cx.textContent);
            const y = _sharedParseCoord(cy.textContent);
            if (!isNaN(x)) out.x = x;
            if (!isNaN(y)) out.y = y;
        }

        const h1 = scope.querySelector("h1.titleInHeader") || doc.querySelector("h1.titleInHeader");
        if (h1) {
            const clone = h1.cloneNode(true);
            clone.querySelectorAll(".coordinates, .mainVillage, .clear").forEach((n) => n.remove());
            const t = _sharedStripBidi(clone.textContent).trim();
            if (t && !/^map$/i.test(t)) out.name = t;
        }

        const detailsRoot = doc.querySelector("#map_details")
            || doc.querySelector("#tileDetails")
            || doc;

        detailsRoot.querySelectorAll("tr").forEach((tr) => {
            const th = tr.querySelector("th");
            const td = tr.querySelector("td");
            if (!th || !td) return;
            const label = _sharedStripBidi(th.textContent).trim().toLowerCase();
            const val = _sharedStripBidi(td.textContent).trim();
            if (label === "distance" && out.distance === null) {
                const m = val.match(/([\d.]+)/);
                if (m) out.distance = Math.round(parseFloat(m[1]));
            }
            if (label === "tribe" && !out.tribe) {
                if (val) out.tribe = val;
            }
        });

        if (out.distance === null || !out.tribe) {
            doc.querySelectorAll("tr").forEach((tr) => {
                const th = tr.querySelector("th");
                const td = tr.querySelector("td");
                if (!th || !td) return;
                const label = _sharedStripBidi(th.textContent).trim().toLowerCase();
                const val = _sharedStripBidi(td.textContent).trim();
                if (out.distance === null && /distance/i.test(label)) {
                    const m = val.match(/([\d.]+)/);
                    if (m) out.distance = Math.round(parseFloat(m[1]));
                }
                if (!out.tribe && /tribe/i.test(label)) {
                    if (val) out.tribe = val;
                }
            });
        }

        return out;
    }
    // ============================================================
    // PHASE 1: READ REPORT LIST
    // ============================================================
    // ⭐ 1.6.1: یک ردیف گزارش را از DOM استخراج می‌کند (مشترک بین alliance و own).
    // تفاوت‌های واقعی دو صفحه:
    //   /alliance/reports → جدول #offs، لینک ردیف: /report?id=<id>|hash&s=1
    //   /report/offensive → جدول #overview، لینک ردیف: ?id=<id>%7Chash&s=1 (نسبی)
    // و در صفحهٔ offensive، reportId دقیق‌تر از a.reportInfoIcon[href*="reportId="]
    // خوانده می‌شود و alt آیکون carry هم loot را در خود دارد (فالبک).
    function _sharedNormalizeReportHref(href) {
        const h = String(href || "").trim();
        if (!h) return "";
        const q = h.indexOf("?");
        if (q >= 0) {
            const query = h.slice(q);
            // ?id=… , /report?id=… , /report/offensive?id=… → /report?id=…
            if (/[?&]id=\d+/.test(query)) return "/report" + query;
        }
        return h;
    }

    function _sharedExtractReportRow(tr) {
        if (!tr) return null;
        const img = tr.querySelector("img.iReport");
        if (!img) return null;
        if (!img.classList.contains("iReport1")) return null;

        // ⚠️ نکتهٔ مهم (1.6.1): querySelectorAll در مرورگر «اسکوپ‌شده» نیست —
        // سلکتوری مثل 'td.sub div a[href*="id="]' لینک‌هایی را هم برمی‌گرداند که
        // فقط یکی از جدهای div شان بیرون از ردیف است (مثلاً داخل #reportsForm).
        // در نتیجه در /report/offensive آیکون reportInfoIcon (که href آن
        // /build.php?id=39&…&reportId=… است) به‌جای لینک موضوع انتخاب می‌شد و
        // عنوان خالی/لینک اشتباه می‌داد. پس روی aهای داخل td.sub دستی فیلتر می‌کنیم.
        const subTd = tr.querySelector("td.sub") || tr;
        let link = null;
        let loose = null;
        let looseAny = null;
        for (const a of subTd.querySelectorAll('a[href*="id="]')) {
            if (a.classList.contains("reportInfoIcon")) continue;
            const h = a.getAttribute("href") || "";
            if (!/[?&]id=\d+/.test(h)) continue;
            if (!looseAny) looseAny = a;
            if (!a.textContent.trim()) continue;
            const isReportLink = /report\?id=\d+/i.test(h) || /^\?id=\d+/.test(h);
            if (isReportLink) { link = a; break; }
            if (!loose) loose = a;
        }
        if (!link) link = loose || looseAny;
        if (!link) return null;

        const href = link.getAttribute("href") || "";
        const m = href.match(/[?&]id=(\d+)/);
        if (!m) return null;

        // در صفحهٔ offensive، آیکون reportInfoIcon دقیق‌ترین reportId را دارد
        const icon = tr.querySelector('a.reportInfoIcon[href*="reportId="]');
        const iconHref = icon ? icon.getAttribute("href") || "" : "";
        const im = iconHref.match(/[?&]reportId=(\d+)/);
        const reportId = parseInt(im ? im[1] : m[1], 10);
        if (!reportId) return null;

        // فالبک loot: alt آیکون carry مثل "26/225" (carried/capacity)
        let lootFallback = null;
        const carryImg = tr.querySelector("img.reportInfo");
        const carryTxt = carryImg ? carryImg.getAttribute("alt") || "" : "";
        const cm = carryTxt.match(/([\d,]+)\s*\/\s*([\d,]+)/);
        if (cm) {
            lootFallback = {
                current: parseInt(cm[1].replace(/,/g, ""), 10) || 0,
                cap: parseInt(cm[2].replace(/,/g, ""), 10) || 0,
            };
        }

        return {
            reportId,
            subject: link.textContent.trim(),
            alliance: tr.querySelector("td.al a")?.textContent.trim() || "",
            dateTxt: tr.querySelector("td.dat")?.textContent.trim() || "",
            href: _sharedNormalizeReportHref(href),
            lootFallback,
        };
    }

    function _sharedReadReportListFromPage(logger) {
        logger("Reading report list...");
        const reports = [];
        const seen = new Set();

        // ── مسیر ۱ (alliance): جدول اختصاصی #offs ──
        const allianceRows = document.querySelectorAll("#offs tbody tr");
        allianceRows.forEach((tr) => {
            const r = _sharedExtractReportRow(tr);
            if (!r || seen.has(r.reportId)) return;
            seen.add(r.reportId);
            reports.push(r);
        });

        // ── مسیر ۲ (own / fallback): هر ردیف گزارش روی صفحه ──
        // ⭐ 1.6.1: /report/offensive از table#overview.row_table_data استفاده
        // می‌کند، پس #offs پیدا نمی‌شد و اسکن «No qualifying reports» می‌داد.
        if (reports.length === 0) {
            const genericRows = document.querySelectorAll(
                "#overview tbody tr, #reportsForm tbody tr, table.row_table_data tbody tr, tbody tr"
            );
            genericRows.forEach((tr) => {
                const r = _sharedExtractReportRow(tr);
                if (!r || seen.has(r.reportId)) return;
                seen.add(r.reportId);
                reports.push(r);
            });
        }

        logger(`Found ${reports.length} qualifying report(s).`);
        return reports;
    }

    // ============================================================
    // PHASE 2: FETCH REPORT DETAIL
    // ============================================================
    async function _sharedFetchReportDetail(report, parseDetail) {
        const url = report.href || `/report?id=${report.reportId}&aid=6`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return parseDetail(doc, report.reportId);
    }

    function _sharedParseReportDetail(doc, reportId) {
        const out = {
            reportId,
            subject: "",
            date: "",
            attacker: { player: null, village: null, villageId: null, alliance: null },
            defender: { player: null, village: null, villageId: null, alliance: null },
            lootPercent: 0,
            lootCurrent: 0,
            lootCap: 0,
            isNatars: false,
            isOasis: false,
        };

        const subjectEl = doc.querySelector(".headline .subject");
        if (subjectEl) out.subject = subjectEl.textContent.trim();

        const timeEl = doc.querySelector(".header .time .text");
        if (timeEl) out.date = timeEl.textContent.trim();

        const carryVal = doc.querySelector(".additionalInformation .inlineIcon.carry .value");
        if (carryVal) {
            const txt = _sharedStripBidi(carryVal.textContent);
            const m = txt.match(/([\d,]+)\s*\/\s*([\d,]+)/);
            if (m) {
                out.lootCurrent = parseInt(m[1].replace(/,/g, ""), 10) || 0;
                out.lootCap = parseInt(m[2].replace(/,/g, ""), 10) || 0;
                if (out.lootCap > 0) {
                    out.lootPercent = Math.min(100, Math.round((out.lootCurrent / out.lootCap) * 100));
                }
            }
        }

        const atk = doc.querySelector(".role.attacker");
        if (atk) {
            const p = atk.querySelector("a.player");
            const v = atk.querySelector("a.village");
            const a = atk.querySelector(".troopHeadline span.inline-block a, .troopHeadline a[href^='/alliance/']");
            out.attacker.player = p ? p.textContent.trim() : null;
            out.attacker.village = v ? _sharedStripBidi(v.textContent) : null;
            out.attacker.villageId = v ? _sharedExtractVillageId(v.getAttribute("href")) : null;
            out.attacker.alliance = a ? a.textContent.trim() : null;
        }

        const def = doc.querySelector(".role.defender");
        if (def) {
            const p = def.querySelector("a.player");
            const v = def.querySelector("a.village");
            const a = def.querySelector(".troopHeadline span.inline-block a, .troopHeadline a[href^='/alliance/']");
            out.defender.player = p ? p.textContent.trim() : null;
            out.defender.village = v ? _sharedStripBidi(v.textContent) : null;
            out.defender.villageId = v ? _sharedExtractVillageId(v.getAttribute("href")) : null;
            out.defender.alliance = a ? a.textContent.trim() : null;
        }

        if (/raids\s+Natars/i.test(out.subject)) out.isNatars = true;
        if (out.defender.player && /^natars$/i.test(out.defender.player)) out.isNatars = true;

        const vname = (out.defender.village || "").toLowerCase();
        if (/unoccupied oasis/i.test(vname)) out.isOasis = true;
        if (/occupied oasis/i.test(vname)) out.isOasis = true;
        if (!out.defender.player && !out.isNatars) out.isOasis = true;

        return out;
    }

    // ============================================================
    // AGGREGATE
    // ============================================================
    function _sharedAggregateByVillage(results) {
        const map = new Map();
        results.forEach((r) => {
            const vid = r.defender.villageId;
            if (!vid) return;
            if (!map.has(vid)) {
                map.set(vid, {
                    villageId: vid,
                    village: r.defender.village,
                    player: r.defender.player,
                    alliance: r.defender.alliance,
                    isNatars: r.isNatars,
                    isOasis: r.isOasis,
                    x: r.x,
                    y: r.y,
                    distance: r.distance,
                    tribe: r.tribe,
                    maxLootPercent: r.lootPercent,
                    hits: 1,
                    attackers: [r.attacker.player].filter(Boolean),
                });
            } else {
                const e = map.get(vid);
                e.hits += 1;
                if (r.lootPercent > e.maxLootPercent) e.maxLootPercent = r.lootPercent;
                if (r.attacker.player && !e.attackers.includes(r.attacker.player)) {
                    e.attackers.push(r.attacker.player);
                }
                if (e.x === null && r.x !== null) e.x = r.x;
                if (e.y === null && r.y !== null) e.y = r.y;
                if (e.distance === null && r.distance !== null) e.distance = r.distance;
                if (!e.tribe && r.tribe) e.tribe = r.tribe;
            }
        });
        return [...map.values()];
    }
// ═══════════════════════════════════════════════════════════
// src/shared/05-farmlist.js — farm-list-v1 export primitives.
// The *builder* (`buildFarmListV1`) stays inside each plugin (it reads
// plugin DOM/state); only the generic document + target shapes live here.
// Key order and values must stay exactly as they were in v1.5.1.
// ═══════════════════════════════════════════════════════════

function _sharedBuildFarmListTarget(entry, troops) {
    return {
        name: _sharedCleanVillageName(entry.village),
        x: entry.x,
        y: entry.y,
        distance: entry.distance != null ? Math.round(entry.distance) : null,
        troops: { ...troops },
        heroFollow: false,
    };
}

function _sharedBuildFarmListDocument(listName, troops, targets) {
    return {
        _format: "farm-list-v1",
        _exported: Date.now(),
        list: {
            name: listName,
            troops: { ...troops },
            heroFollow: false,
            targets,
        },
    };
}
    // ============================================================
    // CONFIG
    // ============================================================
    const CONFIG = {
        version: "1.6.1",
        debug: true,
        delayBetweenReports: 300,
        delayBetweenVillages: 400,
        storageKey: "nova_ara_alliance_cache_v5",
        coordsCacheKey: "nova_ara_alliance_coords_v5",
        cacheTTL: 30 * 60 * 1000,
        maxReports: 500,
        iframeWaitMs: 150,
        iframeMaxAttempts: 40,
        farmListName: "Nova Alliance Farms",
        defaultTT: 3,
    };

    // ============================================================
    // PAGE MODES (1.6.0)
    //   alliance → /alliance/reports   (Nova Alliance Attack Analyzer)
    //   own      → /report/offensive   (Nova Attack Report Analyzer — Own)
    // Cache keys are per-mode so an alliance scan never mixes with an own scan.
    // ============================================================
    const MODES = {
        alliance: {
            id: "alliance",
            title: "Nova Alliance Attack Analyzer",
            storageKey: CONFIG.storageKey,
            coordsCacheKey: CONFIG.coordsCacheKey,
            farmListName: CONFIG.farmListName,
            fileTag: "alliance",
            pathTest: /\/alliance\/reports/,
        },
        own: {
            id: "own",
            title: "Nova Attack Report Analyzer — Own Reports",
            storageKey: "nova_ara_own_cache_v1",
            coordsCacheKey: "nova_ara_own_coords_v1",
            farmListName: "Nova Own Farms",
            fileTag: "own",
            pathTest: /\/report\/offensive/,
        },
    };

    function detectMode() {
        const p = location.pathname;
        for (const m of Object.values(MODES)) {
            if (m.pathTest.test(p)) return m;
        }
        return null;
    }

    const MODE = detectMode() || MODES.alliance;

    // ============================================================
    // THEME
    // ============================================================
    const THEME = {
        bgPanel: "linear-gradient(180deg,#f9fbff,#e8eff9)",
        bgSection: "rgba(255,255,255,.55)",
        border: "#8a9ac0",
        borderLight: "#c0cde0",
        text: "#1a2050",
        textMuted: "#5a6a80",
        titleColor: "#2a4a70",
        green: "linear-gradient(180deg,#7ab04a,#4a7a30)",
        greenBorder: "#2a5a10",
        blue: "linear-gradient(180deg,#6a9ee8,#3060b0)",
        blueBorder: "#204080",
        orange: "linear-gradient(180deg,#d09030,#a06020)",
        orangeBorder: "#603010",
        red: "linear-gradient(180deg,#d9534f,#a03020)",
        redBorder: "#601010",
        gray: "#e0e8f0",
        grayBorder: "#8a9ac0",
        cyan: "linear-gradient(180deg,#5bc0de,#3a99b8)",
        cyanBorder: "#1a6070",
        purple: "linear-gradient(180deg,#b380d9,#7a3a9c)",
        purpleBorder: "#4a2060",
    };

    // ============================================================
    // UTILS / STORAGE — wrappers over src/shared/* (CONFIG injected here)
    // ============================================================
    const log = (...a) => CONFIG.debug && console.log(`[Nova ARA-${MODE.fileTag}]`, ...a);
    const sleep = (ms) => _sharedSleep(ms);

    function escapeHtml(s) { return _sharedEscapeHtml(s); }
    function stripBidi(s) { return _sharedStripBidi(s); }
    function cleanVillageName(name) { return _sharedCleanVillageName(name); }
    function parseCoord(str) { return _sharedParseCoord(str); }
    function extractVillageId(url) { return _sharedExtractVillageId(url); }
    function timestampSuffix() { return _sharedTimestampSuffix(); }

    function saveCache(data) { _sharedSaveCache(MODE.storageKey, data, log); }
    function loadCache() { return _sharedLoadCache(MODE.storageKey, CONFIG.cacheTTL); }
    function clearCache() {
        _sharedClearCacheKey(MODE.storageKey);
        _sharedClearCacheKey(MODE.coordsCacheKey);
    }
    function loadCoordsCache() { return _sharedLoadCoordsCache(MODE.coordsCacheKey); }
    function saveCoordsCache(c) { _sharedSaveCoordsCache(MODE.coordsCacheKey, c); }
    // ============================================================
    // UI: STYLES
    // ============================================================
    function injectStyles() {
        if (document.getElementById("nova-ara-a-styles")) return;
        const st = document.createElement("style");
        st.id = "nova-ara-a-styles";
        st.textContent = `
            .nova-btn {
                cursor: pointer; touch-action: manipulation;
                border-radius: 5px; font-weight: bold;
                font-family: Verdana, sans-serif;
                transition: filter .15s ease, transform .08s ease;
                display: inline-flex; align-items: center; justify-content: center;
                gap: 5px; white-space: nowrap; box-sizing: border-box;
            }
            .nova-btn:hover { filter: brightness(1.08); }
            .nova-btn:active { transform: translateY(1px); filter: brightness(.95); }
            .nova-btn:disabled { opacity: .55; cursor: not-allowed; filter: none; }
            .nova-btn-icon { font-size: 14px; line-height: 1; }
            .nova-toast {
                position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
                background: linear-gradient(180deg,#ffe9a8,#f0c860);
                border: 2px solid #7a5c30; border-radius: 8px;
                padding: 10px 18px; color: #5a2a08; font-weight: bold;
                font-size: 13px; z-index: 2147483647;
                box-shadow: 0 6px 20px rgba(0,0,0,.35);
                font-family: Verdana, sans-serif;
                max-width: 90vw; word-wrap: break-word;
                text-align: center; box-sizing: border-box;
                animation: novaToastIn .25s ease-out;
            }
            @keyframes novaToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            .nova-toast.success { background: linear-gradient(180deg,#d0f0b0,#8ac060); border-color: #4a7a30; color: #2a4a10; }
            .nova-toast.error { background: linear-gradient(180deg,#f0c0b0,#d08070); border-color: #a03020; color: #5a1010; }
            .nova-toast.info { background: linear-gradient(180deg,#c0dff0,#80b0d0); border-color: #3060a0; color: #1a3050; }

            #nova-ara-a-box .nova-tab {
                display: flex; gap: 2px; margin-top: 10px;
                border-bottom: 1px solid #8a9ac0;
            }
            #nova-ara-a-box .nova-tab button {
                flex: 1; padding: 7px 8px; cursor: pointer;
                background: rgba(255,255,255,.4);
                border: 1px solid #8a9ac0; border-bottom: none;
                border-radius: 5px 5px 0 0;
                font-size: 12px; font-weight: bold; color: #2a4a70;
            }
            #nova-ara-a-box .nova-tab button.active {
                background: #fff; color: #1a2050;
            }
            #nova-ara-a-box .nova-list {
                max-height: 300px; overflow-y: auto; margin-top: 6px;
                background: rgba(255,255,255,.45); border-radius: 5px;
                border: 1px solid #8a9ac0;
            }
            #nova-ara-a-box table.nova-table {
                width: 100%; border-collapse: collapse; font-size: 11px;
                font-family: 'Courier New', monospace;
            }
            #nova-ara-a-box table.nova-table th {
                background: #8a9ec4; color: #fff; padding: 4px 5px;
                text-align: left; position: sticky; top: 0; z-index: 1;
            }
            #nova-ara-a-box table.nova-table td {
                padding: 3px 5px; border-bottom: 1px dashed #c0c8d8;
            }
            #nova-ara-a-box table.nova-table tr:hover td {
                background: rgba(120,200,80,.15);
            }
            #nova-ara-a-box .nova-loot-pct {
                display: inline-block; padding: 0 5px; border-radius: 3px;
                font-weight: bold; min-width: 38px; text-align: center;
            }
            #nova-ara-a-box .nova-loot-pct.p90 { background: #4a8228; color: #fff; }
            #nova-ara-a-box .nova-loot-pct.p70 { background: #d09030; color: #fff; }
            #nova-ara-a-box .nova-loot-pct.p50 { background: #d0d0a0; color: #5a4a10; }
            #nova-ara-a-box .nova-loot-pct.p0  { background: #d0a0a0; color: #5a1010; }
            #nova-ara-a-box .nova-empty {
                padding: 14px; text-align: center;
                color: #8a7050; font-style: italic; font-size: 12px;
            }
            #nova-ara-a-box .nova-nat-tag {
                display: inline-block; background: #7a3a9c; color: #fff;
                padding: 1px 5px; border-radius: 3px; font-size: 9px;
                font-weight: bold; margin-left: 3px;
            }
            #nova-ara-a-box .nova-oasis-tag {
                display: inline-block; background: #3a7a9c; color: #fff;
                padding: 1px 5px; border-radius: 3px; font-size: 9px;
                font-weight: bold; margin-left: 3px;
            }
            #nova-ara-a-box .nova-tribe-tag {
                display: inline-block; background: rgba(80,130,200,.3);
                color: #1a3050; padding: 1px 5px; border-radius: 3px;
                font-size: 9px; font-weight: bold;
            }
            #nova-ara-a-box .nova-hits {
                display: inline-block; background: rgba(120,200,80,.4);
                color: #1a4a10; padding: 1px 6px; border-radius: 3px;
                font-size: 10px; font-weight: bold; margin-left: 3px;
            }
            #nova-ara-a-box a.nova-vlink {
                color: #2a5ab0; text-decoration: none; font-weight: bold;
            }
            #nova-ara-a-box a.nova-vlink:hover {
                text-decoration: underline; color: #1a3a80;
            }
            #nova-ara-a-box .nova-chk-row {
                display: flex; flex-wrap: wrap; gap: 10px;
                align-items: center; margin-bottom: 8px;
                padding: 7px 10px; background: rgba(255,255,255,.5);
                border: 1px solid #c0cde0; border-radius: 5px;
                font-size: 12px; font-weight: bold; color: #2a4a70;
            }
            #nova-ara-a-box .nova-chk-row label {
                display: inline-flex; align-items: center; gap: 4px;
                cursor: pointer; user-select: none;
            }
            #nova-ara-a-box .nova-chk-row input[type="checkbox"] {
                cursor: pointer; width: 15px; height: 15px;
            }
            #nova-ara-a-box .nova-section {
                margin-bottom: 10px; padding: 9px 11px;
                background: rgba(255,255,255,.55);
                border: 1px solid #c0cde0; border-radius: 6px;
            }
            #nova-ara-a-box .nova-section label {
                color: #2a4a70; font-weight: bold;
                display: flex; align-items: center; gap: 8px;
                flex-wrap: wrap; font-size: 12px;
            }
            #nova-ara-a-box .nova-val-badge {
                font-family:'Courier New',monospace; font-weight:bold;
                background:#3a4a80; color:#fff; padding:2px 8px;
                border-radius:3px; min-width:44px; text-align:center;
            }
        `;
        document.head.appendChild(st);
    }

    function showToast(msg, type = "", duration = 2200) {
        injectStyles();
        const ex = document.querySelector(".nova-toast");
        if (ex) ex.remove();
        const el = document.createElement("div");
        el.className = `nova-toast ${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.transition = "opacity .3s ease";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    // ============================================================
    // BUILD UI BOX
    // ============================================================
    function buildBox() {
        injectStyles();
        const boxId = "nova-ara-a-box";
        if (document.getElementById(boxId)) return document.getElementById(boxId);

        const box = document.createElement("div");
        box.id = boxId;
        box.style.cssText = `
            background: ${THEME.bgPanel};
            border: 2px solid ${THEME.border};
            border-radius: 10px;
            padding: 14px;
            margin: 10px 0;
            color: ${THEME.text};
            font-family: Verdana, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 14px rgba(0,0,0,.15);
            box-sizing: border-box;
        `;

        box.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                <span style="font-weight:bold;font-size:16px;color:${THEME.titleColor};">⚔️ ${MODE.title}</span>
                <span style="font-size:10px;color:${THEME.textMuted};background:rgba(255,255,255,.6);padding:2px 7px;border-radius:10px;">v${CONFIG.version}</span>
            </div>

            <div style="margin-bottom:10px;padding:9px 11px;background:${THEME.bgSection};border:1px solid ${THEME.borderLight};border-radius:6px;font-size:11px;color:${THEME.textMuted};line-height:1.5;">
                Scans the current page only. Filters reports tagged
                <b style="color:${THEME.titleColor};">"Won as attacker without losses"</b>.
                Oases and Natars are grouped in separate tabs.<br>
                Source: <b style="color:${THEME.titleColor};">${MODE.id === "own" ? "Own reports (/report/offensive)" : "Alliance reports (/alliance/reports)"}</b>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                <button id="nova-ara-a-scan" class="nova-btn" style="
                    background:${THEME.green};color:#fff;border:1px solid ${THEME.greenBorder};
                    padding:9px 16px;font-size:13px;
                ">
                    <span class="nova-btn-icon">🔍</span> Scan Reports
                </button>
                <button id="nova-ara-a-stop" class="nova-btn" style="
                    background:${THEME.gray};color:${THEME.text};border:1px solid ${THEME.grayBorder};
                    padding:9px 12px;font-size:12px;
                " disabled>
                    <span class="nova-btn-icon">⏹</span> Stop
                </button>
                <button id="nova-ara-a-cache" class="nova-btn" style="
                    background:${THEME.blue};color:#fff;border:1px solid ${THEME.blueBorder};
                    padding:9px 14px;font-size:12px;
                ">
                    <span class="nova-btn-icon">↺</span> Load Cache
                </button>
                <button id="nova-ara-a-clear" class="nova-btn" style="
                    background:${THEME.gray};color:${THEME.text};border:1px solid ${THEME.grayBorder};
                    padding:9px 12px;font-size:12px;
                ">
                    <span class="nova-btn-icon">🗑</span>
                </button>
                <span id="nova-ara-a-progress" style="margin-left:auto;color:${THEME.titleColor};font-size:12px;font-weight:bold;align-self:center;"></span>
            </div>

            <div class="nova-section">
                <label>
                    <span>Min Loot %:</span>
                    <input type="range" id="nova-ara-a-slider" min="0" max="100" step="5" value="0" style="flex:1;min-width:150px;">
                    <span id="nova-ara-a-slider-val" class="nova-val-badge">0%</span>
                </label>
            </div>

            <div class="nova-section">
                <label>
                    <span>Max Distance:</span>
                    <input type="range" id="nova-ara-a-dist-slider" min="0" max="200" step="1" value="200" style="flex:1;min-width:150px;">
                    <span id="nova-ara-a-dist-slider-val" class="nova-val-badge">200</span>
                    <span style="font-size:10px;color:${THEME.textMuted};font-weight:normal;">(0 = no limit, else ≤ N fields)</span>
                </label>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px;">
                <div style="background:${THEME.bgSection};padding:5px 8px;border-radius:4px;display:flex;justify-content:space-between;font-size:11px;font-family:'Courier New',monospace;">
                    <span style="color:${THEME.textMuted};">Scanned</span>
                    <b id="nova-stat-scanned" style="color:${THEME.titleColor};">0</b>
                </div>
                <div style="background:${THEME.bgSection};padding:5px 8px;border-radius:4px;display:flex;justify-content:space-between;font-size:11px;font-family:'Courier New',monospace;">
                    <span style="color:${THEME.textMuted};">Farms</span>
                    <b id="nova-stat-normal" style="color:${THEME.titleColor};">0</b>
                </div>
                <div style="background:${THEME.bgSection};padding:5px 8px;border-radius:4px;display:flex;justify-content:space-between;font-size:11px;font-family:'Courier New',monospace;">
                    <span style="color:${THEME.textMuted};">Oases</span>
                    <b id="nova-stat-oasis" style="color:${THEME.titleColor};">0</b>
                </div>
                <div style="background:${THEME.bgSection};padding:5px 8px;border-radius:4px;display:flex;justify-content:space-between;font-size:11px;font-family:'Courier New',monospace;">
                    <span style="color:${THEME.textMuted};">Natars</span>
                    <b id="nova-stat-natars" style="color:${THEME.titleColor};">0</b>
                </div>
            </div>

            <div class="nova-tab">
                <button data-tab="normal" class="active">Normal Farms</button>
                <button data-tab="oasis">Oases</button>
                <button data-tab="natars">Natars</button>
            </div>
            <div class="nova-list" id="nova-ara-a-list">
                <div class="nova-empty">Click "🔍 Scan Reports" to start.</div>
            </div>

            <div id="nova-ara-a-actions" style="display:none;flex-wrap:wrap;gap:6px;margin-top:10px;padding:10px;background:rgba(255,255,255,.5);border:1px dashed ${THEME.borderLight};border-radius:6px;">
                <div style="width:100%;font-size:11px;color:${THEME.textMuted};font-weight:bold;">
                    📋 Include in export:
                </div>
                <div class="nova-chk-row" style="width:100%;">
                    <label><input type="checkbox" id="nova-chk-normal" checked> Normal Farms</label>
                    <label><input type="checkbox" id="nova-chk-oasis"> Oases</label>
                    <label><input type="checkbox" id="nova-chk-natars"> Natars</label>
                </div>

                <div style="width:100%;padding:6px 8px;background:rgba(255,255,255,.4);border-radius:4px;margin-bottom:6px;">
                    <label style="color:${THEME.titleColor};font-weight:bold;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;">
                        <span>⚡ TT (t4) per target:</span>
                        <input type="number" id="nova-tt-count" value="${CONFIG.defaultTT}" min="1" max="9999"
                               style="width:70px;padding:4px 6px;font-size:13px;border:1px solid ${THEME.border};border-radius:4px;text-align:center;font-weight:bold;">
                    </label>
                </div>

                <div style="width:100%;font-size:11px;color:${THEME.textMuted};margin:4px 0 6px 0;font-weight:bold;">
                    🚜 Export Farm List (compatible with Farm Manager):
                </div>
                <button id="nova-ara-a-copy-farm" class="nova-btn" style="
                    background:${THEME.cyan};color:#fff;border:1px solid ${THEME.cyanBorder};
                    padding:8px 14px;font-size:12px;
                ">
                    <span class="nova-btn-icon">📋</span> Copy Farm List
                </button>
                <button id="nova-ara-a-download-farm" class="nova-btn" style="
                    background:${THEME.orange};color:#fff;border:1px solid ${THEME.orangeBorder};
                    padding:8px 14px;font-size:12px;
                ">
                    <span class="nova-btn-icon">⬇</span> Download Farm List
                </button>

                <div style="width:100%;font-size:11px;color:${THEME.textMuted};margin:8px 0 6px 0;font-weight:bold;">
                    📊 Export Analytical JSON (for reference):
                </div>
                <button id="nova-ara-a-copy" class="nova-btn" style="
                    background:${THEME.cyan};color:#fff;border:1px solid ${THEME.cyanBorder};
                    padding:8px 14px;font-size:12px;
                ">
                    <span class="nova-btn-icon">📋</span> Copy JSON
                </button>
                <button id="nova-ara-a-download" class="nova-btn" style="
                    background:${THEME.orange};color:#fff;border:1px solid ${THEME.orangeBorder};
                    padding:8px 14px;font-size:12px;
                ">
                    <span class="nova-btn-icon">⬇</span> Download JSON
                </button>

                <div style="width:100%;margin-top:8px;">
                    <button id="nova-ara-a-debug" class="nova-btn" style="
                        background:${THEME.purple};color:#fff;border:1px solid ${THEME.purpleBorder};
                        padding:7px 12px;font-size:11px;
                    ">
                        <span class="nova-btn-icon">🐛</span> Debug Log
                    </button>
                </div>
            </div>

            <div id="nova-ara-a-log" style="
                background:#1e1e1e;border:1px solid #333;padding:10px;
                border-radius:5px;max-height:220px;overflow-y:auto;
                white-space:pre-wrap;font-family:'Courier New',monospace;font-size:11.5px;
                color:#a9b7c6;line-height:1.5;margin-top:10px;
            ">Ready.</div>
        `;
        return box;
    }

    function appendLog(msg) {
        const el = document.getElementById("nova-ara-a-log");
        if (!el) return;
        const t = new Date().toLocaleTimeString("en-US", { hour12: false });
        el.textContent += `\n[${t}] ${msg}`;
        el.scrollTop = el.scrollHeight;
    }

    function setProgress(txt) {
        const el = document.getElementById("nova-ara-a-progress");
        if (el) el.textContent = txt;
    }

    function setButtonsEnabled(scanning) {
        const scan = document.getElementById("nova-ara-a-scan");
        const stop = document.getElementById("nova-ara-a-stop");
        if (scan) scan.disabled = scanning;
        if (stop) stop.disabled = !scanning;
    }
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
    // ============================================================
    // CLIPBOARD
    // ============================================================
    async function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                log("clipboard API failed, using fallback:", e.message);
            }
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText =
            "position:fixed;left:0;top:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;z-index:-1;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { ta.setSelectionRange(0, text.length); } catch (e) {}
        let ok = false;
        try { ok = document.execCommand("copy"); }
        catch (e) { log("execCommand copy failed:", e.message); }
        document.body.removeChild(ta);
        return ok;
    }

    function saveFile(text, filename, mime = "application/json") {
        try {
            const blob = new Blob([text], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { document.body.removeChild(a); } catch (e) {}
                URL.revokeObjectURL(url);
            }, 400);
            return true;
        } catch (e) {
            log("saveFile failed", e);
            return false;
        }
    }

    // ============================================================
    // LOAD FROM CACHE
    // ============================================================
    function loadFromCache() {
        const cached = loadCache();
        if (!cached || !cached.results || cached.results.length === 0) {
            appendLog("No valid cache found (or expired).");
            showToast("No cache found", "error");
            return;
        }
        state.results = cached.results;
        const ts = new Date(cached._cachedAt || cached.timestamp).toLocaleString();
        appendLog(`Loaded ${cached.results.length} cached report(s) from ${ts}.`);
        renderList();
        updateStats();
        showActions(true);
        showToast(`✓ Loaded ${cached.results.length} from cache`, "success");
    }
    // ============================================================
    // INIT
    // ============================================================
    function injectBox() {
        const content = document.getElementById("content");
        if (!content) return false;
        if (document.getElementById("nova-ara-a-box")) return true;

        const box = buildBox();
        const spacer = content.querySelector(".navigationSpacer");
        if (spacer) {
            // Insert a spacer BEFORE the box (for top spacing), then insert box before the existing spacer
            const spacerBefore = document.createElement("div");
            spacerBefore.className = "navigationSpacer";
            spacer.parentNode.insertBefore(spacerBefore, spacer);
            spacer.parentNode.insertBefore(box, spacer);
        } else {
            // ⭐ 1.6.0: /report/offensive ممکن است .navigationSpacer نداشته باشد
            content.insertBefore(box, content.firstChild);
        }

        document.getElementById("nova-ara-a-scan").addEventListener("click", runScan);
        document.getElementById("nova-ara-a-stop").addEventListener("click", () => {
            state.scanning = false;
            setProgress("stopping...");
        });
        document.getElementById("nova-ara-a-cache").addEventListener("click", loadFromCache);
        document.getElementById("nova-ara-a-clear").addEventListener("click", () => {
            if (confirm("Clear all cached scans and coordinates?")) {
                clearCache();
                state.results = [];
                renderList();
                updateStats();
                showActions(false);
                appendLog("🗑 Cache cleared.");
                showToast("Cache cleared", "info");
            }
        });

        const slider = document.getElementById("nova-ara-a-slider");
        const sliderVal = document.getElementById("nova-ara-a-slider-val");
        slider.addEventListener("input", () => {
            state.filterPercent = parseInt(slider.value, 10);
            sliderVal.textContent = state.filterPercent + "%";
            renderList();
            updateStats();
        });

        const distSlider = document.getElementById("nova-ara-a-dist-slider");
        const distSliderVal = document.getElementById("nova-ara-a-dist-slider-val");
        distSlider.addEventListener("input", () => {
            state.maxDistance = parseInt(distSlider.value, 10);
            distSliderVal.textContent = state.maxDistance === 0 ? "∞" : String(state.maxDistance);
            renderList();
            updateStats();
        });

        document.querySelectorAll("#nova-ara-a-box .nova-tab button").forEach((b) => {
            b.addEventListener("click", () => {
                document.querySelectorAll("#nova-ara-a-box .nova-tab button").forEach((x) =>
                    x.classList.remove("active")
                );
                b.classList.add("active");
                state.activeTab = b.dataset.tab;
                renderList();
            });
        });

        ["nova-chk-normal", "nova-chk-oasis", "nova-chk-natars"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("change", () => {
                renderList();
                updateStats();
            });
        });

        document.getElementById("nova-ara-a-copy-farm").addEventListener("click", async () => {
            const data = buildFarmListV1();
            const txt = JSON.stringify(data, null, 2);
            const ok = await copyToClipboard(txt);
            if (ok) {
                appendLog(`📋 Farm List copied (${data.list.targets.length} targets, TT=${data.list.troops.t4})`);
                showToast(`✓ Farm List copied (${data.list.targets.length})`, "success");
            } else {
                appendLog(`Copy failed`);
                showToast("Copy failed", "error");
            }
        });

        document.getElementById("nova-ara-a-download-farm").addEventListener("click", () => {
            const data = buildFarmListV1();
            const ok = saveFile(
                JSON.stringify(data, null, 2),
                `nova-farmlist-${MODE.fileTag}-${timestampSuffix()}.json`,
                "application/json"
            );
            if (ok) {
                appendLog(`⬇ Farm List downloaded (${data.list.targets.length} targets)`);
                showToast(`✓ Farm List downloaded (${data.list.targets.length})`, "success");
            } else {
                showToast("Download failed", "error");
            }
        });

        document.getElementById("nova-ara-a-copy").addEventListener("click", async () => {
            const data = buildFilteredExport();
            const ok = await copyToClipboard(JSON.stringify(data, null, 2));
            if (ok) {
                appendLog(`📋 Analytical JSON copied (Farms: ${data.normal.length}, Oases: ${data.oasis.length}, Natars: ${data.natars.length})`);
                showToast("✓ Copied to clipboard", "success");
            } else {
                showToast("Copy failed", "error");
            }
        });

        document.getElementById("nova-ara-a-download").addEventListener("click", () => {
            const data = buildFilteredExport();
            const ok = saveFile(
                JSON.stringify(data, null, 2),
                `nova-ara-${MODE.fileTag}-${timestampSuffix()}.json`,
                "application/json"
            );
            if (ok) {
                appendLog(`⬇ Analytical JSON downloaded`);
                showToast("✓ Downloaded", "success");
            } else {
                showToast("Download failed", "error");
            }
        });

        document.getElementById("nova-ara-a-debug").addEventListener("click", () => {
            const dbg = {
                app: `Nova ARA-${MODE.fileTag} Debug`,
                mode: MODE.id,
                version: CONFIG.version,
                timestamp: new Date().toISOString(),
                url: location.href,
                userAgent: navigator.userAgent,
                reportCount: state.results.length,
                filterPercent: state.filterPercent,
                maxDistance: state.maxDistance,
                debugEntries: state.debugBuffer,
                results: state.results,
            };
            const ok = saveFile(
                JSON.stringify(dbg, null, 2),
                `nova-ara-${MODE.fileTag}-debug-${timestampSuffix()}.json`,
                "application/json"
            );
            if (ok) {
                appendLog(`🐛 Debug log exported (${state.debugBuffer.length} entries)`);
                showToast("✓ Debug log downloaded", "success");
            } else {
                showToast("Debug download failed", "error");
            }
        });

        return true;
    }

    function init() {
        const mode = detectMode();
        if (!mode) {
            log("Not a supported reports page — skipping.");
            return;
        }
        log(`Mode: ${mode.id} (${mode.title})`);
        injectStyles();

        if (!injectBox()) {
            const timer = setInterval(() => {
                if (injectBox()) clearInterval(timer);
            }, 400);
            setTimeout(() => clearInterval(timer), 15000);
        }
    }

    init();
})();
