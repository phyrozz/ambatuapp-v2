import { test, expect } from '@playwright/test';

const games = ['ambatutap', 'ambatusnake', 'ambatublou', 'flappy-bus'];

test('Every game fills the viewport and keeps its controls visible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const id of games) {
      await page.goto(`/games/${id}/`);
      await expect(page.locator('.game-session-toolbar')).toBeVisible();
      await expect(page.locator('.topbar, .sidebar, .mobile-nav')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Back to the arcade' })).toBeVisible();
      const fits = await page.locator('.game-session').evaluate((session) => {
        const rect = session.getBoundingClientRect();
        const stage = session.querySelector('.game-stage')!;
        return {
          fullscreen: rect.top === 0 && Math.abs(rect.height - innerHeight) < 1,
          noPageOverflow:
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
          noStageOverflow:
            stage.scrollHeight <= stage.clientHeight + 1 &&
            stage.scrollWidth <= stage.clientWidth + 1,
          controlsFit: [
            ...session.querySelectorAll(
              '.game-session-toolbar button, .game-controls, .tap-target, .canvas-wrap, .direction-pad, .mines-board, .game-result',
            ),
          ].every((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.top >= 0 &&
              bounds.bottom <= innerHeight &&
              bounds.left >= 0 &&
              bounds.right <= innerWidth
            );
          }),
        };
      });
      expect(fits, `${id} at ${viewport.width} × ${viewport.height}`).toEqual({
        fullscreen: true,
        noPageOverflow: true,
        noStageOverflow: true,
        controlsFit: true,
      });
      if (viewport.width === 390 || viewport.width === 844 || viewport.width === 1440) {
        await page.screenshot({ path: `test-results/game-${id}-${viewport.width}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});

test('Panels pause arcade play, trap focus, and keep the round intact', async ({ page }) => {
  await page.goto('/games/ambatusnake/');
  await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await page.getByRole('button', { name: 'Hall of fame', exact: true }).click();
  const board = page.getByRole('dialog', { name: 'Hall of fame' });
  await expect(board).toBeVisible();
  await expect(page.locator('.game-overlay')).toContainText('On pause.');
  await page.keyboard.press('p');
  await expect(page.locator('.game-overlay')).toContainText('On pause.');
  await page.keyboard.press('Tab');
  expect(await board.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: 'test-results/game-scoreboard.png' });
  await page.keyboard.press('Escape');
  await expect(board).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hall of fame', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Character', exact: true }).click();
  await page.screenshot({ path: 'test-results/game-characters.png' });
  await page.getByRole('button', { name: 'Kakangku', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.game-overlay')).toContainText('On pause.');
  await page.locator('.game-overlay').getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.game-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Invite friends' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.game-overlay')).toContainText('On pause.');
  expect(
    await page.evaluate(() => window.dispatchEvent(new Event('game-back', { cancelable: true }))),
  ).toBe(false);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to the arcade' }).click();
  await expect(page).toHaveURL(/\/games\/$/);
  await expect(page.locator('.topbar')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('Live score resets, best score persists, and character choice survives reload', async ({
  page,
}) => {
  await page.goto('/games/ambatutap/');
  await page.locator('.tap-target').click();
  await expect(page.locator('.game-session-score strong')).toHaveText('1');
  await page.getByRole('button', { name: 'New round' }).click();
  await expect(page.locator('.game-session-score strong')).toHaveText('0');
  await expect(page.locator('.best-pill')).toContainText('1');
  await page.getByRole('button', { name: 'Character', exact: true }).click();
  await page.getByRole('button', { name: 'Nissan', exact: true }).click();
  await expect(page.locator('.tap-target img')).toHaveAttribute('src', '/assets/nissan.jpg');
  await page.getByRole('button', { name: 'Mute game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute game', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.locator('.best-pill')).toContainText('1');
  await expect(page.locator('.tap-target img')).toHaveAttribute('src', '/assets/nissan.jpg');
});

test('Indonesian, dark mode, reduced motion, and hard mines fit a narrow phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem('ambatuapp-locale', 'id');
    localStorage.setItem('ambatuapp-theme', 'dark');
  });
  await page.goto('/games/ambatublou/');
  await expect(page.getByRole('link', { name: 'Kembali ke arkade' })).toBeVisible();
  await page.locator('.game-select-control .app-select-trigger').click();
  await page.getByRole('option').last().click();
  await expect(page.locator('.mine-cell')).toHaveCount(144);
  await page.locator('.mine-cell').first().click();
  await expect(page.locator('.game-session-score strong')).not.toHaveText('0');
  await page.getByRole('button', { name: 'Karakter', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/game-dark-indonesian.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-stage')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
