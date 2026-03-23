---
name: ai-streaming
description: Use when implementing AI chat, streaming tokens, multi-model routing, or integrating Vercel AI SDK with Groq/OpenAI/Anthropic providers.
---

# AI Streaming with Vercel AI SDK + Groq

## Setup

```bash
bun add ai @ai-sdk/groq @ai-sdk/openai @ai-sdk/anthropic zod
```

```typescript
// src/lib/ai.ts
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type CoreMessage } from 'ai'
import { getSettings } from './storage'

// Initialize providers based on stored API keys
export async function getProvider() {
  const settings = await getSettings()

  if (settings.groqApiKey) {
    return createGroq({ apiKey: settings.groqApiKey })
  }

  // Default: use Groq with env var (for development)
  return createGroq({ apiKey: import.meta.env.VITE_GROQ_API_KEY })
}

// Available models by provider
export const MODELS = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', free: true },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', free: true },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', free: true },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', free: false },
    { id: 'gpt-4o', name: 'GPT-4o', free: false },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', free: false },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', free: false },
  ]
}
```

## Streaming in the Background Service Worker

```typescript
// src/entrypoints/background.ts
import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

async function handleChatStream(
  messages: CoreMessage[],
  modelId: string,
  tabId: number
) {
  const groq = createGroq({ apiKey: GROQ_API_KEY })

  const result = streamText({
    model: groq(modelId),
    messages,
    system: 'You are a helpful AI assistant in a browser sidebar.',
  })

  // Stream chunks back to the sidepanel via port
  const port = chrome.tabs.connect(tabId, { name: 'ai-stream' })

  for await (const chunk of result.textStream) {
    port.postMessage({ type: 'CHUNK', text: chunk })
  }

  port.postMessage({ type: 'DONE' })
  port.disconnect()
}
```

## Receiving the Stream in the Sidebar

```typescript
// src/components/Chat/ChatWindow.tsx
function useChatStream() {
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const sendMessage = useCallback(async (messages: CoreMessage[]) => {
    setIsStreaming(true)
    setStreamingText('')

    // Open a port to receive stream chunks
    const port = chrome.runtime.connect({ name: 'ai-stream' })

    port.onMessage.addListener((message) => {
      if (message.type === 'CHUNK') {
        setStreamingText(prev => prev + message.text)
      }
      if (message.type === 'DONE') {
        setIsStreaming(false)
        port.disconnect()
      }
      if (message.type === 'ERROR') {
        setIsStreaming(false)
        // handle error
      }
    })

    // Tell background to start streaming
    chrome.runtime.sendMessage({
      type: 'CHAT_STREAM',
      payload: { messages, modelId: 'llama-3.3-70b-versatile' }
    })
  }, [])

  return { streamingText, isStreaming, sendMessage }
}
```

## System Prompts with Page Context

```typescript
function buildSystemPrompt(pageContext?: string, pdfText?: string): string {
  let system = 'You are a helpful AI assistant in a browser sidebar.'

  if (pageContext) {
    system += `\n\nThe user is currently reading this page:\n\n${pageContext.slice(0, 8000)}`
  }

  if (pdfText) {
    system += `\n\nThe user has uploaded a PDF. Content:\n\n${pdfText.slice(0, 12000)}`
  }

  return system
}
```

## Groq Free Tier Rate Limits
- **llama-3.3-70b-versatile**: 30 req/min, 14,400 req/day, 32,768 ctx
- **mixtral-8x7b-32768**: 30 req/min, 14,400 req/day, 32,768 ctx
- **gemma2-9b-it**: 30 req/min, 14,400 req/day, 8,192 ctx

Handle rate limit errors gracefully:
```typescript
try {
  // stream...
} catch (error) {
  if (error.status === 429) {
    port.postMessage({ type: 'ERROR', message: 'Rate limit hit. Try again in a minute.' })
  }
}
```

## Token Counting / Context Management
Groq models have limited context windows. For long pages or PDFs:
1. Count approximate tokens: `text.split(/\s+/).length * 1.3` (rough estimate)
2. If estimated tokens > 80% of model context, truncate with a notice
3. For PDFs, summarize in chunks then combine summaries
