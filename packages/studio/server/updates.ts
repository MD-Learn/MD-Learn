// "MDlearn X is out" for the npm install (mdlearn studio): the npm registry is asked at most once a day, for the
// version number only, and a failure is silent. Settings → About turns it off; the desktop app updates itself instead
// (it sets MDLEARN_DESKTOP), so there this does nothing.
import type { SettingsStore } from './settings.js'

export const REGISTRY = 'https://registry.npmjs.org/mdlearn/latest'
const DAY = 24 * 60 * 60_000, TIMEOUT_MS = 3000
export interface UpdateInfo { current: string; latest: string | null; newer: boolean; desktop: boolean; check: boolean }
export interface UpdateDeps { settings: SettingsStore; version: string; url?: string; fetch?: typeof fetch; now?: () => number }

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/
/** Whether `a` is a later version than `b` (a pre-release comes before its release). */
export function isNewer(a: string, b: string): boolean {
  const x = VERSION.exec(a), y = VERSION.exec(b)
  if (!x || !y) return false
  for (let i = 1; i <= 3; i++) { const d = Number(x[i]) - Number(y[i]); if (d) return d > 0 }
  if (!x[4] || !y[4]) return !x[4] && !!y[4]
  return x[4].localeCompare(y[4], 'en', { numeric: true }) > 0
}

const asking = new Map<string, Promise<void>>()
async function ask(d: UpdateDeps, now: number): Promise<void> {
  let latest: string | undefined
  try {
    const r = await (d.fetch ?? fetch)(d.url ?? REGISTRY, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const v = r.ok ? ((await r.json()) as { version?: unknown }).version : undefined
    if (typeof v === 'string' && VERSION.test(v)) latest = v
  } catch { /* offline: tomorrow, then */ }
  d.settings.update((s) => ({ ...s, updates: { ...s.updates, checkedAt: now, ...(latest ? { latest } : {}) } }))
}
export async function updateInfo(d: UpdateDeps): Promise<UpdateInfo> {
  const desktop = process.env.MDLEARN_DESKTOP === '1'
  const now = (d.now ?? Date.now)(), u = d.settings.get().updates
  if (!desktop && u.check && (u.checkedAt === undefined || now - u.checkedAt >= DAY)) {
    const key = d.settings.file
    if (!asking.has(key)) asking.set(key, ask(d, now).finally(() => asking.delete(key)))
    await asking.get(key)
  }
  const { latest, check } = d.settings.get().updates
  return { current: d.version, latest: latest ?? null, newer: !desktop && check && !!latest && isNewer(latest, d.version), desktop, check }
}
