---
name: chrome-extension
description: Use when working with Chrome Manifest V3 extension APIs — permissions, service workers, content scripts, message passing, chrome.storage, sidePanel. Also use when debugging extension loading errors.
---

# Chrome Extension (MV3) Patterns

## The Three-Layer Architecture

```
Content Script (runs IN the page)
    ↕ chrome.runtime.sendMessage / onMessage
Background Service Worker (central hub)
    ↕ port / sendMessage
Side Panel UI (extension page, like a popup but persistent)
```

**Rule: ALL external API calls (AI, fetch) go through the Background Service Worker.**
Content scripts cannot make cross-origin requests (blocked by CSP on most pages).

## Message Passing Pattern

```typescript
// content.ts — asking background to do something
const result = await chrome.runtime.sendMessage({
  type: 'GET_PAGE_CONTENT',
  payload: { url: window.location.href }
})

// background.ts — handling the request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    getPageContent(sender.tab!.id!)
      .then(sendResponse)
    return true // CRITICAL: return true to keep channel open for async response
  }
})
```

## Service Worker Keep-Alive
MV3 service workers terminate after ~30 seconds idle. Keep alive during streaming:

```typescript
// sidepanel/App.tsx — ping background every 25s during AI stream
let keepAliveInterval: ReturnType<typeof setInterval>

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' })
  }, 25_000)
}

function stopKeepAlive() {
  clearInterval(keepAliveInterval)
}
```

## chrome.storage vs localStorage
| | chrome.storage.local | chrome.storage.session | localStorage |
|---|---|---|---|
| Available in | All extension pages + content scripts | All extension pages | Only that page |
| Persists | Until cleared | Until browser closes | Until cleared |
| Async | YES (promise) | YES (promise) | NO (sync) |
| Cross-tab | YES | YES | NO |

**Never use localStorage in extensions — it doesn't work reliably across extension pages.**

```typescript
// lib/storage.ts pattern
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings')
  return result.settings ?? DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}
```

## SidePanel API Setup

```typescript
// background.ts
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id! })
})

// wxt.config.ts manifest entry
export default defineConfig({
  manifest: {
    permissions: ['activeTab', 'storage', 'sidePanel', 'scripting', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel/index.html'
    }
  }
})
```

## Injecting Content Scripts Programmatically

```typescript
// background.ts
await chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    // This runs IN the page context
    return document.body.innerText
  }
})
```

## Common MV3 Gotchas
- `chrome.runtime.sendMessage` throws if no listener is registered — wrap in try/catch
- Service workers can't use `window` or `document` — they're not browser contexts
- Content scripts CAN'T import npm packages directly — bundle them in via WXT's content script bundling
- `fetch()` in service workers works fine — but no CORS bypass; you still need CORS-friendly APIs
- Extension pages (sidepanel, popup) are isolated from page JS — different window object
