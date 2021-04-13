const puppeteer = require('puppeteer')
const koa = require('koa')
const utils = require('./uitls')

// Listen all headers

// async function setupLoggingOfAllNetworkData(page) {
//     const cdpSession = await page.target().createCDPSession()
//     await cdpSession.send('Network.enable')
//     const cdpRequestDataRaw = {}
//     const addCDPRequestDataListener = (eventName) => {
//         cdpSession.on(eventName, request => {
//             cdpRequestDataRaw[request.requestId] = cdpRequestDataRaw[request.requestId] || {}
//             Object.assign(cdpRequestDataRaw[request.requestId], { [eventName]: request })
//         })
//     }
//     addCDPRequestDataListener('Network.requestWillBeSent')
//     addCDPRequestDataListener('Network.requestWillBeSentExtraInfo')
//     addCDPRequestDataListener('Network.responseReceived')
//     addCDPRequestDataListener('Network.responseReceivedExtraInfo')
//     return cdpRequestDataRaw
// }

const getRender = async () => {
    const browser = await puppeteer.launch(
        Object.assign(utils.getLaunchParam(), { headless: true }))
    return async (url, allCookies, clearPre) => {
        const page = await browser.newPage()
        const cdpSession = await page.target().createCDPSession()
        if (clearPre) {
            await cdpSession.send("Network.clearBrowserCookies")
            await cdpSession.send("Network.clearBrowserCache")
        }
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36")
        const waitPromise = page.waitForResponse(resp => {
            return resp.url().startsWith(url) && resp.status() === 200
        }, 10000)
        await page.goto(url)
        await waitPromise
        const msg = await (allCookies ? cdpSession.send("Network.getAllCookies") : cdpSession.send("Network.getCookies", { urls: [url] }))
        await cdpSession.detach()
        await page.close()
        return msg.cookies
    }
}

const serve = async () => {
    const app = new koa()
    const render = await getRender()
    app.use(async (ctx, next) => {
        // url example: https://weibo.com/u/2817218621
        const { url, getAllCookies = false, clearPre = false } = ctx.query
        console.log((new Date()).toLocaleString(), " => ", url)
        const cookies = await render(url, getAllCookies, clearPre)
        ctx.body = { cookies, cookie_str: cookies.map(cookie => cookie.name + "=" + cookie.value).join(";") }
    })
    app.listen(9001)
}

serve()