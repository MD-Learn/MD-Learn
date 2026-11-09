// Settings → Appearance → Reading, and the Aa menu in the reader: the font and size of what you read. Per device, like
// the theme; public/theme.js applies them before the first paint. The size scales the whole note (headings, formulas,
// code, tables and the column's width), so it is also the reader's zoom.
import { useEffect, useSyncExternalStore } from 'react'

export type ReadFont = 'serif' | 'times' | 'sans' | 'easy' | 'dyslexia' | 'mono'
export const READ_FONTS: ReadFont[] = ['serif', 'times', 'sans', 'easy', 'dyslexia', 'mono']
export const MIN_SIZE = 14, MAX_SIZE = 28, DEFAULT_SIZE = 18
/** Each font's own face, for showing the choice in it (the stacks are in app.css). */
export const FONT_FACE: Record<ReadFont, string> = {
  serif: 'var(--font-read)', times: 'var(--font-times)', sans: 'var(--font-ui)', easy: 'var(--font-easy)', dyslexia: 'var(--font-dyslexia)', mono: 'var(--font-mono)',
}
const FONT_KEY = 'mdl-read-font', SIZE_KEY = 'mdl-read-size'

export const clampSize = (n: number) => (Number.isFinite(n) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n))) : DEFAULT_SIZE)
export const fontOf = (value: string | null): ReadFont => (READ_FONTS.includes(value as ReadFont) ? (value as ReadFont) : 'serif')
/** One point bigger (1) or smaller (-1), or back to the default (0). */
export const nextSize = (size: number, step: -1 | 0 | 1) => (step === 0 ? DEFAULT_SIZE : clampSize(size + step))

export interface Reading { font: ReadFont; size: number }
const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
let current: Reading = { font: fontOf(read(FONT_KEY)), size: clampSize(Number(read(SIZE_KEY) ?? DEFAULT_SIZE)) }
const listeners = new Set<() => void>()

export function applyReading(next: Reading) {
  current = { font: fontOf(next.font), size: clampSize(next.size) }
  const root = document.documentElement
  if (current.font === 'serif') delete root.dataset.readFont
  else root.dataset.readFont = current.font
  root.style.setProperty('--read-size', `${current.size}px`)
  root.style.setProperty('--read-scale', String(current.size / DEFAULT_SIZE))
  try {
    if (current.font === 'serif') localStorage.removeItem(FONT_KEY)
    else localStorage.setItem(FONT_KEY, current.font)
    if (current.size === DEFAULT_SIZE) localStorage.removeItem(SIZE_KEY)
    else localStorage.setItem(SIZE_KEY, String(current.size))
  } catch { /* it still applies until the page reloads */ }
  for (const l of listeners) l()
}
/** The reading font and size, kept in step between Settings and the reader's Aa menu. */
export function useReading(): Reading {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => current)
}
/** Ctrl/Cmd with +, − or 0 on a reading page sizes the note instead of the whole page. */
export function useReadingKeys() {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const step = e.key === '+' || e.key === '=' ? 1 : e.key === '-' ? -1 : e.key === '0' ? 0 : null
      if (step === null) return
      e.preventDefault()
      applyReading({ ...current, size: nextSize(current.size, step) })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
}
