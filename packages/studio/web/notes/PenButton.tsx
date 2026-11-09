// The highlighter in the reader's top bar: on, every selection made with a mouse or a pen is highlighted at once in
// the chosen colour. Esc or the button turns it off.
import { useEffect } from 'react'
import { Highlighter } from 'lucide-react'
import { usePen } from './pen'
import { ColorRow } from './ColorRow'
import { markLabel } from './marks'
import { t } from '../i18n'

export function PenButton() {
  const { on, color, setOn, setColor } = usePen()
  useEffect(() => {
    if (!on) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOn(false) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [on, setOn])
  const name = on ? t('Highlighter on: {colour}', { colour: markLabel(color) }) : t('Highlighter')
  return (
    <div className="flex items-center">
      <button type="button" aria-pressed={on} aria-label={t('Highlighter')} title={name} onClick={() => setOn(!on)}
        className={`relative inline-flex size-7 items-center justify-center rounded-[6px] hover:bg-hover cursor-pointer ${on ? 'bg-active text-text' : 'text-muted hover:text-text'}`}>
        <Highlighter className="size-4" strokeWidth={1.8} aria-hidden />
        <span className={`hl-dot hl-${color} absolute bottom-0.5 right-0.5 !size-[7px]`} aria-hidden />
      </button>
      {on && <div className="max-[700px]:hidden"><ColorRow size="sm" marks={false} current={color} onPick={(c) => setColor(c as typeof color)} /></div>}
    </div>
  )
}
