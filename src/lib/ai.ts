import { createGroq } from '@ai-sdk/groq';
import { streamText, type ModelMessage } from 'ai';

import { storageGet } from './storage';

type GroqModel = {
  id: 'llama-3.3-70b-versatile' | 'mixtral-8x7b-32768' | 'gemma2-9b-it';
  name: string;
};

type StreamTextResultLike = {
  textStream: AsyncIterable<string>;
};

type StreamTextInput = {
  model: unknown;
  messages: ModelMessage[];
  system: string;
  abortSignal?: AbortSignal;
  maxRetries?: number;
};

type StreamTextImpl = (input: StreamTextInput) => StreamTextResultLike;
type CreateGroqClient = (apiKey: string) => (modelId: string) => unknown;

export type StreamChatDependencies = {
  streamTextImpl: StreamTextImpl;
  createGroqClient: CreateGroqClient;
  getApiKey: () => Promise<string | undefined>;
};

export type StreamChatParams = {
  messages: ModelMessage[];
  modelId: GroqModel['id'];
  systemPrompt?: string;
  abortSignal?: AbortSignal;
};

export const GROQ_MODELS: GroqModel[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
];

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant in a browser sidebar.';

async function resolveGroqApiKey(): Promise<string | undefined> {
  const storedApiKey = await storageGet<string>('local', 'groqApiKey');
  if (storedApiKey) {
    return storedApiKey;
  }

  return import.meta.env.VITE_GROQ_API_KEY;
}

export async function streamChat(
  params: StreamChatParams,
  dependencies: StreamChatDependencies = {
    streamTextImpl: (input) => {
      const result = streamText({
        model: input.model as Parameters<typeof streamText>[0]['model'],
        messages: input.messages,
        system: input.system,
        abortSignal: input.abortSignal,
        maxRetries: input.maxRetries,
      });

      return {
        textStream: result.textStream,
      };
    },
    createGroqClient: (apiKey) => {
      const provider = createGroq({ apiKey });
      return (modelId) => provider(modelId as Parameters<typeof provider>[0]);
    },
    getApiKey: resolveGroqApiKey,
  },
): Promise<StreamTextResultLike> {
  const apiKey = await dependencies.getApiKey();
  if (!apiKey) {
    throw new Error('Groq API key is missing. Set VITE_GROQ_API_KEY or save groqApiKey.');
  }

  const groq = dependencies.createGroqClient(apiKey);

  const result = dependencies.streamTextImpl({
    model: groq(params.modelId),
    messages: params.messages,
    system: params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    abortSignal: params.abortSignal,
    maxRetries: 1,
  });

  return {
    textStream: result.textStream,
  };
}
