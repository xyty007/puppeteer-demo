# puppeteer-demo

## Demos

### cnki.js

login

### tiktok.js

render the author's home page, get work list and cookie

### cookies.js

open url, get cookies (httponly cookies include)

## How to run

- eg: run cookies.js

```bash
docker build -t puppeteer-demo:latest -f Dockerfile.all .
# run file cookies.js with nodejs
docker run -p 9001:9001 puppeteer-demo:latest node cookies.js
```
