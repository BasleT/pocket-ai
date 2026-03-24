# pocket-ai — PLAN3.md (UI Fixes & Visual Polish)

> Based on the current screenshot. Every issue below is visible right now.
> Fix these in order. Do not skip ahead. Do not refactor components.

---

## CRITICAL — Layout Still Broken

The input bar is at the bottom which is progress, but there's a massive empty void
between the last message and the input bar. The message area is not filling the space.
The layout chain fix from PLAN2 still needs to be applied correctly.

**Panel.tsx line 147:**
```tsx
// MUST BE:
<div key={activePanel} className="ui-panel-body panel-animate h-full">
```

**ChatPanel.tsx outer section MUST BE:**
```tsx
<section className="flex h-full min-h-0 flex-col overflow-hidden">
```

**ChatWindow.tsx outer div MUST BE:**
```tsx
<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
```

When these are correct the messages fill from top, the empty void disappears,
and the input stays pinned at the bottom with no gap.

---

## VISUAL PROBLEMS — Exact Fixes

### Problem 1 — Header Is A Mess

**What I see:** "POCKET AI" stacked on two lines, page title truncated badly, "Body text only"
badge in orange floating awkwardly, "Docs" badge next to it, all crammed with no hierarchy.

**Root cause:** The header `div` has `min-w-0 flex items-center gap-2` but there's too much
content trying to fit in one line with no priority. The brand + title + multiple badges = chaos.

**Fix in `Panel.tsx` header section:**
```tsx
<header className="ui-panel-header">
  {/* Left: brand only, small and muted */}
  <p className="ui-brand shrink-0">Pocket AI</p>

  {/* Right: title + single most important badge only */}
  <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden pl-3">
    <p
      key={pageContext?.url ?? pageTitle}
      className="ui-page-title page-title-animate min-w-0 truncate"
    >
      {pageTitle}
    </p>

    {/* Show extraction badge OR content type badge — not both */}
    {pageContext?.source && pageContext.source !== 'readability' ? (
      <ExtractionBadge source={pageContext.source} />
    ) : pageContext?.content ? (
      <span
        key={`${pageContext.url}-${contentType}`}
        className="ui-content-badge badge-animate shrink-0"
        title={contentTypeMeta.label}
      >
        <span aria-hidden="true">{contentTypeMeta.emoji}</span>
      </span>
    ) : null}
  </div>
</header>
```

Key changes:
- Brand is `shrink-0` so it never wraps
- Title takes remaining space with `flex-1 truncate`
- Show EITHER extraction warning OR content type — never both at once
- Content type badge shows only the emoji in the header (label is in the tooltip)

---

### Problem 2 — "Chatting about:" Context Row Is Ugly

**What I see:** "Chatting about: Micropulse Synergy - Basle Trimmer" wraps to 3 lines,
"Re-read page" and "Clear" buttons float next to it awkwardly. Looks like a form, not a UI.

**Fix in `ChatPanel.tsx` — replace the context row entirely:**
```tsx
<div className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
     style={{ borderColor: 'var(--border)' }}>

  {/* Truncated page context indicator */}
  <span className="min-w-0 flex-1 truncate text-[11px]"
        style={{ color: 'var(--text-muted)' }}>
    {carryContext && previousPageContext
      ? `${pageContext?.title ?? 'current page'} + ${previousPageContext.title}`
      : pageContext?.title ?? 'No page context'}
  </span>

  {/* Actions — right aligned, compact */}
  <div className="flex shrink-0 items-center gap-1">
    {isStreaming && (
      <button
        type="button"
        className="ui-btn ui-btn-ghost !px-2 !py-1 text-[11px]"
        onClick={handleStopStream}
      >
        Stop
      </button>
    )}
    <button
      type="button"
      className="ui-btn ui-btn-ghost !px-2 !py-1 text-[11px]"
      onClick={() => void triggerPageReread()}
      disabled={isRereading}
    >
      {isRereading ? '...' : 'Re-read'}
    </button>
    {messages.length > 0 && !isStreaming && (
      <button
        type="button"
        className="ui-btn ui-btn-ghost !px-2 !py-1 text-[11px]"
        onClick={handleClearConversation}
      >
        Clear
      </button>
    )}
  </div>
</div>
```

Key changes:
- Single row, never wraps
- Page title truncates cleanly with `truncate`
- Buttons are compact `!px-2 !py-1` — small pill size
- "Stop thinking" becomes just "Stop" to save space
- All on one line always

---

### Problem 3 — Error State Looks Like a Modal

**What I see:** The "Streaming timed out" error has a heavy rounded border, large padding,
looks like a dialog box dropped in the middle of the chat. Jarring.

**Fix in `ChatPanel.tsx` — make errors inline and subtle:**
```tsx
{chatError && (
  <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
       style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
    <span style={{ color: '#f59e0b' }}>⚠</span>
    <div className="flex-1 min-w-0">
      <p style={{ color: 'var(--text-secondary)' }}>
        {chatError.includes('timed out')
          ? 'Response timed out.'
          : chatError.includes('Rate limit') || chatError.includes('429')
          ? 'Rate limit hit. Wait 30s and retry.'
          : chatError.includes('API key') || chatError.includes('missing')
          ? 'No API key. Open Settings to add one.'
          : chatError}
      </p>
      <div className="mt-1.5 flex gap-2">
        {lastFailedPrompt && (
          <button
            type="button"
            onClick={() => sendPrompt(lastFailedPrompt)}
            className="text-[11px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Retry →
          </button>
        )}
        {(chatError.includes('API key') || chatError.includes('missing')) && (
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="text-[11px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Settings →
          </button>
        )}
      </div>
    </div>
  </div>
)}
```

---

### Problem 4 — User Message Bubble Alignment

**What I see:** "What are common gotchas?" is a user message but it's centered on the screen
instead of right-aligned. It looks like a chip/button, not a chat message.

This is likely because `isThinking` or some state flag is incorrectly set, or the message
hasn't been properly added to the `messages` array and is still being shown as a quick chip.

**Check in `ChatPanel.tsx`:** When a quick action chip is clicked, it should call `handleSend`
which adds it to `messages` as a `role: 'user'` message immediately. If it's still showing
as a chip it means `messages.length === 0` is still true when it renders.

The fix is to ensure `setMessages` is called synchronously before the stream starts.
In `sendPrompt`:
```typescript
const sendPrompt = (prompt: string) => {
  const userMessage: LocalChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: prompt,
    timestamp: Date.now(),
  };

  // This MUST happen before the port check so message appears immediately
  const conversation = [...messages, userMessage];
  setMessages(conversation); // ← make sure this is here before any early returns

  const port = streamPortRef.current;
  if (!port || isStreaming) {
    setQueuedPrompt(prompt);
    return;
  }
  // ...rest of function
};
```

---

### Problem 5 — Input Bar Spacing & Model Selector

**What I see:** The input bar has "Model" label on the left, "Llama 3.3 70B ▼" on the right,
then a full-width textarea below. The model selector row adds height and visual weight
that fights the input area.

**Fix — move model selector inline with the send button row:**
```tsx
// In ChatInput.tsx — restructure the layout:
<div className="ui-input-bar">
  <div className="flex items-end gap-2">
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Escape') setValue('');
      }}
      rows={2}
      placeholder="Ask about this page..."
      className="ui-input min-h-[42px] max-h-40 w-full resize-none"
    />
    {supportsVoice && (
      <button type="button" onClick={toggleVoiceInput}
              className={`ui-btn ui-btn-ghost h-10 w-10 shrink-0 !p-0 ${isListening ? 'mic-listening' : ''}`}>
        {isListening ? <MicOff size={15} /> : <Mic size={15} />}
      </button>
    )}
    <button
      type="button"
      onClick={submit}
      disabled={isSending || !value.trim()}
      className="ui-btn ui-btn-accent h-10 shrink-0"
    >
      Send
    </button>
  </div>

  {/* Model selector — below textarea, subtle */}
  <div className="mt-2 flex items-center justify-between px-1">
    <select
      value={modelId}
      onChange={(e) => onModelChange(e.target.value as ChatModelId)}
      className="cursor-pointer border-0 bg-transparent text-[11px] transition-colors"
      style={{ color: 'var(--text-muted)' }}
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>{model.name}</option>
      ))}
    </select>
    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
      ↵ send · ⇧↵ newline
    </span>
  </div>
</div>
```

Key changes:
- Model selector moves BELOW the textarea, smaller text, no label
- Keyboard hint on the right: "↵ send · ⇧↵ newline" — useful and looks pro
- Input row is cleaner with just textarea + mic + send

---

### Problem 6 — Empty State When There Are Messages

**What I see:** There's a large empty white void between the last message/error and the
input bar. This is the ChatWindow not filling the flex space.

This is the layout bug. Once the `h-full` chain is fixed this void disappears.
The ChatWindow with `flex-1` will expand to fill the available space.

---

### Problem 7 — Quick Action Chips Spacing

**What I see:** The chips wrap onto multiple lines with inconsistent spacing.

**Fix in `index.css`:**
```css
/* Make chips slightly smaller and tighter */
.ui-quick-chip {
  @apply cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-all duration-150;
  border-color: var(--border);
  color: var(--text-secondary);
  background: transparent;
  white-space: nowrap; /* ADD THIS — prevents chip text from wrapping */
}
```

And in ChatPanel.tsx the chips container:
```tsx
<div className="flex flex-wrap gap-1.5 px-4 pb-3">
  {quickActions.map((action) => (
    <button key={action} type="button" onClick={() => handleSend(action)} className="ui-quick-chip">
      {action}
    </button>
  ))}
</div>
```

---

### Problem 8 — Rail Icon Sizing

**What I see:** The right rail icons look a bit large and the active state (purple square)
is very boxy. The settings icon at the bottom right corner is slightly cut off.

**Fix in `index.css`:**
```css
.ui-rail {
  @apply flex h-full w-[48px] shrink-0 flex-col items-center px-[5px] py-2;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
}

.ui-rail-btn {
  @apply flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg;
  color: var(--text-muted);
  transition: all 150ms ease;
}
```

Reduce width from 52px to 48px, buttons from 40px to 36px (h-9 w-9).
This gives the main panel 4px more width which matters in a narrow sidebar.

---

### Problem 9 — Typography Hierarchy Is Flat

Everything is the same visual weight. Nothing pops. The user message should feel
like a message, not just text in a box.

**Fix in `index.css`:**
```css
/* User messages — more contrast, clearly "sent" */
.ui-message-user {
  @apply rounded-2xl rounded-br-sm px-4 py-3 text-sm font-medium;
  background: var(--accent);
  color: #ffffff;
  /* Remove border — solid accent color needs no border */
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

/* Assistant messages — slightly more padding, reading-optimized */
.ui-message-assistant {
  @apply rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed;
  background: var(--bg-elevated);
  border-color: var(--border);
  color: var(--text-primary);
}

/* Tighten up markdown output */
.ui-message-assistant p { margin: 0 0 6px; line-height: 1.55; }
.ui-message-assistant p:last-child { margin-bottom: 0; }
.ui-message-assistant ul, .ui-message-assistant ol { padding-left: 16px; margin: 4px 0 6px; }
.ui-message-assistant li { margin-bottom: 3px; line-height: 1.5; }
.ui-message-assistant strong { color: var(--text-primary); font-weight: 600; }
.ui-message-assistant code {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.8em;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
.ui-message-assistant pre {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
  margin: 6px 0;
}
.ui-message-assistant pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.82em;
}
.ui-message-assistant h1,
.ui-message-assistant h2,
.ui-message-assistant h3 {
  font-weight: 600;
  margin: 8px 0 4px;
  color: var(--text-primary);
}
```

---

### Problem 10 — Overall Spacing Is Inconsistent

Looking at the screenshot the padding jumps around — some sections have px-4, some px-3,
the error has different padding than the messages. Standardize everything to a 12px/16px grid.

**In `index.css` add spacing standards as comments for reference:**
```css
/* SPACING SYSTEM:
   - Panel horizontal padding: 16px (px-4)
   - Compact rows (context bar, error): 12px (px-3)
   - Vertical section gaps: 8px (py-2) or 12px (py-3)
   - Input bar padding: 12px (p-3)
   - Message bubble padding: 12px horizontal 10px vertical (px-3 py-2.5)
*/

/* Tighten message bubble padding to match the spacing system */
.ui-message-user,
.ui-message-assistant {
  @apply px-3 py-2.5; /* was px-4 py-3 — slightly tighter */
}
```

---

## Summary of Files to Change

| Problem | File | Change |
|---|---|---|
| Layout void | `src/components/layout/Panel.tsx` | Add `h-full` to ui-panel-body div |
| Layout void | `src/components/Chat/ChatPanel.tsx` | Add `h-full` to outer section |
| Layout void | `src/components/Chat/ChatWindow.tsx` | Verify `flex-1 min-h-0 overflow-y-auto` |
| Header chaos | `src/components/layout/Panel.tsx` | Rewrite header JSX |
| Context row wrapping | `src/components/Chat/ChatPanel.tsx` | Rewrite context row JSX |
| Error state looks modal | `src/components/Chat/ChatPanel.tsx` | Rewrite error JSX |
| User message centering | `src/components/Chat/ChatPanel.tsx` | Fix sendPrompt message order |
| Input bar layout | `src/components/Chat/ChatInput.tsx` | Move model selector below textarea |
| Chip wrapping | `entrypoints/sidepanel/index.css` | Add white-space: nowrap to ui-quick-chip |
| Chip spacing | `src/components/Chat/ChatPanel.tsx` | Tighten container gap |
| Rail icon sizing | `entrypoints/sidepanel/index.css` | 48px rail, 36px buttons |
| Typography | `entrypoints/sidepanel/index.css` | Message styles + markdown styles |
| Spacing consistency | `entrypoints/sidepanel/index.css` | Padding standardization |

---

## What Good Looks Like After These Fixes

1. Panel fills full height — no void, no collapse
2. Header: "POCKET AI" · truncated page title · single badge — clean single line
3. Context row: truncated title + Re-read + Clear — one compact line, never wraps
4. Error: small inline warning, "Retry →" text link, not a modal card
5. Messages: right-aligned purple user bubbles with shadow, left-aligned elevated assistant
6. Input: textarea + mic + send, model selector below as tiny muted text
7. Chips: single row where possible, no text wrap inside chips
8. Code blocks in responses: dark surface, monospace font, proper border radius
9. Rail: slightly narrower, icons not cut off

---

*PLAN3.md — March 2026*
*Do PLAN3 first. Then go back to PLAN2 Phase 2+ for features.*
