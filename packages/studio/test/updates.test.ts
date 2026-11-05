import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { settingsStore } from '../server/settings'
import { updateInfo, isNewer, REGISTRY } from '../server/updates'
import { createApp } from '../server/app'
import { EventBus } from '../server/bus'
import { Workspaces } from '../server/workspaces'

const DAY = 86_400_000
const store = () => settingsStore(join(mkdtempSync(join(tmpdir(), 'mdl-upd-')), 's.json'))
function registry(version: unknown = '1.9.1') {
  const asked: string[] = []
  const fetch = (async (url: string) => { asked.push(String(url)); return new Response(JSON.stringify({ name: 'mdlearn', version })) }) as unknown as typeof globalThis.fetch
  return { asked, fetch }
}
afterEach(() => { delete process.env.MDLEARN_DESKTOP })

describe('looking for a new version on npm', () => {
  it('asks the registry at most once a day and says when a newer version is out', async () => {
    const settings = store(), r = registry()
    let now = 1_000 * DAY
    const d = { settings, version: '1.9.0', fetch: r.fetch, now: () => now }
    expect(await updateInfo(d)).toEqual({ current: '1.9.0', latest: '1.9.1', newer: true, desktop: false, check: true })
    expect(r.asked).toEqual([REGISTRY])
    now += DAY - 1
    await updateInfo(d)
    expect(r.asked.length).toBe(1)
    now += 1
    await updateInfo(d)
    expect(r.asked.length).toBe(2)
  })
  it('is quiet when offline or answered nonsense, and tries again the next day', async () => {
    const settings = store()
    const down = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    expect(await updateInfo({ settings, version: '1.9.0', fetch: down })).toMatchObject({ latest: null, newer: false })
    const s2 = store()
    expect(await updateInfo({ settings: s2, version: '1.9.0', fetch: registry('<script>').fetch })).toMatchObject({ latest: null, newer: false })
  })
  it('does nothing when turned off, or inside the desktop app (which updates itself)', async () => {
    const settings = store(), r = registry()
    settings.update((s) => ({ ...s, updates: { ...s.updates, check: false } }))
    expect(await updateInfo({ settings, version: '1.9.0', fetch: r.fetch })).toMatchObject({ newer: false, check: false })
    process.env.MDLEARN_DESKTOP = '1'
    expect(await updateInfo({ settings: store(), version: '1.9.0', fetch: r.fetch })).toMatchObject({ newer: false, desktop: true })
    expect(r.asked).toEqual([])
  })
  it('compares versions as numbers', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true)
    expect(isNewer('1.9.0', '1.9.0')).toBe(false)
    expect(isNewer('1.9.0-beta.1', '1.9.0')).toBe(false)
  })
  it('GET /api/updates reports it; turning it off needs this computer', async () => {
    const settings = store(), r = registry('2.0.0')
    const workspaces = new Workspaces(settings)
    const app = createApp({ version: '1.9.0', security: { port: 1, lan: false, lanFull: false, token: 'x'.repeat(43) }, settings, workspaces, bus: new EventBus(), serverId: 't', updatesFetch: r.fetch })
    const h = { host: 'localhost:1', 'content-type': 'application/json', 'x-mdl': '1' }
    expect(await (await app.request('/api/updates', { headers: h })).json()).toMatchObject({ current: '1.9.0', latest: '2.0.0', newer: true })
    expect(await (await app.request('/api/updates', { method: 'POST', headers: h, body: JSON.stringify({ check: false }) })).json()).toMatchObject({ check: false, newer: false })
    expect(settings.get().updates.check).toBe(false)
  })
})
