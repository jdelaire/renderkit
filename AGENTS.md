# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Vue SPA.
  - `src/ui/` is reserved for UI components (currently most UI lives in `src/App.vue`).
  - `src/domain/` holds core types and job reducer logic.
  - `src/network/` wraps OpenAI/proxy API calls and job polling.
  - `src/providers/` contains provider adapters (OpenAI Sora 2 now, others later).
  - `src/persist/` implements IndexedDB/localStorage persistence.
  - `src/state/` is the app store and hydration logic.
- `public/` contains static assets and security headers (`public/_headers` for Cloudflare Pages).
- `proxy/` is the optional Node proxy server.
- `docs/` holds planning and progress notes (`docs/plan.md`, `docs/progress.md`).

## Build, Test, and Development Commands
- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck + production build.
- `npm run preview` — serve the built app locally.
- `npm run proxy` — run the optional Node proxy.
- `./scripts/run-proxy.sh` — run the proxy with `.env` defaults.

## Coding Style & Naming Conventions
- Use 2‑space indentation in Vue SFCs and TypeScript.
- Prefer concise, descriptive names (e.g., `jobManager`, `openaiVideos`).
- No formatter/linter is enforced yet; keep changes consistent with existing style.

## Testing Guidelines
- No test framework is configured yet. If you add tests, keep them near the modules they cover (e.g., `src/domain/__tests__`).
- Recommended: unit tests for reducers/adapters, integration tests for mocked API flows.

## Commit & Pull Request Guidelines
- No commit convention is enforced in this repo.
- PRs should include a short summary, any relevant screenshots (UI changes), and mention config changes (e.g., `public/_headers`, `.env.example`).

## Security & Configuration Tips
- Never commit `.env` files; use `.env.example` for reference.
- Browser API keys are inherently leakable; for production, prefer proxy/worker mode.
- Update `public/_headers` `connect-src` to include your proxy domain in production.
