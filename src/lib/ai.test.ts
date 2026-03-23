import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';

import {
  GROQ_MODELS,
  buildPageContextSystemPrompt,
  detectContentType,
  type StreamChatDependencies,
  streamChat,
} from './ai';

describe('streamChat', () => {
  it('exposes the expected free Groq model IDs', () => {
    expect(GROQ_MODELS.map((model) => model.id)).toEqual([
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ]);
  });

  it('streams text chunks in order', async () => {
    const chunks = ['Hi', ' there'];
    const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }];

    const dependencies: StreamChatDependencies = {
      createGroqClient: () => () => ({ kind: 'model' }),
      createOpenAiClient: () => () => ({ kind: 'model' }),
      createAnthropicClient: () => () => ({ kind: 'model' }),
      createGoogleClient: () => () => ({ kind: 'model' }),
      getApiKey: async () => 'test-key',
      streamTextImpl: () => ({
        textStream: (async function* stream() {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
      }),
    };

    const result = await streamChat(
      {
        messages,
        modelId: 'llama-3.3-70b-versatile',
      },
      dependencies,
    );

    const received: string[] = [];
    for await (const chunk of result.textStream) {
      received.push(chunk);
    }

    expect(received).toEqual(chunks);
  });
});

describe('buildPageContextSystemPrompt', () => {
  it('injects title and truncates long page content', () => {
    const longContent = 'A'.repeat(50_000);

    const prompt = buildPageContextSystemPrompt({
      title: 'Example Title',
      url: 'https://example.com/page',
      content: longContent,
      source: 'readability',
    });

    expect(prompt).toContain('Example Title');
    expect(prompt).toContain('https://example.com/page');
    expect(prompt.length).toBeLessThan(30_000);
  });

  it('includes previous page context when carry-over is enabled', () => {
    const prompt = buildPageContextSystemPrompt(
      {
        title: 'Current Page',
        url: 'https://example.com/current',
        content: 'Current content',
        source: 'readability',
      },
      {
        includePreviousContext: true,
        previousPage: {
          title: 'Previous Page',
          url: 'https://example.com/previous',
          content: 'Previous content',
          source: 'readability',
        },
      },
    );

    expect(prompt).toContain('Previously reading: Previous Page');
    expect(prompt).toContain('Currently reading: Current Page');
    expect(prompt).toContain('---');
  });
});

describe('detectContentType', () => {
  it('detects a YouTube video page', () => {
    expect(detectContentType('https://www.youtube.com/watch?v=abc', 'video transcript')).toBe('video');
  });

  it('detects developer docs pages from content signals', () => {
    expect(detectContentType('https://example.dev/docs', 'import { x } from y; API endpoint reference')).toBe('docs');
  });

  it('falls back to generic page when no pattern matches', () => {
    expect(detectContentType('https://example.com', 'just plain text with no special cues')).toBe('page');
  });
});
