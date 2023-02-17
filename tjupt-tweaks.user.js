// ==UserScript==
// @name         TJUPT Tweaks
// @name:zh-CN   北洋园优化
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.2.0
// @description  Current tweaks: fold / hide the bannar
// @description:zh-CN  目前的优化：折叠／隐藏横幅
// @author       amorphobia
// @match        *://tjupt.org/*
// @match        *://*.tjupt.org/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @noframes
// @homepageURL  https://github.com/amorphobia/tampermonkey-scripts
// @supportURL   https://github.com/amorphobia/tampermonkey-scripts/issues
// @icon         https://tjupt.org/assets/favicon/favicon.png
// @license      AGPL-3.0-or-later
// ==/UserScript==

(function() {
    "use strict";

    const github = "https://github.com/amorphobia/tampermonkey-scripts/";

    let menu_items = [
        {
            "id": "m_bannerAutoFold",
            "name": "自动折叠横幅",
            "value": true,
            "display": "自动折叠横幅"
        },
        {
            "id": "m_bannerHide",
            "name": "隐藏横幅",
            "value": false,
            "display": "隐藏横幅（隐藏时折叠设置无效）"
        }
    ];
    let menu_registered = [];

    for (let i = 0; i < menu_items.length; i++) {
        if (GM_getValue(menu_items[i].id) == null) {
            GM_setValue(menu_items[i].id, menu_items[i].value);
        }
    }

    registerMenu();

    function registerMenu() {
        if (menu_registered.length > menu_items.length) {
            for (let i = 0; i < menu_registered.length; i++) {
                GM_unregisterMenuCommand(menu_registered[i]);
            }
        }

        for (let i = 0; i < menu_items.length; i++) {
            menu_items[i].value = GM_getValue(menu_items[i].id);
            menu_registered[i] = GM_registerMenuCommand(`${menu_items[i].value ? "✅" : "❌"}${menu_items[i].display}`, function () {
                toggleSwitch(menu_items[i]);
            });
        }

        menu_registered[menu_registered.length] = GM_registerMenuCommand("💬反馈与建议", function () {
            window.GM_openInTab(github, { active: true, insert: true, setParent: true });
        });
    }

    function toggleSwitch(item) {
        const status = item.value ? "关闭" : "开启";
        GM_setValue(item.id, !item.value);
        GM_notification({
            text: `已${status}「${item.name}」\n（点击刷新网页后生效）`,
            timeout: 3500,
            onclick: function () { location.reload(); }
        });
        registerMenu();
    }

    function getValue(id) {
        for (const item of menu_items) {
            if (item.id == id) {
                return item.value;
            }
        }
    }

    let css = "";
    if (getValue("m_bannerHide")) {
        css = `.logo_img img {\n`
            + `    display: none;\n`
            + `}\n`;
    } else if (getValue("m_bannerAutoFold")) {
        const logo_img = document.querySelector(".logo_img");
        const original_height = logo_img.clientHeight;

        css = `.logo_img {\n`
            + `    height: 10px;\n`
            + `    overflow: hidden;\n`
            + `    transition: height 0.5s;\n`
            + `}\n`
            + `\n`
            + `.logo_img:hover {\n`
            + `    height: ${original_height}px;\n`
            + `}\n`;
    }

    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(css);
    } else {
        let style_node = document.createElement("style");
        style_node.appendChild(document.createTextNode(css));
        (document.querySelector("head") || document.documentElement).appendChild(style_node);
    }
})();
