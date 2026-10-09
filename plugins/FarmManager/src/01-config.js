  const FM_VERSION = "2.1.2";
  const FM_NS = "FarmManager";
  const DRIVER_PLUGIN = "Heartbeat";
  const POLL_MS = 1000;
  const MAX_WIDTH = 600;
  const PENDING_RUN_KEY = "fm_pending_run_v17";

  const FM_STORAGE_KEY = "travian_farm_manager_data_v18";
  const FM_STORAGE_VERSION = 18;
  const FM_REQUIRES_NOVA_MIN = "0.0.3";

  // ⭐ فاز ۲ — وضعیت صریح چرخهٔ run (جایگزین معنایی چهار فلگ موازی — باگ #۱)
  // چهار فلگ قدیمی همچنان به‌صورت derived نوشته می‌شوند (سازگاری window.FM.diag)
  const RUN_STATUS = {
    IDLE: "idle",
    PREPARING: "preparing",
    RUNNING: "running",
    COOLDOWN: "cooldown",
    PAUSED_NO_TROOPS: "paused-no-troops",
    FINISHED: "finished",
  };

  // ⭐ TTL settings
  const TTL_MIN_MS = 15 * 60 * 1000; // حداقل 15 دقیقه
  const TTL_PER_TASK_MS = 45 * 1000; // 45 ثانیه per task
  const ROTATION_PER_TASK_MS = 60 * 1000; // 60 ثانیه per task برای rotation
  const ROTATION_EXTRA_MS = 120 * 1000; // 2 دقیقه اضافه
  const ROTATION_MAX_MS = 6 * 60 * 60 * 1000; // ⭐ سقف 6 ساعت

  // ─────────────────────────────────────────────────────────────
  // Log Buffer (بهینه‌شده: dedupe + sample rate)
  // ─────────────────────────────────────────────────────────────
  const LOG_BUFFER_MAX = 300;
  const _logBuffer = [];
  const _logDedupMap = new Map(); // key → {count, lastTs}
  const LOG_DEDUP_WINDOW_MS = 5000; // 5 ثانیه

  // ─────────────────────────────────────────────────────────────
  // Utils
  // ─────────────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const now = () => Date.now();
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = (p) => (p || "id") + "_" + Math.random().toString(36).slice(2, 9);

  const cleanNum = (s) =>
    String(s || "")
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\ufeff]/g, "")
      .replace(/−/g, "-")
      .replace(/[^\d-]/g, "");
  const cleanInt = (s) => {
    const n = cleanNum(s);
    return n === "" ? null : parseInt(n, 10);
  };

  function logNormal(min, max) {
    const u = Math.random() || 1e-9;
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const t = Math.min(1, Math.max(0, (z + 3) / 6));
    return Math.round(min + (max - min) * t);
  }

  function clearPendingRunKey() {
    try {
      sessionStorage.removeItem(PENDING_RUN_KEY);
    } catch (e) {}
  }

  // ⭐ محدود کردن nextRotationAt به بازه معقول
  function safeRotationAt(targetMs) {
    const maxAllowed = now() + ROTATION_MAX_MS;
    return Math.min(Math.max(targetMs, now() + 1000), maxAllowed);
  }

  // ⭐ فاز ۳: مقایسهٔ نسخهٔ Nova با حداقل مورد نیاز (a<b → -1)
  function compareVer(a, b) {
    const pa = String(a || "").split(".").map((x) => parseInt(x, 10) || 0);
    const pb = String(b || "").split(".").map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
  }
