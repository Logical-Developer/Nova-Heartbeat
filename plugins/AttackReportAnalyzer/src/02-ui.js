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
