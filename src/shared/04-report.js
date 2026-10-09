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
