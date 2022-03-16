// ==UserScript==
// @name         jdos-shit
// @name:zh      JDOS 拉屎占坑
// @namespace    https://www.diguage.com/monkeyell
// @version      1.0
// @description  JDOS 拉屎占坑专用。公司内部辅助工具，非内部人员请勿下载。
// @author       diguage
// @homepage     https://www.diguage.com
// @match        jdt.jdos.jd.com/
// @grant        unsafeWindow
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @note         2022-03-16 v1.0 初步强坑确认一条龙
// ==/UserScript==

(function() {
    'use strict';
    // 抢茅坑
    console.log("wait to shit...")
    var seconds = 1000*(Math.round(Math.random()*30) + 60);
    var timer = setInterval(function() {
        console.log("begin to shit...");

        // 抢茅坑
        var button = $("#cluster-group > div > div:nth-child(1) > div > div > span:nth-child(2) > button.btn.bg-color-blueDark.txt-color-white");
        if(button.length >= 1) {
            button.click();

            // 点击确定
            setTimeout(function (a,b) {
                $('#bot2-Msg1').click();
            }, 300, 1, 1);
        }
    }, seconds);
})();
