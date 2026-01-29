# Renderkit Proxy

Minimal Node proxy for OpenAI video requests. This keeps the OpenAI key off the browser.

## Setup

```
export OPENAI_API_KEY=sk-...
export PORT=8787
export ALLOWED_ORIGIN=http://localhost:5173
export RATE_LIMIT_PER_MIN=30
export MAX_CONCURRENT=3
export MAX_BODY_BYTES=1000000
export PROXY_TOKEN=optional-shared-secret
```

Run:

```
node server.js
```

## Frontend config

Set `VITE_PROXY_BASE_URL` to your proxy URL, e.g.

```
VITE_PROXY_BASE_URL=http://localhost:8787
VITE_PROXY_TOKEN=optional-shared-secret
```

The app will allow generation without a browser key when the proxy is enabled.
