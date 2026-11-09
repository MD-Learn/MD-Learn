import { test, expect, type Page } from '@playwright/test'
import { openFolder } from './helpers'
import type { Note } from '../shared/types'

const TEXT = '# Highlights\n\nThe radar equation relates the received power to range.\n\nRange resolution depends on the bandwidth of the pulse.\n\nThe Doppler shift gives the radial speed of the target.\n'
const H = { 'x-mdl': '1' }

/** A fresh document of three paragraphs, open in the reader. */
async function openDoc(page: Page, name: string) {
  const ws = await openFolder(page)
  const path = `highlights/${name}-${Date.now()}.md`
  expect((await page.request.post(`/api/w/${ws}/files/create`, { headers: H, data: { path, text: TEXT } })).ok()).toBe(true)
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent(path)}`)
  await page.locator('article .read p').nth(2).waitFor()
  return { ws, path, notes: async () => (await (await page.request.get(`/api/w/${ws}/notes?path=${encodeURIComponent(path)}`)).json()) as Note[] }
}
/** Select paragraph `n` and let go of the mouse, as a reader would. */
const select = (page: Page, n: number) => page.evaluate((i) => {
  const p = document.querySelectorAll('article .read p')[i]
  const r = document.createRange(); r.selectNodeContents(p)
  const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r)
  p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}, n)
const drawn = (page: Page, color: string) => page.evaluate((c) => (CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get(`mdl-mark-${c}`)?.size ?? 0, color)
/** The middle of the first highlighted passage of a colour, to click on. */
const middleOf = (page: Page, color: string) => page.evaluate((c) => {
  const [range] = [...(CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get(`mdl-mark-${c}`)!]
  const r = range.getClientRects()[0]
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, color)

test('one click on a colour highlights the passage, beside the file, and it stays after a reload', async ({ page }) => {
  const doc = await openDoc(page, 'click')
  await select(page, 0)
  await page.getByRole('toolbar', { name: 'Selected text' }).getByRole('button', { name: 'Green', exact: true }).click()
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toHaveCount(0)
  await expect.poll(() => drawn(page, 'green')).toBe(1)
  expect((await doc.notes()).map((n) => [n.body, n.color])).toEqual([['', 'green']])
  await page.reload()
  await page.locator('article .read p').first().waitFor()
  await expect.poll(() => drawn(page, 'green')).toBe(1)
})

test('with the toolbar open, keys 1 to 6 pick a colour and H repeats the last one', async ({ page }) => {
  const doc = await openDoc(page, 'keys')
  await select(page, 0)
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible()
  await page.keyboard.press('3')
  await expect.poll(() => drawn(page, 'blue')).toBe(1)
  await select(page, 1)
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible()
  await page.keyboard.press('h')
  await expect.poll(() => drawn(page, 'blue')).toBe(2)
  expect((await doc.notes()).map((n) => n.color)).toEqual(['blue', 'blue'])
})

test('the highlighter highlights every selection at once, until it is turned off', async ({ page }) => {
  const doc = await openDoc(page, 'pen')
  await page.getByRole('button', { name: 'Highlighter' }).click()
  await page.getByRole('group', { name: 'Highlight colour' }).getByRole('button', { name: 'Orange' }).click()
  await select(page, 0)
  await expect.poll(() => drawn(page, 'orange')).toBe(1)
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toHaveCount(0)
  await page.keyboard.press('Escape') // off
  await expect(page.getByRole('button', { name: 'Highlighter' })).toHaveAttribute('aria-pressed', 'false')
  await select(page, 1)
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible()
  expect((await doc.notes()).map((n) => n.color)).toEqual(['orange'])
})

test('click a highlight to change its colour or remove it; a note on it is kept', async ({ page }) => {
  const doc = await openDoc(page, 'menu')
  await select(page, 0)
  await page.getByRole('toolbar', { name: 'Selected text' }).getByRole('button', { name: 'Yellow', exact: true }).click()
  await expect.poll(() => drawn(page, 'yellow')).toBe(1)

  let at = await middleOf(page, 'yellow')
  await page.mouse.click(at.x, at.y)
  const menu = page.getByRole('dialog', { name: 'Highlight' })
  await menu.getByRole('button', { name: 'Pink', exact: true }).click()
  await expect.poll(() => drawn(page, 'pink')).toBe(1)
  expect(await drawn(page, 'yellow')).toBe(0)

  at = await middleOf(page, 'pink')
  await page.mouse.click(at.x, at.y)
  await menu.getByRole('button', { name: 'Add a note' }).click()
  await page.getByRole('textbox', { name: 'Note text' }).fill('Power falls with R to the fourth.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Power falls with R to the fourth.')).toBeVisible()

  at = await middleOf(page, 'pink')
  await page.mouse.click(at.x, at.y)
  await menu.getByRole('button', { name: 'Remove highlight' }).click()
  await expect.poll(() => drawn(page, 'pink')).toBe(0)
  expect((await doc.notes()).map((n) => [n.body, n.color])).toEqual([['Power falls with R to the fourth.', undefined]])
})

test('the notes panel shows one colour at a time', async ({ page }) => {
  const doc = await openDoc(page, 'filter')
  for (const [n, color] of [[0, 'Green'], [1, 'Purple']] as const) {
    await select(page, n)
    await page.getByRole('toolbar', { name: 'Selected text' }).getByRole('button', { name: color, exact: true }).click()
    await expect.poll(async () => (await doc.notes()).length).toBe(n + 1)
  }
  await page.getByRole('tab', { name: /Notes/ }).click()
  const cards = page.getByRole('article', { name: 'Note' })
  await expect(cards).toHaveCount(2)
  await page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: 'Purple' }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.getByText('Purple')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name: 'All' }).click()
  await expect(cards).toHaveCount(2)
})

test('with colour in notes off, every highlight colour is the same grey', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mdl-colour', 'off'))
  await openDoc(page, 'grey')
  const vars = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--hl-green', '--hl-pink', '--subtle'].map((v) => s.getPropertyValue(v).trim()) })
  expect(new Set(vars).size).toBe(1)
})
