import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import console from 'node:console';
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.goto('http://127.0.0.1:3000/demo');
  await page.getByRole('heading', { name: 'Your pricing, under control.' }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/overview.png', fullPage: true });
  await page.getByRole('button', { name: 'Try sample update' }).click();
  await page.getByRole('button', { name: 'Review changes' }).click();
  await page.getByRole('heading', { name: 'Review before you update' }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/review.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:3000/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true });
  console.log('Saved overview, review, mobile and sign-in screenshots.');
} finally {
  await browser.close();
}
