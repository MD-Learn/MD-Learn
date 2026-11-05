// Local model through Ollama: streaming chat, JSON-shaped answers, availability. One request at a time
// (an 8 GB GPU does not run two well); questions asked while studying go first.
export interface OllamaConfig { url: string; model: string; embedModel?: string }
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
/** `models`: on this computer. `cloudModels`: Ollama's cloud models, which run on Ollama's servers under your Ollama account. */
export interface EngineStatus { available: boolean; models: string[]; cloudModels: string[]; model: string; cloud: boolean; error?: string }

export async function ollamaStatus(cfg: OllamaConfig): Promise<EngineStatus> {
  const none = { models: [], cloudModels: [], model: cfg.model, cloud: false }
  try {
    const r = await fetch(`${cfg.url}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (!r.ok) return { available: false, ...none, error: `Ollama answered ${r.status}.` }
    const body = await r.json() as { models?: { name: string; remote_host?: string }[] }
    const all = body.models ?? []
    const models = all.filter((m) => !m.remote_host).map((m) => m.name), cloudModels = all.filter((m) => m.remote_host).map((m) => m.name)
    const cloud = cloudModels.includes(cfg.model), has = cloud || models.includes(cfg.model)
    return { available: has, models, cloudModels, model: cfg.model, cloud, ...(has ? {} : { error: `Model ${cfg.model} is not installed. Download it in Settings → Local AI.` }) }
  } catch {
    return { available: false, ...none, error: 'Ollama is not running (start it with `ollama serve`).' }
  }
}

/** `cloud`: a model Ollama runs on its own servers (it takes no room here). */
export interface InstalledModel { name: string; size: number; family?: string; parameters?: string; quantization?: string; cloud?: boolean }
export async function ollamaModels(cfg: OllamaConfig): Promise<InstalledModel[]> {
  const r = await fetch(`${cfg.url}/api/tags`, { signal: AbortSignal.timeout(3000) })
  if (!r.ok) throw new Error(`Ollama answered ${r.status}.`)
  const body = await r.json() as { models?: { name: string; size?: number; remote_host?: string; details?: { family?: string; parameter_size?: string; quantization_level?: string } }[] }
  return (body.models ?? []).map((m) => ({ name: m.name, size: m.remote_host ? 0 : m.size ?? 0, family: m.details?.family, parameters: m.details?.parameter_size, quantization: m.details?.quantization_level, ...(m.remote_host ? { cloud: true } : {}) }))
}
/** Ollama's cloud models need its account on this computer. */
export const SIGN_IN = 'Sign in to Ollama first: run `ollama signin` in a terminal, then try again.'
const failed = async (res: Response) => (res.status === 401 ? new Error(SIGN_IN) : new Error(`Ollama answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`))

export async function ollamaVersion(cfg: OllamaConfig): Promise<string | null> {
  try {
    const r = await fetch(`${cfg.url}/api/version`, { signal: AbortSignal.timeout(1500) })
    return r.ok ? ((await r.json()) as { version?: string }).version ?? null : null
  } catch { return null }
}

export async function ollamaDelete(cfg: OllamaConfig, model: string): Promise<void> {
  const r = await fetch(`${cfg.url}/api/delete`, { method: 'DELETE', body: JSON.stringify({ model }), signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`Ollama answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
}

let queue: Promise<unknown> = Promise.resolve()
let waiting = 0
/** Run `fn` when the model is free. */
function inTurn<T>(fn: () => Promise<T>): Promise<T> {
  waiting++
  const run = queue.then(() => { waiting--; return fn() }, () => { waiting--; return fn() })
  queue = run.catch(() => {})
  return run
}
export const ollamaBusy = () => waiting

export interface ChatOptions { messages: ChatMessage[]; signal?: AbortSignal; onDelta?: (text: string) => void; format?: object; think?: boolean; temperature?: number; numCtx?: number }
/** Stream a chat completion; resolves with the whole text. Aborting stops generation in Ollama too. */
export function ollamaChat(cfg: OllamaConfig, o: ChatOptions): Promise<string> {
  return inTurn(async () => {
    const res = await fetch(`${cfg.url}/api/chat`, {
      method: 'POST', signal: o.signal,
      body: JSON.stringify({ model: cfg.model, messages: o.messages, stream: true, think: o.think ?? false, keep_alive: '15m',
        options: { num_ctx: o.numCtx ?? 8192, temperature: o.temperature ?? 0.3 }, ...(o.format ? { format: o.format } : {}) }),
    })
    if (!res.ok || !res.body) throw await failed(res)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', text = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        const msg = JSON.parse(line) as { message?: { content?: string }; error?: string; done?: boolean }
        if (msg.error) throw new Error(/unauthori[sz]ed/i.test(msg.error) ? SIGN_IN : msg.error)
        const piece = msg.message?.content ?? ''
        if (piece) { text += piece; o.onDelta?.(piece) }
      }
    }
    return text
  })
}

/** `embeddinggemma` is installed as `embeddinggemma:latest`. */
export const hasModel = (models: string[], name: string) => models.some((m) => m === name || m.startsWith(`${name}:`))

/** Meaning vectors for texts (one per input). Each call takes a turn, so a chat is never stuck behind a long indexing run. */
export function ollamaEmbed(cfg: OllamaConfig, model: string, inputs: string[], signal?: AbortSignal): Promise<number[][]> {
  return inTurn(async () => {
    const res = await fetch(`${cfg.url}/api/embed`, { method: 'POST', signal, body: JSON.stringify({ model, input: inputs, truncate: true, keep_alive: '10m' }) })
    if (!res.ok) throw new Error(`Ollama answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const body = await res.json() as { embeddings?: number[][] }
    if (!body.embeddings || body.embeddings.length !== inputs.length) throw new Error('Ollama returned no embeddings.')
    return body.embeddings
  })
}

export interface PullProgress { status: string; completed?: number; total?: number }
/** Download a model; `onProgress` gets the layer being downloaded. Resolves when Ollama says success. */
export async function ollamaPull(cfg: OllamaConfig, model: string, onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${cfg.url}/api/pull`, { method: 'POST', signal, body: JSON.stringify({ model, stream: true }) })
  if (!res.ok || !res.body) throw await failed(res)
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = '', ok = false
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
      if (!line) continue
      const msg = JSON.parse(line) as PullProgress & { error?: string }
      if (msg.error) throw new Error(/unauthori[sz]ed/i.test(msg.error) ? SIGN_IN : msg.error)
      if (msg.status === 'success') ok = true
      onProgress({ status: msg.status, completed: msg.completed, total: msg.total })
    }
  }
  if (!ok) throw new Error('The download ended before Ollama reported success.')
}
