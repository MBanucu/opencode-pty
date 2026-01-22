import { test, expect } from '@playwright/test';

test.describe('App Component', () => {
  test('renders the PTY Sessions title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PTY Sessions')).toBeVisible();
  });

  test('shows connected status when WebSocket connects', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('● Connected')).toBeVisible();
  });

  test('shows no active sessions message when empty', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('No active sessions')).toBeVisible();
  });

  test('shows empty state when no session is selected', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Select a session from the sidebar to view its output')).toBeVisible();
  });
});