// ==UserScript==
// @name         Nova Attack Report Analyzer - Alliance (V 1.6.2)
// @name:fa      نوا آنالایزر گزارش حملات اتحاد
// @namespace    https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer
// @version      1.6.2
// @description  Analyze attack reports (alliance + own). Extract farm targets with loot %, distance, coordinates, tribe, target-village alliance. Separate Natars and Oases. Filter by alliance / attacker, sort columns. Export as farm-list-v1 (compatible with Farm Manager) or analytical JSON.
// @description:fa  تحلیل گزارش‌های حمله (اتحاد و شخصی). استخراج فارم‌ها با درصد غارت، فاصله، مختصات، نژاد و اتحاد دهکده هدف. فیلتر بر اساس اتحاد/مهاجم، مرتب‌سازی ستون‌ها. خروجی farm-list-v1 (سازگار با Farm Manager) یا JSON تحلیلی.
// @author       Nova
// @match        *://*.travian.com/alliance/reports*
// @match        *://*.travian.com/report/offensive*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer
// @supportURL   https://github.com/Logical-Developer/Nova-Attack-Report-Analyzer/issues
// @updateURL    https://raw.githubusercontent.com/Logical-Developer/Nova-Attack-Report-Analyzer/main/Nova-Attack-Report-Analyzer-Alliance.user.js
// @downloadURL  https://raw.githubusercontent.com/Logical-Developer/Nova-Attack-Report-Analyzer/main/Nova-Attack-Report-Analyzer-Alliance.user.js
// ==/UserScript==

(function () {
    "use strict";
