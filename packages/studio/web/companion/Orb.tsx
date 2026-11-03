// Loaded only for someone who chose the orb. The library draws a static frame under reduced motion, and follows the theme.
// It wears the accent colour, and grows denser and bolder with each stage.
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import type { Activity } from './sprites'

const STATES: Record<Activity, OrbState> = { idle: 'breathing', reading: 'breathing', working: 'working', searching: 'searching', listening: 'listening', happy: 'shaping', asleep: 'breathing' }
const DOTS = [0.7, 0.85, 1, 1.2, 1.45], DOT_SIZE = [0.85, 0.95, 1, 1.1, 1.25]
export default function Orb({ activity, stage = 1, size = 20, color }: { activity: Activity; stage?: number; size?: 20 | 64; color?: string }) {
  const k = Math.min(DOTS.length, Math.max(1, stage)) - 1
  return <ThinkingOrb state={STATES[activity]} size={size} paused={activity === 'asleep'} dots={DOTS[k]} dotSize={DOT_SIZE[k]} aria-hidden
    {...(color && /^#(?:[0-9a-f]{3}){1,2}$/i.test(color) ? { color } : {})} />
}
