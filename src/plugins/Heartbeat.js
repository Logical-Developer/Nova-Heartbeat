// ═══════════════════════════════════════════════════════════
// plugins/Heartbeat.js
// ═══════════════════════════════════════════════════════════

  registerPlugin('Heartbeat', {
    onArrive: async (ctx) => { captureCurrentVillage(); return { type: 'done', reason: 'captured' }; }
  });
