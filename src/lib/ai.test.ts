import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';

import { GROQ_MODELS, type StreamChatDependencies, streamChat } from './ai';

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
