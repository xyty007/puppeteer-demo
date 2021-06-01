exports.sleep = timeout => {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

exports.getLaunchParam = (originParam, enableCache = false) => {
    if (!originParam.args) {
        originParam.args = []
    }
    if (process.env.PROXY_SERVER) {
        originParam.args.push("--proxy-server=" + process.env.PROXY_SERVER)
    }
    if (process.env.ENV === "docker") {
        originParam.args = originParam.args.concat(['--no-sandbox', '--disable-gpu'])
        originParam = Object.assign({ headless: true }, originParam)
        if (enableCache) {
            originParam = Object.assign({ userDataDir: '/tmp/puppeteer-cache' }, originParam)
        }
    } else {
        originParam = Object.assign({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: false }, originParam)
        if (enableCache) {
            originParam = Object.assign({ userDataDir: 'D:\\code\\puppeteer-demo\\puppeteer-cache' }, originParam)
        }
    }
    return originParam
}