import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openFolder, RADAR } from './helpers'

// the stand-in cloud AI in serve.mjs
const KEY = 'sk-e2e-cloud-0123456789abcd'
const cloudUrl = () => `http://127.0.0.1:${readFileSync(join(import.meta.dirname, '.cloud-port'), 'utf8').trim()}/v1`
const H = { 'x-mdl': '1' }
// the server is shared by every test: leave it as it was
test.afterEach(async ({ page }) => {
  await page.request.post('/api/ai/cloud', { headers: H, data: { clearKey: true } })
  await page.request.post('/api/ai/local/choose', { headers: H, data: { model: 'qwen3:8b' } })
})
async function setUp(page: Page) {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/settings#cloud-ai`)
  const section = page.getByRole('region', { name: 'Cloud AI' })
  await section.getByRole('combobox', { name: 'Service' }).selectOption('other')
  await section.getByRole('textbox', { name: 'Address' }).fill(cloudUrl())
  await section.getByLabel('Key').fill(KEY)
  await section.getByRole('combobox', { name: 'Model' }).fill('cloud-small')
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByText(/^Ready: 127\.0\.0\.1:\d+ · cloud-small$/)).toBeVisible()
  return { ws, section }
}

test('set up a cloud AI with a key: the key is never shown again, and a test question answers', async ({ page }) => {
  const { section } = await setUp(page)
  await expect(section.getByText('Saved, ending in abcd')).toBeVisible()
  await section.getByRole('button', { name: 'Load models' }).click()
  await expect(section.getByText('2 models: start typing to pick one.')).toBeVisible()
  await section.getByRole('button', { name: 'Try it' }).click()
  await expect(section.getByRole('status')).toContainText('From the cloud')
  await page.reload()
  expect(await page.content()).not.toContain(KEY)
  // a wrong key says what the service answered
  await section.getByRole('button', { name: 'Replace' }).click()
  await section.getByLabel('Key').fill('sk-wrong-000000000000')
  await section.getByRole('button', { name: 'Save' }).click()
  await section.getByRole('button', { name: 'Try it' }).click()
  await expect(section.getByRole('alert')).toContainText('answered 401: Invalid API key.')
})

test('Explain and Ask answer from the cloud AI once it is chosen, and say where the passages go', async ({ page }) => {
  const { ws } = await setUp(page)
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent(RADAR)}`)
  await page.getByRole('tab', { name: /Notes/ }).click()
  const pick = page.getByRole('radiogroup', { name: 'Answers from' })
  await pick.getByRole('radio', { name: /^127\.0\.0\.1:\d+$/ }).click()
  await expect(page.getByText(/answers\. The passages and titles it reads go to 127\.0\.0\.1:\d+, under your key\./)).toBeVisible()
  await page.locator('article .read p').first().waitFor()
  await page.evaluate(() => {
    const p = document.querySelector('article .read p')!
    const r = document.createRange(); r.selectNodeContents(p)
    const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r)
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await page.getByRole('toolbar', { name: 'Selected text' }).getByRole('button', { name: 'Explain' }).click()
  await expect(page.getByText('From the cloud: the passage, step by step.')).toBeVisible()
  await expect(page.getByText(/^127\.0\.0\.1:\d+ · cloud-small$/)).toBeVisible()

  // the choice is remembered: Ask the folder uses it too
  await page.goto(`/w/${ws}/ask`)
  await expect(page.getByRole('radiogroup', { name: 'Answers from' }).getByRole('radio', { name: /^127\.0\.0\.1:\d+$/ })).toBeChecked()
  await page.getByRole('textbox', { name: /question/i }).first().fill('What is backscatter?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.getByText('From the cloud: backscatter is the power returned')).toBeVisible()

  // and so does Correct with AI
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent('demo/apuntes.md')}`)
  const q = page.getByRole('region', { name: 'Explain' })
  await q.getByRole('textbox', { name: 'Your explanation' }).fill('Toma varias entradas a la vez.')
  await q.getByRole('button', { name: 'Check' }).click()
  await q.getByRole('button', { name: 'Correct with AI' }).click()
  await expect(q.getByRole('status', { name: 'AI correction' })).toContainText('What does the cloud say next?')
})

test('an Ollama cloud model is listed apart, and the page says it answers from Ollama\'s servers', async ({ page }) => {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/settings#local-ai`)
  const inUse = page.getByRole('radiogroup', { name: 'The model Studio answers with' })
  await expect(page.getByText(/Cloud models, through Ollama/)).toBeVisible()
  await inUse.getByRole('radio', { name: /gpt-oss:120b-cloud/ }).click()
  await expect(inUse.getByRole('radio', { name: /gpt-oss:120b-cloud/ })).toBeChecked()
  await page.goto(`/w/${ws}/ask`)
  await expect(page.getByText('An Ollama cloud model answers. The passages and titles it reads go to Ollama\'s servers, under your Ollama account.')).toBeVisible()
})
