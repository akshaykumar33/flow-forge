import { expect, test, type Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('img', { name: /Diagram canvas/ });
const nodes = (page: Page) => canvas(page).locator('[data-node-id]');

async function editSource(page: Page, text: string) {
  const editor = page.getByRole('textbox', { name: 'Mermaid source' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(nodes(page)).toHaveCount(7);
  // No uncaught errors while loading and laying out the first diagram.
  expect(errors).toEqual([]);
});

test('renders the starter diagram with outline and no problems', async ({ page }) => {
  await expect(
    page.getByRole('navigation', { name: 'Diagram outline' }).getByRole('button'),
  ).toHaveCount(7);
  await expect(page.getByRole('tab', { name: 'Problems (0)' })).toBeVisible();
});

test('clicking a node on the canvas shows it in the inspector', async ({ page }) => {
  await canvas(page).locator('[data-node-id="sql"]').click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector).toContainText('Azure SQL Database');
  await expect(inspector).toContainText('azure.sql-database');
  await expect(
    page.getByRole('button', { name: 'Azure SQL Database', pressed: true }),
  ).toBeVisible();
});

test('the outline selects nodes from the keyboard', async ({ page }) => {
  const item = page
    .getByRole('navigation', { name: 'Diagram outline' })
    .getByRole('button', { name: 'Key Vault' });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText('kv');
});

test('invalid source reports a located problem and keeps the last good diagram', async ({
  page,
}) => {
  await editSource(page, 'flowchart LR\n  A --> \n  B[[[\n');
  await expect(page.getByRole('tab', { name: 'Problems (1)' })).toBeVisible();
  await expect(nodes(page)).toHaveCount(7);
  await page.getByRole('tab', { name: 'Problems (1)' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('line 3');
  await page.getByRole('tabpanel').getByRole('button').first().click();
  await expect(page.getByRole('tab', { name: 'Source' })).toHaveAttribute('aria-selected', 'true');
});

test('editing the source updates the diagram', async ({ page }) => {
  await editSource(page, 'flowchart TB\n  a[Start] --> b[Finish]\n');
  await expect(nodes(page)).toHaveCount(2);
});

test('loading an example replaces the diagram', async ({ page }) => {
  await page.getByLabel('Example').selectOption('ci-cd');
  await expect(canvas(page).locator('[data-node-id="prod"]')).toBeVisible();
});

test('switching theme re-renders with that theme', async ({ page }) => {
  await page.getByLabel('Theme').selectOption('blueprint');
  await expect(canvas(page).locator('svg > rect').first()).toHaveAttribute('fill', '#123a6b');
});

test('exports SVG, Mermaid and JSON as downloads', async ({ page }) => {
  for (const [name, file] of [
    ['SVG', 'diagram.svg'],
    ['Mermaid', 'diagram.mmd'],
    ['JSON', 'diagram.json'],
  ] as const) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('group', { name: 'Export' }).getByRole('button', { name }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(file);
  }
});

test('hostile labels stay inert on the canvas', async ({ page }) => {
  let alerted = false;
  page.on('dialog', async (d) => {
    alerted = true;
    await d.dismiss();
  });
  await editSource(
    page,
    'flowchart LR\n  a["<img src=x onerror=alert(1)>"] --> b["#lt;script#gt;alert(2)#lt;/script#gt;"]\n',
  );
  await expect(nodes(page)).toHaveCount(2);
  await expect(canvas(page).locator('script, img, foreignObject')).toHaveCount(0);
  expect(alerted).toBe(false);
});

test.describe('suggestions and undo', () => {
  const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Example').selectOption('aws-serverless');
    await expect(canvas(page).locator('[data-node-id="gw"]')).toBeVisible();
    await canvas(page).locator('[data-node-id="gw"]').click();
  });

  test('an uncertain service is only a suggestion until applied', async ({ page }) => {
    const suggestions = inspector(page).getByRole('region', { name: 'Suggestions' });
    await expect(suggestions).toContainText('Amazon API Gateway');
    await expect(suggestions).toContainText('80%');
    await expect(inspector(page)).not.toContainText('aws.api-gateway');

    await suggestions.getByRole('button', { name: 'Apply Amazon API Gateway' }).click();
    await expect(inspector(page)).toContainText('aws.api-gateway');
    await expect(inspector(page)).toContainText('your choice');
    await expect(inspector(page).getByRole('region', { name: 'Suggestions' })).toHaveCount(0);
  });

  test('undo and redo move through decisions, by button and keyboard', async ({ page }) => {
    await inspector(page).getByRole('button', { name: 'Apply Amazon API Gateway' }).click();
    await expect(inspector(page)).toContainText('your choice');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(inspector(page)).not.toContainText('your choice');
    await expect(inspector(page)).toContainText('Amazon API Gateway');

    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(inspector(page)).toContainText('your choice');

    await canvas(page).click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await canvas(page).locator('[data-node-id="gw"]').click();
    await expect(inspector(page)).not.toContainText('your choice');
    await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
  });

  test('ignored suggestions stay gone after editing the source', async ({ page }) => {
    await inspector(page).getByRole('button', { name: 'Ignore Amazon API Gateway' }).click();
    await expect(inspector(page).getByRole('region', { name: 'Suggestions' })).toHaveCount(0);

    // An unrelated edit re-parses everything; the dismissed suggestion must not return.
    const editor = page.getByRole('textbox', { name: 'Mermaid source' });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('\n  extra[Extra]');
    await expect(canvas(page).locator('[data-node-id="extra"]')).toBeVisible();
    await canvas(page).locator('[data-node-id="gw"]').click();
    await expect(inspector(page).getByRole('region', { name: 'Suggestions' })).toHaveCount(0);
  });

  test('an accepted service survives source edits', async ({ page }) => {
    await inspector(page).getByRole('button', { name: 'Apply Amazon API Gateway' }).click();
    const editor = page.getByRole('textbox', { name: 'Mermaid source' });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('\n  extra[Extra]');
    await expect(canvas(page).locator('[data-node-id="extra"]')).toBeVisible();
    await canvas(page).locator('[data-node-id="gw"]').click();
    await expect(inspector(page)).toContainText('your choice');
  });
});
