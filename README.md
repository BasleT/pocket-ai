# Pocket AI

Chrome/Edge side panel extension for AI chat, page summarization, YouTube summaries, PDF chat, and OCR.

## What This Package Is

This repo builds a Manifest V3 browser extension with two usage modes:

- **Embed mode:** loads provider sites (ChatGPT, Claude, Gemini, Grok, DeepSeek) in sidepanel tabs.
- **AI mode:** streams model responses with context tools (page, YouTube transcript, PDF, OCR).

## Prerequisites

- Bun 1.3+
- Chrome or Edge (Chromium)

## Install

```bash
bun install
```

## Development

Run live development build:

```bash
bun run dev
```

Firefox dev target:

```bash
bun run dev:firefox
```

## Build

Build production extension output:

```bash
bun run build
```

Output directory:

- `.output/chrome-mv3`

## Load Unpacked Extension (Chrome/Edge)

1. Run `bun run build`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select `.output/chrome-mv3`

## Tests and Verification

Type check:

```bash
bun run typecheck
```

Targeted test examples:

```bash
bun run test src/lib/ai.test.ts
bun run test src/lib/secureStorage.test.ts
bun run test src/lib/extractors/pdf.test.ts
```

## Package / Zip

Create extension zip for distribution:

```bash
bun run zip
```

Zip output example:

- `.output/pocket-ai-0.1.0-chrome.zip`

## Key Runtime Features

- Streaming chat with provider-based model routing
- Encrypted API key storage (AES-GCM via Web Crypto)
- Right-click image OCR (`Extract text from image`)
- PDF parsing with OCR fallback and chunked context
- YouTube transcript summarization
- Theme modes (system/light/dark)
- Keyboard shortcut: `Alt+Shift+S` toggles sidepanel

## Important Files

- `entrypoints/background.ts`: MV3 worker, routing, context menu, connection tests
- `entrypoints/sidepanel/App.tsx`: main app integration
- `src/lib/ai.ts`: model/provider routing and stream helper
- `src/lib/secureStorage.ts`: encrypted secret handling
- `src/components/Settings/SettingsPanel.tsx`: provider toggles, keys, connection tests
- `wxt.config.ts`: extension config/manifest fields

## Notes

- YouTube summary depends on caption availability.
- OCR and PDF OCR are compute-heavy; first use may feel slower.
- Keep API keys in Settings; do not hardcode secrets in source.
