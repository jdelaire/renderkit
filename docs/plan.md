# Product Spec
Renderkit is a minimalist, techy single-page web app for programmatic AI video generation that starts with OpenAI Sora 2 and is architected to add other providers without refactoring core flows. It is not a social platform, not a marketplace, and has no accounts or collaboration features at launch.

Core user flows:
- Generate video: prompt + params → job creation → status polling → output
- View queue: active/in-flight jobs with status and progress
- View history: completed/failed jobs
- Download outputs: asset files + metadata
- Manage provider + key: BYO key stored locally; optional proxy mode

# UX Plan (cobalt.tools vibe)
Layout regions (single page):
- Left panel: prompt input + quick presets
- Middle panel: parameters (duration, resolution, model selector, advanced toggles)
- Right rail: queue (active jobs with status + ETA), history (completed/failed)
- Footer/status bar: connection status, provider selection, key status, rate-limit indicators

Default states:
- No key: locked UI with single CTA to add key or enable proxy mode
- No jobs: empty queue with short hint ("Create your first job")
- No history: empty history with a “Start generating” helper

Empty/error states:
- Provider offline: banner in status bar + retry action
- Rate-limited: in-context message on job with next retry timestamp

Minimal keyboard shortcuts:
- Cmd/Ctrl+Enter: submit job
- Cmd/Ctrl+K: focus prompt
- Cmd/Ctrl+L: open provider/key modal
- Esc: close modal

# Technical Architecture
Stack choice:
- Vue + Vite + TypeScript. Justification: excellent SPA ergonomics with SFCs, strong ecosystem, and straightforward state management for async job flows.
- Tailwind. Justification: fast iteration for a dense utilitarian UI and easy theme control; no heavy UI framework.

Module boundaries (folder map):
- src/ui/ components, layout, view state
- src/domain/ core types, job state machine, queue reducer
- src/providers/ provider adapters (OpenAI now, others later)
- src/network/ API client, polling scheduler, retry logic
- src/persist/ local storage (IndexedDB + settings)
- src/state/ app store, selectors
- src/assets/ icons, base styles

Provider interface contract (TS-style shape in plain text):
- Provider interface includes: name, id, capabilities
- listModels(): returns model list with id, label, maxDuration, supportedResolutions
- createJob(input): prompt, durationSec, resolution, modelId, optional seed, optional style params
- getJob(jobId): returns provider job status, progress, output handles, error
- getDownloadUrl(outputId): returns signed URL or direct URL
- cancelJob(jobId): best-effort cancel

Normalized internal job model:
- jobId (internal UUID), providerId, providerJobId
- status: queued | in_progress | succeeded | failed | canceled | rate_limited | expired
- createdAt, updatedAt, startedAt, completedAt
- input: prompt, durationSec, resolution, modelId, params
- output: list of assets with format, size, url, checksum (optional)
- error: type, message, retryAt (optional)
- progress: 0–1, etaSec (optional)

# Security & Privacy Plan
Threat model (BYO key in browser):
- XSS could exfiltrate keys from storage
- Malicious extensions or shared device access can read local data
- LocalStorage is accessible to any script in origin

Mitigations:
- Strict CSP (no inline scripts, no third-party scripts, only self)
- Sanitize all user-generated text before display
- No analytics by default; no external fonts; no CDN scripts
- Store keys encrypted at rest using Web Crypto with a user-supplied passphrase (optional toggle)
- Clear “Forget Key” action with one click

Optional proxy mode:
- Endpoints: POST /jobs, GET /jobs/:id, POST /jobs/:id/cancel, GET /jobs/:id/download
- Data stored: ideally none; only transient in-memory mapping; no logs of prompt by default
- Rate limiting: IP-based, with global concurrency cap; denylist for abuse
- Abuse prevention: request size limits, per-IP throttle, simple token to prevent open relay

# Data Model & Persistence
Stored locally:
- Provider settings: selected provider, default model, last resolution/duration
- API keys (encrypted if passphrase enabled)
- Job history: normalized job model, outputs metadata, timestamps
- UI preferences: sidebar collapse, polling interval

Storage choice:
- Recommended: IndexedDB for structured job history and output metadata; scalable and async
- Fallback: localStorage if IndexedDB unavailable; store only recent jobs and minimal metadata

# Networking & Async Job Management
Polling strategy:
- Base interval 2s while in_progress, 5s after 30s, 10s after 2 min
- Exponential backoff on network errors; reset on success
- Cancellation: user cancel triggers provider cancel + stop polling

Concurrency control:
- Max parallel jobs: 3 (configurable)
- Queue pending jobs; start next when active slot frees

Timeout and retries:
- Soft timeout at 10 minutes; mark as “stale” with manual retry
- Retries: network errors up to 3 with backoff; provider rate-limit honors retryAt

# Error Handling
Taxonomy:
- Auth: invalid/expired key
- Quota: usage limit reached
- Validation: prompt/params invalid
- Provider down: 5xx or maintenance
- Network: offline, DNS, timeout
- Job failed: provider returns failed state

UI behavior:
- Auth: inline banner + open key modal
- Quota: job row shows “quota reached” + link to provider dashboard
- Validation: highlight invalid fields with inline message
- Provider down: global status bar + pause queue
- Network: show offline pill; pause polling; resume on reconnect
- Job failed: show reason and “Retry with same params” button

# Testing Plan
Unit tests:
- Provider adapter contract adherence
- Job reducer/state machine transitions and edge cases

Integration tests:
- Mocked provider API with success, rate-limit, failure flows

Minimal E2E:
- Generate job → poll to success → download output
- Invalid key flow
- Queue concurrency enforcement

# Deployment Plan
Frontend:
- Static hosting on Cloudflare Pages (or Vercel as fallback)
- Environment config via VITE_ vars for provider endpoints and proxy toggle

Optional proxy:
- Deploy on Cloudflare Workers or Node on Fly.io
- Same origin as SPA to avoid CORS complexity

# Milestones
1) Foundation & skeleton
- Deliverables: Vite app, layout shell, CSS theme, routing-free SPA
- Acceptance: app loads, UI regions visible, empty states implemented

2) Domain core + persistence
- Deliverables: job model, queue reducer, IndexedDB storage, settings store
- Acceptance: create/update job state persists across reload

3) Provider adapter (OpenAI Sora 2)
- Deliverables: provider interface, OpenAI adapter, model list stub
- Acceptance: create job and poll status in mocked environment

4) Networking & async manager
- Deliverables: polling scheduler, concurrency caps, cancel handling
- Acceptance: 3 parallel jobs max; backoff works on errors

5) UI wiring & key management
- Deliverables: provider selector, key modal, encrypted storage option
- Acceptance: key set/clear flows; blocked state without key

6) Downloads & history
- Deliverables: output list, download action, history view
- Acceptance: completed jobs show outputs and download works

7) Error handling + rate limits
- Deliverables: error taxonomy mapping, UI messaging, retry logic
- Acceptance: each error state is visible and actionable

8) Deploy + proxy (optional)
- Deliverables: static deploy, env config; proxy service if chosen
- Acceptance: live SPA; proxy flow works without storing user keys
