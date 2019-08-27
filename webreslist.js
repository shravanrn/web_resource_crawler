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

function launchWebsite(siteStr) {
    return browser.tabs.query({active: true})
    .then(function (tabs) {
        return browser.tabs.update(tabs[0].id, { url: siteStr })
    })
    .then(function () {
        console.log(`Launching: ${siteStr}`);
    })
    .delay(delayAmount)
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
