import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

test('entry starts with the optional solution tour and required checkpoints stay explicit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.article-heading h1')).toHaveText('Azure Cost Optimizer Workshop');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Start solution tour', exact: true }).click();
  await expect(page.locator('.article-heading h1')).toHaveText('Part 1: Solution Tour');
  await expect(page.getByRole('heading', { name: 'Reading checkpoint (Optional)' })).toBeVisible();
  await expect(page.getByText('Does not affect evaluation', { exact: true })).toBeVisible();
  await page.goto('/#part-2-hands-on-workshop');
  await expect(page.locator('.article-heading h1')).toHaveText('Part 2: Hands-On Workshop');
  await page.getByRole('navigation', { name: 'Adjacent sections' }).getByRole('button', { name: /Next.*Set Up Copilot/ }).click();
  await expect(page.locator('.article-heading h1')).toHaveText('Set Up Copilot For A Guided Workshop');
  await expect(page.locator('.prose')).toContainText('Default Approvals');
  await page.goBack();
  await expect(page.locator('.article-heading h1')).toHaveText('Part 2: Hands-On Workshop');
  await page.goForward();
  await expect(page.locator('.article-heading h1')).toHaveText('Set Up Copilot For A Guided Workshop');
  await page.reload();
  await expect(page.locator('.section-link[aria-current="page"]')).toContainText('Set Up Copilot');
  await page.goto('/#step-1-prepare-the-workstation');
  await expect(page.getByRole('heading', { name: 'Required checkpoint' })).toBeVisible();
  await expect(page.getByText('Counts toward the 15 evaluated steps', { exact: true })).toBeVisible();
  await page.goto('/#what-you-are-building');
  await page.getByRole('link', { name: '1. Solution at a glance', exact: true }).click();
  await expect(page.locator('.article-heading h1')).toHaveText('Solution At A Glance');
  await page.goBack();
  await expect(page.locator('.article-heading h1')).toHaveText('What You Are Building');
  await expect(page.getByRole('heading', { name: 'Reading checkpoint (Optional)' })).toBeVisible();
});

test('all sections remain in README order and every displayed prompt is exact', async ({ page, request }) => {
  const source = fs.readFileSync(path.resolve('../README.md'), 'utf8');
  const tree = unified().use(remarkParse).parse(source);
  const headings = tree.children.filter(node => node.type === 'heading' && node.depth <= 2);
  const guide = await request.get('/api/content').then(response => response.json());
  expect(guide.sections).toHaveLength(headings.length);
  await page.goto('/');
  for (const [index, section] of guide.sections.entries()) {
    const heading = headings[index];
    expect(section.title).toBe(source.slice(heading.position!.start.offset, heading.position!.end.offset).replace(/^#{1,2} /, ''));
    const expectedBody = source.slice(heading.position!.end.offset, headings[index + 1]?.position?.start.offset ?? source.length).trim();
    expect(section.markdown).toBe(expectedBody);
    await expect(page.locator('.article-heading h1')).toHaveText(section.title.replace(/^Step \d+: /, '').replace(/^Architecture \d+: /, ''));
    const prompts = [...expectedBody.matchAll(/```(\w+)\r?\n([\s\S]*?)```/g)].filter(match => match[1] !== 'mermaid').map(match => match[2].replace(/\r\n/g, '\n').replace(/\n$/, ''));
    expect(await page.locator('.code-block pre code').allTextContents()).toEqual(prompts);
    if (index < guide.sections.length - 1) await page.getByRole('navigation', { name: 'Adjacent sections' }).getByRole('button', { name: /^Next/ }).click();
  }
});

test('subsection deep links and signed-out evidence routes remain explicit', async ({ page }) => {
  await page.goto('/#before-sprint-1-arrange-foundry-model-access');
  await expect(page.locator('.article-heading h1')).toHaveText('Workshop Requirements And Preparation');
  await expect(page.locator('#before-sprint-1-arrange-foundry-model-access')).toBeInViewport();
  await page.goto('/evidence');
  await expect(page.getByRole('heading', { name: 'Your evidence', exact: true })).toBeVisible();
  await page.goto('/kudos');
  await expect(page.getByRole('heading', { name: 'Workshop kudos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('mobile navigation is keyboard-contained and hidden navigation is inert', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile drawer behavior');
  await page.goto('/');
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await menu.click();
  await expect(page.getByRole('textbox', { name: 'Search workshop sections' })).toBeFocused();
  await expect(page.locator('.workspace')).toHaveAttribute('inert', '');
  const first = page.locator('.sidebar a.brand');
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.sidebar a').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
});