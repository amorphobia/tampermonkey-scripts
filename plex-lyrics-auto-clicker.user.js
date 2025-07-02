// ==UserScript==
// @name         Plex Lyrics Auto Clicker
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1.1
// @description  Show lyrics automatically in Plex web client
// @author       amorphobia
// @match        https://app.plex.tv/
// @include      http://*:32400/*
// @icon         https://plex.tv/favicon.ico
// @license      AGPL-3.0-or-later
// @grant        none
// @downloadURL   https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/plex-lyrics-auto-clicker.user.js
// @updateURL     https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/plex-lyrics-auto-clicker.user.js
// ==/UserScript==

(function() {
    'use strict';
    window.setInterval(function() {
        if (document.querySelectorAll('[class*="AudioVideoFullPlayer-content"]').length > 0
                && document.querySelectorAll('[class*="AudioVideoLyrics-content"]').length === 0) {
            const lrc = document.querySelectorAll('[data-testid*="lyricsButton"]');
            if (lrc.length > 0 && !lrc[0].disabled) {
                console.log("Clicking ...");
                const rect = lrc[0].getBoundingClientRect();
                const x = rect.left + (rect.width / 2);
                const y = rect.top + (rect.height / 2);

                lrc[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
                lrc[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
                lrc[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
                lrc[0].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
            }
        }
    }, 1000);
})();
