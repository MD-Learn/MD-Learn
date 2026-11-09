// Highlights: three with a purpose (one click, no text, and each leads somewhere; icon and label say what the colour
// says), and six plain colours that are just colour. All are kept beside the file, never in it.
import { CircleHelp, GraduationCap, Star, type LucideIcon } from 'lucide-react'
import type { HighlightColor, NoteColor } from '../../shared/types'
import { t } from '../i18n'

export const NOTE_MARKS: { color: NoteColor; icon: LucideIcon }[] = [
  { color: 'important', icon: Star },
  { color: 'confusing', icon: CircleHelp },
  { color: 'exam', icon: GraduationCap },
]
export const HIGHLIGHTS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange']
export const NOTE_COLORS: NoteColor[] = [...HIGHLIGHTS, ...NOTE_MARKS.map((m) => m.color)]
export const isHighlight = (c: string | undefined): c is HighlightColor => HIGHLIGHTS.includes(c as HighlightColor)
export const isNoteColor = (c: string | undefined): c is NoteColor => NOTE_COLORS.includes(c as NoteColor)

const LABELS: Record<NoteColor, () => string> = {
  important: () => t('Important'), confusing: () => t('Confusing'), exam: () => t('For the exam'),
  yellow: () => t('Yellow'), green: () => t('Green'), blue: () => t('Blue'), pink: () => t('Pink'), purple: () => t('Purple'), orange: () => t('Orange'),
}
export const markLabel = (color: NoteColor) => LABELS[color]()
