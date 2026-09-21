import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public field guide is static, responsive and renders all architecture views', async ({ page }, info) => {
  const apiRequests: string[] = [];
  const failures: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto('./');
  await expect(page.getByText('Read-only public guide', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the live Azure Cost Optimizer Workshop' })).toHaveAttribute('href', 'https://aco-workshop-guide.blackwave-6513be11.eastus2.azurecontainerapps.io/');
  await expect(page.getByRole('link', { name: 'Open Azure Cost Optimizer Workshop on GitHub' })).toHaveAttribute('href', 'https://github.com/gitpavleenbali/azure-cost-optimizer-workshop');
  await expect(page.locator('.prose').first()).toContainText('git clone https://github.com/gitpavleenbali/azure-cost-optimizer-workshop.git');
  await expect(page.getByText('Facilitator', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Join workshop', { exact: true })).toHaveCount(0);
  if (info.project.name === 'mobile') await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  for (const [anchor, kind] of [
    ['architecture-1-solution-at-a-glance', 'diagram'],
    ['architecture-2-azure-cost-intelligence-platform-and-workloads', 'image'],
    ['architecture-3-azure-deployment-and-microsoft-foundry', 'image'],
    ['architecture-4-azure-cost-optimizer-data-flow', 'diagram'],
  ] as const) {
    await page.goto('./#' + anchor);
    if (kind === 'diagram') await expect(page.locator('[data-testid="mermaid-diagram"] svg')).toBeVisible();
    else {
      const image = page.locator('.screenshot-frame img').first();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  expect(apiRequests).toEqual([]);
  expect(failures).toEqual([]);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});