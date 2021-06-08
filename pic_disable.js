const puppeteer = require('puppeteer')
const koa = require('koa')
const utils = require('./uitls')

const fakePic = require('fs').readFileSync("puppeteer.png", "base64")


const getRender = async () => {
    const browser = await puppeteer.launch(
        Object.assign(utils.getLaunchParam({ headless: true })))
    return async (url) => {
        const page = await browser.newPage()
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36")
        await page.setRequestInterception(true, true)
        page.on('request', req => {
            if ("image" === req.resourceType()) {
                req.respond({
                    status: 200,
                    contentType: "image/png",
                    body: Buffer.from(fakePic, 'base64')
                })
            } else {
                req.continue()
            }
        })
        await page.goto(url)
        await waitPromise
        const msg = await page.evaluate(() => {
            return { html: document.querySelector("*").outerHTML }
        })
        await page.close()
        return msg
    }
}

const serve = async () => {
    const app = new koa()
    const render = await getRender()
    app.use(async (ctx) => {
        const url = ctx.query
        console.log((new Date()).toLocaleString(), " => ", url)
        ctx.body = await render(url)
    })
    app.listen(9001)
}

serve()