import type { Page } from '@playwright/test';

export async function mockGroqResponses(page: Page): Promise<void> {
  await page.route('https://api.groq.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-chatcmpl',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mocked Groq response from Playwright.',
            },
          },
        ],
      }),
    });
  });
}
