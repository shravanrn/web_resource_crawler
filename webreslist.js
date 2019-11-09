//////////////////////////////////////////////////////////////////////////////////
//Settings
const delayAmount = 10000;
const sites = [
    "https://google.com",
    "https://youtube.com",
    "https://tmall.com",
    "https://baidu.com",
    "https://qq.com",
    "https://facebook.com",
    "https://sohu.com",
    "https://taobao.com",
    "https://wikipedia.org",
    "https://login.tmall.com",
    "https://yahoo.com",
    "https://360.cn",
    "https://jd.com",
    "https://amazon.com",
    "https://sina.com.cn",
    "https://weibo.com",
    "https://pages.tmall.com",
    "https://reddit.com",
    "https://live.com",
    "https://vk.com",
    "https://netflix.com",
    "https://okezone.com",
    "https://blogspot.com",
    "https://alipay.com",
    "https://csdn.net",
    "https://office.com",
    "https://instagram.com",
    "https://yahoo.co.jp",
    "https://xinhuanet.com",
    "https://bing.com",
    "https://microsoft.com",
    "https://aliexpress.com",
    "https://twitter.com/search?l=&q=the%20since%3A2019-11-03%20until%3A2019-11-04&src=typd",
    "https://livejasmin.com",
    "https://stackoverflow.com",
    "https://google.com.hk",
    "https://babytree.com",
    "https://naver.com",
    "https://ebay.com",
    "https://twitch.tv",
    "https://amazon.co.jp",
    "https://tribunnews.com",
    "https://pornhub.com",
    "https://apple.com",
    "https://google.co.in",
    "https://tianya.cn",
    "https://amazon.in",
    "https://microsoftonline.com",
    "https://msn.com",
    "https://wordpress.com"
];

//////////////////////////////////////////////////////////////////////////////////
//Program
class Result {
    constructor() {
      this.memory = 0;
      this.siteStr = "";
      this.loggedUrls = [];
    }

    addURL(details) {
        var url = details.url;
        var contentType = last(details.responseHeaders.filter(contentHeader =>
            contentHeader.name == "content-type"
        ));
        var contentEncoding = last(details.responseHeaders.filter(contentHeader =>
            contentHeader.name == "content-encoding"
        ));
        this.loggedUrls.push({
            url : url,
            contentType : contentType,
            contentEncoding : contentEncoding
        });
    }

    setSite(val) {
        this.siteStr = val;
    }

    setMemory(val) {
        this.memory = val;
    }
}

var currentResult = new Result();

function logURL(details) {
    currentResult.addURL(details);
}

browser.webRequest.onHeadersReceived.addListener(
    logURL,
    {urls: ["<all_urls>"]},
    ["blocking", "responseHeaders"]
  );

function getMemory(curr) {
    return browser.runtime.sendNativeMessage("webresourcecrawler_native", "getmem")
    .then(function(response){
        var memVals = response.split("\n");
        var max = -1;
        memVals.forEach(function(val){
            var v = parseInt(val);
            if(v > max) { max = v; }
        });
        curr.setMemory(max);
    });
}

function launchWebsite(siteStr) {
    currentResult.setSite(siteStr);

    return browser.tabs.query({active: true})
    .then(tabs => browser.tabs.update(tabs[0].id, { url: siteStr }))
    .then(() => console.log(`Launching: ${siteStr}`))
    .delay(delayAmount)
    .then(() => getMemory(currentResult))
    .then(() => {
        var result = currentResult;
        currentResult = new Result();
        console.log("Curr result: " + JSON.stringify(result));
        return result;
    });
}

function postResults(results) {
    return browser.runtime.sendNativeMessage("webresourcecrawler_native", {
        "nameStr" : "results",
        "valueStr" : results
    });
}

var inProgress = false;

function openPages() {
    if (inProgress) { return; }
    inProgress = true;

    var p = Promise.resolve(true);
    var allResults = [];

    sites.forEach(item => {
        p = p
            .then(() => launchWebsite(item))
            .then(result => allResults.push(result));
    });

    p
    .then(() => postResults(allResults))
    .then(() => {
        console.log("Results: " + JSON.stringify(allResults));
        inProgress = false;
        return browser.tabs.query({active: true})
    })
    .then(function (tabs) {
        return browser.tabs.update(tabs[0].id, { url: "about:blank" })
    });
}


browser.browserAction.onClicked.addListener(openPages);


//////////////////////////////////////////////////////////////////////////////////
//General Helpers

function delay(t, v) {
    return new Promise(function(resolve) {
        setTimeout(resolve.bind(null, v), t)
    });
 }

Promise.prototype.delay = function(t) {
     return this.then(function(v) {
         return delay(t, v);
     });
 }

function last(arr){
    if (!arr) { return arr; }
    if (arr.length == 0) { return null; }
    return arr[arr.length - 1];
}
