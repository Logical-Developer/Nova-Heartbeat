#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// build.js — Concatenate src/ into Nova-Heartbeat.user.js
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUT_FILE = path.join(__dirname, 'Nova-Heartbeat.user.js');

// Order matters. The whole build is wrapped in a single IIFE that is opened
// in 00-header.js and closed at the end of 12-bootstrap.js.
//
// NOTE: plugin files are concatenated BEFORE 12-bootstrap.js so that their
// top-level registerPlugin() calls execute inside the IIFE (and before init()
// is triggered). 12-bootstrap.js therefore stays the final file of the build.
const FILES = [
  '00-header.js',
  '01-config.js',
  '02-utils.js',
  '03-state.js',
  '04-resolver.js',
  '05-navigate.js',
  '06-runner.js',
  '07-plugins-api.js',
  '08-ui-hbbox.js',
  '09-ui-settings.js',
  '10-ui-debug.js',
  '11-api.js',
  'plugins/Heartbeat.js',
  // 'plugins/Builder.js',  // enable if you add a Builder plugin
  '12-bootstrap.js',
];

const banner = `// ═══════════════════════════════════════════════════════════
// ⚠ AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY
// Generated: ${new Date().toISOString()}
// Source: src/
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
console.log(`✓ Built Nova-Heartbeat.user.js`);
console.log(`  Files: ${FILES.length}`);
console.log(`  Lines: ${totalLines}`);
console.log(`  Size:  ${sizeKB} KB`);
