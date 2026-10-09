#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// build.js — Concatenate src/ into AttackReportAnalyzer.user.js
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const SHARED_DIR = path.join(__dirname, '..', '..', 'src', 'shared');
const OUT_FILE = path.join(__dirname, 'AttackReportAnalyzer.user.js');

// Order matters. The whole build is wrapped in a single IIFE that is opened
// in 00-header.js and closed at the end of 05-bootstrap.js.
//
// The shared modules (src/shared/*.js) are concatenated AFTER the header (the
// IIFE is already open at that point) and BEFORE the plugin's own modules, so
// the plugin code can use the `_shared*` helpers without any import.
const FILES = [
  { dir: SRC_DIR, file: '00-header.js' },
  { dir: SHARED_DIR, file: '01-utils.js' },
  { dir: SHARED_DIR, file: '02-storage.js' },
  { dir: SHARED_DIR, file: '03-map.js' },
  { dir: SHARED_DIR, file: '04-report.js' },
  { dir: SHARED_DIR, file: '05-farmlist.js' },
  { dir: SRC_DIR, file: '01-config.js' },
  { dir: SRC_DIR, file: '02-ui.js' },
  { dir: SRC_DIR, file: '03-scan.js' },
  { dir: SRC_DIR, file: '04-clipboard.js' },
  { dir: SRC_DIR, file: '05-bootstrap.js' },
];

const banner = `// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: ${new Date().toISOString()}
// Source: src/ + ../../src/shared/
// Rebuild: node build.js
// ═══════════════════════════════════════════════════════════
`;

let output = banner;
let totalLines = 0;

for (const entry of FILES) {
  const filePath = path.join(entry.dir, entry.file);
  const label = entry.dir === SHARED_DIR ? `../../src/shared/${entry.file}` : entry.file;

  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing: ${label}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  totalLines += content.split('\n').length;

  output += content;
  if (!content.endsWith('\n')) output += '\n';
}

fs.writeFileSync(OUT_FILE, output, 'utf8');

const sizeKB = (output.length / 1024).toFixed(2);
console.log(`✓ Built AttackReportAnalyzer.user.js`);
console.log(`  Files: ${FILES.length}`);
console.log(`  Lines: ${totalLines}`);
console.log(`  Size:  ${sizeKB} KB`);
