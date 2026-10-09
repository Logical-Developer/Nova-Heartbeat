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
