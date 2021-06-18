const puppeteer = require('puppeteer')
const koa = require('koa')
const utils = require('./uitls')

const fakePic = require('fs').readFileSync("puppeteer.png", "base64")
const reg = /window\._SSR_HYDRATED_DATA=(.+?)<\/script>/
const forceClearInterval = 200;
let intervalLast = forceClearInterval


const getRender = async () => {
    const browser = await puppeteer.launch(
        Object.assign(utils.getLaunchParam({}, true)))
    return async (url, clearPre) => {
        const page = await browser.newPage()
        const cdpSession = await page.target().createCDPSession()
        if (clearPre || intervalLast-- <= 0) {
            console.log("Clear browser cookies and cache")
            await cdpSession.send("Network.clearBrowserCookies")
            await cdpSession.send("Network.clearBrowserCache")
            intervalLast = forceClearInterval
        }
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36")
        await page.setRequestInterception(true, true);
        page.on('request', req => {
            const url = req.url().toLowerCase()
            const resourceType = req.resourceType()
            if ("image" === resourceType) {
                req.respond({
                    status: 200,
                    contentType: "image/png",
                    body: Buffer.from(fakePic, 'base64')
                })
            } else if (resourceType == 'media' || url.endsWith('.mp4') || url.endsWith('.avi') || url.endsWith('.flv') || url.endsWith('.mov') || url.endsWith('.wmv')) {
                req.abort()
            } else {
                req.continue()
            }
        })
        page.on('dialog', async dialog => {
            await dialog.dismiss()
        })
        const waitPromise = page.waitForResponse(async resp => {
            const urlWithoutQuery = url.split("?")[0]
            if (decodeURI(resp.url()).startsWith(urlWithoutQuery) && resp.status() === 200) {
                const text = await resp.text()
                return reg.test(text)
            } else {
                return false
            }
        }, 10000)
        try {
            await page.goto(url, { timeout: 20000 })
            const resp = await waitPromise
            const html = await resp.text()
            const data = JSON.parse(reg.exec(html)[1].replace(/undefined/g, "null"))
            const msg = await cdpSession.send("Network.getCookies", { urls: [url] })
            return { cookies: msg.cookies, data }
        } catch (e) {
            console.log(e)
            const msg = await cdpSession.send("Network.getCookies", { urls: [url] })
            return { cookies: msg.cookies }
        } finally {
            await cdpSession.detach()
            await page.close()
        }
    }
}
/**
 * expect query: 
 * 1. http://127.0.0.1:9004?url=https://www.ixigua.com/search/竖锯/?tab_name=home
 * 2. http://127.0.0.1:9004?url=https://www.ixigua.com/6849164340491371016
 */
const serve = async () => {
    const app = new koa()
    const render = await getRender()
    app.use(async ctx => {
        const { url, clearPre = false } = ctx.query
        console.log((new Date()).toLocaleString(), " => ", url)
        ctx.body = await render(url, clearPre)
    })
    app.listen(9004)
}

serve()