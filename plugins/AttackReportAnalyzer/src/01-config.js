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
