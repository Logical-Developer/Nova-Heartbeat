  // ─────────────────────────────────────────────────────────────
  // Sound + Toast + Notifications
  // ─────────────────────────────────────────────────────────────
  function playAlarm() {
    const fm = readFMData();
    if (!fm.settings.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ctx.currentTime;
      [0, 0.25, 0.5].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = i === 2 ? 1400 : 900;
        gain.gain.setValueAtTime(0, t0 + offset);
        gain.gain.linearRampToValueAtTime(0.12, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.15);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.15);
      });
    } catch (e) {}
  }
  function showToast(msg, kind) {
    let el = document.getElementById("fm-toast");
    if (el) el.remove();
    el = document.createElement("div");
    el.id = "fm-toast";
    const bg =
      kind === "warn"
        ? "linear-gradient(180deg,#ffe0b0,#f0b060)"
        : "linear-gradient(180deg,#c4e8a8,#7ab04a)";
    el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${bg};border:2px solid #4a5a30;border-radius:8px;padding:10px 18px;color:#1a2a10;font-family:Verdana,sans-serif;font-size:13px;font-weight:bold;z-index:2147483600;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:80vw;text-align:center;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .4s";
      el.style.opacity = "0";
    }, 4500);
    setTimeout(() => el.remove(), 5000);
  }
  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${String(mm).padStart(2, "0")}m`;
  }
