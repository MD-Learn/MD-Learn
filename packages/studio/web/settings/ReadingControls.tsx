// The reading font and size: in Settings → Appearance and in the reader's Aa menu. They apply at once, on this device.
import { Minus, Plus } from 'lucide-react'
import { DEFAULT_SIZE, FONT_FACE, MAX_SIZE, MIN_SIZE, READ_FONTS, applyReading, nextSize, useReading, type ReadFont } from '../lib/reading'
import { t } from '../i18n'

const FONT_NAMES: Record<ReadFont, () => string> = {
  serif: () => t('Serif'), times: () => 'Times New Roman', sans: () => t('Sans'), easy: () => t('Easy to read'), dyslexia: () => t('For dyslexia'), mono: () => t('Monospace'),
}
const option = (on: boolean) => `inline-flex h-8 items-center rounded-[6px] border px-3 text-[14px] cursor-pointer ${on ? 'border-accent bg-accent-soft font-medium' : 'border-border hover:bg-hover'}`
const step = 'inline-flex size-8 items-center justify-center rounded-[6px] border border-border hover:bg-hover cursor-pointer disabled:opacity-40 disabled:cursor-default'

export function ReadingControls({ id = 'reading' }: { id?: string }) {
  const r = useReading()
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p id={`${id}-font`} className="text-[12.5px] text-muted">{t('Font')}</p>
        <div role="radiogroup" aria-labelledby={`${id}-font`} className="mt-1.5 flex flex-wrap gap-1.5">
          {READ_FONTS.map((f) => <button key={f} type="button" role="radio" aria-checked={r.font === f} onClick={() => applyReading({ ...r, font: f })} className={option(r.font === f)} style={{ fontFamily: FONT_FACE[f] }}>{FONT_NAMES[f]()}</button>)}
        </div>
        {r.font === 'times' && <p className="mt-1.5 text-[12.5px] text-muted">{t('Times New Roman when this computer has it, or a font that looks the same.')}</p>}
      </div>
      <div>
        <p id={`${id}-size`} className="text-[12.5px] text-muted">{t('Text size')}</p>
        <div role="group" aria-labelledby={`${id}-size`} className="mt-1.5 flex items-center gap-1.5">
          <button type="button" className={step} aria-label={t('Smaller text')} disabled={r.size <= MIN_SIZE} onClick={() => applyReading({ ...r, size: nextSize(r.size, -1) })}><Minus className="size-4" aria-hidden /></button>
          <output aria-live="polite" className="w-14 text-center tabular text-[13.5px]">{r.size}px</output>
          <button type="button" className={step} aria-label={t('Bigger text')} disabled={r.size >= MAX_SIZE} onClick={() => applyReading({ ...r, size: nextSize(r.size, 1) })}><Plus className="size-4" aria-hidden /></button>
          {r.size !== DEFAULT_SIZE && <button type="button" onClick={() => applyReading({ ...r, size: DEFAULT_SIZE })} className="ml-1 text-[12.5px] text-muted underline underline-offset-2 hover:text-text cursor-pointer">{t('Reset')}</button>}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">{t('The whole note grows with it: headings, formulas, code and tables. In a note, Ctrl and + or − does the same.')}</p>
      </div>
    </div>
  )
}
