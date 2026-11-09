// Who answers the app's short questions (Ask, Explain, Visualise, Correct with AI, teach-back, key ideas): the local
// model through Ollama, or a cloud AI with your own key. Both run on the account of the computer running MDlearn (an
// Ollama cloud model is your Ollama account), so a phone on the network may use them only under --lan-full.
import type { Capability } from '../../shared/types.js'
import type { SettingsStore } from '../settings.js'
import type { SecretsStore } from '../secrets.js'
import { UserError } from '../workspaces.js'
import { checkBaseUrl, cloudChat, providerOf, redact, type CloudTarget } from './cloud.js'
import { ollamaChat, ollamaStatus, type ChatOptions } from './ollama.js'

export type QuickEngine = 'local' | 'cloud'
export interface QuickChat { engine: QuickEngine; label: string; chat(o: ChatOptions): Promise<string> }
export interface LlmDeps { settings: SettingsStore; secrets: SecretsStore }
export const CLOUD_KEY_ENV = 'MDLEARN_CLOUD_KEY'

/** The key: from the environment if set there, else the one saved in Settings. */
export const cloudKey = (d: LlmDeps) => process.env[CLOUD_KEY_ENV]?.trim() || d.secrets.get('cloudKey')
/** The service's name as people know it; for one you named, its address. */
export function cloudName(provider: string | undefined, baseUrl: string | undefined): string {
  const p = providerOf(provider)
  if (p && p.id !== 'other') return p.name
  try { return new URL(baseUrl ?? '').host || 'Cloud AI' } catch { return 'Cloud AI' }
}
/** Where cloud questions go, or why they cannot. */
export function cloudTarget(d: LlmDeps, needModel = true): CloudTarget | string {
  const { provider, baseUrl, model } = d.settings.get().cloud
  const key = cloudKey(d)
  if (!provider || !baseUrl) return 'Set up a cloud AI in Settings → Cloud AI first.'
  if (!key) return 'Save the key for your cloud AI in Settings → Cloud AI.'
  if (needModel && !model) return 'Choose a model for your cloud AI in Settings → Cloud AI.'
  try { return { name: cloudName(provider, baseUrl), baseUrl: checkBaseUrl(baseUrl), model: model ?? '', key } } catch (e) { return (e as Error).message }
}
export function cloudStatus(d: LlmDeps): { available: boolean; provider: string | null; name: string | null; model: string | null; error?: string } {
  const { provider, baseUrl, model } = d.settings.get().cloud
  const t = cloudTarget(d)
  return { available: typeof t !== 'string', provider: provider ?? null, name: provider ? cloudName(provider, baseUrl) : null, model: model ?? null, ...(typeof t === 'string' ? { error: t } : {}) }
}

const ON_THIS_COMPUTER = 'This AI runs on the account of the computer running MDlearn, so only that computer can use it.'
/** A failure the person can read (never the key); a stop stays a stop. */
const readable = (chat: (o: ChatOptions) => Promise<string>, key?: string) => async (o: ChatOptions) => {
  try { return await chat(o) } catch (e) {
    if (o.signal?.aborted) throw e
    throw new UserError('engine', redact((e as Error).message, key))
  }
}
/** The engine to answer with, checked: it is set up, reachable as far as we can tell, and this device may use it. */
export async function quickChat(engine: QuickEngine, d: LlmDeps, caps: Capability[]): Promise<QuickChat> {
  if (engine === 'cloud') {
    if (!caps.includes('ai')) throw new UserError('capability', ON_THIS_COMPUTER)
    const t = cloudTarget(d)
    if (typeof t === 'string') throw new UserError('engine', t)
    return { engine, label: `${t.name} · ${t.model}`, chat: readable((o) => cloudChat(t, o), t.key) }
  }
  const cfg = d.settings.get().ollama
  const status = await ollamaStatus(cfg)
  if (!status.available) throw new UserError('engine', status.error ?? 'The local model is not available.')
  if (status.cloud && !caps.includes('ai')) throw new UserError('capability', ON_THIS_COMPUTER)
  return { engine, label: `${status.cloud ? 'Ollama cloud' : 'local'} · ${cfg.model}`, chat: readable((o) => ollamaChat(cfg, o)) }
}
