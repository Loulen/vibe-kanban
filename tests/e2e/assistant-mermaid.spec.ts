import { expect, test } from '@playwright/test';

test('validates assistant mermaid rendering behavior', async ({ page }) => {
  await page.goto('/mermaid-e2e.html');

  const validAssistant = page.getByTestId('assistant-valid-mermaid');
  await expect(validAssistant.locator('.wysiwyg svg')).toHaveCount(1);
  await expect(validAssistant.locator('.wysiwyg svg')).toContainText('User Input');

  const invalidAssistant = page.getByTestId('assistant-invalid-mermaid');
  await expect(
    invalidAssistant.getByText('Unable to render Mermaid diagram.')
  ).toBeVisible();
  await expect(invalidAssistant.locator('pre code')).toContainText('A-->');
  await expect(invalidAssistant.locator('.wysiwyg svg')).toHaveCount(0);

  const nonAssistant = page.getByTestId('non-assistant-mermaid-disabled');
  await expect(nonAssistant.locator('.wysiwyg svg')).toHaveCount(0);
  await expect(nonAssistant.locator('code')).toContainText('flowchart LR');

  const maliciousAssistant = page.getByTestId('assistant-malicious-mermaid');
  await expect(maliciousAssistant.locator('[href^="javascript:"]')).toHaveCount(0);
  await expect(maliciousAssistant.locator('[xlink\\:href^="javascript:"]')).toHaveCount(0);
  await expect(
    maliciousAssistant.locator('[onload], [onclick], [onerror]')
  ).toHaveCount(0);

  await expect(page.getByText('Syntax error in text')).toHaveCount(0);
});
