const puppeteer = require('puppeteer')
const koa = require('koa')

const render = async () => {
    const browser = await puppeteer.launch()
    return async () => {
        const page = await browser.newPage()
        await page.goto("http://jtp.cnki.net/bilingual/Login")
        await page.evaluate(() => {
            document.getElementById('username').value = "sybjsg"
            document.getElementById('password').value = "bj123456"
        })
        await page.click('#submittext');
        try {
            await page.waitForResponse(response => {
                return response.url().startsWith("http://jtp.cnki.net/bilingual")
            }, { timeout: 5000 })
        }
        catch (e) { console.log(e) }
        const param = await page.evaluate(() => {
            return { Cookie: document.cookie }
        })
        await page.close()
        return param
    }
}

const serve = async () => {
    const r = await render()
    const app = new koa()
    app.use(async (ctx, next) => {
        console.log((new Date()).toLocaleString())
        ctx.body = await r()
    })
    app.listen(9010)
}

serve()