import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type ModelMessage } from 'ai';

import { storageGetSecret } from './storage';
import type { ApiProviderId } from '../types/settings';
import type { PageContentResult } from '../types/page';

export type ChatModel = {
  id: string;
  name: string;
  provider: ApiProviderId;
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
type CreateModelClient = (apiKey: string) => (modelId: string) => unknown;

export type StreamChatDependencies = {
  streamTextImpl: StreamTextImpl;
  createGroqClient: CreateModelClient;
  createOpenAiClient: CreateModelClient;
  createAnthropicClient: CreateModelClient;
  createGoogleClient: CreateModelClient;
  getApiKey: (provider: ApiProviderId) => Promise<string | undefined>;
};

export type StreamChatParams = {
  messages: ModelMessage[];
  modelId: string;
  systemPrompt?: string;
  abortSignal?: AbortSignal;
};

export const CHAT_MODELS: ChatModel[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
];

export const GROQ_MODELS = CHAT_MODELS.filter((model) => model.provider === 'groq');

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant in a browser sidebar.';
const MAX_PAGE_CONTEXT_CHARS = 24_000;

export function buildPageContextSystemPrompt(page: PageContentResult): string {
  const content =
    page.content.length > MAX_PAGE_CONTEXT_CHARS
      ? `${page.content.slice(0, MAX_PAGE_CONTEXT_CHARS)}...`
      : page.content;

  return [
    'You are a helpful AI assistant in a browser sidebar.',
    `The user is currently reading: ${page.title}`,
    `URL: ${page.url}`,
    '',
    content,
  ].join('\n');
}

async function resolveProviderApiKey(provider: ApiProviderId): Promise<string | undefined> {
  const storedApiKey = await storageGetSecret(`${provider}ApiKey`);
  if (storedApiKey) {
    return storedApiKey;
  }

  if (provider === 'groq') {
    return import.meta.env.VITE_GROQ_API_KEY;
  }

  return undefined;
}

function resolveProviderFromModel(modelId: string): ApiProviderId {
  return CHAT_MODELS.find((model) => model.id === modelId)?.provider ?? 'groq';
}

export function getAvailableModelsByConfiguredProviders(configuredProviders: ApiProviderId[]): ChatModel[] {
  const providerSet = new Set(configuredProviders);
  return CHAT_MODELS.filter((model) => providerSet.has(model.provider));
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
    createOpenAiClient: (apiKey) => {
      const provider = createOpenAI({ apiKey });
      return (modelId) => provider(modelId as Parameters<typeof provider>[0]);
    },
    createAnthropicClient: (apiKey) => {
      const provider = createAnthropic({ apiKey });
      return (modelId) => provider(modelId as Parameters<typeof provider>[0]);
    },
    createGoogleClient: (apiKey) => {
      const provider = createGoogleGenerativeAI({ apiKey });
      return (modelId) => provider(modelId as Parameters<typeof provider>[0]);
    },
    getApiKey: resolveProviderApiKey,
  },
): Promise<StreamTextResultLike> {
  const provider = resolveProviderFromModel(params.modelId);
  const apiKey = await dependencies.getApiKey(provider);
  if (!apiKey) {
    throw new Error(`${provider} API key is missing.`);
  }

  let resolvedModel: unknown;
  if (provider === 'openai') {
    resolvedModel = dependencies.createOpenAiClient(apiKey)(params.modelId);
  } else if (provider === 'anthropic') {
    resolvedModel = dependencies.createAnthropicClient(apiKey)(params.modelId);
  } else if (provider === 'google') {
    resolvedModel = dependencies.createGoogleClient(apiKey)(params.modelId);
  } else {
    resolvedModel = dependencies.createGroqClient(apiKey)(params.modelId);
  }

  const result = dependencies.streamTextImpl({
    model: resolvedModel,
    messages: params.messages,
    system: params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    abortSignal: params.abortSignal,
    maxRetries: 1,
  });

  return {
    textStream: result.textStream,
  };
}
