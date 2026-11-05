// Studio settings (~/.config/mdlearn/studio.json): recent folders, library location, AI engines.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'

const SettingsSchema = z.object({
  recents: z.array(z.object({ root: z.string(), lastOpened: z.number() })).default([]),
  libraryDir: z.string().default(join(homedir(), 'MDlearn', 'library')),
  ollama: z.object({ url: z.string().default('http://127.0.0.1:11434'), model: z.string().default('qwen3:8b'), embedModel: z.string().default('embeddinggemma') }).default({ url: 'http://127.0.0.1:11434', model: 'qwen3:8b', embedModel: 'embeddinggemma' }),
  claude: z.object({ path: z.string().optional(), model: z.string().default('sonnet') }).default({ model: 'sonnet' }),
  scinet: z.object({ url: z.string().default('http://127.0.0.1:8000') }).default({ url: 'http://127.0.0.1:8000' }),
  /** A cloud AI with your own key, for short questions (server/ai/cloud.ts). The key itself is in secrets.json. */
  cloud: z.object({ provider: z.string().max(40).optional(), baseUrl: z.string().max(500).optional(), model: z.string().max(200).optional() }).default({}),
  /** First-run help: the welcome tour is shown until it is finished or skipped once. */
  onboarding: z.object({ tourDone: z.boolean().default(false) }).default({ tourDone: false }),
  /** The companion's growth (companion.ts): points never lost, what was already counted (hashed), the last few things. */
  companion: z.object({
    growth: z.boolean().default(true),
    points: z.number().int().min(0).default(0),
    counted: z.array(z.string()).default([]),
    log: z.array(z.object({ at: z.number(), kind: z.enum(['read', 'exercise', 'explain', 'session']), title: z.string(), points: z.number() })).default([]),
    name: z.string().max(40).optional(),
    /** Per folder, the time up to which Study reviews have been counted, so none counts twice. */
    reviewed: z.record(z.string(), z.number()).default({}),
  }).default({ growth: true, points: 0, counted: [], log: [], reviewed: {} }),
})
export type Settings = z.infer<typeof SettingsSchema>
export const defaultSettingsFile = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'mdlearn', 'studio.json')

export interface SettingsStore { get(): Settings; update(fn: (s: Settings) => Settings): Settings; file: string }
export function settingsStore(file = defaultSettingsFile()): SettingsStore {
  let current: Settings = SettingsSchema.parse({})
  if (existsSync(file)) {
    try { current = SettingsSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) } catch { /* unreadable settings: start from defaults, keep the file until the next save */ }
  }
  return {
    file,
    get: () => current,
    update(fn) {
      const next = SettingsSchema.parse(fn(current))
      mkdirSync(dirname(file), { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(next, null, 2))
      renameSync(tmp, file)
      current = next
      return next
    },
  }
}
