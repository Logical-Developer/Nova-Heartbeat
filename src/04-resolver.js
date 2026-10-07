// ═══════════════════════════════════════════════════════════
// 04-resolver.js
// ═══════════════════════════════════════════════════════════

  const Resolver = (() => {
    function isElVisible(el) {
      if (!el || !el.isConnected) return false;
      const st = getComputedStyle(el);
      if (st.display==='none' || st.visibility==='hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function hasRealHref(el) {
      if (el.tagName !== 'A') return true;
      const h = el.getAttribute('href');
      return !!(h && h !== '#' && !h.startsWith('javascript:'));
    }
    function getHref(el) {
      const a = el.tagName === 'A' ? el : el.querySelector('a');
      return a ? (a.getAttribute('href') || '') : (el.getAttribute('href') || '');
    }
    function villageSwitch(t, ctx) {
      if (!t.village) return null;
      if (String(t.village) === String(ctx.vid)) return null;
      const el = document.querySelector(`#sidebarBoxVillageList .listEntry.village[data-did="${t.village}"] a`);
      if (!el || !isElVisible(el)) return null;
      return { el, strategy: 'village-switch', isLink: false };
    }
    function headerMenu(t, ctx) {
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      if (t.params && Object.keys(t.params).length) return null;
      const map = { dorf1:'#navigation a.resourceView', dorf2:'#navigation a.buildingView', karte:'#navigation a.map', report:'#navigation a.reports', statistics:'#navigation a.statistics', messages:'#navigation a.messages' };
      const sel = map[t.page]; if (!sel) return null;
      const el = document.querySelector(sel);
      return isElVisible(el) ? { el, strategy: 'header-menu', isLink: true } : null;
    }
    function closeBtn(t, ctx) {
      if (ctx.page !== 'build' || (t.page !== 'dorf2' && t.page !== 'dorf1')) return null;
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      const el = document.querySelector('#closeContentButton');
      return isElVisible(el) ? { el, strategy: 'close-button', isLink: true } : null;
    }
    function tile(t, ctx) {
      if (t.page !== 'build') return null;
      if (ctx.page !== 'dorf1' && ctx.page !== 'dorf2') return null;
      if (t.village && String(t.village) !== String(ctx.vid)) return null;
      const slot = t.params?.id, gid = t.params?.gid;
      if (!slot) return null;

      const idRegex = new RegExp(`[?&]id=${slot}(?:&|$|#)`);
      const gidInHrefRegex = /[?&]gid=(\d+)(?:&|$|#)/;

      const legacyEl = document.querySelector(`#building${slot}`);
      if (legacyEl) {
        const href = getHref(legacyEl);
        if (idRegex.test(href)) {
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk) {
            const clk = legacyEl.tagName==='A' ? legacyEl : (legacyEl.querySelector('a') || legacyEl);
            if (isElVisible(clk)) return { el: clk, strategy: 'tile-legacy', isLink: clk.tagName==='A' };
          }
        }
      }

      const slotEl = document.querySelector(`.buildingSlot[data-aid="${slot}"]`);
      if (slotEl) {
        const slotGid = slotEl.getAttribute('data-gid');
        if (gid) {
          if (slotGid && slotGid !== '0' && String(slotGid) !== String(gid)) {
            return null;
          }
        }

        const aEl = slotEl.querySelector('a[href*="build.php"]');
        if (aEl) {
          const href = aEl.getAttribute('href') || '';
          if (idRegex.test(href)) {
            let gidOk = true;
            if (gid) {
              const gidMatch = gidInHrefRegex.exec(href);
              if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
            }
            if (gidOk && isElVisible(aEl)) {
              return { el: aEl, strategy: 'tile-slot-a', isLink: true };
            }
          }
        }

        const paths = slotEl.querySelectorAll('path[onclick]');
        for (const p of paths) {
          const onclick = p.getAttribute('onclick') || '';
          const hrefMatch = onclick.match(/build\.php\?[^'"\s]+/);
          if (!hrefMatch) continue;
          const href = hrefMatch[0];
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && isElVisible(p)) {
            return { el: p, strategy: 'tile-slot-path-onclick', isLink: false };
          }
        }

        const dataHrefPaths = slotEl.querySelectorAll('path[data-href*="build.php"]');
        for (const p of dataHrefPaths) {
          const href = p.getAttribute('data-href') || '';
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && isElVisible(p)) {
            return { el: p, strategy: 'tile-slot-path-datahref', isLink: false };
          }
        }

        if (isElVisible(slotEl)) {
          return { el: slotEl, strategy: 'tile-slot-div', isLink: false };
        }
      }

      const containers = ['#villageContent', '#resourceFieldContainer', '#resourceField', '#village'];
      for (const contSel of containers) {
        const container = document.querySelector(contSel);
        if (!container) continue;
        const links = container.querySelectorAll('a[href*="build.php"]');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (!idRegex.test(href)) continue;
          let gidOk = true;
          if (gid) {
            const gidMatch = gidInHrefRegex.exec(href);
            if (gidMatch && gidMatch[1] !== String(gid)) gidOk = false;
          }
          if (gidOk && a.isConnected && isElVisible(a)) {
            return { el: a, strategy: 'tile-container-a', isLink: true };
          }
        }
      }

      if (slot && gid) {
        const wallSlots = document.querySelectorAll(`.buildingSlot[data-aid="${slot}"][data-gid="${gid}"]`);
        for (const wallSlot of wallSlots) {
          const clickablePath = wallSlot.querySelector('path[onclick*="build.php"]');
          if (clickablePath && isElVisible(clickablePath)) {
            return { el: clickablePath, strategy: 'tile-wall-path', isLink: false };
          }
          const clickableA = wallSlot.querySelector('a[href*="build.php"]');
          if (clickableA && isElVisible(clickableA)) {
            return { el: clickableA, strategy: 'tile-wall-a', isLink: true };
          }
        }
      }

      return null;
    }
    function card(t, ctx) {
      if (t.page !== 'build' || ctx.page !== 'build') return null;
      if (!t.params?.gid || t.params?.id) return null;
      const card = document.querySelector(`#contract_building${t.params.gid}`);
      if (!card) return null;
      const btn = card.querySelector('button.green.new, button.purple.new, .upgradeButtonsContainer button.green, .upgradeButtonsContainer button.purple');
      return isElVisible(btn) ? { el: btn, strategy: 'construct-card', isLink: false } : null;
    }
    function href(t, ctx) {
      const want = { page: t.page, params: {} };
      if (t.village && String(t.village) !== String(ctx.vid)) want.params.newdid = t.village;
      Object.assign(want.params, t.params || {});
      for (const a of $$('a[href]')) {
        if (!hasRealHref(a) || !isElVisible(a)) continue;
        try {
          const u = new URL(a.href, location.origin);
          if (!u.pathname.includes(want.page)) continue;
          let ok = true;
          for (const [k,v] of Object.entries(want.params)) if (u.searchParams.get(k) !== String(v)) { ok=false; break; }
          if (ok) return { el: a, strategy: 'href-match', isLink: true };
        } catch {}
      }
      return null;
    }
    const STRATS = [villageSwitch, headerMenu, closeBtn, tile, card, href];
    function resolve(t) {
      const ctx = { vid: curVillageId(), page: pageType() };
      for (const fn of STRATS) { try { const r = fn(t, ctx); if (r && r.el) return { ...r, ctx }; } catch {} }
      return null;
    }
    return { resolve, isElVisible };
  })();

