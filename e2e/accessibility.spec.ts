import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resetBrowserState } from './helpers'

async function expectNoSeriousAccessibilityViolations(page: Parameters<typeof AxeBuilder>[0]['page']) {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
  expect(blocking, blocking.map(({ id, help }) => `${id}: ${help}`).join('\n')).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page)
  await page.goto('/')
})

test('focus view has no serious automated accessibility violations', async ({ page }) => {
  await expectNoSeriousAccessibilityViolations(page)

  await page.getByRole('button', { name: 'Start Countdown' }).click()
  await expect(page.getByRole('button', { name: /^Pause Countdown:/ })).toBeVisible()
  await page.getByRole('button', { name: 'Split Timer' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page)
})

test('dashboard and open disclosures have no serious automated accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Dashboard' }).click()
  await page.getByRole('button', { name: 'Add timer' }).click()
  await page.getByRole('button', { name: 'Countdown', exact: true }).click()
  await page.getByRole('button', { name: 'Tile options' }).click()
  await expectNoSeriousAccessibilityViolations(page)
})
