// ═══════════════════════════════════════════════════════════
// plugins/_template.js — PLUGIN TEMPLATE (NOT built into the userscript)
// ═══════════════════════════════════════════════════════════
//
// HOW TO USE:
//   1. Copy this file to src/plugins/<Name>.js  (e.g. plugins/Builder.js)
//   2. Rename the plugin id below from 'Template' to '<Name>'.
//   3. Implement the hooks you need.
//   4. Add 'plugins/<Name>.js' to the FILES array in build.js
//      — BEFORE '12-bootstrap.js' (bootstrap closes the IIFE).
//   5. node build.js  &&  node --check Nova-Heartbeat.user.js
//
// This file is a reference only; it is not listed in build.js FILES,
// so it never reaches the built userscript.

  registerPlugin('Template', {

    // ── onDecide (optional, sync) ─────────────────────────────
    // Called while sitting on the hub (state HUB_DECIDING), before
    // navigating to build.php.  ctx = { job, village }
    // Return one of:
    //   { action: 'build' }
    //   { action: 'wait',  delayMs, reason }
    //   { action: 'skip',  delayMs, reason }
    //   { action: 'done',  reason }
    onDecide(ctx) {
      return { action: 'build' };
    },

    // ── onArrive (required, async) ────────────────────────────
    // Called on the target page (BUILD_EXECUTING) and again while
    // verifying (VERIFYING).  ctx = { job, target, payload, isVerify }
    // Return one of:
    //   { type: 'done',       reason }
    //   { type: 'wait',       delayMs, reason }   // delayMs default 30000
    //   { type: 'retry',      reason }
    //   { type: 'fail',       reason }
    //   { type: 'transition', state, extra }
    async onArrive(ctx) {
      return { type: 'done', reason: 'noop' };
    },

    // ── onComplete (optional) ─────────────────────────────────
    // Called once the job finished successfully.  ctx = { job }
    onComplete({ job }) {},

    // ── onFail (optional) ─────────────────────────────────────
    // Called on final failure or TTL expiry.  ctx = { job, reason }
    onFail({ job, reason }) {},
  });
