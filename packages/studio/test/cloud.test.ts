import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server, type IncomingMessage } from 'node:http'
import { checkBaseUrl, cloudChat, cloudModels, redact, PROVIDERS } from '../server/ai/cloud'

// a stand-in for an OpenAI-compatible provider
const KEY = 'sk-test-0123456789abcdefXYZ9'
let server: Server, base = ''
const seen: { path: string; auth?: string; body: Record<string, unknown> }[] = []
let mode: 'stream' | 'error' | 'picky' | 'midstream' | 'slow' = 'stream'
beforeAll(async () => {
  server = createServer((req: IncomingMessage, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d)).on('end', () => {
      const body = raw ? JSON.parse(raw) as Record<string, unknown> : {}
      seen.push({ path: req.url ?? '', auth: req.headers.authorization, body })
      if (req.url === '/v1/models') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'b-model' }, { id: 'a-model' }] })); return }
      if (mode === 'error') { res.statusCode = 401; res.end(JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}. You can find your key at https://example.org` } })); return }
      // a model that refuses optional settings
      if (mode === 'picky' && (body.temperature !== undefined || body.response_format)) { res.statusCode = 400; res.end(JSON.stringify({ error: { message: 'Unsupported parameter: temperature' } })); return }
      if (mode === 'slow') return // never answers
      res.setHeader('content-type', 'text/event-stream')
      const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
      if (mode === 'midstream') { res.write(chunk('Half')); res.end(`data: ${JSON.stringify({ error: { message: 'overloaded' } })}\n\n`); return }
      const all = chunk('One $R^2$ ') + ': keep-alive\n\n' + chunk('out, one back.') + 'data: [DONE]\n\n'
      // split in the middle of a line, as a network may
      res.write(all.slice(0, 37)); setTimeout(() => res.end(all.slice(37)), 10)
    })
  }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`
})
afterAll(() => { server.close() })
const target = () => ({ name: 'Test', baseUrl: base, model: 'a-model', key: KEY })

describe('an OpenAI-compatible provider', () => {
  it('streams an answer, read across split chunks, with the key only in the header', async () => {
    mode = 'stream'
    const pieces: string[] = []
    const text = await cloudChat(target(), { messages: [{ role: 'user', content: 'Why R^4?' }], onDelta: (p) => pieces.push(p), temperature: 0.2 })
    expect(text).toBe('One $R^2$ out, one back.')
    expect(pieces).toEqual(['One $R^2$ ', 'out, one back.'])
    const last = seen.at(-1)!
    expect(last.path).toBe('/v1/chat/completions')
    expect(last.auth).toBe(`Bearer ${KEY}`)
    expect(last.body).toMatchObject({ model: 'a-model', stream: true, temperature: 0.2 })
    expect(JSON.stringify(last.body)).not.toContain(KEY)
  })
  it('asks for JSON with the shape in the instructions', async () => {
    mode = 'stream'
    await cloudChat(target(), { messages: [{ role: 'system', content: 'Judge.' }, { role: 'user', content: 'x' }], format: { type: 'object', properties: { ok: { type: 'boolean' } } } })
    const body = seen.at(-1)!.body as { response_format: unknown; messages: { content: string }[] }
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0].content).toContain('"ok"')
  })
  it('tries again without optional settings a model refuses', async () => {
    mode = 'picky'
    const n = seen.length
    expect(await cloudChat(target(), { messages: [{ role: 'user', content: 'x' }], temperature: 0.1, format: { type: 'object' } })).toBe('One $R^2$ out, one back.')
    expect(seen.length - n).toBe(2)
    expect(seen.at(-1)!.body.temperature).toBeUndefined()
  })
  it('says what the provider answered, never the key', async () => {
    mode = 'error'
    const e = await cloudChat(target(), { messages: [{ role: 'user', content: 'x' }] }).catch((x: Error) => x)
    expect((e as Error).message).toMatch(/^Test answered 401: Incorrect API key provided/)
    expect((e as Error).message).not.toContain(KEY)
    expect((e as Error).message).not.toContain('0123456789')
  })
  it('stops on an error in the middle of the answer', async () => {
    mode = 'midstream'
    await expect(cloudChat(target(), { messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('overloaded')
  })
  it('gives up when the provider does not answer in time', async () => {
    mode = 'slow'
    await expect(cloudChat(target(), { messages: [{ role: 'user', content: 'x' }] }, 150)).rejects.toThrow(/did not answer in time/)
  })
  it('lists its models, sorted', async () => {
    expect(await cloudModels(target())).toEqual(['a-model', 'b-model'])
  })
})

describe('the provider address', () => {
  it('must be https, or http to this computer only', () => {
    expect(checkBaseUrl('https://openrouter.ai/api/v1/')).toBe('https://openrouter.ai/api/v1')
    expect(checkBaseUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(checkBaseUrl('http://localhost:8080/v1')).toBe('http://localhost:8080/v1')
    expect(checkBaseUrl('http://[::1]:8080/v1')).toBe('http://[::1]:8080/v1')
    for (const bad of ['http://example.org/v1', 'http://192.168.1.4/v1', 'ftp://x.org', 'https://user:pass@x.org/v1', 'not a url', 'https://x.org/v1?key=1', 'file:///etc/passwd'])
      expect(() => checkBaseUrl(bad), bad).toThrow()
  })
  it('every preset is https', () => {
    for (const p of PROVIDERS) if (p.baseUrl) expect(checkBaseUrl(p.baseUrl)).toBe(p.baseUrl)
  })
  it('keys are hidden in any text', () => {
    expect(redact(`bad key ${KEY} and sk-or-v1-abcdef0123456789abcdef`, KEY)).toBe('bad key •••• and ••••')
  })
})
