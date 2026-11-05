// The reader's Aa button: the reading font and size, without leaving the note.
import { useEffect, useRef, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { ReadingControls } from '../settings/ReadingControls'
import { t } from '../i18n'

export function ReadingMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-label={t('Font and text size')} title={t('Font and text size')} onClick={() => setOpen((o) => !o)}
        className={`inline-flex size-7 items-center justify-center rounded-[6px] text-muted hover:bg-hover hover:text-text cursor-pointer ${open ? 'bg-active text-text' : ''}`}>
        <ALargeSmall className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label={t('Font and text size')} className="absolute right-0 top-8 z-50 w-[min(92vw,360px)] rounded-[8px] border border-border bg-raised p-3 shadow-pop">
          <ReadingControls id="aa" />
        </div>
      )}
    </div>
  )
}
