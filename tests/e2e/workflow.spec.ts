import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
test('complete supplier workflow, exports and reload persistence', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your pricing, under control.' })).toBeVisible();
  await page.getByRole('button', { name: 'Try sample update' }).click();
  await expect(page.getByRole('heading', { name: 'Match your columns' })).toBeVisible();
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByRole('heading', { name: 'Review before you update' })).toBeVisible();
  await expect(page.getByText('New product', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve valid rows' }).click();
  await page.getByRole('button', { name: 'Apply approved changes' }).click();
  await expect(page.getByText('Changes applied. Your catalogue is up to date.')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download product CSV' }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toContain('.csv');
  const csv = await readFile((await downloaded.path())!, 'utf8');
  expect(csv).toContain('PP-100,USB-C hub,22.00,33.85');
  expect(csv).toContain('PP-500,Cable organizer,3.00,4.62');
  expect(csv).not.toContain('PP-300');
  await page.reload();
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await expect(page.getByText('Cable organizer')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('sample-update.csv')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});
test('invalid upload produces a useful error', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'New price update', exact: true }).first().click();
  await page.getByLabel('Supplier file').setInputFiles({
    name: 'broken.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,sku,cost\nA,B,10'),
  });
  await expect(page.getByRole('alert').filter({ hasText: /header/i })).toContainText(/header/i);
});
test('supplier creation, pricing rules and SKU aliases persist', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Suppliers', exact: true }).click();
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await page.getByLabel('Supplier name').fill('Test Supply');
  await page.getByLabel('Pricing method').selectOption('markup');
  await page.getByLabel('Pricing percentage').fill('40');
  await page.getByRole('button', { name: 'Save supplier' }).click();
  await expect(page.getByText('Test Supply', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Suppliers', exact: true }).click();
  await expect(page.getByText('Test Supply', { exact: true })).toBeVisible();
});
test('mobile layout stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your pricing, under control.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('unauthenticated account page redirects to sign-in', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
test('real Supabase account supports updates, reload, password change and sign-in', async ({
  page,
}) => {
  const email = `browser-${crypto.randomUUID()}@example.com`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: 'Load sample workspace' }).click();
  await expect(page.getByRole('button', { name: 'Try sample update' })).toBeVisible();
  await page.getByRole('button', { name: 'Try sample update' }).click();
  await page.getByRole('button', { name: 'Review changes' }).click();
  await page.getByRole('button', { name: 'Approve valid rows' }).click();
  await page.getByRole('button', { name: 'Apply approved changes' }).click();
  await expect(page.getByText('Changes applied. Your catalogue is up to date.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await expect(page.getByText('Cable organizer')).toBeVisible();
  await page.goto('/reset');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('NewBrowserTest123!');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  await page.getByRole('link', { name: 'Open workspace' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('NewBrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await expect(page.getByText('Cable organizer')).toBeVisible();
});
test('catalogue import and supplier aliases support recurring uploads', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await page.getByRole('button', { name: 'Import catalogue', exact: true }).click();
  await page.getByLabel('Supplier file').setInputFiles({
    name: 'catalogue.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,name,cost,selling_price\n001,Special part,12.00,20.00'),
  });
  await page.getByRole('button', { name: 'Import catalogue', exact: true }).click();
  await expect(page.getByText('Special part')).toBeVisible();
  await page.getByRole('button', { name: 'Suppliers', exact: true }).click();
  await page.getByRole('button', { name: 'Manage supplier' }).click();
  await page.getByRole('button', { name: 'Add alias', exact: true }).click();
  await page.getByLabel('Supplier SKU 1').fill('vendor-001');
  await page.getByLabel('Catalogue SKU 1').selectOption('001');
  await page.getByRole('button', { name: 'Save supplier' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'New price update', exact: true }).first().click();
  await page.getByLabel('Supplier file').setInputFiles({
    name: 'supplier.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,name,cost\nvendor-001,Special part,14.00'),
  });
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByText('Matched', { exact: true })).toBeVisible();
  await page.getByLabel('Approve 001', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply approved changes' }).click();
  await expect(page.getByText('Changes applied. Your catalogue is up to date.')).toBeVisible();
});
test('login failures and reset requests are recoverable', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('does-not-exist@example.com');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /invalid/i })).toContainText(/invalid/i);
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email address').fill('does-not-exist@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
});

test('a stale demo tab cannot overwrite a newer save', async ({ page, context }) => {
  await page.goto('/demo');
  const other = await context.newPage();
  await other.goto('/demo');
  for (const [tab, name] of [
    [page, 'First supplier'],
    [other, 'Second supplier'],
  ] as const) {
    await tab.getByRole('button', { name: 'Suppliers', exact: true }).click();
    await tab.getByRole('button', { name: 'Add supplier' }).click();
    await tab.getByLabel('Supplier name').fill(name);
    await tab.getByRole('button', { name: 'Save supplier' }).click();
    if (tab === page) await expect(tab.getByRole('dialog')).not.toBeVisible();
  }
  await expect(other.getByRole('dialog').getByRole('alert')).toContainText(/changed/i);
});

test('all main screens meet automated accessibility checks', async ({ page }) => {
  await page.goto('/demo');
  for (const name of ['Overview', 'Suppliers', 'Catalogue', 'History']) {
    await page.getByRole('button', { name, exact: true }).click();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await page.goto('/login');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});

test('password recovery email returns to the app and changes the password', async ({
  page,
  request,
}) => {
  const email = `recovery-${crypto.randomUUID()}@example.com`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('RecoveryStart123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  let messageId = '';
  await expect
    .poll(async () => {
      const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json();
      const mail = inbox.messages.find((m: { ID: string; To: { Address: string }[] }) =>
        m.To.some((to) => to.Address === email),
      );
      messageId = mail?.ID ?? '';
      return Boolean(messageId);
    })
    .toBe(true);
  const mail = await (
    await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)
  ).json();
  const link = String(mail.HTML || mail.Text)
    .match(/https?:\/\/[^\s<>"']+\/auth\/v1\/verify[^\s<>"']*/)?.[0]
    ?.replaceAll('&amp;', '&');
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('RecoveryChanged123!');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
});
