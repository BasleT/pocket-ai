# AI Browser Sidebar — AGENTS.md

## Project Overview
This is a Chrome extension AI sidebar (Sider AI clone) built with:
- **WXT** (Vite-based extension framework)
- **React + TypeScript** (UI)
- **Tailwind CSS** (styling)
- **Vercel AI SDK** (`ai` npm package) for streaming multi-model chat
- **Groq** as the primary free AI backend (no credit card required)
- **pdfjs-dist** (Mozilla PDF.js) for PDF parsing
- **Tesseract.js** for OCR (image → text)
- **@mozilla/readability** (Readability.js) for page content extraction
- **youtube-transcript** for YouTube summarization

## Provider Architecture
There are two completely separate provider modes:

### Mode A — Embedded (iframe) Providers
Loads the actual AI website (chat.openai.com, claude.ai, gemini.google.com) inside the sidebar panel using an iframe. Uses `declarativeNetRequest` to strip `X-Frame-Options` headers so the sites can embed. Auth is handled entirely by the provider's own website — we never touch tokens or cookies. User just needs to be logged in to that site in Chrome as normal.

**Providers:** ChatGPT, Claude, Gemini, Grok, DeepSeek
**How:** Strip X-Frame-Options header via declarativeNetRequest rules, render in iframe
**User requirement:** Already logged into that site in Chrome

### Mode B — API Providers
Direct API calls via Vercel AI SDK. Required for power features (page summarization, PDF chat, OCR context injection) since those need to inject custom system prompts — which you can't do via iframe.

**Free tier:** Groq (no key needed to start), Google AI Studio free tier, OpenRouter free models
**BYO key:** OpenAI, Anthropic, Groq, Google AI Studio
**How:** Vercel AI SDK streaming through background service worker

## Project Structure
```
.
├── AGENTS.md                  ← you are here
├── PLAN.md                    ← implementation phases & tasks
├── opencode.json              ← opencode config (MCP servers, plugins, agents)
├── .opencode/
│   ├── agents/                ← custom subagent definitions
│   │   ├── architect.md
│   │   ├── reviewer.md
│   │   ├── tester.md
│   │   └── ui-specialist.md
│   └── skills/                ← project-specific skills
│       ├── chrome-extension.md
│       ├── wxt-patterns.md
│       └── ai-streaming.md
├── src/
│   ├── entrypoints/
│   │   ├── background.ts      ← service worker (API calls, message routing, declarativeNetRequest)
│   │   ├── content.ts         ← page content extractor
│   │   ├── sidepanel/         ← main sidebar React app
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── App.tsx
│   │   └── popup/             ← toolbar icon popup (minimal)
│   ├── components/
│   │   ├── providers/
│   │   │   ├── EmbedProvider.tsx     ← iframe wrapper + tab bar (ChatGPT/Claude/Gemini etc.)
│   │   │   ├── EmbedProviderTab.tsx  ← individual provider tab
│   │   │   └── providerConfig.ts     ← list of embeddable providers + their URLs
│   │   ├── Chat/              ← API mode chat UI
│   │   ├── Toolbar/
│   │   ├── PdfReader/
│   │   ├── Summarizer/
│   │   └── Settings/
│   ├── lib/
│   │   ├── ai.ts              ← Vercel AI SDK setup, model routing
│   │   ├── declarativeRules.ts ← builds X-Frame-Options strip rules for embed providers
│   │   ├── extractors/
│   │   │   ├── page.ts        ← Readability.js page scraper
│   │   │   ├── pdf.ts         ← PDF.js parser
│   │   │   ├── ocr.ts         ← Tesseract.js
│   │   │   └── youtube.ts     ← transcript fetcher
│   │   └── storage.ts         ← chrome.storage wrappers
│   └── types/
│       └── index.ts
├── public/                    ← extension icons, assets
├── wxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Build & Dev Commands
```bash
# Install deps
bun install

# Dev mode (auto-reloads extension)
bun run dev

# Production build
bun run build

# Type check
bun run typecheck

# Lint
bun run lint

# Run tests
bun run test
```

## Tech Rules & Conventions

### TypeScript
- Strict mode enabled — no `any`, no untyped returns on exported functions
- Use `zod` for runtime schema validation of API responses
- Prefer `type` over `interface` for simple shapes

### React
- Functional components only — no class components
- Co-locate component styles with the component file (Tailwind only, no CSS modules)
- Use `React.memo` sparingly — only when profiling shows a need
- State: `useState` for local, `zustand` for shared sidebar state

### Chrome Extension (MV3)
- ALL AI API calls (Mode B) go through the **background service worker** — never directly from content scripts
- Use `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` for content ↔ background comms
- Use `chrome.sidePanel` API (not popup) for the main UI
- Use `chrome.storage.local` for settings, `chrome.storage.session` for per-tab context
- NEVER use `localStorage` or `sessionStorage` in extension contexts
- The iframe embed (Mode A) uses `declarativeNetRequest` rules to strip `X-Frame-Options` and `Content-Security-Policy` headers on specific provider domains — this is the standard, documented approach used by all major AI sidebar extensions
- NEVER read, intercept, or transmit cookies or auth tokens from embedded provider iframes — we only strip the header that prevents embedding, nothing else

### Streaming
- Use Server-Sent Events (SSE) via the Vercel AI SDK `streamText()` function
- Always handle stream errors and show fallback UI — never let a failed stream silently hang
- Timeout streams after 30 seconds

### Permissions (manifest)
- Request only what is needed: `activeTab`, `storage`, `sidePanel`, `scripting`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`
- `host_permissions`: `<all_urls>` required for page reading AND for declarativeNetRequest rules to strip headers on provider domains

### File/Import Rules
- Barrel exports (`index.ts`) are fine for `components/` and `lib/`
- Do NOT barrel-export from `entrypoints/` — WXT treats those as distinct build targets
- No circular imports

## Agent Workflow
1. **Always read PLAN.md first** before starting any task to understand current phase and open tasks
2. Use the `architect` subagent for any decision involving new file structure, new dependencies, or API design
3. Use the `tester` subagent after each feature is implemented — do not skip tests
4. Use the `reviewer` subagent before marking a task complete
5. Use the `ui-specialist` subagent for any Tailwind/component work

## Testing
- Vitest for unit tests (`.test.ts` files alongside source)
- Playwright for integration/e2e tests (`tests/e2e/`)
- Test coverage target: 80% for `lib/` utilities, best-effort for React components
- Run `bun run test` and fix all failures before marking a task done

## Commit Convention
```
feat: add YouTube transcript extraction
fix: handle empty PDF pages in OCR fallback
refactor: extract page content logic to lib/extractors/page.ts
test: add unit tests for pdf parser
chore: update wxt to 0.20.x
```

## Dependencies to NOT add
- Do NOT add `axios` — use native `fetch`
- Do NOT add `moment` or `dayjs` — use `Intl.DateTimeFormat`
- Do NOT add `lodash` — use native JS equivalents
- Do NOT add any UI component library (MUI, Chakra, etc.) — Tailwind + shadcn/ui primitives only
- Do NOT add server-side frameworks (Next.js, Express) — this is a pure client-side extension

## When Stuck
- Check `.opencode/skills/chrome-extension.md` for MV3 gotchas
- Check `.opencode/skills/wxt-patterns.md` for WXT-specific patterns
- Use the `architect` subagent to think through the design before writing code
