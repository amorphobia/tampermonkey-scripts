// ==UserScript==
// @name         EU.org Password Max Length
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.1.0
// @description  Set max password length long enough in login page of nic.eu.org
// @author       amorphobia
// @match        https://nic.eu.org/arf/*/login/*
// @icon         https://nic.eu.org/favicon.ico
// @grant        none
// @downloadURL  https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/eu-org-password-max-length.user.js
// @updateURL    https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/eu-org-password-max-length.user.js
// ==/UserScript==

(function() {
    'use strict';

    var ipt = document.querySelector('input[id="id_password"]');
    if (ipt) {
        ipt.maxLength = 100;
    }
})();
