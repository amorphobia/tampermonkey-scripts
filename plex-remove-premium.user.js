// ==UserScript==
// @name         Plex Remove Premium
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1.0
// @description  Remove Go Premium button in Plex web client
// @author       amorphobia
// @match        https://app.plex.tv/*
// @include      http://*:32400/*
// @icon         https://plex.tv/favicon.ico
// @license      AGPL-3.0-or-later
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/CoeJoder/waitForKeyElements.js@v1.3/waitForKeyElements.js
// @downloadURL  https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/plex-remove-premium.user.js
// @updateURL    https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/plex-remove-premium.user.js
// ==/UserScript==

(function() {
    'use strict';
    /*globals waitForKeyElements*/
    waitForKeyElements(() => {
        var btn = document.querySelector('span[title="Go Premium"]')?.parentElement;
        if (btn) {
            return [btn];
        }
        btn = document.querySelector('span[title="订阅高级版"]')?.parentElement;
        if (btn) {
            return [btn];
        }
        return null;
    }, (element) => {
        if (element) {
            if (element.style.display !== 'none') {
                element.style.display = 'none';
                return true;
            }
        }
        return false;
    });
})();
