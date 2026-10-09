  // ─────────────────────────────────────────────────────────────
  // Human behavior
  // ─────────────────────────────────────────────────────────────
  const PROFILES = {
    fast: { charDelay: [15, 50], microDelay: [80, 200], betweenTasks: [0, 0] },
    normal: {
      charDelay: [40, 130],
      microDelay: [150, 500],
      betweenTasks: [0, 0],
    },
    paranoid: {
      charDelay: [80, 250],
      microDelay: [400, 1200],
      betweenTasks: [3000, 8000],
    },
  };
  function profileSettings() {
    const p = readFMData().settings.profile || "normal";
    return PROFILES[p] || PROFILES.normal;
  }
  async function humanType(input, value) {
    const prof = profileSettings();
    input.focus();
    await delay(logNormal(...prof.microDelay));
    if (input.value) {
      input.select();
      await delay(logNormal(...prof.charDelay));
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const ch of String(value)) {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: ch,
          bubbles: true,
          cancelable: true,
        }),
      );
      await delay(logNormal(...prof.charDelay));
      input.value += ch;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: ch,
          bubbles: true,
          cancelable: true,
        }),
      );
      await delay(logNormal(...prof.charDelay));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function humanTabToNext(current) {
    const prof = profileSettings();
    await delay(logNormal(...prof.charDelay));
    current.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    await delay(logNormal(...prof.charDelay));
  }
  async function humanClickNoNav(el, shouldContinue = () => true) {
    if (!el || !el.isConnected) return { ok: false };
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden")
      return { ok: false };
    if (el.disabled) return { ok: false };
    const prof = profileSettings();
    await delay(logNormal(...prof.microDelay));
    if (!shouldContinue()) return { ok: false, cancelled: true };
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await delay(logNormal(...prof.microDelay));
    if (!shouldContinue()) return { ok: false, cancelled: true };
    const rect = el.getBoundingClientRect();
    const tx = rect.left + rect.width * (0.25 + Math.random() * 0.5);
    const ty = rect.top + rect.height * (0.25 + Math.random() * 0.5);
    const from = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const c1 = {
      x: from.x + (tx - from.x) * 0.3 + (Math.random() - 0.5) * 60,
      y: from.y + (ty - from.y) * 0.3 + (Math.random() - 0.5) * 60,
    };
    const c2 = {
      x: from.x + (tx - from.x) * 0.7 + (Math.random() - 0.5) * 60,
      y: from.y + (ty - from.y) * 0.7 + (Math.random() - 0.5) * 60,
    };
    const steps = 4 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1),
        mt = 1 - t;
      const px =
        mt * mt * mt * from.x +
        3 * mt * mt * t * c1.x +
        3 * mt * t * t * c2.x +
        t * t * t * tx +
        (Math.random() - 0.5) * 3;
      const py =
        mt * mt * mt * from.y +
        3 * mt * mt * t * c1.y +
        3 * mt * t * t * c2.y +
        t * t * t * ty +
        (Math.random() - 0.5) * 3;
      el.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: px,
          clientY: py,
        }),
      );
      await delay(logNormal(15, 50));
      if (!shouldContinue()) return { ok: false, cancelled: true };
    }
    el.dispatchEvent(
      new MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
        clientX: tx,
        clientY: ty,
      }),
    );
    el.dispatchEvent(
      new MouseEvent("mouseenter", {
        bubbles: true,
        cancelable: true,
        clientX: tx,
        clientY: ty,
      }),
    );
    await delay(logNormal(...prof.microDelay));
    if (!shouldContinue()) return { ok: false, cancelled: true };
    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        buttons: 1,
        clientX: tx,
        clientY: ty,
      }),
    );
    await delay(logNormal(...prof.charDelay));
    if (!shouldContinue()) return { ok: false, cancelled: true };
    el.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: tx,
        clientY: ty,
      }),
    );
    await delay(logNormal(...prof.charDelay));
    if (!shouldContinue()) return { ok: false, cancelled: true };
    el.click();
    return { ok: true };
  }
