#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// watch.js — Auto-rebuild on file changes
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'src');

let timer = null;
function build() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      execSync('node build.js', { stdio: 'inherit', cwd: __dirname });
      console.log(`[${new Date().toLocaleTimeString()}] ✓ rebuilt\n`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] ✗ build failed\n`);
    }
  }, 150);
}

console.log('👀 Watching src/ for changes... (Ctrl+C to stop)\n');
build();

fs.watch(SRC_DIR, { recursive: true }, (event, filename) => {
  if (filename && filename.endsWith('.js')) {
    console.log(`changed: ${filename}`);
    build();
  }
});
