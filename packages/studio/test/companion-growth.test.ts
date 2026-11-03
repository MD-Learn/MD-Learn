import { describe, it, expect } from 'vitest'
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { parseDocument, type DocBlock } from '@mdlearn/core'
import { appendProgress } from '@mdlearn/core/node'
import { createApp } from '../server/app'
import { EventBus } from '../server/bus'
import { settingsStore } from '../server/settings'
import { Workspaces } from '../server/workspaces'
import { award, hashed, levelOf, stageOf, MAX_COUNTED } from '../server/companion'
import type { CompanionView, ServerEvent } from '../shared/types'

const fixture = resolve(__dirname, '../../core/test/fixtures/curriculum')
const tmp = (p: string) => mkdtempSync(join(tmpdir(), p))
const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i % 50}`).join(' ')
const NOTE = `# Funciones\n\n## Varias variables\n\n${words(200)}.\n\n:::quiz\n¿Cuántas salidas tiene?\n- [x] Una\n- [ ] Dos\n:::\n`
function setup() {
  const root = tmp('mdl-grow-'); cpSync(fixture, root, { recursive: true })
  writeFileSync(join(root, 'funciones.md'), NOTE)
  writeFileSync(join(root, 'corta.md'), '# Corta\n\nSolo unas palabras.\n')
  const settings = settingsStore(join(tmp('mdl-cfg-'), 's.json'))
  const workspaces = new Workspaces(settings)
  const bus = new EventBus()
  const events: ServerEvent[] = []
  bus.subscribe((e) => events.push(e.event))
  const app = createApp({ version: 't', security: { port: 1, lan: false, lanFull: false, token: 'x'.repeat(43) }, settings, workspaces, bus, serverId: 't' })
  const h = workspaces.open(root)
  const headers = { host: 'localhost:1', 'content-type': 'application/json', 'x-mdl': '1' }
  const post = async <T>(p: string, body: unknown) => (await app.request(p, { method: 'POST', body: JSON.stringify(body), headers })).json() as Promise<T>
  const get = async <T>(p: string) => (await app.request(p, { headers })).json() as Promise<T>
  return { settings, bus, events, h, post, get }
}
const grew = (events: ServerEvent[]) => events.filter((e): e is Extract<ServerEvent, { type: 'companion.grew' }> => e.type === 'companion.grew')

describe('levels', () => {
  it('needs 25, 75, 150, 250 … points in all for each next level, and changes look every few levels', () => {
    expect([0, 24, 25, 74, 75, 149, 150, 250].map((p) => levelOf(p).level)).toEqual([1, 1, 2, 2, 3, 3, 4, 5])
    expect(levelOf(30)).toMatchObject({ level: 2, from: 25, to: 75 })
    expect([1, 2, 3, 5, 8, 12, 40].map(stageOf)).toEqual([1, 1, 2, 3, 4, 5, 5])
  })
})

describe('growing', () => {
  it('counts each thing once, keeps a short log, and says when it grows a level', () => {
    const { settings, bus, events } = setup()
    const deps = { settings, bus }
    expect(award(deps, 'w', { kind: 'read', key: 'read:w:a.md', title: 'A' })).toMatchObject({ gained: 10, points: 10, level: 1 })
    expect(award(deps, 'w', { kind: 'read', key: 'read:w:a.md', title: 'A' })).toBeNull()
    expect(award(deps, 'w', { kind: 'read', key: 'read:w:b.md', title: 'B' })).toMatchObject({ points: 20 })
    expect(award(deps, 'w', { kind: 'session', key: 's:1', title: '', cards: 100 })).toMatchObject({ gained: 30, points: 50, level: 2, levelUp: true })
    expect(grew(events).map((e) => [e.grew.kind, e.grew.gained, e.grew.levelUp])).toEqual([['read', 10, false], ['read', 10, false], ['session', 30, true]])
    expect(settings.get().companion.log.map((l) => l.title)).toEqual(['', 'B', 'A'])
  })
  it('does nothing while growth is off', () => {
    const { settings, bus, events } = setup()
    settings.update((s) => ({ ...s, companion: { ...s.companion, growth: false } }))
    expect(award({ settings, bus }, 'w', { kind: 'read', key: 'read:w:a.md', title: 'A' })).toBeNull()
    expect(settings.get().companion.points).toBe(0)
    expect(grew(events)).toEqual([])
  })
  it('remembers only the most recent things it counted, and the last twenty in its log', () => {
    const { settings, bus } = setup()
    // as if it had already counted ex:0 … ex:4999 (each award writes the settings, so 5000 real ones are slow on CI)
    settings.update((s) => ({ ...s, companion: { ...s.companion, counted: Array.from({ length: MAX_COUNTED }, (_, i) => hashed(`ex:${i}`)) } }))
    for (let i = MAX_COUNTED; i < MAX_COUNTED + 25; i++) award({ settings, bus }, 'w', { kind: 'exercise', key: `ex:${i}`, title: `Q${i}` })
    const c = settings.get().companion
    expect(c.counted).toHaveLength(MAX_COUNTED)
    expect(c.log).toHaveLength(20)
    expect(c.points).toBe(2 * 25)
    expect(award({ settings, bus }, 'w', { kind: 'exercise', key: 'ex:30', title: '' })).toBeNull() // still remembered
    expect(award({ settings, bus }, 'w', { kind: 'exercise', key: 'ex:0', title: '' })).not.toBeNull() // the oldest 25 were let go
  })
})

describe('the companion API', () => {
  it('starts growing, can be named and turned off', async () => {
    const { post, get } = setup()
    expect(await get<CompanionView>('/api/companion')).toMatchObject({ growth: true, points: 0, level: 1, stage: 1, from: 0, to: 25, log: [] })
    expect(await post<CompanionView>('/api/companion', { name: 'Pip', growth: false })).toMatchObject({ name: 'Pip', growth: false })
    expect(await post<CompanionView>('/api/companion', { name: '' })).not.toHaveProperty('name')
  })
  it('counts a note read to the end once, but not a short note or a missing one', async () => {
    const { post, h } = setup()
    expect(await post(`/api/w/${h.id}/companion/read`, { doc: 'funciones.md' })).toMatchObject({ gained: 10, points: 10 })
    expect(await post(`/api/w/${h.id}/companion/read`, { doc: 'funciones.md' })).toMatchObject({ gained: 0, points: 10 })
    expect(await post(`/api/w/${h.id}/companion/read`, { doc: './x/../funciones.md' })).toMatchObject({ gained: 0, points: 10 }) // the same note
    expect(await post(`/api/w/${h.id}/companion/read`, { doc: 'corta.md' })).toMatchObject({ gained: 0 })
    expect(await post(`/api/w/${h.id}/companion/read`, { doc: 'nada.md' })).toMatchObject({ error: { code: 'not-found' } })
  })
  it('counts a question answered in a note once (right or wrong), but not "show answer"', async () => {
    const { post, h, events } = setup()
    const widgetId = (parseDocument(NOTE, { path: 'funciones.md' }).blocks.find((b) => (b as { type: string }).type === 'quiz') as DocBlock & { id: string }).id
    await post(`/api/w/${h.id}/doc/check`, { path: 'funciones.md', widgetId, answer: { type: 'skip' } })
    expect(grew(events)).toEqual([])
    await post(`/api/w/${h.id}/doc/check`, { path: 'funciones.md', widgetId, answer: { type: 'quiz', picked: [1] } })
    await post(`/api/w/${h.id}/doc/check`, { path: 'funciones.md', widgetId, answer: { type: 'quiz', picked: [0] } })
    expect(grew(events).map((e) => [e.grew.kind, e.grew.gained, e.grew.title])).toEqual([['exercise', 2, 'Funciones']])
  })
  it('counts a finished Study session from the reviews recorded here, each review in one session only', async () => {
    const { post, h } = setup()
    const start = Date.now() - 60_000, session = (at: number) => post(`/api/w/${h.id}/companion/session`, { session: String(at), cards: 25 })
    expect(await session(start)).toMatchObject({ gained: 0 }) // nothing reviewed: what the browser says doesn't count
    appendProgress(h.ws, { reviews: ['a/1', 'a/2', 'a/2', 'a/3', 'a/4'].map((key, i) => ({ id: randomUUID(), t: start + 1000 * (i + 1), key, rating: 3 as const })) })
    expect(await session(start)).toMatchObject({ gained: 9 }) // 5, and one for each of the 4 cards
    expect(await session(start)).toMatchObject({ gained: 0 }) // sent again
    expect(await session(start - 1)).toMatchObject({ gained: 0 }) // another session, the same reviews
    // a phone whose clock runs a few minutes ahead still gets its session
    appendProgress(h.ws, { reviews: [{ id: randomUUID(), t: Date.now(), key: 'a/5', rating: 3 }] })
    expect(await session(Date.now() + 5 * 60_000)).toMatchObject({ gained: 6 })
    expect(await post(`/api/w/${h.id}/companion/session`, { session: '../x' })).toMatchObject({ error: { code: expect.any(String) } })
  })
})
