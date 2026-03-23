import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type ModelMessage } from 'ai';

import { storageGetSecret } from './storage';
import type { ApiProviderId } from '../types/settings';
import type { PageContentResult } from '../types/page';

export type ContentType = 'video' | 'code' | 'recipe' | 'product' | 'article' | 'docs' | 'page';

export const CONTENT_TYPE_META: Record<ContentType, { label: string; emoji: string }> = {
  video: { label: 'Video', emoji: '📺' },
  code: { label: 'Code', emoji: '💻' },
  recipe: { label: 'Recipe', emoji: '🍳' },
  product: { label: 'Product', emoji: '🛒' },
  article: { label: 'Article', emoji: '📰' },
  docs: { label: 'Docs', emoji: '📖' },
  page: { label: 'Page', emoji: '🌐' },
};

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

function truncateContext(content: string): string {
  if (content.length <= MAX_PAGE_CONTEXT_CHARS) {
    return content;
  }

  return `${content.slice(0, MAX_PAGE_CONTEXT_CHARS)}...`;
}

export function detectContentType(url: string, text: string): ContentType {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.includes('youtube.com/watch') || normalizedUrl.includes('youtu.be/')) {
    return 'video';
  }

  if (normalizedUrl.includes('github.com')) {
    return 'code';
  }

  if (/ingredients|prep time|servings/i.test(text)) {
    return 'recipe';
  }

  if (/add to cart|buy now|\$[\d,.]+/i.test(text)) {
    return 'product';
  }

  if (/by .+|published|breaking news/i.test(text)) {
    return 'article';
  }

  if (/function|const |import |api|endpoint/i.test(text)) {
    return 'docs';
  }

  return 'page';
}

function contentTypeInstruction(contentType: ContentType): string {
  if (contentType === 'video') {
    return 'The page is a video context. Prioritize timeline flow, major moments, and explain references from transcript context.';
  }

  if (contentType === 'code') {
    return 'The page is a code repository context. Prioritize code-level accuracy, architecture, and actionable implementation guidance.';
  }

  if (contentType === 'recipe') {
    return 'The page is a recipe context. Prioritize ingredients, measurements, substitutions, and concise step clarity.';
  }

  if (contentType === 'product') {
    return 'The page is a product context. Prioritize price, value trade-offs, specs, and buying considerations.';
  }

  if (contentType === 'article') {
    return 'The page is a news/article context. Prioritize claims, key facts, and concise neutral synthesis.';
  }

  if (contentType === 'docs') {
    return 'The page is technical documentation. Prioritize exact API behavior, examples, and practical integration details.';
  }

  return 'The page is a general webpage. Prioritize relevance to visible page context and concise helpful responses.';
}

export function buildPageContextSystemPrompt(
  page: PageContentResult,
  options?: {
    includePreviousContext?: boolean;
    previousPage?: PageContentResult | null;
  },
): string {
  const content = truncateContext(page.content);
  const contentType = detectContentType(page.url, page.content);
  const instructions = contentTypeInstruction(contentType);

  const prompt = [
    'You are a helpful AI assistant in a browser sidebar.',
    `Content type: ${CONTENT_TYPE_META[contentType].label}`,
    instructions,
    `The user is currently reading: ${page.title}`,
    `URL: ${page.url}`,
    '',
    content,
  ];

  if (options?.includePreviousContext && options.previousPage?.content) {
    prompt.push(
      '',
      '---',
      'Previous page context (use only when it helps answer cross-tab questions):',
      `Title: ${options.previousPage.title}`,
      `URL: ${options.previousPage.url}`,
      '',
      truncateContext(options.previousPage.content),
    );
  }

  return prompt.join('\n');
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
