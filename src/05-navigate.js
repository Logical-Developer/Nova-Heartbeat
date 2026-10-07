// ═══════════════════════════════════════════════════════════
// 05-navigate.js
// ═══════════════════════════════════════════════════════════

  let _mouse = { x: Math.round(innerWidth/2), y: Math.round(innerHeight/2) };
  let _scriptClick = false;
  let _lastUserClickAt = 0;

  function dispatchMouse(el, type, x, y, extra = {}) {
    el.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, composed:true, view:window,
      clientX:x, clientY:y, screenX:x+(window.screenX||0), screenY:y+(window.screenY||0), button:0, buttons:extra.buttons??0, detail: type==='click'?1:0 }));
  }
  function bezier(from, to, n) {
    const c1 = { x: from.x+(to.x-from.x)*0.3+(Math.random()-0.5)*60, y: from.y+(to.y-from.y)*0.3+(Math.random()-0.5)*60 };
    const c2 = { x: from.x+(to.x-from.x)*0.7+(Math.random()-0.5)*60, y: from.y+(to.y-from.y)*0.7+(Math.random()-0.5)*60 };
    const pts = [];
    for (let i=1;i<=n;i++) {
      const t = i/(n+1), mt = 1-t;
      pts.push({ x: mt*mt*mt*from.x+3*mt*mt*t*c1.x+3*mt*t*t*c2.x+t*t*t*to.x+(Math.random()-0.5)*3,
                 y: mt*mt*mt*from.y+3*mt*mt*t*c1.y+3*mt*t*t*c2.y+t*t*t*to.y+(Math.random()-0.5)*3 });
    }
    return pts;
  }
  function waitNav(ms) {
    return new Promise(r => {
      let done = false;
      const finish = v => { if (!done) { done = true; r(v); } };
      const startHref = location.href;
      const startPath = location.pathname + location.search;
      const onU = () => finish(true);
      window.addEventListener('beforeunload', onU, { once: true });
      const iv = setInterval(() => {
        const curPath = location.pathname + location.search;
        if (document.readyState==='loading' || location.href!==startHref || curPath !== startPath) {
          clearInterval(iv); window.removeEventListener('beforeunload', onU); finish(true);
        }
      }, 50);
      setTimeout(() => { clearInterval(iv); window.removeEventListener('beforeunload', onU); finish(false); }, ms);
    });
  }
  async function humanClick(el, opts = {}) {
    if (!el || !el.isConnected) return { ok: false, reason: 'detached' };
    const st = getComputedStyle(el);
    if (st.display==='none' || st.visibility==='hidden') return { ok: false, reason: 'invisible' };
    if (el.disabled || el.classList.contains('disabled')) return { ok: false, reason: 'disabled' };
    await delay(logNormal(200, 700));
    let rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) { el.scrollIntoView({ behavior:'smooth', block:'center' }); await delay(logNormal(180, 400)); rect = el.getBoundingClientRect(); }
    const tx = rect.left + rect.width * (0.22 + Math.random()*0.56);
    const ty = rect.top + rect.height * (0.22 + Math.random()*0.56);
    const segs = 3 + Math.floor(Math.random()*4);
    for (const p of bezier(_mouse, { x:tx, y:ty }, segs)) { dispatchMouse(el, 'mousemove', p.x, p.y); _mouse = { x:p.x, y:p.y }; await delay(logNormal(25, 70)); }
    dispatchMouse(el, 'mouseover', tx, ty); dispatchMouse(el, 'mouseenter', tx, ty);
    await delay(logNormal(80, 240));
    dispatchMouse(el, 'mousedown', tx, ty, { buttons:1 });
    await delay(logNormal(40, 120));
    dispatchMouse(el, 'mouseup', tx, ty);
    _scriptClick = true;
    const isLink = el.tagName==='A' && el.href && !el.href.startsWith('javascript:');
    const navP = waitNav(opts.navTimeoutMs || CFG.NAV_TIMEOUT_MS);
    dispatchMouse(el, 'click', tx, ty);
    const navigated = await navP;
    setTimeout(() => { _scriptClick = false; }, 150);
    return { ok: true, navigated: !!navigated, isLink: !!isLink, needsFallback: isLink && !navigated, href: isLink ? el.href : null };
  }
  function isPopupOpen() {
    for (const v of document.querySelectorAll('video')) {
      const st = getComputedStyle(v);
      if (st.display==='none' || st.visibility==='hidden' || v.paused) continue;
      const r = v.getBoundingClientRect();
      if (r.width >= 100 && r.height >= 100) return true;
    }
    for (const el of document.querySelectorAll('.videoWrapper, [class*="videoPlayer" i], [class*="videoFeature" i] .modal')) {
      const st = getComputedStyle(el);
      if (st.display==='none' || st.visibility==='hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 300 && r.height >= 200) return true;
    }
    return false;
  }
  function canAct() {
    const s = readState();
    const allowHidden = s.heartbeat?.allowHiddenTab === true;
    if (!allowHidden && document.visibilityState === 'hidden') return { ok: false, reason: 'tab-hidden' };
    if (isPopupOpen()) return { ok: false, reason: 'popup' };
    const fi = freezeInfo();
    if (fi && !fi.expired) return { ok: false, reason: 'page-frozen', freeze: fi };
    if (_lastUserClickAt && now() - _lastUserClickAt < CFG.USER_ACTIVE_WINDOW_MS) return { ok: false, reason: 'user-active' };
    return { ok: true };
  }
  async function navigate(target) {
    const ready = canAct();
    if (!ready.ok) return { ok: false, reason: ready.reason };
    const r = Resolver.resolve(target);
    if (!r) {
      log('nav', `✗ no-link for ${target.page}${target.village ? ' @'+vLabel(target.village) : ''}`);
      return { ok: false, reason: 'no-link-found' };
    }

    if (r.useDirectUrl && r.directUrl) {
      const curVid = curVillageId();
      if (curVid && target.village && String(curVid) !== String(target.village)) {
        recordRotationContext(curVid);
        ssSet(SS_PAGE_MARK, 'nova');
      }
      log('nav', `🎯 direct URL: ${r.directUrl} [${r.strategy}]`);
      await randomDelay(500, 1200);
      location.href = r.directUrl;
      return { ok: true, fallback: true };
    }

    const curVid = curVillageId();
    if (curVid && target.village && String(curVid) !== String(target.village)) {
      recordRotationContext(curVid);
      ssSet(SS_PAGE_MARK, 'nova');
    }
    log('nav', `→ ${target.page}${target.params ? '?'+new URLSearchParams(target.params).toString() : ''} @${vLabel(target.village)} [${r.strategy}]`);
    await delay(logNormal(CFG.DELAY_PRE_CLICK_MIN, CFG.DELAY_PRE_CLICK_MAX));
    const res = await humanClick(r.el, { navTimeoutMs: CFG.NAV_TIMEOUT_MS });
    if (!res.ok) return { ok: false, reason: res.reason };
    if (res.needsFallback) { await delay(logNormal(300, 700)); location.href = res.href; return { ok: true, fallback: true }; }
    return { ok: true, navigated: res.navigated };
  }

