//////////////////////////////////////////////////////////////////////////////////
//Settings
const delayAmount = 10000;
//list of sites at the bottom

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

//////////////////////////////////////////////////////////////////////////////////

const sites = [
    "https://google.com",
    "https://youtube.com",
    "https://tmall.com",
    "https://baidu.com",
    "https://qq.com",
    "https://taobao.com",
    "https://sohu.com",
    "https://facebook.com",
    "https://wikipedia.org",
    "https://login.tmall.com",
    "https://yahoo.com",
    "https://jd.com",
    "https://360.cn",
    "https://amazon.com",
    "https://sina.com.cn",
    "https://weibo.com",
    "https://pages.tmall.com",
    "https://reddit.com",
    "https://live.com",
    "https://vk.com",
    "https://okezone.com",
    "https://netflix.com",
    "https://blogspot.com",
    "https://alipay.com",
    "https://office.com",
    "https://csdn.net",
    "https://instagram.com",
    "https://xinhuanet.com",
    "https://aliexpress.com",
    "https://yahoo.co.jp",
    "https://microsoft.com",
    "https://babytree.com",
    "https://bing.com",
    "https://stackoverflow.com",
    "https://livejasmin.com",
    "https://google.com.hk",
    "https://naver.com",
    "https://twitter.com",
    "https://microsoftonline.com",
    "https://ebay.com",
    "https://apple.com",
    "https://amazon.co.jp",
    "https://google.co.in",
    "https://force.com",
    "https://tribunnews.com",
    "https://tianya.cn",
    "https://pornhub.com",
    "https://linkedin.com",
    "https://msn.com",
    "https://wordpress.com",
    "https://adobe.com",
    "https://panda.tv",
    "https://imdb.com",
    "https://dropbox.com",
    "https://amazon.in",
    "https://yandex.ru",
    "https://zhanqi.tv",
    "https://china.com.cn",
    "https://mail.ru",
    "https://myshopify.com",
    "https://caijing.com.cn",
    "https://twitch.tv",
    "https://mama.cn",
    "https://google.com.br",
    "https://bongacams.com",
    "https://medium.com",
    "https://soso.com",
    "https://spotify.com",
    "https://xvideos.com",
    "https://whatsapp.com",
    "https://blogger.com",
    "https://booking.com",
    "https://detail.tmall.com",
    "https://espn.com",
    "https://amazonaws.com",
    "https://rednet.cn",
    "https://amazon.de",
    "https://ok.ru",
    "https://google.de",
    "https://imgur.com",
    "https://amazon.co.uk",
    "https://google.co.jp",
    "https://bbc.com",
    "https://hao123.com",
    "https://github.com",
    "https://tumblr.com",
    "https://sogou.com",
    "https://indeed.com",
    "https://rakuten.co.jp",
    "https://xhamster.com",
    "https://detik.com",
    "https://soundcloud.com",
    "https://onlinesbi.com",
    "https://paypal.com",
    "https://google.ru",
    "https://huanqiu.com",
    "https://nih.gov",
    "https://google.fr",
    "https://yy.com",
    "https://fandom.com",
    "https://pixnet.net",
    "https://hubspot.com",
    "https://so.com",
    "https://stackexchange.com",
    "https://google.cn",
    "https://nytimes.com",
    "https://cnn.com",
    "https://instructure.com",
    "https://bbc.co.uk",
    "https://17ok.com",
    "https://aparat.com",
    "https://1688.com",
    "https://google.it",
    "https://globo.com",
    "https://freepik.com",
    "https://ettoday.net",
    "https://slideshare.net",
    "https://walmart.com",
    "https://google.com.tw",
    "https://shutterstock.com",
    "https://wetransfer.com",
    "https://thestartmagazine.com",
    "https://fiverr.com",
    "https://theguardian.com",
    "https://alibaba.com",
    "https://google.es",
    "https://flipkart.com",
    "https://salesforce.com",
    "https://indiatimes.com",
    "https://google.com.sg",
    "https://liputan6.com",
    "https://office365.com",
    "https://wikihow.com",
    "https://jrj.com.cn",
    "https://daum.net",
    "https://tokopedia.com",
    "https://state.gov",
    "https://bilibili.com",
    "https://uol.com.br",
    "https://kompas.com",
    "https://chase.com",
    "https://digikala.com",
    "https://discordapp.com",
    "https://google.co.uk",
    "https://mercadolivre.com.br",
    "https://craigslist.org",
    "https://google.com.mx",
    "https://yao.tmall.com",
    "https://okta.com",
    "https://cnblogs.com",
    "https://etsy.com",
    "https://sindonews.com",
    "https://roblox.com",
    "https://canva.com",
    "https://cnet.com",
    "https://pinterest.com",
    "https://ebay.de",
    "https://zendesk.com",
    "https://grid.id",
    "https://udemy.com",
    "https://researchgate.net",
    "https://google.com.tr",
    "https://t.co",
    "https://avito.ru",
    "https://amazon.it",
    "https://grammarly.com",
    "https://vimeo.com",
    "https://otvfoco.com.br",
    "https://w3schools.com",
    "https://amazon.fr",
    "https://aliyun.com",
    "https://forbes.com",
    "https://vice.com",
    "https://archive.org",
    "https://6.cn",
    "https://momoshop.com.tw",
    "https://godaddy.com",
    "https://xnxx.com",
    "https://gome.com.cn",
    "https://pixabay.com",
    "https://zillow.com",
    "https://academia.edu",
    "https://zhihu.com",
    "https://mediafire.com",
    "https://savefrom.net",
    "https://itfactly.com",
    "https://washingtonpost.com",
    "https://gohoi.com",
    "https://hdfcbank.com",
    "https://telegram.org",
    "https://techofires.com",
    "https://ideapuls.com",
    "https://thepiratebay.org",
    "https://duckduckgo.com",
    "https://y2mate.com",
    "https://setn.com",
    "https://google.com.sa",
    "https://americanexpress.com",
    "https://ask.com",
    "https://google.ca",
    "https://scribd.com",
    "https://3c.tmall.com",
    "https://sigonews.com",
    "https://wellsfargo.com",
    "https://bestbuy.com",
    "https://youth.cn",
    "https://taboola.com",
    "https://google.com.eg",
    "https://ebay.co.uk",
    "https://line.me",
    "https://amazon.ca",
    "https://speedtest.net",
    "https://chaturbate.com",
    "https://quora.com",
    "https://yelp.com",
    "https://163.com",
    "https://ltn.com.tw",
    "https://chouftv.ma",
    "https://jiameng.com",
    "https://businessinsider.com",
    "https://google.com.ar",
    "https://wix.com",
    "https://trello.com",
    "https://healthline.com",
    "https://ilovepdf.com",
    "https://dailymotion.com",
    "https://ebay-kleinanzeigen.de",
    "https://amazon.es",
    "https://varzesh3.com",
    "https://google.co.id",
    "https://nicovideo.jp",
    "https://food.tmall.com",
    "https://fc2.com",
    "https://primevideo.com",
    "https://thesaurus.com",
    "https://jianshu.com",
    "https://iqiyi.com",
    "https://bet9ja.com",
    "https://quizlet.com",
    "https://sciencedirect.com",
    "https://messenger.com",
    "https://ups.com",
    "https://airbnb.com",
    "https://google.co.th",
    "https://list.tmall.com",
    "https://dailymail.co.uk",
    "https://capitalone.com",
    "https://uniqlo.tmall.com",
    "https://ladbible.com",
    "https://bet365.com",
    "https://mercadolibre.com.ar",
    "https://icicibank.com",
    "https://gfycat.com",
    "https://tistory.com",
    "https://metropoles.com",
    "https://kinopoisk.ru",
    "https://mozilla.org",
    "https://hulu.com",
    "https://reverso.net",
    "https://foxnews.com",
    "https://gmw.cn",
    "https://subject.tmall.com",
    "https://manoramaonline.com",
    "https://smallpdf.com",
    "https://weebly.com",
    "https://larati.net",
    "https://kakao.com",
    "https://nianhuo.tmall.com",
    "https://google.co.kr",
    "https://youm7.com",
    "https://abs-cbn.com",
    "https://asos.com",
    "https://wikimedia.org",
    "https://nvzhuang.tmall.com",
    "https://fedex.com",
    "https://ikea.com",
    "https://ndtv.com",
    "https://softonic.com",
    "https://skype.com",
    "https://khanacademy.org",
    "https://behance.net",
    "https://usps.com",
    "https://envato.com",
    "https://youporn.com",
    "https://weather.com",
    "https://tripadvisor.com",
    "https://investing.com",
    "https://biobiochile.cl",
    "https://telewebion.com",
    "https://namnak.com",
    "https://zoom.us",
    "https://hotstar.com",
    "https://google.pl",
    "https://yts.lt",
    "https://iqoption.com",
    "https://pinimg.com",
    "https://homedepot.com",
    "https://eastday.com",
    "https://coinmarketcap.com",
    "https://dormitysature.info",
    "https://box.com",
    "https://eventbrite.com",
    "https://blackboard.com",
    "https://sahibinden.com",
    "https://hp.com",
    "https://geeksforgeeks.org",
    "https://glassdoor.com",
    "https://gstatic.com",
    "https://cnbc.com",
    "https://tradingview.com",
    "https://breitbart.com",
    "https://allegro.pl",
    "https://wordreference.com",
    "https://suara.com",
    "https://google.com.au",
    "https://9gag.com",
    "https://sex.com",
    "https://spankbang.com",
    "https://naukri.com",
    "https://spao.tmall.com",
    "https://lazada.sg",
    "https://kumparan.com",
    "https://douban.com",
    "https://postlnk.com",
    "https://newstrend.news",
    "https://mgid.com",
    "https://lee.tmall.com",
    "https://adp.com",
    "https://ameblo.jp",
    "https://patch.com",
    "https://goodreads.com",
    "https://merdeka.com",
    "https://neiyi.tmall.com",
    "https://n11.com",
    "https://patria.org.ve",
    "https://divar.ir",
    "https://sberbank.ru",
    "https://hootsuite.com",
    "https://steamcommunity.com",
    "https://google.com.ua",
    "https://redd.it",
    "https://uselnk.com",
    "https://irctc.co.in",
    "https://target.com",
    "https://dmm.co.jp",
    "https://aimer.tmall.com",
    "https://samsung.com",
    "https://elbalad.news",
    "https://googlevideo.com",
    "https://bloomberg.com",
    "https://kompasiana.com",
    "https://citi.com",
    "https://rambler.ru",
    "https://deviantart.com",
    "https://1337x.to",
    "https://51.la",
    "https://amazon.cn",
    "https://ensonhaber.com",
    "https://slack.com",
    "https://giphy.com",
    "https://oracle.com",
    "https://surveymonkey.com",
    "https://wixsite.com",
    "https://apxs.xyz",
    "https://sourceforge.net",
    "https://xfinity.com",
    "https://rakuten.com",
    "https://mit.edu",
    "https://web.de",
    "https://gismeteo.ru",
    "https://doubleclick.net",
    "https://buzzfeed.com",
    "https://outbrain.com",
    "https://genius.com",
    "https://kapanlagi.com",
    "https://err.tmall.com",
    "https://steampowered.com",
    "https://justdial.com",
    "https://nfl.com",
    "https://idntimes.com",
    "https://miao.tmall.com",
    "https://popads.net",
    "https://banvenez.com",
    "https://pulzo.com",
    "https://crabsecret.tmall.com",
    "https://google.gr",
    "https://livejournal.com",
    "https://cambridge.org",
    "https://rt.com",
    "https://ecosia.org",
    "https://americanas.com.br",
    "https://leboncoin.fr",
    "https://mercadolibre.com.mx",
    "https://redtube.com",
    "https://crptgate.com",
    "https://indiamart.com",
    "https://google.ro",
    "https://ouedkniss.com",
    "https://aol.com",
    "https://usatoday.com",
    "https://wish.com",
    "https://gosuslugi.ru",
    "https://patreon.com",
    "https://onlinevideoconverter.com",
    "https://google.com.vn",
    "https://zippyshare.com",
    "https://flaticon.com",
    "https://files.wordpress.com",
    "https://webmd.com",
    "https://olx.ua",
    "https://sportbible.com",
    "https://squarespace.com",
    "https://prezi.com",
    "https://dell.com",
    "https://rutracker.org",
    "https://huaban.com",
    "https://wsj.com",
    "https://ninisite.com",
    "https://google.co.ve",
    "https://issuu.com",
    "https://elpais.com",
    "https://douyu.com",
    "https://springer.com",
    "https://zoho.com",
    "https://namasha.com",
    "https://wowhead.com",
    "https://freelancer.com",
    "https://marketwatch.com",
    "https://hespress.com",
    "https://alwafd.news",
    "https://prothomalo.com",
    "https://emol.com",
    "https://motorsport.com",
    "https://payoneer.com",
    "https://gap.tmall.com",
    "https://gearbest.com",
    "https://tutorialspoint.com",
    "https://slickdeals.net",
    "https://list-manage.com",
    "https://104.com.tw",
    "https://macys.com",
    "https://myhome.tmall.com",
    "https://fidelity.com",
    "https://intuit.com",
    "https://rediff.com",
    "https://banggood.com",
    "https://td.com",
    "https://hotels.com",
    "https://dribbble.com",
    "https://news18.com",
    "https://andhrajyothy.com",
    "https://oberlo.com",
    "https://alodokter.com",
    "https://olx.pl",
    "https://elsevier.com",
    "https://mathrubhumi.com",
    "https://onet.pl",
    "https://chegg.com",
    "https://wp.pl",
    "https://bankofamerica.com",
    "https://britannica.com",
    "https://mi.com",
    "https://yandex.com",
    "https://taleo.net",
    "https://ebay.com.au",
    "https://gamepedia.com",
    "https://wiktionary.org",
    "https://pixiv.net",
    "https://meetup.com",
    "https://timeanddate.com",
    "https://wildberries.ru",
    "https://investopedia.com",
    "https://europa.eu",
    "https://wayfair.com",
    "https://moneycontrol.com",
    "https://myway.com",
    "https://namu.wiki",
    "https://ivi.ru",
    "https://t.me",
    "https://marca.com",
    "https://realtor.com",
    "https://nike.com",
    "https://sarkariresult.com",
    "https://merriam-webster.com",
    "https://libero.it",
    "https://norton.com",
    "https://kickstarter.com",
    "https://eksisozluk.com",
    "https://siteadvisor.com",
    "https://mawdoo3.com",
    "https://51sole.com",
    "https://makemytrip.com",
    "https://11st.co.kr",
    "https://beytoote.com",
    "https://bolasport.com",
    "https://battle.net",
    "https://souq.com",
    "https://ca.gov",
    "https://qoo10.sg",
    "https://att.com"
];
