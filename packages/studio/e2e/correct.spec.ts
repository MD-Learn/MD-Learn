import { test, expect } from '@playwright/test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openFolder, resetProgress, testRoot } from './helpers'

const ANSWER = 'Toma varias entradas a la vez.'

test('an "explain" question in a note can be corrected by the local AI after checking', async ({ page }) => {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/doc?path=${encodeURIComponent('demo/apuntes.md')}`)
  const q = page.getByRole('region', { name: 'Explain' })
  await q.getByRole('textbox', { name: 'Your explanation' }).fill('Varias')
  await q.getByRole('button', { name: 'Check' }).click()
  await expect(q.getByRole('button', { name: 'Correct with AI' })).toBeDisabled() // one word is not enough to judge
  await q.getByRole('button', { name: 'Try again' }).click()
  await q.getByRole('textbox', { name: 'Your explanation' }).fill(ANSWER)
  await q.getByRole('button', { name: 'Check' }).click()
  await expect(q.getByText('Key ideas')).toBeVisible()
  await q.getByRole('button', { name: 'Correct with AI' }).click()
  const fb = q.getByRole('status', { name: 'AI correction' })
  await expect(fb).toContainText('1 of 2 key ideas')
  await expect(fb).toContainText('Toma varias entradas a la vez.') // the idea, with what you wrote as evidence
  await expect(fb).toContainText('Doubling the range divides the power by sixteen.') // the demo model's correction
  await expect(fb).toContainText('Why the fourth power and not the second?')
})

const NOTE = `---
id: correct-demo
lang: es
study: true
---

# Funciones

## Varias variables

Una función de varias variables toma varias entradas y devuelve un solo número.

:::explain
Explica con tus palabras qué hace una función de varias variables.
> - Toma varias entradas.
> - Devuelve un solo número.
:::
`

test('in Study, Claude can correct an explanation and its suggestion can be your rating', async ({ page }) => {
  resetProgress()
  const dir = join(testRoot(), 'correct-demo')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '01-funciones.md'), NOTE)
  try {
    const ws = await openFolder(page)
    await page.goto(`/w/${ws}/study?scope=correct-demo`)
    await page.getByRole('textbox', { name: 'Your explanation' }).fill(ANSWER, { timeout: 10_000 })
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.getByText('How did you do?')).toBeVisible()
    await page.getByRole('radio', { name: 'Claude' }).click()
    await page.getByRole('button', { name: 'Correct with AI' }).click()
    await expect(page.getByRole('status', { name: 'AI correction' })).toContainText('A good start (demo answer)')
    await page.getByRole('button', { name: 'Use this: “Partly”' }).click()
    await expect(page.getByText('How did you do?')).toHaveCount(0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
