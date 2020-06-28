const puppeteer = require('puppeteer')
const koa = require('koa')

const getRender = async () => {
    const sleep = timeout => {
        return new Promise(resolve => setTimeout(resolve, timeout))
    }
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    })
    return async url => {
        const page = await browser.newPage()
        await page.evaluateOnNewDocument(async () => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36")
        await page.goto(url);
        let listPageResp;
        for (let i = 0; i < 3; i++) {
            try {
                listPageResp = await page.waitForResponse(resp => {
                    return resp.url().startsWith("https://www.iesdouyin.com/web/api/v2/aweme/post/?") && resp.url().indexOf("dytk=") >= 0
                }, { timeout: 5000 })
                await page.waitForSelector('.item.goWork', { timeout: 5000 })
                break
            } catch (e) {
                console.log(e)
            }
            await page.reload()
        }
        const pageInfo = await page.evaluate(() => {
            return {
                'User-Agent': navigator.userAgent,
                Cookie: document.cookie,
                Referer: location.href
            }
        })
        await page.close()
        return Object.assign({ url: listPageResp.url() }, pageInfo)
    }
}

const serve = async () => {
    const app = new koa()
    const render = await getRender()
    app.use(async (ctx, next) => {
        const url = ctx.query.url
        console.log((new Date()).toLocaleString(), " => ", url)
        res = await render(url)
        console.log(res.url)
        ctx.body = res
    })
    app.listen(9000)
}

serve()