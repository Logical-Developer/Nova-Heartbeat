// ==UserScript==
// @name         Nova Farm List Manager (V 1.0.3)
// @namespace    local.travian.nova.farmlistmanager
// @version      1.0.3
// @description  Farm List Manager for Nova-HB — scan farm lists, import targets from farm-list-v1 JSON, validate duplicates, start lists, track last run
// @match        https://*.travian.com/*
// @match        https://*.traviantop.com/*
// @match        https://*.international.travian.com/*
// @match        https://*.arabics.travian.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
