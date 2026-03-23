---
name: wxt-patterns
description: Use when working with WXT framework — entrypoints, wxt.config.ts, content script injection, HMR setup, or building/loading the extension.
---

# WXT Framework Patterns

## Project Setup

```bash
bun create wxt@latest . --template react-ts
bun install
bun run dev      # Start dev server with HMR
bun run build    # Production build to .output/
bun run zip      # Create .zip for Chrome Web Store
```

## Entrypoints Directory
WXT treats files in `src/entrypoints/` as separate build targets.

```
src/entrypoints/
├── background.ts          → background service worker
├── content.ts             → content script (auto-injected into all pages)
├── sidepanel/
│   ├── index.html         → side panel page
│   └── main.tsx           → React entry
└── popup/
    ├── index.html         → popup page
    └── main.tsx           → React entry (optional, minimal)
```

## wxt.config.ts Reference

```typescript
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'AI Sidebar',
    description: 'AI-powered browser sidebar',
    version: '1.0.0',

    permissions: [
      'activeTab',
      'storage',
      'sidePanel',
      'scripting',
      'contextMenus'
    ],
    host_permissions: ['<all_urls>'],

    side_panel: {
      default_path: 'sidepanel/index.html'
    },

    action: {
      default_title: 'Open AI Sidebar',
      default_icon: {
        '16': 'icon/16.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png'
      }
    }
  }
})
```

## Content Script Patterns

```typescript
// src/entrypoints/content.ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Runs on every page
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTRACT_CONTENT') {
        const text = extractPageContent()
        sendResponse({ text })
        return true
      }
    })
  }
})
```

## Background Service Worker

```typescript
// src/entrypoints/background.ts
export default defineBackground(() => {
  // Register side panel on icon click
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id! })
  })

  // Route messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse)
    return true
  })
})
```

## Bundling npm Packages in Content Scripts
WXT automatically bundles imports — just import normally:

```typescript
// src/entrypoints/content.ts
import { Readability } from '@mozilla/readability' // ✅ WXT bundles this
```

## Dev Loading in Chrome
1. Run `bun run dev`
2. Go to `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select `.output/chrome-mv3/` directory
6. HMR will auto-reload on file changes (may need manual reload for manifest changes)

## Common WXT Gotchas
- Don't import from `src/entrypoints/` in other files — they're isolated build targets
- The `public/` directory is copied as-is to the build output — good for icons
- HMR doesn't reload the background worker — restart it manually in `chrome://extensions`
- For Firefox, change `extensionApi: 'chrome'` to `extensionApi: 'browser'` in wxt.config.ts
