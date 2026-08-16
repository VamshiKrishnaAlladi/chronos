import { expect, test } from '@playwright/test'
import {
  defaultPreferences,
  fourTileDashboard,
  resetBrowserState,
  seedStorage,
  singleCountdownDashboard,
  singleSplitDashboard,
  STORAGE_KEYS,
  threeTileDashboard,
  twoTileDashboard,
} from './helpers'

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 830, height: 908 },
  { width: 917, height: 768 },
  { width: 1024, height: 768 },
]

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, viewportWidth: number) {
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    widest: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return { selector: element.className || element.tagName, left: bounds.left, right: bounds.right, width: bounds.width }
      })
      .filter(({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5)
      .sort((a, b) => b.right - a.right)
      .slice(0, 3),
  }))
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(viewportWidth)
}

async function expectTileReadoutsContained(page: import('@playwright/test').Page) {
  const violations = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.tile-card'))
    .flatMap((card) => {
      const cardBounds = card.getBoundingClientRect()
      const cardStyles = getComputedStyle(card)
      const contentLeft = cardBounds.left + Number.parseFloat(cardStyles.paddingLeft)
      const contentRight = cardBounds.right - Number.parseFloat(cardStyles.paddingRight)
      return Array.from(card.querySelectorAll<HTMLElement>('.time-input-group, .tile-splits-list, .tile-pomo-label'))
        .map((element) => ({
          className: element.className,
          contentLeft,
          contentRight,
          ...(() => {
            const bounds = element.getBoundingClientRect()
            return { left: bounds.left, right: bounds.right }
          })(),
        }))
        .filter(({ contentLeft, contentRight, left, right }) => left < contentLeft - 1 || right > contentRight + 1)
    }))
  expect(violations, JSON.stringify(violations)).toEqual([])

  const precisionOverflows = await page.evaluate(() => Array.from(
    document.querySelectorAll<HTMLElement>('.split-readout .time-segment-ms'),
  )
    .map((element) => ({
      text: element.textContent,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    .filter(({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1))
  expect(precisionOverflows, JSON.stringify(precisionOverflows)).toEqual([])

  const fillRatios = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.tile-card'))
    .flatMap((card) => {
      const cardBounds = card.getBoundingClientRect()
      const cardStyles = getComputedStyle(card)
      const contentWidth = cardBounds.width
        - Number.parseFloat(cardStyles.paddingLeft)
        - Number.parseFloat(cardStyles.paddingRight)

      return Array.from(card.querySelectorAll<HTMLElement>(
        '.tile-readout-input:not(.tile-readout-input-sm) .time-input-group',
      )).map((readout) => ({
        className: readout.closest('.tile-readout-input')?.className,
        ratio: readout.getBoundingClientRect().width / contentWidth,
      }))
    }))

  const underfilled = fillRatios.filter(({ ratio }) => ratio < 0.68)
  const overfilled = fillRatios.filter(({ ratio }) => ratio > 0.94)
  expect(underfilled, JSON.stringify(fillRatios)).toEqual([])
  expect(overfilled, JSON.stringify(fillRatios)).toEqual([])
}

async function expectSplitsPanelPadding(page: import('@playwright/test').Page) {
  const padding = await page.locator('.tile-splits-list').evaluate((panel) => {
    const styles = getComputedStyle(panel)
    return {
      left: Number.parseFloat(styles.paddingLeft),
      right: Number.parseFloat(styles.paddingRight),
    }
  })
  expect(padding.left).toBeGreaterThanOrEqual(4)
  expect(padding.right).toBe(padding.left)
}

async function expectDashboardBelowHeader(page: import('@playwright/test').Page) {
  const spacing = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.dashboard-grid')
    const controls = document.querySelector<HTMLElement>('.corner-controls')
    const brand = document.querySelector<HTMLElement>('.brand-corner')
    if (!grid || !controls) return null

    const gridTop = grid.getBoundingClientRect().top
    const controlsBottom = controls.getBoundingClientRect().bottom
    const brandStyles = brand ? getComputedStyle(brand) : null
    const brandBottom = brand && brandStyles?.display !== 'none'
      ? brand.getBoundingClientRect().bottom
      : 0

    return { gridTop, headerBottom: Math.max(controlsBottom, brandBottom) }
  })

  expect(spacing).not.toBeNull()
  expect(spacing!.gridTop).toBeGreaterThanOrEqual(spacing!.headerBottom + 12)
}

async function expectDashboardHeaderItemsDoNotOverlap(page: import('@playwright/test').Page) {
  const collision = await page.evaluate(() => {
    const brand = document.querySelector<HTMLElement>('.brand-corner')
    const controls = document.querySelector<HTMLElement>('.corner-controls')
    if (!brand || !controls || getComputedStyle(brand).display === 'none') return null

    const brandBounds = brand.getBoundingClientRect()
    const controlsBounds = controls.getBoundingClientRect()
    const overlapWidth = Math.max(
      0,
      Math.min(brandBounds.right, controlsBounds.right) - Math.max(brandBounds.left, controlsBounds.left),
    )
    const overlapHeight = Math.max(
      0,
      Math.min(brandBounds.bottom, controlsBounds.bottom) - Math.max(brandBounds.top, controlsBounds.top),
    )

    return {
      overlapWidth,
      overlapHeight,
      brand: { left: brandBounds.left, right: brandBounds.right, top: brandBounds.top, bottom: brandBounds.bottom },
      controls: {
        left: controlsBounds.left,
        right: controlsBounds.right,
        top: controlsBounds.top,
        bottom: controlsBounds.bottom,
      },
    }
  })

  if (collision) {
    expect(collision.overlapWidth * collision.overlapHeight, JSON.stringify(collision)).toBe(0)
  }
}

async function expectSingleReadoutBreathingRoom(page: import('@playwright/test').Page) {
  const inset = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.tile-card')
    const readout = card?.querySelector<HTMLElement>('.time-input-group')
    if (!card || !readout) return null

    const cardBox = card.getBoundingClientRect()
    const readoutBox = readout.getBoundingClientRect()
    const cardStyles = getComputedStyle(card)
    const contentLeft = cardBox.left + Number.parseFloat(cardStyles.paddingLeft)
    const contentRight = cardBox.right - Number.parseFloat(cardStyles.paddingRight)

    return {
      left: readoutBox.left - contentLeft,
      right: contentRight - readoutBox.right,
    }
  })

  expect(inset).not.toBeNull()
  expect(inset!.left).toBeGreaterThanOrEqual(8)
  expect(inset!.right).toBeGreaterThanOrEqual(8)
  expect(Math.abs(inset!.left - inset!.right)).toBeLessThanOrEqual(1)
}

async function verifySingleTileLayout(
  page: import('@playwright/test').Page,
  dashboard: typeof singleCountdownDashboard | typeof singleSplitDashboard,
) {
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: {
      ...defaultPreferences,
      data: { ...defaultPreferences.data, appView: 'dashboard' },
    },
    [STORAGE_KEYS.dashboard]: dashboard,
  })

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 641, height: 900 },
    { width: 768, height: 900 },
    { width: 830, height: 908 },
    { width: 917, height: 768 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.locator('.tile-card')).toHaveCount(1)
    await expectNoHorizontalOverflow(page, viewport.width)
    await expectTileReadoutsContained(page)
    await expectSingleReadoutBreathingRoom(page)
    await expectDashboardBelowHeader(page)
  }
}

test('focus and dashboard layouts never overflow supported viewports', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the complete viewport matrix.')
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: defaultPreferences,
    [STORAGE_KEYS.dashboard]: fourTileDashboard,
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const focusButton = page.getByRole('button', { name: 'Focus' })
    if (await focusButton.getAttribute('aria-pressed') !== 'true') await focusButton.click()
    await expect(page.locator('main')).toBeVisible()
    await expectNoHorizontalOverflow(page, viewport.width)

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.locator('.tile-card')).toHaveCount(4)
    await expectNoHorizontalOverflow(page, viewport.width)
    await expectTileReadoutsContained(page)
    await expectDashboardBelowHeader(page)
  }
})

test('single countdown keeps balanced padding at every supported width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the complete viewport matrix.')
  await verifySingleTileLayout(page, singleCountdownDashboard)
})

test('single split timer keeps balanced padding at every supported width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the complete viewport matrix.')
  await verifySingleTileLayout(page, singleSplitDashboard)
})

test('three-tile dashboard clears the fixed header and keeps every readout balanced', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the compact desktop matrix.')
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: {
      ...defaultPreferences,
      data: { ...defaultPreferences.data, appView: 'dashboard' },
    },
    [STORAGE_KEYS.dashboard]: threeTileDashboard,
  })

  for (const viewport of [
    { width: 768, height: 900 },
    { width: 830, height: 908 },
    { width: 917, height: 768 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.locator('.tile-card')).toHaveCount(3)
    await expectNoHorizontalOverflow(page, viewport.width)
    await expectTileReadoutsContained(page)
    await expectDashboardBelowHeader(page)
  }
})

test('two-tile readouts and split rows stay inside symmetric card padding', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the compact desktop matrix.')
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: {
      ...defaultPreferences,
      data: { ...defaultPreferences.data, appView: 'dashboard' },
    },
    [STORAGE_KEYS.dashboard]: twoTileDashboard,
  })

  for (const viewport of [
    { width: 641, height: 900 },
    { width: 768, height: 900 },
    { width: 830, height: 908 },
    { width: 917, height: 768 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.locator('.tile-card')).toHaveCount(2)
    await expectNoHorizontalOverflow(page, viewport.width)
    await expectTileReadoutsContained(page)
  }

  const splitCard = page.locator('.tile-card').filter({
    has: page.getByRole('button', { name: 'Split Timer', exact: true }),
  })
  await expect(splitCard).toHaveCount(1)
  await splitCard.getByRole('button', { name: 'Start Timer' }).click()
  await splitCard.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(splitCard.locator('.splits-row')).toHaveCount(1)
  await expectTileReadoutsContained(page)
  await expectSplitsPanelPadding(page)
})

test('dashboard brand and controls never overlap around the compact-header breakpoint', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('chromium-mobile'), 'Desktop project exercises the compact-header matrix.')
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: {
      ...defaultPreferences,
      data: { ...defaultPreferences.data, appView: 'dashboard' },
    },
    [STORAGE_KEYS.dashboard]: twoTileDashboard,
  })

  for (const width of [640, 641, 662, 700, 720, 740, 741, 768, 830]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('.tile-card')).toHaveCount(2)
    await expectDashboardHeaderItemsDoNotOverlap(page)
    await expectDashboardBelowHeader(page)
    await expectNoHorizontalOverflow(page, width)
  }
})
