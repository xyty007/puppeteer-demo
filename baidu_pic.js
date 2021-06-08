const fs = require('fs')
Array.prototype.randomSelect = function () {
    return this[Math.floor(Math.random() * this.length)]
}
const MIN_RESULT = 72
const puppeteer = require('puppeteer')
const koa = require('koa')
const utils = require('./uitls')

const userAgent = require('./etc').userAgent
const [singleC, listC, waterfallC] = [
    "sfc-image-content-resutl-tpl-single", "sfc-image-content-result-tpl-weibo", "sfc-image-content-waterfall-item"
]
const flowSelector = [singleC, listC].map(i => "." + i).join(", ")
const waterfallSelector = "." + waterfallC + ":not([wat-item-data-id='no-img'])"
const allSelector = [flowSelector, waterfallSelector].join(", ")
const fakePic = fs.readFileSync("puppeteer.png", "base64")

const getRender = async () => {
    const browser = await puppeteer.launch(utils.getLaunchParam({}, true))
    const timesBeforeClear = 100
    let last = timesBeforeClear
    setInterval(() => {
        browser.pages().then(pages => { console.log("Tab count : ", pages.length) })
    }, 2000)
    return async url => {
        const page = await browser.newPage()
        const cdpSession = await page.target().createCDPSession();
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        })
        await page.setRequestInterception(true, true)
        page.on('request', req => {
            // if (url.endsWith('.png') || url.endsWith('.jpg') || picServerReg.test(url)) {
            if ("image"===req.resourceType()) {
                req.respond({
                    status: 200,
                    contentType: "image/png",
                    body: Buffer.from(fakePic, 'base64')
                })
            } else {
                req.continue()
            }
        })
        await page.setUserAgent(userAgent.randomSelect())
        const waiter = page.waitForResponse(resp => {
            return resp.url().indexOf("m.baidu.com/sf/vsearch") > 0 && resp.status() === 200
        }, { timeout: 15000 })
        try {
            if (last-- <= 0) {
                last = timesBeforeClear
                console.log("=> time to clear data")
                await cdpSession.send('Network.clearBrowserCookies');
                await cdpSession.send('Network.clearBrowserCache');
            }
            await page.goto(url, { waitUntil: ['load', 'domcontentloaded'] })
            await waiter
            for (let i = 0; i < 10; i++) {
                const validResCount = await page.evaluate((allSelector) => {
                    return document.querySelectorAll(allSelector).length
                }, allSelector)
                if (validResCount >= MIN_RESULT)
                    break
                const waitAJAX = page.waitForResponse(resp => {
                    // https://m.baidu.com/sf/vsearch/image/search/wisesearchresult?tn=wisejsonala&ie=utf-8&fromsf=1&word=%E5%8C%97%E4%BA%AC%E9%93%B6%E8%A1%8Clogo&pn=150&rn=30&gsm=96&prefresh=undefined&fp=result&searchtype=0&fromfilter=0&tpltype=0
                    return resp.url().indexOf("m.baidu.com/sf/vsearch/image/search/wisesearchresult") > 0
                }, { timeout: 5000 })
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight)
                })
                await waitAJAX.catch(e => { console.log("Scroll timeout =>", e) })
                await utils.sleep(1000)
            }

            return await page.evaluate((flowSelector, waterfallSelector, singleC, listC) => {
                const res = {
                    res: window.location.href.indexOf("m.baidu.com/sf/vsearch") > 0,
                    html: document.querySelector("*").outerHTML
                }
                const flowNodes = document.querySelectorAll(flowSelector)
                if (flowNodes.length > 0) {
                    res.flow = [...flowNodes].map(node => {
                        const nodeType = node.getAttribute("class")
                        if (nodeType.indexOf(singleC) >= 0 || nodeType.indexOf("sfc-image-content-waterfall-item") >= 0) {
                            return node.querySelector("a").href
                        } else if (nodeType.indexOf(listC) >= 0) {
                            const setNode = node.querySelector(".sfc-image-content-image-set")
                            return {
                                urls: [...setNode.querySelectorAll("a")].map(n => n.href),
                                count: Number(setNode.querySelector(".sfc-image-ui-image-set-tag-desc").innerText)
                            }
                        }
                    })
                }
                const waterfallNodes = document.querySelectorAll(waterfallSelector)
                if (waterfallNodes.length > 0) {
                    const waterfall = new Array(waterfallNodes.length)
                    waterfall.fill("")
                    for (const node of waterfallNodes) {
                        const idx = node.getAttribute("wat-item-data-id")
                        if (isNaN(idx)) {
                            continue
                        }
                        waterfall[Number(idx)] = node.querySelector('a').href
                    }
                    res.waterfall = waterfall
                }
                return res
            }, flowSelector, waterfallSelector, singleC, listC)
        } catch (e) {
            console.log(e)
        } finally {
            await cdpSession.detach()
            await page.close()
        }
    }
}

const maxConcurr = 15
let currConcurr = 0

const serve = async () => {
    const app = new koa()
    const render = await getRender()
    app.use(async (ctx) => {
        const url = ctx.query.url
        console.log((new Date()).toLocaleString(), " => ", url)
        if (currConcurr >= maxConcurr) {
            ctx.body = { res: false, err: "too many request" }
            return
        }
        currConcurr++
        ctx.body = await render(url).finally(() => { currConcurr-- })
    })
    app.listen(9002)
}

serve()