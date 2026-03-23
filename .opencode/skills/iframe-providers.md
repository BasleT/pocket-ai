---
name: iframe-providers
description: Use when implementing the embedded provider tab system — loading ChatGPT, Claude, Gemini, Grok inside the sidebar via iframe. Covers declarativeNetRequest header stripping, iframe sandboxing, provider config, and login detection.
---

# Iframe Embed Provider Pattern

## How It Works
AI provider websites set `X-Frame-Options: SAMEORIGIN` or `Content-Security-Policy: frame-ancestors 'self'` to prevent embedding in iframes. Chrome extensions can strip these response headers using `declarativeNetRequest` before they reach the browser — making the site embeddable. We never read cookies, intercept requests, or touch auth tokens. The user's existing login session just works.

## declarativeNetRequest Rules

```typescript
// src/lib/declarativeRules.ts
import type { chrome } from 'chrome'

const PROVIDER_DOMAINS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'grok.com',
  'x.com',           // Grok also lives here
  'chat.deepseek.com',
]

// Headers to strip so providers can be embedded
const HEADERS_TO_REMOVE = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
]

export function buildEmbedRules(): chrome.declarativeNetRequest.Rule[] {
  return PROVIDER_DOMAINS.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'modifyHeaders' as const,
      responseHeaders: HEADERS_TO_REMOVE.map(header => ({
        header,
        operation: 'remove' as const,
      })),
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ['sub_frame' as const, 'main_frame' as const],
    },
  }))
}

// Call this in background.ts on install/startup
export async function registerEmbedRules() {
  const rules = buildEmbedRules()
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
  const existingIds = existingRules.map(r => r.id)

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: rules,
  })
}
```

## Background Service Worker Setup

```typescript
// src/entrypoints/background.ts
import { registerEmbedRules } from '../lib/declarativeRules'

export default defineBackground(() => {
  // Register header-stripping rules on install and startup
  chrome.runtime.onInstalled.addListener(() => registerEmbedRules())
  chrome.runtime.onStartup.addListener(() => registerEmbedRules())

  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id! })
  })
})
```

## Provider Config

```typescript
// src/components/providers/providerConfig.ts
export type Provider = {
  id: string
  name: string
  url: string
  icon: string        // emoji or path to icon
  color: string       // Tailwind bg color class for tab indicator
  loginUrl: string    // URL that indicates user is NOT logged in
}

export const EMBED_PROVIDERS: Provider[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    icon: '🤖',
    color: 'bg-green-500',
    loginUrl: 'https://chat.openai.com/auth/login',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    icon: '🟠',
    color: 'bg-orange-500',
    loginUrl: 'https://claude.ai/login',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    icon: '✨',
    color: 'bg-blue-500',
    loginUrl: 'https://accounts.google.com',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    icon: '𝕏',
    color: 'bg-gray-800',
    loginUrl: 'https://x.com/i/flow/login',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    icon: '🔍',
    color: 'bg-blue-700',
    loginUrl: 'https://chat.deepseek.com/sign_in',
  },
]
```

## EmbedProvider Component

```tsx
// src/components/providers/EmbedProvider.tsx
import { useState, useRef, useEffect } from 'react'
import type { Provider } from './providerConfig'

type EmbedProviderProps = {
  provider: Provider
  isActive: boolean
}

export function EmbedProvider({ provider, isActive }: EmbedProviderProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(true)

  // Detect login page by checking iframe's final URL
  const handleLoad = () => {
    try {
      const url = iframeRef.current?.contentWindow?.location.href
      if (url && url.includes(new URL(provider.loginUrl).hostname)) {
        setIsLoggedIn(false)
      } else {
        setIsLoggedIn(true)
      }
    } catch {
      // Cross-origin — means the site loaded fine (we can't read its URL)
      // This is expected and means the user IS logged in
      setIsLoggedIn(true)
    }
  }

  return (
    <div className={`flex flex-col h-full ${isActive ? 'block' : 'hidden'}`}>
      {!isLoggedIn && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You're not logged into {provider.name}
          </p>
          <a
            href={provider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Log in to {provider.name} →
          </a>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={provider.url}
        className="flex-1 w-full border-0"
        onLoad={handleLoad}
        // Minimal sandbox — providers need scripts and forms to work
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title={provider.name}
      />
    </div>
  )
}
```

## Tab Bar Component

```tsx
// src/components/providers/EmbedProviderTab.tsx
import { EMBED_PROVIDERS } from './providerConfig'

type EmbedProviderTabProps = {
  activeId: string
  onSelect: (id: string) => void
  enabledProviders: string[]   // from settings
}

export function EmbedProviderTabBar({ activeId, onSelect, enabledProviders }: EmbedProviderTabProps) {
  const visible = EMBED_PROVIDERS.filter(p => enabledProviders.includes(p.id))

  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      {visible.map(provider => (
        <button
          key={provider.id}
          onClick={() => onSelect(provider.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
            activeId === provider.id
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          aria-label={`Switch to ${provider.name}`}
        >
          <span>{provider.icon}</span>
          <span>{provider.name}</span>
        </button>
      ))}
    </div>
  )
}
```

## wxt.config.ts Permissions Required

```typescript
export default defineConfig({
  manifest: {
    permissions: [
      'activeTab',
      'storage',
      'sidePanel',
      'scripting',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
      'contextMenus',
    ],
    host_permissions: ['<all_urls>'],
  }
})
```

## Known Gotchas
- **Cross-origin iframe access**: You CANNOT read `iframe.contentWindow.location.href` once the iframe navigates to a cross-origin URL — this throws a security error. Wrap in try/catch; the error itself tells you the site loaded (user is logged in)
- **Google SSO**: Gemini may redirect through `accounts.google.com` first — this is fine, the iframe handles it
- **ChatGPT popups**: Some ChatGPT flows open `popup` windows — the `allow-popups-to-escape-sandbox` sandbox flag handles this
- **Mobile/responsive**: Provider sites are designed for full-width — the sidebar at 400px may show mobile-ish layouts on some providers, which is actually fine
- **iframe persistence**: Keep all provider iframes mounted in the DOM (use CSS `display: none` to hide inactive ones) — this preserves conversation state when switching tabs. Don't unmount/remount.
