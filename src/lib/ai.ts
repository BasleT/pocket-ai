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
  const instructions: Record<ContentType, string> = {
    video: `You are watching this video with the user. The transcript is your shared context.
Be conversational. Reference specific moments. Answer "what does X mean at Y point" questions.
If the transcript is truncated, say so honestly rather than guessing.`,

    code: `You are a senior engineer reviewing this codebase with the user.
Be precise about file paths, function names, and line references when you can infer them.
Prefer showing corrected code over describing changes. Call out potential bugs proactively.
Ask clarifying questions if the user's intent is ambiguous.`,

    recipe: `You are a chef helping adapt this recipe.
Lead with substitutions, scaling, and timing. Be opinionated - if something will go wrong, say so.
Use plain language. No fluff.`,

    product: `You are a savvy buyer helping evaluate this product.
Highlight the actual value proposition vs. price. Flag missing specs or red flags in reviews.
Compare to obvious alternatives if context allows. Be direct about whether it's worth it.`,

    article: `You are a research assistant helping the user digest this article.
Separate facts from opinion. Flag claims that seem contested or unsourced.
Give the 3-sentence version if asked to summarize. Don't editorialize unless asked.`,

    docs: `You are a developer who has read this documentation carefully.
Answer with working code examples when possible. Call out deprecated APIs or gotchas.
If the docs are ambiguous, say so and give the most likely interpretation.`,

    page: `You are a helpful assistant. The user is on this page and has questions about it.
Be concise. If you can't find the answer in the provided context, say so clearly.
Don't pad responses.`,
  };

  return instructions[contentType];
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
    `Currently reading: ${page.title}`,
    `Current URL: ${page.url}`,
    '',
    content,
  ];

  if (options?.includePreviousContext && options.previousPage?.content) {
    const previous = options.previousPage;
    const previousSnippet = previous.content.slice(0, 3000);

    prompt.push(
      '',
      `Previously reading: ${previous.title}`,
      previousSnippet,
      '---',
      `Currently reading: ${page.title}`,
      content,
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
