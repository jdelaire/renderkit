# Progress

Date: 2026-01-29

- Initialized documentation folder and moved `plan.md`.
- Scaffolded Vite + Vue + TypeScript app skeleton.
- Added initial domain types and provider adapter interface scaffolding.
- Replaced default Vite UI with a minimal renderkit layout shell and base styles.
- Added job reducer/state helpers and a minimal Vue store for queue/history counts.
- Wired OpenAI API key lookup from Vite env and surfaced key status in the UI header.
- Expanded `.gitignore` to cover `.env` files and common macOS artifacts.
- Added Vite env loading to support `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY` in `.env`.
- Wired prompt, duration, resolution, and model controls to the Vue store with basic styling.
- Implemented OpenAI video API client, job manager with polling, and queue/history UI with downloads.
- Switched OpenAI create video call to multipart form data and aligned resolution options to API limits.
- Added Sora 2 Pro model option and dynamic resolution filtering by model.
- Added explicit portrait/landscape labels for all vertical resolution options.
- Added local API key management UI, IndexedDB persistence, queue concurrency, retry/cancel actions, and adaptive polling.
- Added provider selector UI wiring and proxy-aware generate gating.
- Implemented keyboard shortcuts for prompt focus, generate, and key panel toggle.
- Implemented optional Node proxy server with rate limiting, concurrency caps, and token protection.
- Added proxy start script and `.env.example` for local/proxy configuration.
- Added proxy configuration placeholders to `.env`.
- Added `scripts/run-proxy.sh` to launch the proxy with env defaults.
- Fixed proxy response header handling to avoid undefined Retry-After values.
- Renamed proxy request/response header variables to avoid shadowing errors.
- Added clear-history action for job history.
- Hardened key handling: session storage by default, optional local storage, and removed env key injection from builds.
- Added security headers template for Cloudflare Pages in `public/_headers`.
