# pocket-ai

> A premium AI sidebar for Chrome — always watching, always ready.

**pocket-ai** is a browser extension that puts a powerful AI assistant in a sleek sidebar next to every webpage you visit. It reads the page you're on automatically — no copying, no pasting, no tab switching. Just open the sidebar and ask.

---

## What it does

**It already knows what you're reading.**
The moment you open the sidebar, pocket-ai has already read the page. Ask "summarize this", "what are the key points", or "explain the third paragraph" — it just answers. No buttons to click, no text to select.

**It works on YouTube too.**
Navigate to any YouTube video and the sidebar automatically fetches the transcript. Ask questions about the video, get a summary, or pull out specific information — all without watching a single second.

**Highlight anything, instantly.**
Select any text on any webpage and a floating mini-toolbar appears. Hit Explain, Summarize, Translate, or Improve and the answer appears in your sidebar instantly.

**Chat with PDFs.**
Drop any PDF into the sidebar and start asking questions. pocket-ai extracts the text (with OCR fallback for scanned documents) and uses it as context for your conversation.

**Extract text from images.**
Right-click any image on any page and choose "Extract text" — Tesseract OCR pulls the words out and drops them in your sidebar, ready to copy or ask questions about.

---

## Features

- 🧠 **Always-on page awareness** — reads every page automatically as you browse
- 💬 **AI chat** — streaming responses powered by Groq (free) or your own API keys
- 📄 **One-click summaries** — instant page summary with content-type detection
- 🎥 **YouTube summarizer** — transcript-based Q&A on any video
- 📁 **PDF chat** — upload and interrogate any PDF document
- 🔍 **OCR** — extract text from images on any webpage
- ✨ **Text selection toolbar** — floating AI actions on any highlighted text
- 🎙️ **Voice input** — speak your questions via Web Speech API
- 🌙 **Dark / light mode** — premium dark theme by default, fully toggleable
- ⌨️ **Keyboard shortcut** — `Alt+Shift+S` to open/close the sidebar
- 🔒 **Encrypted key storage** — API keys stored with AES-GCM encryption
- 🆓 **Free to use** — works out of the box with Groq's free tier

---

## Models supported

Works free out of the box with **Groq** (no credit card, no subscription):
- Llama 3.3 70B *(default — best quality)*
- Llama 3.1 8B Instant *(fastest)*
- Mixtral 8x7B

Add your own keys in Settings to unlock:
- OpenAI (GPT-4o, GPT-4o mini)
- Anthropic (Claude Sonnet, Claude Haiku)

---

## Getting started

### Install from source

```bash
git clone https://github.com/BasleT/pocket-ai.git
cd pocket-ai
bun install
bun run build
```

### Load in Chrome / Edge

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder

### Get your free Groq API key

1. Go to [console.groq.com](https://console.groq.com) — sign up free, no credit card
2. Create an API key
3. Open pocket-ai → Settings → paste your key

That's it. Start asking questions.

---

## Development

```bash
bun run dev          # Live dev build with HMR
bun run build        # Production build
bun run typecheck    # TypeScript check
bun run test         # Run tests
bun run zip          # Package for distribution
```

Output: `.output/chrome-mv3/`

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Extension framework | [WXT](https://wxt.dev) (Vite + MV3) |
| UI | React + TypeScript + Tailwind CSS |
| AI streaming | [Vercel AI SDK](https://sdk.vercel.ai) |
| Free AI backend | [Groq](https://groq.com) (Llama 3.3 70B) |
| Page extraction | [@mozilla/readability](https://github.com/mozilla/readability) |
| PDF parsing | [pdfjs-dist](https://mozilla.github.io/pdf.js/) |
| OCR | [Tesseract.js](https://tesseract.projectnaptha.com/) |
| YouTube | [youtube-transcript](https://www.npmjs.com/package/youtube-transcript) |

---

## Architecture

pocket-ai uses Chrome's Manifest V3 architecture:

```
Content Script (runs on every page)
  → extracts page text with Readability.js
  → sends to Background Service Worker

Background Service Worker
  → stores page context per tab
  → routes all AI API calls (Groq / OpenAI / Anthropic)
  → streams responses back to sidebar

Side Panel (React app)
  → reads page context via usePageContext()
  → renders chat, summarize, YouTube, PDF, OCR panels
  → right-side icon rail navigation
```

All AI calls go through the background service worker — never directly from the page. API keys are stored encrypted with AES-GCM via the Web Crypto API.

---

## Privacy

- Your API keys never leave your browser (encrypted local storage)
- Page content is sent to your chosen AI provider only when you ask a question
- No analytics, no tracking, no servers of our own
- Fully open source — read every line

---

## Contributing

PRs welcome. This is a personal flagship project — quality over quantity.

```bash
bun run typecheck && bun run test
```

---

## License

MIT
