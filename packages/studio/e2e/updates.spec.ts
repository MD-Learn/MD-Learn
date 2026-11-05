import { test, expect } from '@playwright/test'
import { openFolder } from './helpers'

const H = { 'x-mdl': '1' }
// the check is off on the shared test server: this test turns it on (a stand-in registry answers 9.9.9), then off
test.afterEach(async ({ page }) => { await page.request.post('/api/updates', { headers: H, data: { check: false } }) })

test('a newer version on npm shows in Settings → About and once on the home page, until dismissed', async ({ page }) => {
  const ws = await openFolder(page)
  await page.goto(`/w/${ws}/settings#about`)
  const about = page.getByRole('region', { name: 'About' })
  await expect(about.getByText(/^MDlearn \d+\.\d+\.\d+$/)).toBeVisible()
  const look = about.getByRole('checkbox', { name: /Look for new versions/ })
  await expect(look).not.toBeChecked()
  await look.click()
  await expect(look).toBeChecked()
  await expect(about.getByText('MDlearn 9.9.9 is out')).toBeVisible()
  await expect(about.getByText('npm i -g mdlearn@latest')).toBeVisible()

  await page.goto('/')
  const notice = page.getByRole('status').filter({ hasText: 'MDlearn 9.9.9 is out' })
  await expect(notice).toBeVisible()
  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'MDlearn Studio' })).toBeVisible()
  await expect(page.getByText('MDlearn 9.9.9 is out')).toHaveCount(0)

  // turned off, it says nothing
  await page.goto(`/w/${ws}/settings#about`)
  await look.click()
  await expect(look).not.toBeChecked()
  await expect(about.getByText('MDlearn 9.9.9 is out')).toHaveCount(0)
})
