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
