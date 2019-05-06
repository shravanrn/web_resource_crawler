//////////////////////////////////////////////////////////////////////////////////
//Settings
const delayAmount = 5000;
const sites = ["https://developer.mozilla.org", "https://twitter.com/sggrc"];

//////////////////////////////////////////////////////////////////////////////////

var inProgress = false;
var allResults = {};
const emptyResultRow = {
    "count"                : 0,
    "originCount"          : 0,
    "gzippedCount"         : 0,
    "otherCompressedCount" : 0,
    "origins"              : []
};
const emptyResult = {
    "alltext"             : JSON.parse(JSON.stringify(emptyResultRow)),
    "jpeg"                : JSON.parse(JSON.stringify(emptyResultRow)),
    "png"                 : JSON.parse(JSON.stringify(emptyResultRow)),
    "html"                : JSON.parse(JSON.stringify(emptyResultRow)),
    "css"                 : JSON.parse(JSON.stringify(emptyResultRow)),
    "js"                  : JSON.parse(JSON.stringify(emptyResultRow)),
    "memory"              : -1,
    "sfi_extraMemory"     : -1,
    "sfi_memoryOverhead"  : -1.0,
    "proc_extraMemory"    : -1,
    "proc_memoryOverhead" : -1.0
};
var currentResult = JSON.parse(JSON.stringify(emptyResult));

function updateResult(key, url, contentEncoding) {
    currentResult[key].count++;

    const origin = getOrigin(url);
    if (!currentResult[key].origins.includes(origin)){
        currentResult[key].origins.push(origin);
        currentResult[key].originCount++;
    }

    if (isGZipped(contentEncoding)) {
        currentResult[key].gzippedCount++;
    } else if (isCompressed(contentEncoding)) {
        currentResult[key].otherCompressedCount++;
    }
}

function logURL(details) {
    var contentType = last(details.responseHeaders.filter(contentHeader => contentHeader.name == "content-type"));
    var contentEncoding = last(details.responseHeaders.filter(contentHeader => contentHeader.name == "content-encoding"));

    if (isHTML(details.url, contentType)) {
        updateResult("html", details.url, contentEncoding);
    } else if (isCSS(details.url, contentType)) {
        updateResult("css", details.url, contentEncoding);
    } else if (isJS(details.url, contentType)) {
        updateResult("js", details.url, contentEncoding);
    } else if (isJPEG(details.url, contentType)) {
        updateResult("jpeg", details.url, contentEncoding);
    } else if (isPNG(details.url, contentType)) {
        updateResult("png", details.url, contentEncoding);
    }

    if (isHTML(details.url, contentType) ||
        isJS(details.url, contentType) ||
        isCSS(details.url, contentType)) {
        updateResult("alltext", details.url, contentEncoding);
    }
}

function getMemory() {
    return browser.runtime.sendNativeMessage("webresourcecrawler_native", "getmem")
    .then(function(response){
        var memVals = response.split("\n");
        var max = -1;
        memVals.forEach(function(val){
            var v = parseInt(val);
            if(v > max) { max = v; }
        });
        currentResult.memory = max;
    });
}

function runComputations() {
    var sandboxes = currentResult["alltext"].gzippedCount + currentResult["jpeg"].originCount + currentResult["png"].originCount;
    //1.6MB for SFI, 2,4 for proc
    currentResult.sfi_extraMemory  = 1638 * sandboxes;
    currentResult.proc_extraMemory = 2458 * sandboxes;
    currentResult.sfi_memoryOverhead = currentResult.sfi_extraMemory * 100.0 / currentResult.memory;
    currentResult.proc_memoryOverhead = currentResult.proc_extraMemory * 100.0 / currentResult.memory;
}

function launchWebsite(siteStr) {
    return browser.tabs.query({active: true})
    .then(function (tabs) {
        return browser.tabs.update(tabs[0].id, { url: siteStr })
    })
    .then(function () {
        console.log(`Launching: ${siteStr}`);
    })
    .delay(delayAmount)
    .then(function() { return getMemory(); })
    .then(function() { runComputations(); })
    .then(function() {
        allResults[siteStr] = currentResult;
        currentResult = JSON.parse(JSON.stringify(emptyResult));
        console.log("Intermediate result: " + JSON.stringify(allResults));
    });
}

function postResults(results) {
    return browser.runtime.sendNativeMessage("webresourcecrawler_native", {
        "nameStr" : "results",
        "valueStr" : results
    });
}

function openPages() {
    if (inProgress) { return; }
    inProgress = true;

    var p = Promise.resolve(true);

    sites.forEach(function(item){
        p = p.then(function(){ return launchWebsite(item); });
    });

    p.then(function() {
        return postResults(allResults);
    })
    .then(function(){
        console.log("Results: " + JSON.stringify(allResults));
        allResults = {};
        inProgress = false;
        return browser.tabs.query({active: true})
    })
    .then(function (tabs) {
        return browser.tabs.update(tabs[0].id, { url: "about:blank" })
    });
}

browser.webRequest.onHeadersReceived.addListener(
    logURL,
    {urls: ["<all_urls>"]},
    ["blocking", "responseHeaders"]
  );

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

//////////////////////////////////////////////////////////////////////////////////
//Content Helpers
function ext(url) {
    return (url = url.substr(1 + url.lastIndexOf("/")).split('?')[0]).split('#')[0].substr(url.lastIndexOf(".")).toLowerCase()
}

function checkUrlOrContentType(url, contentType, extensions, targetContentType){
    if(!contentType) {
        return extensions.includes(ext(url));
    }

    return contentType.value.toLowerCase().startsWith(targetContentType);
}

function isHTML(url, contentType){
    return checkUrlOrContentType(url, contentType, ["", ".html"], "text/html");
}

function isJS(url, contentType){
    return checkUrlOrContentType(url, contentType, [".js"], "application/javascript");
}

function isCSS(url, contentType){
    return checkUrlOrContentType(url, contentType, [".css"], "text/css");
}

function isJPEG(url, contentType){
    return checkUrlOrContentType(url, contentType, [".jpg", ".jpeg"], "image/jpeg");
}

function isPNG(url, contentType){
    return checkUrlOrContentType(url, contentType, [".png"], "image/png");
}

function isGZipped(contentEncoding){
    if (!contentEncoding) { return false; }
    if (contentEncoding.value.toLowerCase() == "gzip") { return "true"; }
    return false;
}

function isCompressed(contentEncoding){
    if (!contentEncoding) { return false; }
    if (contentEncoding.value) { return "true"; }
    return false;
}

function getOrigin(urlString) {
    const url = new URL(urlString);
    return url.origin;
}
