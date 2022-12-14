// ==UserScript==
// @name         谷歌搜索重定向
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1.2
// @description  自动从 google.cn 跳转到 google.com.hk
// @author       amorphobia
// @match        https://www.google.cn/search*
// @run-at       document-start
// @noframes
// @homepageURL  https://github.com/amorphobia/tampermonkey-scripts
// @supportURL   https://github.com/amorphobia/tampermonkey-scripts/issues
// @license      AGPL-3.0-or-later
// ==/UserScript==

(function () {
  'use strict';
  const url = new URL(location);
  url.hostname = 'www.google.com.hk';
  location.replace(url);
})();
