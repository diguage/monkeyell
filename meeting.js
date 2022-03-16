// ==UserScript==
// @name         会议室小助手
// @namespace    https://www.diguage.com/monkeyell
// @version      1.1
// @description  会议室预订助手
// @author       diguage
// @homepage     https://www.diguage.com
// @grant        none
// @include      http://jms.erp.jd.com/*
// @include      https://jms.erp.jd.com/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js
//使用须知：需要保持页面一直打开，每天重新登录一次；
//
//自动确认会议室的逻辑：每25分钟查询一次已预约会议室列表，对可以确认的会议室进行确认；9:40开始，19点结束；
//
//自动预订会议室的逻辑：
//0、自动预订后天的会议室，界面上显示的日期没有意义，仅仅是为了选择时间范围；
//1、在08:59:55(这个时间可以是接近09:00的任意时间)查询符合条件的会议室，构建可预订会议室的列表(每个元素为1个小时1个会议室);在09:00发送预订请求；
//2、一个时间段为一组，按时间段将符合条件的会议室进行分组，每个时间段仅预订1个会议室；
//3、autoMeetingCodeArray指定了预订的范围，已经内置了常用的中等会议室和比较大的会议室
//
//自动捡漏的逻辑：
//0、通过页面选择日期和时间、容纳人数，自动查询并预订会议室；
//1、读取界面上显示的日期和时间，定期查询(1分钟，频率可调)是否有符合条件的会议室；
//2、如果选择的时间段是连续的，但是没有连续的会议室，则会按小时定尽可能多的会议室，例如时间范围选择14-19点，但是只有14-15和17-18，则只会预订这2个时间段的
//3、通过autoPickInterval指定执行频率，默认是20秒
//
//变更记录
//2021-11-16,支持按楼层范围筛选
//2021-11-18,自动跳过中午的时间
//2022-03-16,更换 JS 的 CDN
// ==/UserScript==

(function() {
    'use strict';

    var constObj = {
        "autoConfirmMeetingOrderEnable":"已开启自动确认会议室"
    };

    var bt_state = true;//自动捡漏状态
    var ref;//自动捡漏刷新
    var autoPickInterval = 20;//捡漏的执行频率，单位是秒
    //请求参数
    var meetingEstimateDate ;//= "2021-01-27";//预定日期
    var reserveStartTime ;//= "1800";//预定开始时间
    var reserveEndTime ;//= "1900";//预定结束时间
    var meetingOrderCountOfDay = 0;

    var autoBookTimerId = null;
    //自动预定会议室的范围：依次是白热度、京东金采、京小贷、小金库、众创学院、巴西
    var autoMeetingCodeArray = ["2001003737","2001003739","2001007398","2001003746","2001003744","2001001631"];
    //自动预定会议室的范围：依次是小金库、法国、保加利亚、埃及
    //var autoMeetingCodeArray = ["2001003746","2001005805","2001005834","2001007972"];

    init();

    function init() {
        var tipsHtml = '<div id="tips" style="position:absolute;left:250px;top:20px;color:red;border:hidden;font-size:large;"></div>'
        $("div.left_area").append($(tipsHtml));

        /**添加按钮*/
        var btn_pick = $("<button id=\"autoBtn\" style=\"width: 140px;margin-left: 17px; \" class=\"el-button el-button--primary\" type=\"button\"><span>自动捡漏</span></button>");
        var btn_book = $("<button id=\"bookBtn\" style=\"width: 160px;margin-left: 17px; \" class=\"el-button el-button--primary\" type=\"button\"><span>自动预订(未开启)</span></button>")
        $(btn_book).click(autoBook);
        $(btn_pick).click(clickBtn);
        $($('.el-form-item__content .el-button')[0]).after(btn_pick);
        $(btn_pick).after(btn_book);

        //10分钟自动确认一次会议室
        setTimeout(autoConfirmMeetingOrderInterval, 300);

        //初始化楼层范围
        var floorRange = ["16-18","19-21","13-15","1-25","13-17"];
        var floorItemHtml = '';
        for(var i in floorRange) {
            floorItemHtml = floorItemHtml + '<label role="checkbox" class="el-checkbox"><span class="el-checkbox__input"><input type="checkbox" value="'+floorRange[i]+'"></span><span>'+floorRange[i]+'</span></label>';
        }
        var floorRangeHtml = '<div class="el-form-item"><label class="el-form-item__label">楼层范围</label><div class="el-form-item__content"><div id="floorRangeDiv" class="el-checkbox-group">'+floorItemHtml+'</div></div></div>';
        $("div.options_container form:first").append(floorRangeHtml);

        //下面这段代码是为了修改人数范围，暂时没用到，逻辑也不对
        var containNumRange = ["15-25","25-35"];
        $('div[data-v-b0de7d82][role="radiogroup"] label').each(function(){
            var radioInput = $(this).find("input");
            if(radioInput.val().length == 0) {
                return ;
            }

        });

        var containNumRangeHtml = '';
        for(i in floorRange) {
            //floorItemHtml = floorItemHtml + '<label role="checkbox" class="el-checkbox"><span class="el-checkbox__input"><input type="checkbox" value="'+floorRange[i]+'"></span><span>'+floorRange[i]+'</span></label>';
        }
        //修改人数范围结束
    }

    function autoBook() {
        if(autoBookTimerId != null) {
            console.info("stop auto book");
            clearTimeout(autoBookTimerId);
            autoBookTimerId = null;
            $("#bookBtn").text("自动预订(未开启)");
            return ;
        }

        var diffTime = getServerTimeDiff();

        //最近的09:00:00
        var bookTime = new Date();
        if(bookTime.getHours() > 9) {
            //今天9点以后，将时间设置为明天
            //bookTime.setDate(bookTime.getDate()+1);
        }
        bookTime.setHours(9,0,0,0);
        var meetingRoomTime = new Date(bookTime.getTime());
        meetingRoomTime.setDate(meetingRoomTime.getDate()+1);
        var meetingRoomDate = buildQueryMeetingRoomParmas().meetingEstimateDate;
        var now = new Date();
        bookTime.setTime(bookTime.getTime()+diffTime);
        //调试用
        //bookTime.setTime(now.getTime()+1000);

        console.info(formatDate(bookTime,"yyyy-MM-dd hh:mm:ss") + "预定" + meetingRoomDate + "的会议室" );
        autoBookTimerId = setTimeout(function(){
                queryAccordWithMeeting(meetingRoomDate,bookTime.getTime(),autoMeetingCodeArray);
            },bookTime.getTime()-now.getTime()-5*1000);//提前5秒查询会议室信息
        $("#bookBtn").text("自动预订"+meetingRoomDate);
    }

    function clickBtn(){

        //开始捡漏
        if(bt_state){
            $("#autoBtn").text("自动捡漏:已开启");
            console.info("开始捡漏");
            //设置定时刷新
            ref = setInterval(function(){
                    queryAccordWithMeeting(null,0,undefined);
                },autoPickInterval*1000);
            bt_state = false;
            //立即执行一次
            queryAccordWithMeeting(null,0,undefined);
        } else {
            stopAutoPick();
        }
    }

    function stopAutoPick() {
        $("#autoBtn").text("自动捡漏:已关闭")
        clearInterval(ref);
        bt_state = true;
    }

    /**
     * ajax 查询会议室
     */
    function queryAccordWithMeeting(bookDate,reserveTimeMs,meetingCodeArray){
        var floorRange=buildfloorRange();
        var queryParams = buildQueryMeetingRoomParmas();
        console.info("选择的楼层"+floorRange);
        console.info(formatDate(new Date(),"hh:mm:ss") + "预订时间为"+queryParams.meetingEstimateDate+" " + queryParams.meetingEstimateStime + "~" + queryParams.meetingEstimateEtime);
        //处理分页逻辑，页面上的分页最多是50，虽然大于50可以正常返回数据,但大于50容易被认为不是从页面发起的
        function pageQueryMeetingRooms() {
        ajaxPost("meetingInfo/queryAvailableMeetingInfo",queryParams,function(result) {
            console.info("当前查询第"+queryParams.pageNum+"页,返回"+result.data.rows.length+"条数据");
                var mg = filterAndMappingMeetingRoom(result,meetingCodeArray,floorRange);
                if(mg!=null){
                    var reserveTimeDiffMs = reserveTimeMs - (new Date()).getTime();
                    if(reserveTimeDiffMs < 0) reserveTimeDiffMs = 0;
                    console.info("在"+reserveTimeDiffMs+"毫秒后预订会议室，候选会议室"+JSON.stringify(mg));
                    if(bookDate == null) {
                        stopAutoPick();//如果是捡漏，则停止查询
                    }
                    batchReserveMeetingRooms(mg,reserveTimeDiffMs);
                } else if(result.data.rows.length==queryParams.pageSize) {//可能还有下一页
                    queryParams.pageNum = queryParams.pageNum + 1;
                    console.info("查询下一页"+queryParams.pageNum);
                    pageQueryMeetingRooms();
                } else {
                    console.info("没有合适时间");
                }
        });
        }

        pageQueryMeetingRooms();
    }

    function buildQueryMeetingRoomParmas() {
        meetingEstimateDate = $(".el-input__inner:eq(3)").val();//预定日期
        reserveStartTime = $(".el-input__inner:eq(4)").val().replace(":","");//预定开始时间
        reserveEndTime = $(".el-input__inner:eq(5)").val().replace(":","");//预定结束时间
        var containNumRange=$('.el-radio__original:checked').val();
        //var floorNo = "";
        var queryParams = {"districtCode":"13","workplaceCode":"1001000052","buildingCode":"","floorNo":"","meetingEstimateDate":meetingEstimateDate,"meetingEstimateStime":reserveStartTime,"meetingEstimateEtime":reserveEndTime,"allDayIndicator":1,"timeZoneDiff":0,"containNumRange":containNumRange,"facilities":["tv"],"roomType":"N","meetingName":null,"pageNum":1,"pageSize":50,"lang":"zh"};
        return queryParams;
    }

    function buildfloorRange() {
        var floorRangeResult = [];
        $('#floorRangeDiv input:checked').each(function(){
            var floorRangeArray = $(this).val().split("-");
            var floorNoBegin = parseInt(floorRangeArray[0]);
            var floorNoEnd = parseInt(floorRangeArray[1]);
            for(var floorNoCur = floorNoBegin; floorNoCur<=floorNoEnd; floorNoCur++) {
                floorRangeResult.push(floorNoCur);
            }
        });

        //从大到小排序，就是为了显示好看，没别的作用
        floorRangeResult.sort(function(a,b){return a-b});

        return floorRangeResult;
    }


    /**
     * 过滤符合条件的会议室，并按时间段进行分组，每个小时1组；
     *  格式：{"起始时间":[会议室列表]}
     *  例如：{"1400"[{},{}]},"1500":[{}]}
     */
    function filterAndMappingMeetingRoom(result, meetingCodeArray, floorRange){
        var rows = result.data.rows;
        rows.sort(function(a,b){return Math.abs(parseInt(a.floorNo)-17)-Math.abs(parseInt(b.floorNo)-17)});
        console.info(rows);
        var meetingRoomGroup = {};
        //转换为数字
        var st = parseInt(reserveStartTime);
        var et = parseInt(reserveEndTime);
        for(var t = st; t<et; t=t+100) {
            if(t>=1200 && t<1400) {
                continue;//自动跳过中午的时间
            }
            meetingRoomGroup[t] = [];
        }

        //优先找连续的会议室
        for(var i=0;i<rows.length && hasEnoughMeetingRoom(meetingRoomGroup) == false;i++){//处理每一个会议室
            if(filterMeetingRoom(rows[i],meetingCodeArray,floorRange)){
                for(var z=0;z<rows[i].meetingEstimateRange.length;z++){//一个会议室可能有多个可用的时间段，需要遍历处理
                    var startTime = rows[i].meetingEstimateRange[z].startTime;
                    var endTime = rows[i].meetingEstimateRange[z].endTime;
                    if(startTime<=reserveStartTime&&endTime>=reserveEndTime) {
                        for(t = st; t<et; t=t+100) {//处理每一个时间段，1小时1个时间段
                            if(t>=1200 && t<1400) {
                                continue;
                            }
                            if(meetingRoomGroup[t].length<3) {
                                meetingRoomGroup[t].push(buildReserveMeetingRoomInfo(rows[i],t,t+100));
                            }
                        }
                    }
                }
            }
        }

        //如果没有连续的，则逐个小时的找
        for(var x in meetingRoomGroup) {
            if(meetingRoomGroup[x].length >= 3) {
                continue;
            }

            t = parseInt(x);

            for(i=0;i<rows.length;i++){
              if(filterMeetingRoom(rows[i],meetingCodeArray,floorRange)){
                for(z=0;z<rows[i].meetingEstimateRange.length;z++){
                    startTime = rows[i].meetingEstimateRange[z].startTime;
                    endTime = rows[i].meetingEstimateRange[z].endTime;
                    if(startTime<=t&&endTime>=t+100 && meetingRoomGroup[t].length<3) {
                        meetingRoomGroup[t].push(buildReserveMeetingRoomInfo(rows[i],t,t+100));
                    }
                }
              }
            }
        }

        var hasData = false;
         for(var k in meetingRoomGroup) {
            if(meetingRoomGroup[k].length == 0) {
                delete meetingRoomGroup[k];
            } else {
                hasData = true;
            }
        }

        return hasData ? meetingRoomGroup : null;
    }

    function filterMeetingRoom(meetingInfo,meetingCodeArray,floorRange) {
         return (meetingCodeArray === undefined || meetingCodeArray.indexOf(meetingInfo.meetingCode)>=0) //会议室编码在指定列表或者没有指定会议室编码
                && (floorRange.length == 0 || floorRange.indexOf(parseInt(meetingInfo.floorNo))>=0) //楼层过滤
    }

    //所有时间段都有3个候选会议室，则返回true
    function hasEnoughMeetingRoom(meetingRoomGroup) {
        for(var i in meetingRoomGroup) {
            if(meetingRoomGroup[i].length < 3) {
                return false;
            }
        }

        return true;
    }

    function buildReserveMeetingRoomInfo(meetingRoom,st,et) {
        var m={
            "meetingName":meetingRoom.meetingName,
            "meetingCode":meetingRoom.meetingCode,
            "workplaceCode":meetingRoom.workplaceCode,
            "districtCode":meetingRoom.districtCode,
            "meetingEstimateDate":meetingRoom.meetingEstimateDate,
            "meetingEstimateStime":st,
            "meetingEstimateEtime":et,
            "bookJoyMeeting":0,
            "joyMeetingParam":{
                "meeting":{
                    "password":""
                }
            },
            "meetingSubject":"预约了会议室",
            "lang":"zh"
        };

        return m;
    }

    /**
    * meetingRoomGroup的格式查看filterAndMappingMeetingRoom
    * ms多少毫秒后执行
    */
    function batchReserveMeetingRooms(meetingRoomGroup,ms) {
        for(var i in meetingRoomGroup) {
            setTimeout(function(i){
                reserveMeetingRoom(i,meetingRoomGroup[i], 0);
            },ms,i);
        }
    }

    /**
     * 预定会议室
     */
    function reserveMeetingRoom(st,meetingRoomList, i){
        var meetingRoom = meetingRoomList[i];
        var logPrefix = st+"-"+i+"-"+meetingRoom.meetingName;
        console.info(formatDate(new Date(),"yyyy-MM-dd hh:mm:ss.SSS") + " 执行预定" + logPrefix);

        ajaxPost("meetingOrder/create", meetingRoom , function(result) {
                //"message":"success
                console.info(logPrefix+"预定结果"+JSON.stringify(result));
                if(!(result.message=="success")){
                    console.info(logPrefix+"预定失败"+i);
                    if(i < meetingRoomList.length-1) {//i==length-1的时候说明当前已经是最后一个了，不需要继续了
                         reserveMeetingRoom(st,meetingRoomList, i+1);
                    }
                }else{
                    meetingOrderCountOfDay = meetingOrderCountOfDay + 1;
                    console.info(logPrefix+"预定成功"+meetingOrderCountOfDay);
                    autoConfirmMeetingOrderInterval();
                }
        });
    }


    /**
    * 会议室自动确认开始
    */
    function autoConfirmMeetingOrderInterval() {
        var thisTime = new Date();
        console.log(formatDate(thisTime,"hh:mm:ss") + "确认会议室");
        var rndm = 5 * 60 * 1000;
        var nextTime = new Date(thisTime.getTime() - thisTime.getTime()%(5 * 60 * 1000) + rndm); // 时间取整

        if(nextTime.getHours()>20) {
            nextTime.setDate(nextTime.getDate()+1);
            nextTime.setHours(9,45,0,0);
        }
        $("#tips").text(constObj.autoConfirmMeetingOrderEnable+",上次确认时间为"+formatDate(thisTime,"hh:mm:ss")+",下次确认时间为"+formatDate(nextTime,"hh:mm:ss"));
        setTimeout(autoConfirmMeetingOrderInterval, nextTime.getTime() - thisTime.getTime());
        queryUnusedMeetingOrder();
    }

    /**
     * 查询未使用的会议室，对符合条件的进行确认
     */
    function queryUnusedMeetingOrder(){

        var queryParams = {"orderStatusList":[1],"pageNo":1,"pageSize":10,"lang":"zh"};

        $.ajax({
            type : "POST",
            contentType: "application/json;charset=UTF-8",
            url : "http://jms.erp.jd.com/meetingOrder/queryOrderByUser",
            data : JSON.stringify(queryParams),
            success : function(result) {
               filterNeedConfirmMeetingOrderAndDoConfirm(result.data.rows);
            },
            error : function(e){
                console.log(e.status);
            }
        });
    }

    function filterNeedConfirmMeetingOrderAndDoConfirm(meetingOrderList) {
        var rows = meetingOrderList;
        var curTime = new Date();
        for(var i=0;i<rows.length;i++){
            var meetingOrderInfo = rows[i];
            var meetingOrderInfoStartTime = meetingOrderInfo.meetingEstimateStime + "";
            var meetingOrderInfoTime = new Date(meetingOrderInfo.meetingEstimateDate + " " + meetingOrderInfoStartTime.substr(0,2)+":" + meetingOrderInfoStartTime.substr(2,2));
            console.log("待确认的会议室 " + meetingOrderInfo.meetingName + " " + formatDate(meetingOrderInfoTime,"yyyy-MM-dd hh:mm:ss"));
            if(meetingOrderInfoTime.getTime() - curTime.getTime() <= 1000 * 60 * 40) {
                confirmMeetingOrder(meetingOrderInfo.meetingOrderCode);
            }
        }
    }

    function confirmMeetingOrder(meetingOrderNo) {
        var params={
            "meetingOrderCode":meetingOrderNo,
            "lang":"zh"
        };

        ajaxPost("meetingOrder/confirm",params,function(result){
                //"message":"success
                console.info("确定结果"+JSON.stringify(result));
                if(!(result.message=="success")){
                    console.info("确定失败");
                }else{
                    console.info("确定成功");
                }
        });
    }

    /**
    * 会议室自动确认结束
    */

    /**
    * 获取本机与服务器的时间差，单位是毫秒
    */
    function getServerTimeDiff() {
        var diffTime = 0;
        $.ajax({
            type : "POST",
            async:false,//必须要同步执行
            contentType: "application/json;charset=UTF-8",
            url : "http://jms.erp.jd.com/meetingInfo/queryAvailableMeetingInfo",
            data : JSON.stringify(buildQueryMeetingRoomParmas()),
            success : function(d,a2,r) {
                var serverTime = new Date(r.getResponseHeader("Date"));
                var endTime = (new Date()).getTime();
                diffTime = (endTime-serverTime.getTime());
                console.info("服务器当期时间为"+formatDate(serverTime,"yyyy-MM-dd hh:mm:ss.S")+",与本机的时间差为"+diffTime);
            },
            error : function(e){
            }
        });

        return diffTime;
    }

    /**
    *以下是公共的函数
    */

    /**
    * 发送ajax请求
    */
    function ajaxPost(uri,data,callback) {
        $.ajax({
            type : "POST",
            contentType: "application/json;charset=UTF-8",
            url : "http://jms.erp.jd.com/"+uri,
            data : JSON.stringify(data),
            success : function(result) {
                callback(result);
            },
            error : function(e){
                console.log(e.status);
            }
        });
    }

    /**
 *对Date的扩展，将 Date 转化为指定格式的String
 *月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
 *年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
 *例子：
 *(new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
 *(new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
 */
    function formatDate(date,fmt) {
        var o = {
            "M+": date.getMonth() + 1, //月份
            "d+": date.getDate(), //日
            "h+": date.getHours(), //小时
            "m+": date.getMinutes(), //分
            "s+": date.getSeconds(), //秒
            "q+": Math.floor((date.getMonth() + 3) / 3), //季度
            "S": date.getMilliseconds() //毫秒
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }
})();