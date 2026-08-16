import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { resetBrowserState } from './helpers'

test.describe.configure({ mode: 'serial' })

test('installed production app reloads while offline', async ({ context, page }) => {
  await resetBrowserState(page)
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Chronos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Countdown' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('a waiting production service worker exposes and dismisses the update prompt', async ({ page }) => {
  const serviceWorkerPath = new URL('../dist/sw.js', import.meta.url)
  const original = await readFile(serviceWorkerPath, 'utf8')

  await resetBrowserState(page)
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  try {
    await writeFile(serviceWorkerPath, `${original}\n// deterministic-e2e-update-${Date.now()}\n`)
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()
    })
    await expect(page.getByRole('status', { name: 'App update' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Later' }).click()
    await expect(page.getByRole('status', { name: 'App update' })).toBeHidden()
  } finally {
    await writeFile(serviceWorkerPath, original)
  }
})
