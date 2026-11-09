import { test, expect, type Page } from '@playwright/test'
import { openFolder, RADAR } from './helpers'

const px = (page: Page, selector: string, prop: 'fontSize' | 'fontFamily' | 'maxWidth') =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], prop)

test('the reading size zooms the whole note, the font changes, and both stay after a reload', async ({ page }) => {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent(RADAR)}`)
  await expect(page.locator('.read h2').first()).toBeVisible()
  const h2 = parseFloat(await px(page, '.read h2', 'fontSize')), tex = parseFloat(await px(page, '.read .katex', 'fontSize'))
  expect(await px(page, '.read', 'fontSize')).toBe('18px')

  await page.getByRole('button', { name: 'Font and text size' }).click()
  const menu = page.getByRole('dialog', { name: 'Font and text size' })
  for (let i = 0; i < 9; i++) await menu.getByRole('button', { name: 'Bigger text' }).click()
  await expect(menu.locator('output')).toHaveText('27px')
  expect(await px(page, '.read', 'fontSize')).toBe('27px')
  expect(parseFloat(await px(page, '.read h2', 'fontSize'))).toBeCloseTo(h2 * 1.5, 0) // headings and formulas grow with it
  expect(parseFloat(await px(page, '.read .katex', 'fontSize'))).toBeCloseTo(tex * 1.5, 0)
  await menu.getByRole('radio', { name: 'For dyslexia' }).click()
  expect(await px(page, '.read', 'fontFamily')).toContain('OpenDyslexic')

  await page.reload()
  await expect(page.locator('.read h2').first()).toBeVisible()
  expect(await px(page, '.read', 'fontSize')).toBe('27px')
  expect(await px(page, '.read', 'fontFamily')).toContain('OpenDyslexic')

  // Ctrl with + or − sizes the note, not the page
  await page.keyboard.press('Control+Equal')
  expect(await px(page, '.read', 'fontSize')).toBe('28px')
  await page.keyboard.press('Control+Equal')
  expect(await px(page, '.read', 'fontSize')).toBe('28px') // the largest
  await page.keyboard.press('Control+0')
  expect(await px(page, '.read', 'fontSize')).toBe('18px')
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1)
})

test('Settings shows the same choices, each font in its own face', async ({ page }) => {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/settings`)
  const fonts = page.getByRole('radiogroup', { name: 'Font' })
  await expect(fonts.getByRole('radio')).toHaveCount(6)
  await fonts.getByRole('radio', { name: 'Times New Roman' }).click()
  await expect(page.getByText('Times New Roman when this computer has it, or a font that looks the same.')).toBeVisible()
  expect(await fonts.getByRole('radio', { name: 'Easy to read' }).evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Atkinson Hyperlegible Next')
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent(RADAR)}`)
  expect(await px(page, '.read', 'fontFamily')).toContain('Times New Roman')
})

test('a large reading size still fits a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 })
  await page.addInitScript(() => localStorage.setItem('mdl-read-size', '28'))
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent(RADAR)}`)
  await expect(page.locator('.read h2').first()).toBeVisible()
  expect(await px(page, '.read', 'fontSize')).toBe('28px')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
