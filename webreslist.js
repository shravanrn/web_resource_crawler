//////////////////////////////////////////////////////////////////////////////////
//Settings
const delayAmount = 10000;
const sites = [
    "https://twitter.com/search?l=en&q=since%3A2019-05-01&src=typd",
    "https://www.amazon.com/",
    "https://www.reddit.com/",
    "https://www.nytimes.com/",
    "https://www.cnn.com/",
    "https://www.facebook.com/",
    "https://www.youtube.com/"
];

//////////////////////////////////////////////////////////////////////////////////

var inProgress = false;
var allResults = {};
const emptyResultRow = {
    "count"                     : 0,
    "originCount"               : 0,
    "gzippedCount"              : 0,
    "gzippedOriginCount"        : 0,
    "gzippedOriginContentCount" : 0,
    "otherCompressedCount"      : 0,
    "urls"                      : [],
    "origins"                   : [],
    "gzippedOrigins"            : [],
    "gzippedOriginsContent"     : []
};
const emptyResult = {
    "compressed"                : JSON.parse(JSON.stringify(emptyResultRow)),
    "jpeg"                      : JSON.parse(JSON.stringify(emptyResultRow)),
    "png"                       : JSON.parse(JSON.stringify(emptyResultRow)),
    "html"                      : JSON.parse(JSON.stringify(emptyResultRow)),
    "css"                       : JSON.parse(JSON.stringify(emptyResultRow)),
    "js"                        : JSON.parse(JSON.stringify(emptyResultRow)),
    "memory"                    : -1,
    "sfi_extraMemory"           : -1,
    "sfi_memoryOverhead"        : -1.0,
    "proc_extraMemory"          : -1,
    "proc_memoryOverhead"       : -1.0,
    "sfi_extraMemory2"          : -1,
    "sfi_memoryOverhead2"       : -1.0,
    "proc_extraMemory2"         : -1,
    "proc_memoryOverhead2"      : -1.0,
    "sfi_extraMemory3"          : -1,
    "sfi_memoryOverhead3"       : -1.0,
    "proc_extraMemory3"         : -1,
    "proc_memoryOverhead3"      : -1.0,
    "sfi_extraMemory4"          : -1,
    "sfi_memoryOverhead4"       : -1.0,
    "proc_extraMemory4"         : -1,
    "proc_memoryOverhead4"      : -1.0
};
var currentResult = JSON.parse(JSON.stringify(emptyResult));

function updateResult(key, url, contentEncoding, contentType) {
    currentResult[key].urls.push(url);
    currentResult[key].count++;

    const origin = getOrigin(url);
    if (!currentResult[key].origins.includes(origin)){
        currentResult[key].origins.push(origin);
        currentResult[key].originCount++;
    }

    if (isGZipped(contentEncoding)) {
        currentResult[key].gzippedCount++;
        if (!currentResult[key].gzippedOrigins.includes(origin)){
            currentResult[key].gzippedOrigins.push(origin);
            currentResult[key].gzippedOriginCount++;
        }

        const originContent = getMimeType(url) + origin;
        if (!currentResult[key].gzippedOriginsContent.includes(originContent)){
            currentResult[key].gzippedOriginsContent.push(originContent);
            currentResult[key].gzippedOriginContentCount++;
        }
    } else if (isCompressed(contentEncoding)) {
        currentResult[key].otherCompressedCount++;
    }
}

function logURL(details) {
    var contentType = last(details.responseHeaders.filter(contentHeader => contentHeader.name == "content-type"));
    var contentEncoding = last(details.responseHeaders.filter(contentHeader => contentHeader.name == "content-encoding"));

    if (isHTML(details.url, contentType)) {
        updateResult("html", details.url, contentEncoding, contentType);
    } else if (isCSS(details.url, contentType)) {
        updateResult("css", details.url, contentEncoding, contentType);
    } else if (isJS(details.url, contentType)) {
        updateResult("js", details.url, contentEncoding, contentType);
    } else if (isJPEG(details.url, contentType)) {
        updateResult("jpeg", details.url, contentEncoding, contentType);
    } else if (isPNG(details.url, contentType)) {
        updateResult("png", details.url, contentEncoding, contentType);
    }

    if (isGZipped(contentEncoding)) {
        updateResult("compressed", details.url, contentEncoding, contentType);
    }
}

function getMemory(curr) {
    return browser.runtime.sendNativeMessage("webresourcecrawler_native", "getmem")
    .then(function(response){
        var memVals = response.split("\n");
        var max = -1;
        memVals.forEach(function(val){
            var v = parseInt(val);
            if(v > max) { max = v; }
        });
        curr.memory = max;
    });
}

function runComputations(curr) {
    var sandboxes = curr["compressed"].gzippedCount + curr["jpeg"].originCount + curr["png"].originCount;
    //1.6MB for SFI, 2.4 for proc
    curr.sfi_extraMemory  = 1638 * sandboxes;
    curr.proc_extraMemory = 2458 * sandboxes;
    curr.sfi_memoryOverhead = curr.sfi_extraMemory * 100.0 / curr.memory;
    curr.proc_memoryOverhead = curr.proc_extraMemory * 100.0 / curr.memory;


    var sandboxes2 = curr["compressed"].gzippedOriginCount + curr["jpeg"].originCount + curr["png"].originCount;
    //1.6MB for SFI, 2.4 for proc
    curr.sfi_extraMemory2  = 1638 * sandboxes2;
    curr.proc_extraMemory2 = 2458 * sandboxes2;
    curr.sfi_memoryOverhead2 = curr.sfi_extraMemory2 * 100.0 / curr.memory;
    curr.proc_memoryOverhead2 = curr.proc_extraMemory2 * 100.0 / curr.memory;

    var sandboxes3 = curr["compressed"].gzippedOriginContentCount + curr["jpeg"].originCount + curr["png"].originCount;
    //1.6MB for SFI, 2.4 for proc
    curr.sfi_extraMemory3  = 1638 * sandboxes3;
    curr.proc_extraMemory3 = 2458 * sandboxes3;
    curr.sfi_memoryOverhead3 = curr.sfi_extraMemory3 * 100.0 / curr.memory;
    curr.proc_memoryOverhead3 = curr.proc_extraMemory3 * 100.0 / curr.memory;


    var sandboxes4 = curr["compressed"].count + curr["jpeg"].count + curr["png"].count;
    //1.6MB for SFI, 2.4 for proc
    curr.sfi_extraMemory4  = 1638 * sandboxes4;
    curr.proc_extraMemory4 = 2458 * sandboxes4;
    curr.sfi_memoryOverhead4 = curr.sfi_extraMemory4 * 100.0 / curr.memory;
    curr.proc_memoryOverhead4 = curr.proc_extraMemory4 * 100.0 / curr.memory;
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
    .then(function() { return getMemory(currentResult); })
    .then(function() { runComputations(currentResult); })
    .then(function() {
        allResults[siteStr] = currentResult;
        currentResult = JSON.parse(JSON.stringify(emptyResult));
        console.log("Intermediate result: " + JSON.stringify(allResults));
    });
}

function computeSummary(results) {
    var sum_sfi_memoryOverhead = 0;
    var sum_proc_memoryOverhead = 0;
    var sum_sfi_memoryOverhead2 = 0;
    var sum_proc_memoryOverhead2 = 0;
    var sum_sfi_memoryOverhead3 = 0;
    var sum_proc_memoryOverhead3 = 0;
    var sum_sfi_memoryOverhead4 = 0;
    var sum_proc_memoryOverhead4 = 0;
    var count = 0;
    for (var site in results) {
        if (results.hasOwnProperty(site)) {
            count++;
            sum_sfi_memoryOverhead += results[site]["sfi_memoryOverhead"];
            sum_proc_memoryOverhead += results[site]["proc_memoryOverhead"];
            sum_sfi_memoryOverhead2 += results[site]["sfi_memoryOverhead2"];
            sum_proc_memoryOverhead2 += results[site]["proc_memoryOverhead2"];
            sum_sfi_memoryOverhead3 += results[site]["sfi_memoryOverhead3"];
            sum_proc_memoryOverhead3 += results[site]["proc_memoryOverhead3"];
            sum_sfi_memoryOverhead4 += results[site]["sfi_memoryOverhead4"];
            sum_proc_memoryOverhead4 += results[site]["proc_memoryOverhead4"];
        }
    }
    results["summary"] = {
        "sfi_memoryOverhead"   : sum_sfi_memoryOverhead   / count,
        "proc_memoryOverhead"  : sum_proc_memoryOverhead  / count,
        "sfi_memoryOverhead2"  : sum_sfi_memoryOverhead2  / count,
        "proc_memoryOverhead2" : sum_proc_memoryOverhead2 / count,
        "sfi_memoryOverhead3"  : sum_sfi_memoryOverhead3  / count,
        "proc_memoryOverhead3" : sum_proc_memoryOverhead3 / count,
        "sfi_memoryOverhead4"  : sum_sfi_memoryOverhead4  / count,
        "proc_memoryOverhead4" : sum_proc_memoryOverhead4 / count
    };
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
        computeSummary(allResults);
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
    "use strict";
    if (url === null) {
        return "";
    }
    var index = url.lastIndexOf("/");
    if (index !== -1) {
        url = url.substring(index + 1); // Keep path without its segments
    }
    index = url.indexOf("?");
    if (index !== -1) {
        url = url.substring(0, index); // Remove query
    }
    index = url.indexOf("#");
    if (index !== -1) {
        url = url.substring(0, index); // Remove fragment
    }
    index = url.lastIndexOf(".");
    return index !== -1
        ? url.substring(index + 1) // Only keep file extension
        : ""; // No extension found
}

function checkUrlOrContentType(url, contentType, extensions, targetContentType){
    if(!contentType) {
        return extensions.includes(ext(url));
    }

    return contentType.value.toLowerCase().startsWith(targetContentType);
}

function isHTML(url, contentType){
    return checkUrlOrContentType(url, contentType, ["", "html"], "text/html");
}

function isJS(url, contentType){
    return checkUrlOrContentType(url, contentType, ["js"], "application/javascript");
}

function isCSS(url, contentType){
    return checkUrlOrContentType(url, contentType, ["css"], "text/css");
}

function isJPEG(url, contentType){
    return checkUrlOrContentType(url, contentType, ["jpg", "jpeg"], "image/jpeg");
}

function isPNG(url, contentType){
    return checkUrlOrContentType(url, contentType, ["png"], "image/png");
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

function getMimeType(url, contentType) {
    if (isHTML(url, contentType)) { return "text/html";              }
    if (isJS(url, contentType))   { return "application/javascript"; }
    if (isCSS(url, contentType))  { return "text/css";               }
    if (isJPEG(url, contentType)) { return "image/jpeg";             }
    if (isPNG(url, contentType))  { return "image/png";              }
    if(!contentType) {
        return ext(url);
    }
    return contentType.value.toLowerCase();
}