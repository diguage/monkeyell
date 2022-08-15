// ==UserScript==
// @name         FuckXingyun
// @name:zh      行云自动填报
// @namespace    https://www.diguage.com/monkeyell
// @version      1.0
// @description  行为自动填报！下午两点以后，随机时间填报一次。
// @author       diguage
// @homepage     https://www.diguage.com
// @match        jagile.jd.com/jtime/report/weekly
// @grant        unsafeWindow
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.3/moment.min.js
// @note         2021-05-22 v1.0 初步实现分库分表结果展示以及自动选择数据库功能
// ==/UserScript==


(function () {
    'use strict';

    $(document).ready(function () {
        console.log('document ready, load FuckXingyun script...');
        setTimeout(function () {
            // 获取下午的随机时间
            var hour = 13 + Math.floor(Math.random() * 6);
            var minute = 10 + Math.floor(Math.random() * 50);
            var second = 10 + Math.floor(Math.random() * 50);
            var triggerTime = moment().format('YYYY-MM-DD') + 'T' + hour + ':' + minute + ':' + second + '+08:00';
            var triggerMomont = moment(triggerTime);


            $("body > div.app-root > section > section > main > div.jacp-module-root.main-inner > div.j-time > div.j-time-report > div:nth-child(2) > div:nth-child(1)")
                .after('<div style="color:red;font-size:140%;">现在时间：' + moment().format() + '<br/>填报时间：' + triggerMomont.format() + '</div>');


            var diffTime = triggerMomont.valueOf() - new Date().getTime();
            if (diffTime < 0) {
                console.log(moment().format() + ' too later to submit to worktime...');
                $("body > div.app-root > section > section > main > div.jacp-module-root.main-inner > div.j-time > div.j-time-report > div:nth-child(2) > div:nth-child(1)")
                    .after('<div style="color:red;font-size:200%;">太晚了！请手动提交工时！</div>');
                return;
            }
            setTimeout(function () {
                console.log(moment().format() + ' start to submit to worktime...');
                // 自动填报
                $("body > div.app-root > section > section > main > div.jacp-module-root.main-inner > div.j-time > div.j-time-report > div.j-time-week.j-time-report_main > div.j-time-report_content > div.j-time-report_footer > div.j-time-report_footer-bar > div:nth-child(2) > button:nth-child(2)").click();

                // 自动提交
                setTimeout(function () {
                    $("body > div.app-root > section > section > main > div.jacp-module-root.main-inner > div.j-time > div.j-time-report > div.j-time-week.j-time-report_main > div.j-time-report_content > div.j-time-report_footer > div.j-time-report_footer-bar > div:nth-child(2) > button:nth-child(3)").click();
                }, (5 + Math.floor(Math.random() * 20)) * 1000);
            }, diffTime);

        }, 5 * 1000);
    });
})();