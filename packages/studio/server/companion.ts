// The companion grows with what you do: finishing a note, answering its questions, explaining in your own words, a
// Study session. Points are decided only here (the browser never says how many), each thing counts once, and none
// are ever lost: no streaks, no decay, nothing for time spent in the app. With growth off nothing is counted. Kept
// in the settings, so it is the same companion in every folder.
import { createHash } from 'node:crypto'
import type { EventBus } from './bus.js'
import type { SettingsStore } from './settings.js'
import type { CompanionView, Grew, GrowthKind } from '../shared/types.js'

export const POINTS: Record<GrowthKind, number> = { read: 10, exercise: 2, explain: 5, session: 5 }
/** A Study session: its points plus one per card, at most this many in all. */
const MAX_SESSION = 30
/** What was already counted is remembered as short hashes, the most recent this many. */
export const MAX_COUNTED = 5000
const LOG = 20
/** A note shorter than this is not "a note read". */
export const MIN_READ_WORDS = 150
/** The level at which each of the five looks begins. */
const STAGE_FROM = [1, 3, 5, 8, 12]

/** Points needed in all to reach the level after `n`: 25, 75, 150, 250 … */
const need = (n: number) => (25 * n * (n + 1)) / 2
export function levelOf(points: number): { level: number; from: number; to: number } {
  let level = 1
  while (points >= need(level)) level++
  return { level, from: need(level - 1), to: need(level) }
}
export const stageOf = (level: number) => STAGE_FROM.filter((l) => level >= l).length
const hashed = (key: string) => createHash('sha256').update(key).digest('base64url').slice(0, 16)

export interface Growth { settings: SettingsStore; bus: EventBus }
export interface Deed { kind: GrowthKind; key: string; title: string; cards?: number }
/** Count a thing done, once: the points, a line in the log, and an event so the companion can say so. */
export function award(deps: Growth, ws: string, d: Deed): Grew | null {
  const c = deps.settings.get().companion
  const key = hashed(d.key)
  if (!c.growth || c.counted.includes(key)) return null
  const gained = d.kind === 'session' ? Math.min(MAX_SESSION, POINTS.session + Math.max(0, Math.floor(d.cards ?? 0))) : POINTS[d.kind]
  const points = c.points + gained, { level } = levelOf(points)
  deps.settings.update((s) => ({ ...s, companion: { ...s.companion, points,
    counted: [...s.companion.counted, key].slice(-MAX_COUNTED),
    log: [{ at: Date.now(), kind: d.kind, title: d.title, points: gained }, ...s.companion.log].slice(0, LOG) } }))
  const grew: Grew = { kind: d.kind, title: d.title, gained, points, level, levelUp: level > levelOf(c.points).level }
  deps.bus.publish({ type: 'companion.grew', ws, grew })
  return grew
}

export function companionView(settings: SettingsStore): CompanionView {
  const c = settings.get().companion, l = levelOf(c.points)
  return { growth: c.growth, points: c.points, ...l, stage: stageOf(l.level), log: c.log, ...(c.name ? { name: c.name } : {}) }
}
