// ═══════════════════════════════════════════════════════════
// 02-utils.js
// ═══════════════════════════════════════════════════════════

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clockOf = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); };

  function fmtDuration(input, unit = 'sec') {
    if (!input && input !== 0) return '—';
    const sec = unit === 'ms' ? Math.round(input / 1000) : Math.round(input);
    if (sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h:${String(m).padStart(2,'0')}m:${String(s).padStart(2,'0')}s`;
    return `${m}m:${String(s).padStart(2,'0')}s`;
  }
  const fmtAge   = (ms) => fmtDuration(ms, 'ms');
  const fmtTimer = (ms) => fmtDuration(ms, 'ms');
  const fmtSec   = (sec) => fmtDuration(sec, 'sec');

  function logNormal(min,max){const u=Math.random()||1e-9,v=Math.random();const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);const t=Math.min(1,Math.max(0,(z+3)/6));return Math.round(min+(max-min)*t);}

  function randomDelay(minMs, maxMs) {
    const ms = Math.round(minMs + Math.random() * (maxMs - minMs));
    return delay(ms);
  }

  async function waitFor(condFn, maxMs = 5000, checkMs = 100) {
    const start = now();
    while (now() - start < maxMs) {
      try { if (condFn()) return { ok: true, waited: now() - start }; } catch {}
      await delay(checkMs);
    }
    return { ok: false, waited: now() - start };
  }

  function ssSet(k, v) { try { sessionStorage.setItem(k, String(v)); } catch {} }
  function ssGet(k, dflt = null) { try { const v = sessionStorage.getItem(k); return v === null ? dflt : v; } catch { return dflt; } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch {} }

  function isDebugEnabled() {
    if (window.NOVA_DEBUG === true) return true;
    try {
      const u = new URL(location.href);
      const p = u.searchParams.get('nova_debug');
      if (p === '1') { try { localStorage.setItem(DEBUG_KEY, '1'); } catch {} return true; }
      if (p === '0') { try { localStorage.removeItem(DEBUG_KEY); } catch {} return false; }
    } catch {}
    try { if (localStorage.getItem(DEBUG_KEY) === '1') return true; } catch {}
    return false;
  }
