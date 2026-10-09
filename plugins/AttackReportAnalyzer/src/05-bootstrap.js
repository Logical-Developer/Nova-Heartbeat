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
