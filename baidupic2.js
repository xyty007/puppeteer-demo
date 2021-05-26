Array.prototype.randomSelect = function () {
    return this[Math.floor(Math.random() * this.length)]
}
const puppeteer = require('puppeteer')
const koa = require('koa')
const utils = require('./uitls')

const picServerReg = new RegExp("t\\d+\\.baidu\\.com/it")
const picServerReg2 = new RegExp("img\\d+\\.baidu\\.com")
const userAgent = require('./etc').userAgent
const [singleC, listC, waterfallC] = [
    "sfc-image-content-resutl-tpl-single", "sfc-image-content-result-tpl-weibo", "sfc-image-content-waterfall-item"
]
const flowSelector = [singleC, listC].map(i => "." + i).join(", ")
const waterfallSelector = "." + waterfallC + ":not([wat-item-data-id='no-img'])"
const allSelector = [flowSelector, waterfallSelector].join(", ")

const getRender = async () => {
    const browser = await puppeteer.launch(utils.getLaunchParam({ userDataDir: '/tmp/puppeteer-cache2' }))
    const timesBeforeClear = 100
    let last = timesBeforeClear
    setInterval(() => {
        browser.pages().then(pages => { console.log("Tab count : ", pages.length) })
    }, 2000)
    return async url => {
        const page = await browser.newPage()
        if (last-- <= 0) {
            last = timesBeforeClear
            console.log("=> time to clear data")
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');
            await client.detach()
        }
        const timer = setTimeout(async () => {
            await page.close()
        }, 900000)
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        }).catch(e => { console.log("May rej 1 =>", e) });
        await page.setRequestInterception(true, true).catch(e => { console.log("May rej 2 =>", e) });
        page.on('request', req => {
            const url = req.url()
            if (url.endsWith('.png') || url.endsWith('.jpg') || picServerReg.test(url)) {
                req.abort()
            } else {
                req.continue()
            }
        })
        await page.setUserAgent(userAgent.randomSelect()).catch(e => { console.log("May rej 3 =>", e) });
        const waiter = page.waitForResponse(resp => {
            return resp.url().indexOf("m.baidu.com/sf/vsearch") > 0 && resp.status() === 200
        }, { timeout: 15000 })
        await page.goto(url).catch(e => console.log("Nav timeout =>", e))
        await waiter.catch(e => console.log("Wait timeout =>", e))

        for (let i = 0; i < 3; i++) {
            const validResCount = await page.evaluate((allSelector) => {
                return document.querySelectorAll(allSelector).length
            }, allSelector).catch(e => console.log("evaluate 1 =>", e))
            if (validResCount >= 21)
                break
            const waiterSub = page.waitForResponse(resp => {
                // https://m.baidu.com/sf/vsearch/image/search/wisesearchresult?tn=wisejsonala&ie=utf-8&fromsf=1&word=%E5%8C%97%E4%BA%AC%E9%93%B6%E8%A1%8Clogo&pn=150&rn=30&gsm=96&prefresh=undefined&fp=result&searchtype=0&fromfilter=0&tpltype=0
                return resp.url().indexOf("m.baidu.com/sf/vsearch/image/search/wisesearchresult") > 0
            }, { timeout: 5000 })
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight)
            }).catch(e => console.log("evaluate 2 =>", e))
            await waiterSub.catch(e => { console.log("Scroll timeout =>", e) })
            await utils.sleep(1000)
        }

        const res = await page.evaluate((flowSelector, waterfallSelector, singleC, listC) => {
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
        }, flowSelector, waterfallSelector, singleC, listC).catch(e => console.log("evaluate 3 =>", e))
        clearTimeout(timer)
        await page.close().catch(e => { console.log("May rej 4 =>", e) });
        return res
    }
}

const getRender2 = async () => {
    const browser = await puppeteer.launch(utils.getLaunchParam({ userDataDir: '/tmp/puppeteer-cache' }))
    return async url => {
        const page = await browser.newPage()
        let html = null
        try {
            await page.evaluateOnNewDocument(async () => {
                const newProto = navigator.__proto__;
                delete newProto.webdriver;
                navigator.__proto__ = newProto;
            });
            await page.setRequestInterception(true, true);
            page.on('request', req => {
                const url = req.url()
                if (url.endsWith('.png') || url.endsWith('.jpg') || picServerReg.test(url) || picServerReg2.test(url)) {
                    req.abort()
                } else {
                    req.continue()
                }
            })
            await page.setUserAgent(userAgent.randomSelect())
            await page.goto(url).catch(e => { })
            html = await page.evaluate(() => {
                return document.querySelector("*").outerHTML
            })
        } catch (e) {
            console.log("unhandled", e)
        } finally {
            await page.close()
        }
        return { res: true, html }
    }
}

const maxConcurr = 20
let currConcurr = 0

const serve = async () => {
    const app = new koa()
    const render = await getRender()
    const render2 = await getRender2()
    app.use(async (ctx) => {
        const url = ctx.query.url
        console.log((new Date()).toLocaleString(), " => ", url)
        if (currConcurr >= maxConcurr) {
            ctx.body = { res: false, err: "too many request" }
        }
        currConcurr++
        ctx.body = await (ctx.query.pa ? render2(url) : render(url)).finally(() => { currConcurr-- })
        if (!ctx.body.res) {
            ctx.status = 406
        }
    })
    app.listen(9003)
}

serve()