// ==UserScript==
// @name         TJUPT Tweak
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1
// @description  北洋园PT微调
// @author       amorphobia
// @match        *://tjupt.org/*
// @match        *://*.tjupt.org/*
// @run-at       document-start
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
