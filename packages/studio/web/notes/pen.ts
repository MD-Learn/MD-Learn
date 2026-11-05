// The highlighter: the colour last used (H repeats it), and the pen mode where every selection made with a mouse or a
// pen is highlighted at once. Remembered on this device.
import { create } from 'zustand'
import type { HighlightColor } from '../../shared/types'
import { isHighlight } from './marks'

const KEY = 'mdl-highlighter'
interface Pen { on: boolean; color: HighlightColor; setOn(on: boolean): void; setColor(color: HighlightColor): void }
function saved(): { on: boolean; color: HighlightColor } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { on?: unknown; color?: unknown }
    return { on: v.on === true, color: isHighlight(v.color as string) ? (v.color as HighlightColor) : 'yellow' }
  } catch { return { on: false, color: 'yellow' } }
}
const keep = (p: { on: boolean; color: HighlightColor }) => { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* this visit only */ } }
export const usePen = create<Pen>((set, get) => ({
  ...saved(),
  setOn: (on) => { set({ on }); keep({ on, color: get().color }) },
  setColor: (color) => { set({ color }); keep({ on: get().on, color }) },
}))
