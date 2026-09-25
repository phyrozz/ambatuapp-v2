import { test, expect } from '@playwright/test';
test('Discover renders with working images and no horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Life’s too short/ })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /Let’s play/ })).toBeVisible();
  await page.locator('.hero-photo img').evaluate((image: HTMLImageElement) => image.decode());
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/discover-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({ path: `test-results/viewport-${test.info().project.name}.png` });
});
test('Hero and navigation fit small phones, tablets, and desktop', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const fits = await page.locator('.hero').evaluate((hero) => {
      const edge = hero.getBoundingClientRect();
      return [...hero.querySelectorAll('.hero-line')].every((line) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return range.getBoundingClientRect().right <= edge.right - 8;
      });
    });
    expect(fits, `Headline should fit at ${width}px`).toBe(true);
  }
});
test('Sound search, playback, stop, favorites, and persistence', async ({ page }) => {
  await page.route(/\/sounds\/?(?:\?.*)?$/, async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ sounds: [{ id: 'yes_king', name: 'Yes King', file: new URL('/assets/sounds/yes_king.mp3', page.url()).toString(), category: 'Classics', color: 1 }] }),
  }));
  await page.goto('/soundboard/');
  await expect(page.locator('.sound-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search sounds' }).fill('yes king');
  await expect(page.locator('.sound-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Favorite Yes King', exact: true }).click();
  await page.getByRole('button', { name: 'Play Yes King', exact: true }).click();
  await expect(page.locator('.audio-dock')).toBeVisible();
  await page.locator('.audio-dock').getByRole('button', { name: 'Stop all' }).click();
  await expect(page.locator('.audio-dock')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.goto('/favorites/');
  await expect(page.locator('.sound-card')).toHaveCount(1);
  await expect(page.locator('.sound-card')).toContainText('Yes King');
  await page.reload();
  await expect(page.locator('.sound-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Unfavorite Yes King', exact: true }).click();
  await expect(page.getByText('Your favorites start here.')).toBeVisible();
});
test('Character search and statically exported profile routes', async ({ page }) => {
  await page.goto('/characters/');
  await expect(page.locator('.character-card')).toHaveCount(13);
  await page.getByRole('textbox', { name: 'Search characters' }).fill('dreamy');
  await page.locator('.character-card').click();
  await expect(page.getByRole('heading', { name: 'DreamybullXXX', exact: true })).toBeVisible();
  await expect(page.getByText('Community meme lore · fictional and satirical')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'DreamybullXXX', exact: true })).toBeVisible();
});
test('Tap game records a persistent score', async ({ page }) => {
  await page.goto('/games/ambatutap/');
  const tap = page.getByRole('button', { name: 'Tap Dreamy' });
  await tap.click();
  await page.waitForTimeout(60);
  await tap.click();
  await expect(page.locator('.big-score')).toHaveText('3');
  await page.reload();
  await expect(page.locator('.best-pill')).toContainText('3');
  await expect(page.locator('.big-score')).toHaveText('0');
});
test('Mines has a safe first move, flag controls, and three difficulties', async ({ page }) => {
  await page.goto('/games/ambatublou/');
  await expect(page.locator('.mine-cell')).toHaveCount(64);
  await page.locator('.mine-cell').first().click();
  await expect(page.locator('.mine-cell').first()).toHaveClass(/revealed/);
  await expect(page.locator('.mine-cell.exploded')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restart mines' }).click();
  await page.getByRole('button', { name: 'Flag mode', exact: true }).click();
  await page.locator('.mine-cell').first().click();
  await expect(page.locator('.mine-cell').first()).toHaveText('⚑');
  await page.getByRole('combobox', { name: 'Difficulty' }).selectOption('2');
  await expect(page.locator('.mine-cell')).toHaveCount(144);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Arcade games start, pause, resume, and finish', async ({ page }) => {
  for (const id of ['ambatusnake', 'flappy-bus']) {
    await page.goto(`/games/${id}/`);
    await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(page.locator('.game-overlay')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'On pause.' })).toBeVisible();
    await page
      .locator('.game-overlay')
      .getByRole('button', { name: 'Resume', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'That was a good run.' })).toBeVisible({
      timeout: 6000,
    });
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.locator('.game-overlay')).toHaveCount(0);
  }
});
test('Guest account and unconfigured feeds have honest usable fallbacks', async ({ page }) => {
  await page.goto('/profile/');
  await expect(page.getByText('Account sign-in hasn’t been connected yet.')).toBeVisible();
  await page.goto('/watch/');
  await expect(page.locator('.video-card')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Search YouTube' })).toBeVisible();
});
