import { expect, test } from '@playwright/test';

test('production login hydrates without importing server session secrets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Custos issuer control console' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign-In With Ethereum' }).click();
  await expect(page.getByText('No injected wallet found.')).toBeVisible();
  expect(errors).toEqual([]);
});
