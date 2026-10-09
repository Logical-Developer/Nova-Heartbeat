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
