exports.sleep = timeout => {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

exports.getLaunchParam = () => {
    if (process.env.ENV === "docker") {
        return { args: ['--no-sandbox', '--disable-gpu'], headless: true }
    } else {
        return { executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', headless: false }
    }
}