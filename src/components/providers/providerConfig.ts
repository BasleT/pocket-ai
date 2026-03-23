export type ProviderId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek';

export type EmbedProvider = {
  id: ProviderId;
  name: string;
  url: string;
  embedUrls: string[];
  loginUrl: string;
  iconLabel: string;
  colorClass: string;
  loginHosts: string[];
};

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    embedUrls: ['https://chatgpt.com/', 'https://chat.openai.com/'],
    loginUrl: 'https://chatgpt.com/',
    iconLabel: 'GPT',
    colorClass: 'bg-emerald-500',
    loginHosts: ['chat.openai.com', 'chatgpt.com', 'auth.openai.com'],
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    embedUrls: ['https://claude.ai'],
    loginUrl: 'https://claude.ai/login',
    iconLabel: 'CLD',
    colorClass: 'bg-orange-500',
    loginHosts: ['claude.ai'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    embedUrls: ['https://gemini.google.com'],
    loginUrl: 'https://gemini.google.com',
    iconLabel: 'GEM',
    colorClass: 'bg-sky-500',
    loginHosts: ['accounts.google.com'],
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    embedUrls: ['https://grok.com'],
    loginUrl: 'https://grok.com',
    iconLabel: 'GRK',
    colorClass: 'bg-zinc-800',
    loginHosts: ['x.com'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    embedUrls: ['https://chat.deepseek.com'],
    loginUrl: 'https://chat.deepseek.com',
    iconLabel: 'DSK',
    colorClass: 'bg-blue-700',
    loginHosts: ['chat.deepseek.com'],
  },
];

export const DEFAULT_PROVIDER_ID: ProviderId = 'chatgpt';
