import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const origin = "http://127.0.0.1:4397";
const admin = {
  name: "Browser Facilitator",
  password: "browser-admin-fixture-password",
};
async function nav(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
}
async function snapshot(page: Page, name: string) {
  const directory = path.resolve("../.workshop/interactive-visuals");
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, name + ".png"),
    fullPage: true,
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
}

test("all guide content and four diagrams render on both viewports", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Azure Cost Optimizer Workshop", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Azure Cost Optimizer Workshop on GitHub" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/gitpavleenbali/azure-cost-optimizer-workshop",
  );
  await expect(page.locator(".prose").first()).toContainText(
    "git clone https://github.com/gitpavleenbali/azure-cost-optimizer-workshop.git",
  );
  await noOverflow(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await snapshot(page, "guide-" + info.project.name);
  await page.goto('/#step-1-prepare-the-workstation');
  await expect(
    page.getByRole("heading", { name: "Prepare The Workstation", exact: true }),
  ).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "prepare-workshop.ps1",
  );
  for (const section of [
    "architecture-1-solution-at-a-glance",
    "architecture-2-azure-cost-intelligence-platform-and-workloads",
    "architecture-3-azure-deployment-and-microsoft-foundry",
    "architecture-4-azure-cost-optimizer-data-flow",
  ]) {
    await page.goto("/#" + section);
    await expect(page.locator(".article-heading h1")).toBeVisible();
    if (
      section.startsWith("architecture-1") ||
      section.startsWith("architecture-4")
    ) {
      await expect(
        page.locator("[data-testid=mermaid-diagram] svg"),
      ).toBeVisible({ timeout: 30000 });
      expect(
        await page
          .locator("[data-testid=mermaid-diagram] svg")
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThan(100);
    } else {
      const image = page.locator(".prose img").first();
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
    }
    await noOverflow(page);
    await snapshot(page, section.slice(0, 14) + "-" + info.project.name);
  }
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await snapshot(page, "dark-" + info.project.name);
  await page.goto("/#meet-agent-aco");
  const images = page.locator(".prose img");
  expect(await images.count()).toBeGreaterThan(10);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("participant progress, screenshot review and kudos are real shared state", async ({
  page,
  browser,
  request,
}, info) => {
  const session = await request
    .get("/api/session")
    .then((response) => response.json());
  if (session.setupRequired)
    expect(
      (
        await request.post("/api/setup", { headers: { origin }, data: admin })
      ).status(),
    ).toBe(201);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Join workshop", exact: true })
    .click();
  const name = "Participant " + info.project.name;
  await page.getByLabel("Your name").fill(name);
  await page
    .getByLabel("Choose a passphrase")
    .fill("participant-browser-fixture-password");
  await page
    .getByLabel("Workshop invite code")
    .fill("browser-invite-code-fixture");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Join workshop", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto('/#step-1-prepare-the-workstation');
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Checkpoint saved");
  await page.reload();
  await expect(page.locator(".step-state")).toHaveText("Complete");
  await page.getByLabel('Private note to your facilitator').fill('Approval still pending; no cloud action taken.');
  await page.route('**/api/progress/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary save failure; retry safely.' }) }), { times: 1 });
  await page.getByRole('button', { name: 'Blocked', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary save failure');
  await expect(page.locator('.step-state')).toHaveText('Complete');
  await expect(page.getByLabel('Private note to your facilitator')).toHaveValue('Approval still pending; no cloud action taken.');
  await page.getByRole('button', { name: 'Blocked', exact: true }).click();
  await expect(page.locator('.step-state')).toHaveText('Blocked');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.locator('.step-state')).toHaveText('Complete');
  await page.goto("/#sprint-1-checkpoint");
  const task = page.getByRole("checkbox", {
    name: "Local sample works",
    exact: true,
  });
  await task.check();
  await expect(task).toBeChecked();
  await page.reload();
  await expect(task).toBeChecked();
  const identity = await page.request
    .get("/api/session")
    .then((response) => response.json());
  const guide = await page.request
    .get("/api/content")
    .then((response) => response.json());
  await nav(page);
  await page.getByRole("button", { name: "My evidence", exact: true }).click();
  const bytes = fs.readFileSync(path.resolve('../docs/assets/screenshots/aco-answer.png'));
  await page
    .getByLabel("Workshop screenshot")
    .setInputFiles({
      name: "sample-result.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await page
    .getByLabel("What did you accomplish?")
    .fill("Browser-tested local workshop result");
  await page
    .getByRole("checkbox", { name: "I have removed sensitive information" })
    .check();
  await page.getByRole("checkbox", { name: "Share my name" }).check();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.locator(".submission-current .badge")).toHaveText(
    "pending",
  );
  await expect(page.locator('.wall-eligibility')).toContainText('1/15 are complete');
  await snapshot(page, "submission-" + info.project.name);
  await expect(page).toHaveURL(/\/evidence$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your finish line' })).toBeVisible();
  await expect(page.locator('.submission-current .badge')).toHaveText('pending');
  const adminContext = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(origin + "/facilitator");
  await adminPage
    .getByRole("button", { name: "Sign in as facilitator" })
    .click();
  await adminPage.getByLabel("Your name").fill(admin.name);
  await adminPage
    .getByLabel("Passphrase", { exact: true })
    .fill(admin.password);
  await adminPage
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(
    adminPage.getByRole("heading", { name: "The room, at a glance" }),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "Show invite code" }).click();
  const inviteCode = adminPage.locator('code[aria-label="Workshop invite code"]');
  await expect(inviteCode).toHaveText(
    "browser-invite-code-fixture",
  );
  await adminPage.getByRole("button", { name: "Hide invite code" }).click();
  await expect(inviteCode).toHaveCount(0);
  await adminPage
    .getByRole("button", { name: "Review " + name, exact: true })
    .click();
  await expect(adminPage.getByText('only 1/15 steps are reported complete')).toBeVisible();
  await adminPage
    .getByLabel("Review note")
    .fill("Visible test evidence reviewed.");
  await adminPage.route('**/api/admin/submissions/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Review not saved. Try again.' }) }), { times: 1 });
  await adminPage.getByRole('button', { name: 'Approve screenshot', exact: true }).click();
  await expect(adminPage.getByRole('dialog').getByRole('alert')).toContainText('Review not saved');
  await expect(adminPage.getByRole('dialog').getByRole('alert')).toBeInViewport();
  await snapshot(adminPage, 'review-dialog-' + info.project.name);
  await noOverflow(adminPage);
  expect((await new AxeBuilder({ page: adminPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await adminPage
    .getByRole("button", { name: "Approve screenshot", exact: true })
    .click();
  await expect(adminPage.getByRole("dialog")).toHaveCount(0);
  await expect(adminPage.getByRole('status')).toContainText('kudos wall waits for 14 remaining steps (1/15)');
  await adminPage.locator('.main-scroll').evaluate(element => element.scrollTo({ top: 0, behavior: 'instant' }));
  if (info.project.name === 'mobile') {
    expect(await adminPage.locator('.roster').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
  }
  await snapshot(adminPage, "facilitator-" + info.project.name);
  expect((await new AxeBuilder({ page: adminPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await adminPage.goto(origin + '/kudos');
  await expect(adminPage.locator('.wall-card').filter({ hasText: name })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.wall-eligibility')).toContainText('Approved, but not on the kudos wall yet');
  await expect(page.locator('.wall-eligibility')).toContainText('1/15 complete');
  for (const section of guide.sections.filter(
    (item: { step: number | null }) => item.step,
  )) {
    expect(
      (
        await page.request.put("/api/progress/" + section.id, {
          headers: { origin, "x-csrf-token": identity.csrf },
          data: {
            status: "done",
            note: "Browser test evidence",
            revision: guide.revision,
          },
        })
      ).ok(),
    ).toBeTruthy();
  }
  await page.reload();
  await expect(page.locator('.wall-eligibility')).toContainText('Approved and ready for the kudos wall');
  const adminIdentity = await adminPage.request
    .get(origin + '/api/session')
    .then(response => response.json());
  expect((await adminPage.request.put(origin + '/api/admin/wall', {
    headers: { origin, 'x-csrf-token': adminIdentity.csrf },
    data: { released: false },
  })).ok()).toBeTruthy();
  await adminPage.reload();
  await expect(adminPage.getByRole('heading', { name: 'Kudos board closed' })).toBeVisible();
  await expect(adminPage.locator('.wall-card').filter({ hasText: name })).toBeVisible();
  adminPage.once('dialog', dialog => dialog.accept());
  await adminPage.getByRole('button', { name: 'Release board', exact: true }).click();
  await expect(adminPage.getByRole('heading', { name: 'Kudos board released' })).toBeVisible();
  const applause = adminPage.getByRole('button', { name: 'Kudos for ' + name, exact: true });
  await applause.click();
  await expect(applause).toHaveAttribute('aria-pressed', 'true');
  await expect(applause).toContainText('1');
  await applause.click();
  await expect(applause).toHaveAttribute('aria-pressed', 'false');
  await expect(applause).toContainText('0');
  await nav(page);
  await page
    .getByRole("button", { name: "Workshop kudos", exact: true })
    .click();
  await expect(
    page.locator(".wall-card").filter({ hasText: name }),
  ).toBeVisible();
  await snapshot(page, "wall-" + info.project.name);
  await expect(page).toHaveURL(/\/kudos$/);
  await page.reload();
  await expect(page.locator('.wall-card').filter({ hasText: name })).toBeVisible();
  const ownKudos = page.getByRole('button', { name: 'Kudos for ' + name, exact: true });
  await expect(ownKudos).toBeEnabled();
  await ownKudos.click();
  await expect(ownKudos).toHaveAttribute('aria-pressed', 'true');
  await noOverflow(page);
  await page.request.post('/api/logout', { headers: { origin, 'x-csrf-token': identity.csrf }, data: {} });
  await nav(page);
  await page.getByRole('button', { name: 'Continue workshop', exact: true }).click();
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
  await adminContext.close();
});
