// A cloud AI with your own API key, for the app's short questions (Ask, Explain, Correct with AI, teach-back, key
// ideas, Visualise). Any OpenAI-compatible service: the presets below, or one you name (also LM Studio or llama.cpp on
// this computer). The key is sent only in the Authorization header to the address you chose, and is hidden from every
// message MDlearn shows or saves.
import { UserError } from '../workspaces.js'
import type { ChatMessage, ChatOptions } from './ollama.js'

export interface Provider { id: string; name: string; baseUrl: string; keys?: string }
export const PROVIDERS: Provider[] = [
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keys: 'https://openrouter.ai/keys' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keys: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keys: 'https://aistudio.google.com/apikey' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keys: 'https://console.groq.com/keys' },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', keys: 'https://console.mistral.ai/api-keys' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keys: 'https://platform.deepseek.com/api_keys' },
  { id: 'other', name: 'Other', baseUrl: '' },
]
export const providerOf = (id: string | undefined) => PROVIDERS.find((p) => p.id === id)

/** Where the questions go, and with which key. */
export interface CloudTarget { name: string; baseUrl: string; model: string; key: string }

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])
/** https anywhere, or http to this computer only; no key or password in the address. Returns it without a trailing slash. */
export function checkBaseUrl(raw: string): string {
  let u: URL
  try { u = new URL(raw.trim()) } catch { throw new UserError('invalid', 'That is not a web address.') }
  if (u.username || u.password) throw new UserError('invalid', 'Put the key in its own box, not in the address.')
  if (u.search || u.hash) throw new UserError('invalid', 'The address cannot have ? or # in it.')
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && LOOPBACK.has(u.hostname)))) throw new UserError('invalid', 'Use an https address (http only for a server on this computer).')
  return u.toString().replace(/\/+$/, '')
}

const KEYISH = /(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{20,})/g
/** Text without the key, or anything that looks like one. */
export function redact(text: string, key?: string): string {
  const out = key && key.length >= 8 ? text.split(key).join('••••') : text
  return out.replace(KEYISH, '••••')
}

const TIMEOUT_MS = 120_000
const headers = (key: string) => ({ authorization: `Bearer ${key}`, 'content-type': 'application/json' })
async function failure(t: CloudTarget, res: Response): Promise<Error> {
  const raw = await res.text().catch(() => '')
  let msg = raw.slice(0, 300)
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string }
    msg = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? msg
  } catch { /* not JSON */ }
  return new Error(redact(`${t.name} answered ${res.status}${msg ? `: ${msg}` : '.'}`, t.key))
}
/** A JSON answer: the shape goes into the instructions (not every service takes a schema). */
function withShape(messages: ChatMessage[], format: object): ChatMessage[] {
  const rule = `\n\nAnswer with one JSON object only, matching this JSON Schema:\n${JSON.stringify(format)}`
  return messages[0]?.role === 'system' ? [{ ...messages[0], content: messages[0].content + rule }, ...messages.slice(1)] : [{ role: 'system', content: rule.trim() }, ...messages]
}

/** Stream a chat completion; resolves with the whole text. A model that refuses temperature or JSON mode is asked again without them. */
export async function cloudChat(t: CloudTarget, o: ChatOptions, timeoutMs = TIMEOUT_MS): Promise<string> {
  const limit = AbortSignal.timeout(timeoutMs)
  const signal = o.signal ? AbortSignal.any([o.signal, limit]) : limit
  const messages = o.format ? withShape(o.messages, o.format) : o.messages
  const optional = { ...(o.temperature !== undefined ? { temperature: o.temperature } : {}), ...(o.format ? { response_format: { type: 'json_object' } } : {}) }
  const send = (extra: object) => fetch(`${t.baseUrl}/chat/completions`, { method: 'POST', signal, headers: { ...headers(t.key), accept: 'text/event-stream' }, body: JSON.stringify({ model: t.model, messages, stream: true, ...extra }) })
  try {
    let res = await send(optional)
    if ((res.status === 400 || res.status === 422) && Object.keys(optional).length) { await res.body?.cancel(); res = await send({}) }
    if (!res.ok || !res.body) throw await failure(t, res)
    return await read(t, res, o.onDelta)
  } catch (e) {
    if (limit.aborted && !o.signal?.aborted) throw new Error(`${t.name} did not answer in time.`)
    throw e
  }
}

async function read(t: CloudTarget, res: Response, onDelta?: (text: string) => void): Promise<string> {
  // some servers answer all at once even when asked to stream
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const j = await res.json() as { choices?: { message?: { content?: string } }[] }
    const text = j.choices?.[0]?.message?.content ?? ''
    if (text) onDelta?.(text)
    return text
  }
  const reader = res.body!.getReader(), dec = new TextDecoder()
  let buf = '', text = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue // blank lines and ": comments"
      const data = line.slice(5).trim()
      if (data === '[DONE]') return text
      const msg = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } | string }
      if (msg.error) throw new Error(redact(`${t.name}: ${typeof msg.error === 'string' ? msg.error : msg.error.message ?? 'error'}`, t.key))
      const piece = msg.choices?.[0]?.delta?.content
      if (piece) { text += piece; onDelta?.(piece) }
    }
  }
  return text
}

/** The models the service offers, by name. */
export async function cloudModels(t: Omit<CloudTarget, 'model'>): Promise<string[]> {
  try {
    const res = await fetch(`${t.baseUrl}/models`, { headers: headers(t.key), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw await failure({ ...t, model: '' }, res)
    const j = await res.json() as { data?: { id?: string }[] }
    return (j.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string').sort()
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new Error(`${t.name} did not answer in time.`)
    throw new Error(redact((e as Error).message, t.key))
  }
}
