import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, cpSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer, type Server } from 'node:http'
import { createApp } from '../server/app'
import { EventBus } from '../server/bus'
import { settingsStore } from '../server/settings'
import { Workspaces } from '../server/workspaces'
import type { Note } from '../shared/types'

const fixture = resolve(__dirname, '../../core/test/fixtures/curriculum')
const tmp = (p: string) => mkdtempSync(join(tmpdir(), p))
const KEY = 'sk-test-SECRET-9f8e7d6c5b4aWXYZ'
const TOKEN = 'x'.repeat(43)
const DOC = '00_FOUNDATIONS/04_radar.md'
const anchor = { section: '2', quote: { exact: 'radar equation', prefix: 'The ', suffix: ' tells' } }
// a section long enough for key ideas
const LONG = 'long.md', LONG_TEXT = `# Long\n\n## 1. Echoes\n\n${'The echo comes back weaker with distance, and the delay tells the range. '.repeat(12)}\n`

// a stand-in OpenAI-compatible service and a stand-in Ollama that also lists one of its cloud models
let provider: Server, ollama: Server, providerUrl = '', ollamaUrl = ''
let lastBody: { model?: string; messages?: { content: string }[] } = {}
beforeAll(async () => {
  provider = createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${KEY}`) { res.statusCode = 401; res.end(JSON.stringify({ error: { message: 'bad key' } })); return }
    if (req.url === '/v1/models') { res.end(JSON.stringify({ data: [{ id: 'small-model' }] })); return }
    let raw = ''
    req.on('data', (d) => (raw += d)).on('end', () => {
      lastBody = JSON.parse(raw)
      res.setHeader('content-type', 'text/event-stream')
      const content = lastBody.messages?.some((m) => m.content.includes('JSON')) ? '```json\n{"ideas":["Power falls as R^-4.","The delay gives the range."]}\n```' : 'Four, from the cloud.'
      res.end(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`)
    })
  }).listen(0)
  ollama = createServer((req, res) => {
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models: [{ name: 'qwen3:8b', size: 5e9 }, { name: 'gpt-oss:120b-cloud', remote_host: 'https://ollama.com:443' }] })); return }
    if (req.url === '/api/version') { res.end(JSON.stringify({ version: '0.12.0' })); return }
    let raw = ''
    req.on('data', (d) => (raw += d)).on('end', () => {
      const body = JSON.parse(raw) as { model: string }
      if (body.model.endsWith('-cloud')) { res.statusCode = 401; res.end(JSON.stringify({ error: 'unauthorized' })); return }
      res.end(JSON.stringify({ message: { content: 'From the local model.' }, done: true }) + '\n')
    })
  }).listen(0)
  await Promise.all([provider, ollama].map((s) => new Promise((r) => s.once('listening', r))))
  providerUrl = `http://127.0.0.1:${(provider.address() as { port: number }).port}/v1`
  ollamaUrl = `http://127.0.0.1:${(ollama.address() as { port: number }).port}`
})
afterAll(() => { provider.close(); ollama.close() })
afterEach(() => { delete process.env.MDLEARN_CLOUD_KEY })

function setup() {
  const root = tmp('mdl-cloud-'); cpSync(fixture, root, { recursive: true }); writeFileSync(join(root, LONG), LONG_TEXT)
  const cfgDir = tmp('mdl-cfg-')
  const settings = settingsStore(join(cfgDir, 's.json'))
  settings.update((s) => ({ ...s, ollama: { ...s.ollama, url: ollamaUrl, model: 'qwen3:8b' } }))
  const workspaces = new Workspaces(settings)
  const bus = new EventBus()
  const app = createApp({ version: 't', security: { port: 1, lan: true, lanFull: false, token: TOKEN }, settings, workspaces, bus, serverId: 't' })
  const h = workspaces.open(root)
  const headers = { host: 'localhost:1', 'content-type': 'application/json', 'x-mdl': '1' }
  // a phone on the network: another address, with the cookie the shared link gives
  const phone = { incoming: { socket: { remoteAddress: '192.168.1.20', remotePort: 5000, remoteFamily: 'IPv4' } } }
  const call = async (path: string, body?: unknown, from?: 'phone') => {
    const url = path.startsWith('/api/') ? path : `/api/w/${h.id}${path}`
    const init = { method: body === undefined ? 'GET' : 'POST', headers: { ...headers, ...(from ? { cookie: `mdl_t=${TOKEN}`, origin: 'http://localhost:1' } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }
    const r = await app.request(url, init, from ? phone : undefined)
    const text = await r.text()
    expect(text, `${path} shows the key`).not.toContain(KEY)
    return { status: r.status, json: JSON.parse(text) as Record<string, unknown> }
  }
  return { root, h, call, settings, bus, secretsFile: join(cfgDir, 'secrets.json') }
}
const configure = (call: ReturnType<typeof setup>['call']) => call('/api/ai/cloud', { provider: 'other', baseUrl: providerUrl, model: 'small-model', key: KEY })

describe('the cloud AI settings', () => {
  it('keep the key apart, readable by you only, and never send it back', async () => {
    const { call, secretsFile, settings } = setup()
    const before = await call('/api/ai/cloud')
    expect(before.json).toMatchObject({ hasKey: false, available: false, provider: null })
    expect((before.json.providers as { id: string }[]).map((p) => p.id)).toContain('openrouter')
    const r = await configure(call)
    expect(r.json).toMatchObject({ hasKey: true, keyEnd: 'WXYZ', available: true, model: 'small-model', name: expect.stringMatching(/^127\.0\.0\.1:\d+$/) })
    expect(JSON.parse(readFileSync(secretsFile, 'utf8')).cloudKey).toBe(KEY)
    if (process.platform !== 'win32') expect(statSync(secretsFile).mode & 0o777).toBe(0o600)
    expect(readFileSync(settings.file, 'utf8')).not.toContain(KEY)
    expect((await call('/api/engines')).json.cloud).toMatchObject({ available: true, model: 'small-model' })
    expect((await call('/api/ai/cloud', { clearKey: true })).json).toMatchObject({ hasKey: false, available: false })
    expect(JSON.parse(readFileSync(secretsFile, 'utf8')).cloudKey).toBeUndefined()
  })
  it('a preset fills its own address; another service forgets the model', async () => {
    const { call } = setup()
    await configure(call)
    const r = await call('/api/ai/cloud', { provider: 'openrouter' })
    expect(r.json).toMatchObject({ provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: null, name: 'OpenRouter' })
  })
  it('refuse an address that is not https, or that carries a password', async () => {
    const { call } = setup()
    expect((await call('/api/ai/cloud', { provider: 'other', baseUrl: 'http://example.org/v1' })).status).toBe(400)
    expect((await call('/api/ai/cloud', { provider: 'other', baseUrl: 'https://me:pw@example.org/v1' })).status).toBe(400)
    expect((await call('/api/ai/cloud', { provider: 'nope' })).status).toBe(400)
  })
  it('take the key from MDLEARN_CLOUD_KEY when it is set', async () => {
    const { call, secretsFile } = setup()
    process.env.MDLEARN_CLOUD_KEY = KEY
    const r = await call('/api/ai/cloud', { provider: 'other', baseUrl: providerUrl, model: 'small-model' })
    expect(r.json).toMatchObject({ hasKey: true, fromEnv: true, available: true })
    expect(existsSync(secretsFile)).toBe(false)
  })
  it('list the models and answer a test question', async () => {
    const { call } = setup()
    await configure(call)
    expect((await call('/api/ai/cloud/models', {})).json).toEqual({ models: ['small-model'] })
    expect((await call('/api/ai/cloud/test', {})).json).toMatchObject({ ok: true, reply: 'Four, from the cloud.' })
  })
  it('say what the service answered when the key is wrong, without the key', async () => {
    const { call } = setup()
    await call('/api/ai/cloud', { provider: 'other', baseUrl: providerUrl, model: 'small-model', key: 'sk-wrong-0000000000' })
    const r = await call('/api/ai/cloud/test', {})
    expect(r.status).toBe(400)
    expect((r.json.error as { message: string }).message).toMatch(/answered 401: bad key/)
  })
})

describe('short questions answered by the cloud AI', () => {
  it('a question about a passage streams into its note, labelled with the service and model', async () => {
    const { call, root } = setup()
    await configure(call)
    const r = await call('/ai/ask', { doc: DOC, anchor, question: 'Why R^4?', engine: 'cloud' })
    expect(r.status).toBe(200)
    const id = (r.json.note as Note).id
    await expect.poll(() => (JSON.parse(readFileSync(join(root, '.mdlearn/notes', `${DOC}.json`), 'utf8')).notes as Note[]).find((n) => n.id === id)?.thread.at(-1)?.done).toBe(true)
    const note = (JSON.parse(readFileSync(join(root, '.mdlearn/notes', `${DOC}.json`), 'utf8')).notes as Note[]).find((n) => n.id === id)!
    expect(note.thread.at(-1)).toMatchObject({ text: 'Four, from the cloud.', engine: expect.stringMatching(/· small-model$/) })
    expect(lastBody.model).toBe('small-model')
    expect(JSON.stringify(lastBody)).toContain('radar equation') // the passage goes to the service: the page says so
  })
  it('key ideas for a cheat sheet', async () => {
    const { call } = setup()
    await configure(call)
    expect((await call('/sheet/ideas', { path: LONG, engine: 'cloud' })).status).toBe(200)
    await expect.poll(async () => ((await call(`/sheet?path=${LONG}`)).json.ideas as { state: string }).state).toBe('done')
    const sheet = (await call(`/sheet?path=${LONG}`)).json as { sections: { ideas?: string[] }[] }
    expect(sheet.sections.flatMap((s) => s.ideas ?? [])).toEqual(['Power falls as R^-4.', 'The delay gives the range.'])
  })
  it('a cloud AI that is not set up says where to set it up', async () => {
    const { call } = setup()
    const r = await call('/ai/ask', { doc: DOC, anchor, engine: 'cloud' })
    expect(r.status).toBe(400)
    expect((r.json.error as { message: string }).message).toMatch(/Settings → Cloud AI/)
  })
})

describe('accounts stay on the computer running MDlearn', () => {
  it('a phone on the network cannot set up or use the cloud AI', async () => {
    const { call } = setup()
    await configure(call)
    expect((await call('/api/ai/cloud', undefined, 'phone')).status).toBe(403)
    expect((await call('/api/ai/cloud', { clearKey: true }, 'phone')).status).toBe(403)
    const ask = await call('/ai/ask', { doc: DOC, anchor, engine: 'cloud' }, 'phone')
    expect(ask.status).toBe(400)
    expect((ask.json.error as { code: string }).code).toBe('capability')
    expect((await call('/api/engines', undefined, 'phone')).json.cloud).toMatchObject({ available: false, model: null })
    // the local model still answers it
    expect((await call('/ai/ask', { doc: DOC, anchor, engine: 'local' }, 'phone')).status).toBe(200)
  })
  it('an Ollama cloud model is listed and can be chosen here, but not used from a phone', async () => {
    const { call } = setup()
    const info = await call('/api/ai/local')
    expect((info.json.models as { name: string; cloud?: boolean }[]).find((m) => m.name === 'gpt-oss:120b-cloud')).toMatchObject({ cloud: true })
    expect((await call('/api/ai/local/choose', { model: 'gpt-oss:120b-cloud' })).status).toBe(200)
    expect((await call('/api/engines')).json.local).toMatchObject({ available: true, cloud: true })
    expect((await call('/api/engines', undefined, 'phone')).json.local).toMatchObject({ available: false })
    expect((await call('/ai/ask', { doc: DOC, anchor, engine: 'local' }, 'phone')).json.error).toMatchObject({ code: 'capability' })
  })
  it('an Ollama cloud model without an Ollama sign-in says how to sign in', async () => {
    const { call } = setup()
    await call('/api/ai/local/choose', { model: 'gpt-oss:120b-cloud' })
    expect((await call('/sheet/ideas', { path: LONG, engine: 'local' })).status).toBe(200) // it starts, then the progress reports the failure
    await expect.poll(async () => ((await call(`/sheet?path=${LONG}`)).json.ideas as { error?: string }).error).toMatch(/ollama signin/)
  })
})
