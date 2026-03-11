import { expect, test } from '@playwright/test';

test('validates assistant mermaid rendering behavior', async ({ page }) => {
  await page.goto('/mermaid-e2e.html');

  const validAssistant = page.getByTestId('assistant-valid-mermaid');
  await expect(validAssistant.locator('.wysiwyg svg')).toHaveCount(1);
  await expect(validAssistant.locator('.wysiwyg svg')).toContainText('User Input');

  const invalidAssistant = page.getByTestId('assistant-invalid-mermaid');
  await expect(
    invalidAssistant.getByText('Unable to render Mermaid diagram')
  ).toBeVisible();
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

test('mermaid zoom dialog shows error details for invalid diagrams', async ({ page }) => {
  await page.goto('/mermaid-e2e.html');

  // Wait for mermaid rendering to complete
  const invalidSection = page.getByTestId('assistant-invalid-mermaid');
  await expect(
    invalidSection.getByText('Unable to render Mermaid diagram')
  ).toBeVisible();

  // Open the invalid diagram modal
  await invalidSection
    .getByRole('button', { name: 'Open Mermaid diagram' })
    .click();

  // Verify the dialog shows the real error message
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Unable to render Mermaid diagram')
  ).toBeVisible();
  await expect(dialog.locator('pre').first()).toContainText('Parse error');

  // Verify "Show source code" details section
  await dialog.getByText('Show source code').click();
  await expect(dialog.locator('details pre')).toContainText('A-->');

  // Verify Copy PNG is disabled when there's an error
  await expect(
    dialog.getByRole('button', { name: 'Copy as PNG' })
  ).toBeDisabled();

  // Verify Copy Code is still available
  await expect(
    dialog.getByRole('button', { name: 'Copy Mermaid code' })
  ).toBeEnabled();
});

test('mermaid zoom dialog shows copy buttons for valid diagrams', async ({ page }) => {
  await page.goto('/mermaid-e2e.html');

  // Wait for valid diagram to render
  const validSection = page.getByTestId('assistant-valid-mermaid');
  await expect(validSection.locator('.wysiwyg svg')).toHaveCount(1);

  // Open the valid diagram modal
  await validSection
    .getByRole('button', { name: 'Open Mermaid diagram' })
    .click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Verify diagram renders in the modal
  await expect(dialog.locator('svg')).toContainText('User Input');

  // Verify Copy Code button works
  const copyCodeBtn = dialog.getByRole('button', { name: 'Copy Mermaid code' });
  await expect(copyCodeBtn).toBeEnabled();
  await copyCodeBtn.click();
  await expect(copyCodeBtn).toContainText('Copied!');

  // Verify Copy PNG button is enabled
  const copyPngBtn = dialog.getByRole('button', { name: 'Copy as PNG' });
  await expect(copyPngBtn).toBeEnabled();
});
