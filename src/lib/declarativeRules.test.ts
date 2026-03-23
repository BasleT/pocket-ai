import { describe, expect, it } from 'vitest';

import {
  EMBED_PROVIDER_DOMAINS,
  EMBED_RULE_HEADERS_TO_REMOVE,
  buildEmbedRules,
} from './declarativeRules';

describe('buildEmbedRules', () => {
  it('creates one rule per provider domain', () => {
    const rules = buildEmbedRules();
    expect(rules).toHaveLength(EMBED_PROVIDER_DOMAINS.length);
  });

  it('creates deterministic rule IDs', () => {
    const rules = buildEmbedRules();
    expect(rules.map((rule) => rule.id)).toEqual([1000, 1001, 1002, 1003, 1004]);
  });

  it('removes frame blocking headers from responses', () => {
    const rule = buildEmbedRules()[0];
    expect(rule.action.type).toBe('modifyHeaders');
    expect(rule.action.responseHeaders).toEqual(
      EMBED_RULE_HEADERS_TO_REMOVE.map((header) => ({
        header,
        operation: 'remove',
      })),
    );
  });

  it('targets main frame and sub frame requests for provider domains', () => {
    const firstRule = buildEmbedRules()[0];
    expect(firstRule.condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
    expect(firstRule.condition.urlFilter).toBe('||chat.openai.com^');
  });
});
