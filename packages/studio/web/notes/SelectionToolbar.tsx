// Select text in a document → a highlight colour (one click, or keys 1–6, H for the last one), or Note · Card · Inbox ·
// Ask · Explain · Visualise, floating by the selection. With the highlighter on, a selection made with a mouse or a pen
// is highlighted at once. A phone's long-press selection fires no mouseup, so the toolbar also follows the selection.
import { useEffect, useRef, useState } from 'react'
import { ChartSpline, Inbox, Layers, MessageSquarePlus, Sparkles, StickyNote } from 'lucide-react'
import { HIGHLIGHTS, isHighlight } from './marks'
import { ColorRow } from './ColorRow'
import { usePen } from './pen'
import { anchorFromSelection } from '../lib/anchor'
import type { NoteAnchor, NoteColor } from '../../shared/types'
import { t } from '../i18n'

export type SelectionKind = 'note' | 'ask' | 'explain' | 'visual' | 'card' | 'inbox' | NoteColor
export interface SelectionAction { (kind: SelectionKind, anchor: NoteAnchor): void }
const HEIGHT = 74, SETTLE_MS = 400, MIN_CHARS = 2

export function SelectionToolbar({ root, onAction, canAsk }: { root: HTMLElement | null; onAction: SelectionAction; canAsk: boolean }) {
  const [at, setAt] = useState<{ x: number; top: number; bottom: number; anchor: NoteAnchor } | null>(null)
  const pen = usePen()
  const act = (k: SelectionKind, anchor: NoteAnchor) => { onAction(k, anchor); window.getSelection()?.removeAllRanges(); setAt(null) }
  const latest = useRef({ pen, act })
  latest.current = { pen, act }

  useEffect(() => {
    if (!root) return
    let dragging = false, touch = false, timer: number | undefined
    const read = () => { const r = anchorFromSelection(root); return r && r.anchor.quote.exact.length >= MIN_CHARS ? r : null }
    const show = () => {
      const r = read()
      if (!r) { setAt(null); return }
      const rect = r.range.getBoundingClientRect()
      setAt({ x: Math.min(Math.max(rect.left + rect.width / 2, 160), window.innerWidth - 160), top: rect.top, bottom: rect.bottom, anchor: r.anchor })
    }
    const onDown = (e: PointerEvent) => { touch = e.pointerType === 'touch'; dragging = !touch }
    // a drag that ends outside the text
    const onDragEnd = (e: PointerEvent) => { if (dragging && !root.contains(e.target as Node)) { dragging = false; setTimeout(show, 0) } }
    const onUp = () => {
      dragging = false
      if (touch) return // a touch selection settles first (below)
      setTimeout(() => {
        const { pen: p, act: a } = latest.current
        const r = p.on ? read() : null
        if (r) a(p.color, r.anchor); else show()
      }, 0)
    }
    const onKey = () => setTimeout(show, 0)
    const onChange = () => {
      const s = window.getSelection()
      clearTimeout(timer)
      if (!s || s.isCollapsed) { setAt(null); return }
      if (!dragging) timer = window.setTimeout(show, SETTLE_MS)
    }
    const hide = () => setAt(null)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('mouseup', onUp)
    document.addEventListener('pointerup', onDragEnd)
    root.addEventListener('keyup', onKey)
    document.addEventListener('selectionchange', onChange)
    const main = document.getElementById('main')
    main?.addEventListener('scroll', hide, { passive: true })
    return () => {
      clearTimeout(timer)
      root.removeEventListener('pointerdown', onDown); root.removeEventListener('mouseup', onUp); document.removeEventListener('pointerup', onDragEnd); root.removeEventListener('keyup', onKey)
      document.removeEventListener('selectionchange', onChange); main?.removeEventListener('scroll', hide)
    }
  }, [root])

  // with the toolbar open: 1–6 pick a colour, H repeats the last one
  useEffect(() => {
    if (!at) return
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return
      const n = HIGHLIGHTS[Number(e.key) - 1]
      const color = n ?? (e.key.toLowerCase() === 'h' ? usePen.getState().color : null)
      if (!color) return
      e.preventDefault()
      usePen.getState().setColor(color)
      act(color, at.anchor)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [at]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!at) return null
  const pick = (c: NoteColor) => { if (isHighlight(c)) pen.setColor(c); act(c, at.anchor) }
  const btn = 'flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium hover:bg-hover cursor-pointer'
  const label = (text: string) => <span className="max-[560px]:sr-only">{text}</span> // on a phone the second row is icons, or it would not fit
  const top = at.top - HEIGHT - 8 >= 8 ? at.top - HEIGHT - 8 : Math.min(at.bottom + 8, window.innerHeight - HEIGHT - 8)
  return (
    <div role="toolbar" aria-label={t('Selected text')} style={{ left: at.x, top }}
      className="fixed z-40 flex -translate-x-1/2 flex-col rounded-[8px] border border-border bg-raised p-0.5 shadow-pop"
      onMouseDown={(e) => e.preventDefault()}>
      <ColorRow current={undefined} onPick={pick} shortcuts />
      <div className="flex items-center border-t border-border pt-0.5">
        <button type="button" className={btn} onClick={() => act('note', at.anchor)}><StickyNote className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Note'))}</button>
        <button type="button" className={btn} onClick={() => act('card', at.anchor)}><Layers className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Card'))}</button>
        <button type="button" className={btn} onClick={() => act('inbox', at.anchor)}><Inbox className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Inbox'))}</button>
        {canAsk && <button type="button" className={btn} onClick={() => act('ask', at.anchor)}><MessageSquarePlus className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Ask'))}</button>}
        {canAsk && <button type="button" className={btn} onClick={() => act('explain', at.anchor)}><Sparkles className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Explain'))}</button>}
        {canAsk && <button type="button" className={btn} onClick={() => act('visual', at.anchor)}><ChartSpline className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{label(t('Visualise'))}</button>}
      </div>
    </div>
  )
}
