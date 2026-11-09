// Click a highlight → change its colour, write a note on it, or remove it. Nothing is added to the document: the click
// is matched against the highlighted passages' rectangles (useNoteHighlights).
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StickyNote, Trash2 } from 'lucide-react'
import { keys, notesApi } from '../api/queries'
import { useUi } from '../state/ui'
import { ColorRow } from './ColorRow'
import { isHighlight } from './marks'
import { usePen } from './pen'
import { useNotesUi } from './store'
import type { NoteAt } from './NotesPanel'
import type { Note, NoteColor } from '../../shared/types'
import { t } from '../i18n'

const WIDTH = 300, INTERACTIVE = 'a, button, input, textarea, select, summary, label, [role="button"], [contenteditable="true"]'

export function HighlightMenu({ ws, doc, article, noteAt }: { ws: string; doc: string; article: HTMLElement | null; noteAt: NoteAt }) {
  const [open, setOpen] = useState<{ note: Note; x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const { setPanelTab, notify } = useUi()
  const { setActive, setEdit } = useNotesUi()

  useEffect(() => {
    if (!article) return
    const click = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return
      const s = window.getSelection()
      if (s && !s.isCollapsed) return // finishing a selection, not a click
      const note = noteAt(e.clientX, e.clientY)
      if (!note?.color) return
      setOpen({ note, x: Math.min(Math.max(e.clientX - WIDTH / 2, 8), window.innerWidth - WIDTH - 8), y: e.clientY + 14 })
    }
    article.addEventListener('click', click)
    return () => article.removeEventListener('click', click)
  }, [article, noteAt])
  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLElement>('button[aria-pressed="true"], button')?.focus()
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    const hide = () => setOpen(null)
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key)
    const main = document.getElementById('main'); main?.addEventListener('scroll', hide, { passive: true })
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); main?.removeEventListener('scroll', hide) }
  }, [open])
  if (!open) return null

  const { note } = open
  const done = async (job: Promise<unknown>) => {
    setOpen(null)
    try { await job; await qc.invalidateQueries({ queryKey: keys.notes(ws, doc) }) } catch (e) { notify((e as Error).message) }
  }
  const recolor = (color: NoteColor) => { if (isHighlight(color)) usePen.getState().setColor(color); void done(notesApi.update(ws, doc, note.id, { color })) }
  // a highlight with a note or a conversation keeps them: only its colour goes
  const keeps = !!note.body || note.thread.length > 0
  const remove = () => void done(keeps ? notesApi.update(ws, doc, note.id, { color: null }) : notesApi.remove(ws, doc, note.id))
  const write = () => { setOpen(null); setPanelTab('notes'); if (note.body) setActive(note.id); else setEdit(note.id) }
  const item = 'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 text-[13px] hover:bg-hover cursor-pointer'
  const top = open.y + 90 > window.innerHeight ? open.y - 120 : open.y
  return (
    <div ref={box} role="dialog" aria-label={t('Highlight')} style={{ left: open.x, top, width: WIDTH }}
      className="fixed z-40 rounded-[8px] border border-border bg-raised p-0.5 shadow-pop">
      <ColorRow current={note.color} onPick={recolor} />
      <div className="flex items-center gap-0.5 border-t border-border pt-0.5">
        <button type="button" className={item} onClick={write}><StickyNote className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{note.body ? t('Open note') : t('Add a note')}</button>
        <button type="button" className={item} onClick={remove}><Trash2 className="size-4 text-muted" strokeWidth={1.8} aria-hidden />{t('Remove highlight')}</button>
      </div>
    </div>
  )
}
