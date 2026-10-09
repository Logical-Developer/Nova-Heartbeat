// ==UserScript==
// @name         Nova Heartbeat (V 0.0.4)
// @namespace    https://github.com/Logical-Developer/Nova-Heartbeat
// @version      0.0.4
// @description  Nova Heartbeat — automated page rotation and construct-to-upgrade conversion
// @author       Logical-Developer
// @homepage     https://github.com/Logical-Developer/Nova-Heartbeat
// @supportURL   https://github.com/Logical-Developer/Nova-Heartbeat/issues
// @updateURL    https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js
// @downloadURL  https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js
// @match        https://*.travian.com/*
// @match        https://*.traviantop.com/*
// @match        https://*.international.travian.com/*
// @match        https://*.arabics.travian.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

// ═══════════════════════════════════════════════════════════
// Nova Heartbeat v0.0.4
// Modular source — see src/ folder
// DO NOT EDIT THE BUILT FILE — edit src/ and run: node build.js
// ═══════════════════════════════════════════════════════════
