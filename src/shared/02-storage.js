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
