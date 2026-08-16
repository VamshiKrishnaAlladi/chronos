import { expect, test } from '@playwright/test'
import { resetBrowserState, STORAGE_KEYS } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page)
  await page.goto('/')
})

test('starts, pauses, restores, and stops a focus countdown', async ({ page }) => {
  await page.getByLabel('HH:MM:SS seconds').fill('12')
  await page.getByRole('button', { name: 'Start Countdown' }).click()
  await expect(page.getByRole('button', { name: /^Pause Countdown:/ })).toBeVisible()

  const persistedEndsAt = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}')
    return stored.sessions?.['focus:countdown']?.state?.endsAt
  }, STORAGE_KEYS.runtime)
  expect(persistedEndsAt).toEqual(expect.any(Number))
  expect(persistedEndsAt).toBeGreaterThan(Date.now())

  await page.getByRole('button', { name: /^Pause Countdown:/ }).press('Space')
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Resume Countdown:/ }).press('Enter')
  await expect(page.getByRole('button', { name: /^Pause Countdown:/ })).toBeVisible()

  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Start Countdown' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.runtime)).toBeNull()
})

test('restores a running stopwatch from its absolute start timestamp', async ({ page }) => {
  await page.getByRole('button', { name: 'Split Timer' }).click()
  await page.getByRole('button', { name: 'Start Split Timer' }).click()
  await page.waitForTimeout(1_100)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.reload()

  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  const elapsed = await page.getByRole('timer', { name: /Split timer:/ }).textContent()
  expect(elapsed).not.toBe('00:00:00.00')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(page.locator('.splits-row')).toHaveCount(1)
})

test('traps focus in confirmations and restores it when Escape cancels', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Countdown' }).click()
  await expect(page.getByRole('button', { name: /^Pause Countdown:/ })).toBeVisible()
  const splitTimerButton = page.getByRole('button', { name: 'Split Timer' })
  await splitTimerButton.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Switch' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(splitTimerButton).toBeFocused()
  await expect(page.getByRole('button', { name: /^Pause Countdown:/ })).toBeVisible()
})

test('supports dashboard disclosure, rename, kind switch, and removal', async ({ page }) => {
  await page.getByRole('button', { name: 'Dashboard' }).click()
  const addButton = page.getByRole('button', { name: 'Add timer' })
  await addButton.click()
  await expect(addButton).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Countdown', exact: true }).click()

  await page.getByRole('button', { name: 'Countdown', exact: true }).click()
  const nameInput = page.getByRole('textbox', { name: 'Tile name' })
  await nameInput.fill('Tea timer')
  await nameInput.press('Enter')
  await expect(page.getByRole('button', { name: 'Tea timer' })).toBeVisible()

  const options = page.getByRole('button', { name: 'Tile options' })
  await options.click()
  await page.getByRole('button', { name: 'Switch to Split Timer' }).click()
  await expect(page.getByRole('button', { name: 'Start Timer' })).toBeVisible()

  await options.click()
  await page.keyboard.press('Escape')
  await expect(options).toBeFocused()
  await expect(options).toHaveAttribute('aria-expanded', 'false')
  await options.click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Add your first timer')).toBeVisible()
})

test('switches immediately from an idle dashboard back to focus view', async ({ page }) => {
  await page.getByRole('button', { name: 'Dashboard' }).click()
  await expect(page.getByText('Add your first timer')).toBeVisible()

  await page.getByRole('button', { name: 'Focus' }).click()

  await expect(page.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Start Countdown' })).toBeVisible()
})
