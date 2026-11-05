// The highlight colours as a row of buttons: six plain colours, then the three marks with a purpose. Used by the
// selection toolbar, the menu on a highlight and an open highlight in the notes panel.
import type { NoteColor } from '../../shared/types'
import { HIGHLIGHTS, NOTE_MARKS, markLabel } from './marks'
import { t } from '../i18n'

const KEYS = HIGHLIGHTS.map((_, i) => String(i + 1))
export function ColorRow({ current, onPick, marks = true, size = 'md', shortcuts }: { current?: NoteColor; onPick(c: NoteColor): void; marks?: boolean; size?: 'sm' | 'md'; shortcuts?: boolean }) {
  const box = size === 'sm' ? 'size-7' : 'size-8'
  const btn = (on: boolean) => `${box} inline-flex shrink-0 items-center justify-center rounded-[6px] hover:bg-hover cursor-pointer ${on ? 'bg-active' : ''}`
  return (
    <div role="group" aria-label={t('Highlight colour')} className="flex items-center">
      {HIGHLIGHTS.map((c, i) => {
        const name = shortcuts ? `${markLabel(c)} (${KEYS[i]})` : markLabel(c)
        return <button key={c} type="button" aria-label={markLabel(c)} aria-pressed={current === c} title={name} onClick={() => onPick(c)} className={btn(current === c)}>
          <span className={`hl-dot hl-${c} ${current === c ? 'ring-2 ring-text/70 ring-offset-1 ring-offset-raised' : ''}`} aria-hidden />
        </button>
      })}
      {marks && <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />}
      {marks && NOTE_MARKS.map(({ color, icon: Icon }) => (
        <button key={color} type="button" aria-label={markLabel(color)} aria-pressed={current === color} title={markLabel(color)} onClick={() => onPick(color)} className={btn(current === color)}>
          <Icon className={`size-4 tone-${color}`} strokeWidth={1.8} aria-hidden />
        </button>
      ))}
    </div>
  )
}
