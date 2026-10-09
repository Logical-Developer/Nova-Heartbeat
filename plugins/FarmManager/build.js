#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// build.js — Concatenate src/ into FarmManager.user.js
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUT_FILE = path.join(__dirname, 'FarmManager.user.js');

// Order matters. The whole build is wrapped in a single IIFE that is opened
// in 00-header.js and closed at the end of 18-bootstrap.js.
// NOTE: 17-public-api.js must come before 18-bootstrap.js because boot()
// calls installPublicApi(TC).
const FILES = [
  '00-header.js',
  '01-config.js',
  '02-adapter.js',
  '03-storage.js',
  '04-troops.js',
  '05-human.js',
  '06-log.js',
  '07-notify.js',
  '08-cooldown.js',
  '09-import-export.js',
  '10-map-box.js',
  '11-rally-panel.js',
  '12-run-controller.js',
  '13-arrive-handler.js',
  '14-pending-report.js',
  '15-debug-tab.js',
  '16-heartbeat-wrapper.js',
  '17-public-api.js',
  '18-bootstrap.js',
];

const banner = `// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: ${new Date().toISOString()}
// Source: plugins/FarmManager/src/
// Rebuild: node build.js
// ═══════════════════════════════════════════════════════════
`;

let output = banner;
let totalLines = 0;

for (const file of FILES) {
  const filePath = path.join(SRC_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lineCount = content.split('\n').length;
  totalLines += lineCount;

  output += `\n// ═══════════════════════════════════════════════════════════\n`;
  output += `// FILE: ${file} (${lineCount} lines)\n`;
  output += `// ═══════════════════════════════════════════════════════════\n\n`;
  output += content;
  if (!content.endsWith('\n')) output += '\n';
}

fs.writeFileSync(OUT_FILE, output, 'utf8');

const sizeKB = (output.length / 1024).toFixed(2);
console.log(`✓ Built FarmManager.user.js`);
console.log(`  Files: ${FILES.length}`);
console.log(`  Lines: ${totalLines}`);
console.log(`  Size:  ${sizeKB} KB`);
