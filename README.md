# pocket-ai

AI-powered browser sidebar — chat, summarize, PDF, OCR. Embeds ChatGPT, Claude & Gemini using your existing login. Free models via Groq included.

## How Providers Work

**Embedded tab (your existing subscriptions):** ChatGPT, Claude, Gemini, Grok, and DeepSeek load directly inside the sidebar using your existing browser login. Uses Chrome's `declarativeNetRequest` API to strip `X-Frame-Options` headers so they can embed — your auth cookies are never touched. Just be logged in and it works.

**API mode (free + BYO key):** Direct API calls via Vercel AI SDK for power features like page summarization, PDF chat, and OCR. Groq's free tier (Llama 3.3 70B) works with no setup. Optionally add your own OpenAI/Anthropic/Google keys.

## Quickstart for OpenCode

### 1. Install Superpowers
In your first OpenCode session, paste this:
```
Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md
```
Restart OpenCode.

### 2. Start the project
```bash
git clone <your-repo>
cd ai-sidebar
opencode
```

### 3. Get your free Groq API key
1. Go to https://console.groq.com — sign up free, no credit card
2. Create an API key
3. Set it: `export VITE_GROQ_API_KEY=gsk_your_key_here`

### 4. Tell OpenCode to start building
```
Start with Phase 0 from PLAN.md. Use @swarm/planner to decompose the tasks.
```

## Key Files
| File | Purpose |
|------|---------|
| `AGENTS.md` | Rules and conventions for all agents |
| `PLAN.md` | Phased implementation plan with task IDs |
| `opencode.json` | OpenCode config: plugins, MCP servers, permissions |
| `.opencode/agents/` | Custom subagent definitions |
| `.opencode/skills/` | Reference docs injected on demand |

## Agent Reference
| Agent | Invoke | Use for |
|-------|--------|---------|
| Build | (default) | Writing code, implementing tasks |
| Plan | `Tab` key | Analyzing before coding |
| @architect | `@architect` | Structural decisions, new deps |
| @reviewer | `@reviewer` | Code review before marking done |
| @tester | `@tester` | Writing and running tests |
| @ui-specialist | `@ui-specialist` | React components, Tailwind |
| @swarm/planner | `@swarm/planner` | Decompose a phase into parallel tasks |
| @swarm/worker | (invoked by planner) | Execute individual tasks |

## MCP Servers
| Server | Purpose |
|--------|---------|
| playwright | Browser automation for testing the extension |
| context7 | Fetch live docs for WXT, Vercel AI SDK, etc. |
| github | (optional) PR creation, CI status |

## Tech Stack
- **WXT** — Chrome extension framework (Vite-based)
- **React + TypeScript** — UI
- **Tailwind CSS** — Styling
- **declarativeNetRequest** — strips X-Frame-Options for iframe embedding (built-in Chrome API)
- **Vercel AI SDK** — Multi-model streaming for API mode
- **Groq** — Free AI backend (Llama 3.3 70B, Mixtral) — no credit card
- **pdfjs-dist** — PDF parsing
- **Tesseract.js** — OCR
- **@mozilla/readability** — Page content extraction
- **youtube-transcript** — YouTube captions
