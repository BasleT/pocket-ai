# AI Browser Sidebar — Implementation Plan

> **Status:** Phase 0 — Setup
> **Stack:** WXT · React · TypeScript · Tailwind · Vercel AI SDK · Groq

---

## Phase 0 — Project Scaffolding
*Goal: Working extension that loads in Chrome with a visible sidebar*

### Tasks
- [ ] `P0-01` Scaffold WXT project: `bun create wxt@latest . --template react-ts`
- [ ] `P0-02` Install core deps: `ai`, `@ai-sdk/groq`, `zod`, `zustand`, `tailwindcss`, `@mozilla/readability`, `pdfjs-dist`, `tesseract.js`, `youtube-transcript`
- [ ] `P0-03` Configure `wxt.config.ts` — set manifest permissions: `activeTab`, `storage`, `sidePanel`, `scripting`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`; `host_permissions: ["<all_urls>"]`
- [ ] `P0-04` Create `sidepanel/` entrypoint — bare React app renders "Hello World"
- [ ] `P0-05` Create `background.ts` service worker — registers side panel on `chrome.action.onClicked`
- [ ] `P0-06` Verify extension loads in Chrome (`chrome://extensions` → Load unpacked → `dist/`)
- [ ] `P0-07` Set up Tailwind + base styles in sidepanel
- [ ] `P0-08` Set up Vitest + Playwright configs
- [ ] `P0-09` Create `lib/storage.ts` — typed wrappers around `chrome.storage.local` / `chrome.storage.session`

**Exit criteria:** Extension installs, sidebar opens on icon click, Tailwind styles render correctly.

---

## Phase 1 — Embedded Provider Tabs (your existing subscriptions)
*Goal: ChatGPT, Claude, Gemini, Grok load inside the sidebar using your existing browser login — zero setup required*

### Tasks
- [ ] `P1-01` Create `lib/declarativeRules.ts` — builds `declarativeNetRequest` rules that strip `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` response headers for provider domains (`chat.openai.com`, `claude.ai`, `gemini.google.com`, `grok.com`, `chat.deepseek.com`)
- [ ] `P1-02` Register the rules in `background.ts` on install/startup via `chrome.declarativeNetRequest.updateDynamicRules()`
- [ ] `P1-03` Create `components/providers/providerConfig.ts` — array of provider objects: `{ id, name, url, icon, color }`
- [ ] `P1-04` Build `components/providers/EmbedProvider.tsx` — renders an `<iframe>` pointing to the provider URL, fills the sidebar height, handles load errors gracefully
- [ ] `P1-05` Build `components/providers/EmbedProviderTab.tsx` — tab bar at the top of the sidebar with provider icons; clicking switches the active iframe
- [ ] `P1-06` Persist which iframe tabs are "open" and which was last active in `chrome.storage.session` — so switching back resumes where you left off
- [ ] `P1-07` Add toggle in sidebar header: **"Embed"** (iframe mode) vs **"AI"** (API mode) — this is the main mode switcher
- [ ] `P1-08` Handle the case where a user isn't logged in to a provider — detect the login page URL and show a "Log in to [Provider]" button that opens a new tab
- [ ] `P1-09` Unit tests for `lib/declarativeRules.ts` rule generation

**Exit criteria:** Click "ChatGPT" tab in sidebar → chat.openai.com loads and you can chat using your Plus subscription. Same for Claude and Gemini.

---

## Phase 2 — API Chat (free models + BYO key)
*Goal: Working multi-model chat in the sidebar connected to Groq (free) with no setup*

### Tasks
- [ ] `P2-01` Create `lib/ai.ts` — initialize Vercel AI SDK with Groq provider; export `streamChat()` helper
- [ ] `P2-02` Set up message routing: `content.ts` → `background.ts` → Groq API → stream back to sidepanel
- [ ] `P2-03` Build `components/Chat/ChatMessage.tsx` — renders user/assistant messages with markdown (use `react-markdown`)
- [ ] `P2-04` Build `components/Chat/ChatInput.tsx` — textarea with send button, keyboard shortcut (Ctrl+Enter)
- [ ] `P2-05` Build `components/Chat/ChatWindow.tsx` — scrollable message list, auto-scroll to bottom
- [ ] `P2-06` Build `components/Toolbar/ModelPicker.tsx` — dropdown to select model (Groq: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`)
- [ ] `P2-07` Add streaming token display — tokens appear one-by-one as they arrive
- [ ] `P2-08` Add error handling UI — failed stream shows retry button
- [ ] `P2-09` Persist chat history to `chrome.storage.session`
- [ ] `P2-10` Add "Clear chat" button
- [ ] `P2-11` Unit tests for `lib/ai.ts` streaming logic (mock Groq)

**Exit criteria:** Can have a full streaming AI conversation using Groq free tier with no API key configured.

---

## Phase 3 — Page Context & Summarization
*Goal: API mode sidebar can read the current page and answer questions about it*

### Tasks
- [ ] `P3-01` Create `lib/extractors/page.ts` — inject Readability.js into page via content script, return cleaned article text
- [ ] `P3-02` Add messaging: background listens for `GET_PAGE_CONTENT` message, calls page extractor, returns text
- [ ] `P3-03` Build `components/Toolbar/ContextBar.tsx` — shows "📄 Reading: [page title]" when page context is loaded
- [ ] `P3-04` Add "Summarize this page" quick action button — prepopulates a prompt with page content
- [ ] `P3-05` Add text selection handler — when user selects text on page and opens sidebar, pre-inject selection as context
- [ ] `P3-06` Handle pages where Readability fails (SPAs, login walls) — show graceful fallback message
- [ ] `P3-07` Unit tests for `lib/extractors/page.ts`

**Exit criteria:** "Summarize this page" works on any standard article/blog page in API mode.

---

## Phase 4 — YouTube Summarization
*Goal: Detect YouTube pages, fetch transcript, allow Q&A on video content*

### Tasks
- [ ] `P4-01` Create `lib/extractors/youtube.ts` — use `youtube-transcript` package to fetch captions by video ID
- [ ] `P4-02` Detect YouTube page in content script — extract video ID from URL
- [ ] `P4-03` Build `components/Summarizer/YouTubeSummarizer.tsx` — auto-activates on youtube.com/watch pages
- [ ] `P4-04` Add "Summarize video" button — sends transcript chunk to AI (handle long transcripts with chunking)
- [ ] `P4-05` Handle videos with no transcript — show message "No captions available"
- [ ] `P4-06` Unit tests for transcript extraction and chunking logic

**Exit criteria:** Opening a YouTube video and clicking "Summarize" returns a concise summary.

---

## Phase 5 — PDF Chat
*Goal: User can upload a PDF and ask questions about it in the sidebar*

### Tasks
- [ ] `P5-01` Create `lib/extractors/pdf.ts` — use `pdfjs-dist` to extract text from all pages; handle both text-native and image PDFs
- [ ] `P5-02` Build `components/PdfReader/PdfUpload.tsx` — drag-and-drop or file picker for `.pdf` files
- [ ] `P5-03` Build `components/PdfReader/PdfChat.tsx` — chat interface with PDF text injected as system context
- [ ] `P5-04` Add OCR fallback: if `pdfjs-dist` returns empty text, fall back to `tesseract.js` on rendered page images
- [ ] `P5-05` Handle large PDFs: chunk text, summarize chunks, create rolling context window
- [ ] `P5-06` Show page count and extraction progress bar during parsing
- [ ] `P5-07` Unit tests for PDF parsing and chunking

**Exit criteria:** Can upload a 20-page PDF and ask "what are the key points?" and get a useful answer.

---

## Phase 6 — OCR (Image → Text)
*Goal: User can click on any image on a page and extract its text*

### Tasks
- [ ] `P6-01` Create `lib/extractors/ocr.ts` — Tesseract.js worker, accepts image URL or blob
- [ ] `P6-02` Add right-click context menu: "Extract text from image" (use `chrome.contextMenus`)
- [ ] `P6-03` Show OCR result in sidebar with copy button
- [ ] `P6-04` Add language selection for OCR (English default, show picker for others)
- [ ] `P6-05` Unit tests for OCR module

**Exit criteria:** Right-click any image on a webpage → "Extract text" → text appears in sidebar.

---

## Phase 7 — Settings & API Key Management
*Goal: User can configure their own API keys for other providers*

### Tasks
- [ ] `P7-01` Build `components/Settings/SettingsPanel.tsx` — tabbed settings UI
- [ ] `P7-02` Embed provider toggles — enable/disable which providers show in the tab bar
- [ ] `P7-03` API key inputs: Groq (default/free), OpenAI (optional), Anthropic (optional), Google AI Studio (optional)
- [ ] `P7-04` Store keys encrypted in `chrome.storage.local` (use `AES-GCM` via Web Crypto API)
- [ ] `P7-05` Update `lib/ai.ts` model router — picks provider based on stored keys, falls back to Groq
- [ ] `P7-06` Build `components/Toolbar/ModelPicker.tsx` — dynamically show available models based on configured providers
- [ ] `P7-07` Add "Test connection" button per API key — sends a trivial ping and shows ✅/❌
- [ ] `P7-08` Unit tests for key storage encryption/decryption

**Exit criteria:** User can enable/disable embed providers, configure API keys, and switch between free and paid models.

---

## Phase 8 — Polish & Cross-Browser
*Goal: Ship-ready quality, Edge support*

### Tasks
- [ ] `P8-01` Add dark mode (auto-detect `prefers-color-scheme`, toggle in settings)
- [ ] `P8-02` Add keyboard shortcuts — `Alt+Shift+S` to open/close sidebar
- [ ] `P8-03` Add loading skeletons for all async operations
- [ ] `P8-04` Test on Microsoft Edge (Chromium-based, declarativeNetRequest works the same)
- [ ] `P8-05` Accessibility audit — ARIA labels, keyboard navigation throughout
- [ ] `P8-06` Bundle size audit — keep extension zip under 5MB
- [ ] `P8-07` Write README.md with install instructions and feature list
- [ ] `P8-08` Prepare Chrome Web Store listing assets (screenshots, description)

**Exit criteria:** Extension installable on Chrome and Edge, all phases working.

---

## Backlog (Post-MVP)
These are nice-to-haves for after the core is working:

- **Prompt library** — save and reuse favorite prompts
- **Chat history** — persist conversations across browser sessions
- **Translation** — detect page language, offer to translate selection
- **Grammar checker** — on selected text, apply grammar correction
- **Group chat** — run the same prompt against multiple models simultaneously and display side-by-side
- **Deep research mode** — multi-step web search + synthesis (requires search MCP)
- **Wisebase / knowledge store** — save AI responses to a local searchable store
- **Native desktop app** — Electron or Tauri wrapper using the same React codebase

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Groq rate limits (free tier) | Show clear UI when rate-limited; prompt user to add their own key |
| PDF.js bundle size (~3MB) | Lazy-load PDF worker only when user opens PDF feature |
| Tesseract.js WASM size (~10MB) | Load only on demand; show download progress |
| Chrome sidePanel API not on Firefox | WXT handles abstraction; fall back to popup on Firefox |
| Long page content exceeds model context | Chunk and summarize in stages; always show what was included |
| MV3 service worker termination | Heartbeat ping from sidepanel keeps worker alive during long operations |
