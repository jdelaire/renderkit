# renderkit

Minimal, provider-agnostic web app for AI video generation (OpenAI Sora 2 first).

## Run locally

```
npm install
npm run dev
```

Create a `.env` with your key (local dev only):

```
VITE_OPENAI_API_KEY=sk-...
```

Security note: never set `VITE_OPENAI_API_KEY` in production builds. Browser-side keys can leak.

## Proxy mode (optional)

Start the proxy:

```
cd proxy
node server.js
```

Then set:

```
VITE_PROXY_BASE_URL=http://localhost:8787
VITE_PROXY_TOKEN=optional-shared-secret
```

When the proxy is enabled, the app can generate without a browser key.

## Security notes

- Browser keys are inherently leakable (XSS, extensions, shared devices).
- For production, use the proxy/worker and keep keys server-side.
- Update `public/_headers` with your production proxy domain in `connect-src`.
