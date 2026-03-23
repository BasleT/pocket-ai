import type { ModelMessage } from 'ai';

import type { CHAT_MODELS } from '../lib/ai';

export type ChatModelId = (typeof CHAT_MODELS)[number]['id'];

export type LocalChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type SerializableModelMessage = {
  role: Extract<ModelMessage['role'], 'system' | 'user' | 'assistant'>;
  content: string;
};

export type ChatStreamStartMessage = {
  type: 'CHAT_STREAM_START';
  requestId: string;
  modelId: ChatModelId;
  messages: SerializableModelMessage[];
};

export type ChatStreamChunkMessage = {
  type: 'CHAT_STREAM_CHUNK';
  requestId: string;
  chunk: string;
};

export type ChatStreamDoneMessage = {
  type: 'CHAT_STREAM_DONE';
  requestId: string;
};

export type ChatStreamErrorMessage = {
  type: 'CHAT_STREAM_ERROR';
  requestId: string;
  message: string;
};

export type ChatPortResponse =
  | ChatStreamChunkMessage
  | ChatStreamDoneMessage
  | ChatStreamErrorMessage;
