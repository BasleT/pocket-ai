const EMBED_RULE_ID_START = 1000;

export const EMBED_PROVIDER_DOMAINS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'grok.com',
  'chat.deepseek.com',
] as const;

export const EMBED_RULE_HEADERS_TO_REMOVE = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
] as const;

export function buildEmbedRules(): chrome.declarativeNetRequest.Rule[] {
  return EMBED_PROVIDER_DOMAINS.map((domain, index) => ({
    id: EMBED_RULE_ID_START + index,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: EMBED_RULE_HEADERS_TO_REMOVE.map((header) => ({
        header,
        operation: 'remove',
      })),
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  }));
}

export async function registerEmbedRules(): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.map((rule) => rule.id),
    addRules: buildEmbedRules(),
  });
}
