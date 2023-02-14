// ==UserScript==
// @name         TJUPT Tweaks
// @name:zh-CN   北洋园优化
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1.2
// @description  Current tweaks: Fold the bannar
// @description:zh-CN  目前的优化：折叠 bannar
// @author       amorphobia
// @match        *://tjupt.org/*
// @match        *://*.tjupt.org/*
// @noframes
// @homepageURL  https://github.com/amorphobia/tampermonkey-scripts
// @supportURL   https://github.com/amorphobia/tampermonkey-scripts/issues
// @icon         https://tjupt.org/assets/favicon/favicon.png
// @license      AGPL-3.0-or-later
// @grant        none
// ==/UserScript==

(function() {
  const logo_img = document.querySelector('.logo_img');
  const originalHeight = logo_img.clientHeight;

  let css = `
.logo_img {
  height: 10px;
  overflow: hidden;
  transition: height 0.5s;
}

.logo_img:hover {
  height: ${originalHeight}px;
}
`;

  if (typeof GM_addStyle !== "undefined") {
    GM_addStyle(css);
  } else {
    let styleNode = document.createElement("style");
    styleNode.appendChild(document.createTextNode(css));
    (document.querySelector("head") || document.documentElement).appendChild(styleNode);
  }
})();
