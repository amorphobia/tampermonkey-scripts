// ==UserScript==
// @name         TJUPT Tweaks
// @name:zh-CN   北洋园优化
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      0.3.0
// @description  Current tweaks: fold / hide the bannar, hide sticky torrents
// @description:zh-CN  目前的优化：折叠／隐藏横幅，隐藏置顶种子
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
    const num_emoji = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

    let menu_items = [
        {
            "id": "m_bannerAutoFold",
            "name": "自动折叠横幅",
            "display": "自动折叠横幅",
            "type": "switch",
            "value": true
        },
        {
            "id": "m_bannerHide",
            "name": "隐藏横幅",
            "display": "隐藏横幅（隐藏时折叠设置无效）",
            "type": "switch",
            "value": false
        },
        {
            "id": "m_hideSticky",
            "name": "隐藏置顶种子",
            "display": [
                "显示所有置顶",
                "隐藏一重置顶",
                "隐藏一、二重置顶",
                "隐藏所有置顶" ],
            "type": "gear",
            "value": 0
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
            const item = menu_items[i];
            const value = menu_items[i].value;

            if (item.type == "switch") {
                menu_registered[i] = GM_registerMenuCommand(`${value ? "✅" : "❌"}${item.display}`, function () {
                    toggleSwitch(item);
                });
            } else if (item.type == "gear") {
                menu_registered[i] = GM_registerMenuCommand(`${num_emoji[value]}${item.display[value]}`, function () {
                    shiftGear(item);
                });
            } else {
                menu_registered[i] = GM_registerMenuCommand(`${item.id}`, function () { console.log(`Unrecognized menu item: ${item.id}`) })
            }
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

    function shiftGear(item) {
        const new_value = (item.value + 1) % item.display.length;
        GM_setValue(item.id, new_value);
        GM_notification({
            text: `切换为「${item.display[new_value]}」\n（点击刷新网页后生效）`,
            timeout: 3500,
            onclick: function () { location.reload(); }
        })
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

    switch (getValue("m_hideSticky")) {
    case 3:
        css += `.triple_sticky_bg {\n`
             + `    display: none;\n`
             + `}\n`;
        // fallsthrough
    case 2:
        css += `.double_sticky_bg {\n`
             + `    display: none;\n`
             + `}\n`;
        // fallsthrough
    case 1:
        css += `.sticky_bg {\n`
             + `    display: none;\n`
             + `}\n`;
        // fallsthrough
    default:
    }

    if (typeof GM_addStyle !== "undefined") {
        GM_addStyle(css);
    } else {
        let style_node = document.createElement("style");
        style_node.appendChild(document.createTextNode(css));
        (document.querySelector("head") || document.documentElement).appendChild(style_node);
    }
})();
