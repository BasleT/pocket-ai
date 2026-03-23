# pocket-ai — AGENTS.md

## Project Overview
A Chrome extension AI sidebar inspired by Sider AI. Built with:
- **WXT** — Chrome extension framework (Vite-based)
- **React + TypeScript** — UI
- **Tailwind CSS** — styling (custom purple accent `#7c3aed`)
- **Vercel AI SDK** (`ai` + `@ai-sdk/groq`) — streaming AI
- **Groq** — free AI backend (Llama 3.3 70B), key in `GROQ_API_KEY` env var
- **@mozilla/readability** — page content extraction
- **pdfjs-dist** — PDF parsing
- **Tesseract.js** — OCR
- **youtube-transcript** — YouTube captions

## Design Philosophy
Inspired by Sider AI — clean, minimal, lots of whitespace. Right-side vertical icon rail, main panel to the left. Always-on page awareness — the extension always knows what page the user is on without any user action. Purple accent color (`#7c3aed`). Light theme default.

## Project Structure
```
src/
├── entrypoints/
│   ├── background.ts          ← service worker: AI calls, message routing, page context storage
│   ├── content.ts             ← always-running: extracts page content, sends to background
│   └── sidepanel/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx            ← activePanel state, renders Shell
├── components/
│   ├── layout/
│   │   ├── Shell.tsx          ← outer flex row: Panel (left) + IconRail (right)
│   │   ├── IconRail.tsx       ← 48px vertical strip, 6 icons, purple active state
│   │   └── Panel.tsx          ← renders active feature panel
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── summarize/
│   │   └── SummarizePanel.tsx
│   ├── youtube/
│   │   └── YouTubePanel.tsx
│   ├── pdf/
│   │   ├── PdfUpload.tsx
│   │   └── PdfChat.tsx
│   ├── ocr/
│   │   └── OcrPanel.tsx
│   └── settings/
│       └── SettingsPanel.tsx
├── lib/
│   ├── ai.ts                  ← Vercel AI SDK + Groq setup, streamChat()
│   ├── pageContext.ts         ← usePageContext() hook
│   ├── storage.ts             ← chrome.storage wrappers
│   └── extractors/
│       ├── page.ts            ← Readability.js
│       ├── pdf.ts             ← pdfjs-dist
│       ├── ocr.ts             ← Tesseract.js
│       └── youtube.ts         ← youtube-transcript
└── types/
    └── index.ts
```

## Build Commands
```bash
bun install
bun run dev        # dev mode with HMR
bun run build      # production build to .output/
bun run typecheck  # type check
bun run lint       # lint
bun run test       # vitest
```

## Critical Rules

### Chrome Extension (MV3)
- ALL Groq API calls go through the **background service worker** — never from content scripts or sidepanel directly
- Use `chrome.runtime.sendMessage` / ports for content ↔ background ↔ sidepanel communication
- Use `chrome.storage.local` for persistent settings (API keys), `chrome.storage.session` for per-tab context
- NEVER use `localStorage` in extension contexts
- Return `true` from `onMessage` listeners when using async `sendResponse`

### Always-On Page Context
- Content script runs on EVERY page, ALWAYS
- Extracts page text with Readability.js on load AND on URL change (for SPAs)
- Sends to background which stores in `chrome.storage.session` keyed by tabId
- Sidebar reads from storage via `usePageContext()` — never reads DOM directly
- Page context is ALWAYS injected into AI system prompt automatically — user never has to do anything

### TypeScript
- Strict mode — no `any`, no untyped exports
- Use `zod` for API response validation

### React
- Functional components only
- Tailwind only — no CSS modules, no inline styles
- `zustand` for shared sidebar state
- `useState` for local component state

### AI Streaming
- Always stream — never wait for full response
- Show `▊` cursor while streaming
- Handle 429 rate limit errors gracefully with user-friendly message
- Timeout after 30 seconds

### Do NOT add
- `axios` — use native fetch
- `moment`/`dayjs` — use `Intl`
- `lodash` — use native JS
- Any UI component library — Tailwind + custom components only

## Agent Workflow
1. Read PLAN.md first — know which phase and task you're working on
2. Check `.opencode/skills/` for relevant patterns before writing code
3. Use @architect for structural decisions
4. Use @tester after implementing features
5. Use @reviewer before marking tasks done
6. Use @swarm/planner for phases with parallel tasks (5, 7, 8)

## Commit Convention
```
feat: add YouTube transcript extraction
fix: handle empty PDF pages in OCR fallback
refactor: extract page content logic to lib/extractors/page.ts
test: add unit tests for pdf parser
```
