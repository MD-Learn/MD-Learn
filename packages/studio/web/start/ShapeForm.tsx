// How you want your course, asked before anyone writes it: how long, from what level, what for, what to put in, and
// anything else. The same answers go to Claude, into the command for a coding assistant, and into the ask for a chat.
// They are remembered in this browser for the next course.
import { useState, type ReactNode } from 'react'
import type { CourseExtra, CourseGoal, CourseLength } from '@mdlearn/core'
import type { CourseShape } from '../api/queries'
import { t } from '../i18n'

export type Level = 'beginner' | 'intermediate' | 'advanced'
export interface Shape extends Required<CourseShape> { level: Level; wishes: string }

const KEY = 'mdl-course-shape'
const DEFAULT: Shape = { length: 'normal', level: 'intermediate', goal: 'exam', include: ['exercises', 'visuals', 'exam-practice'], wishes: '' }
const LENGTHS: CourseLength[] = ['short', 'normal', 'full']
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
const GOALS: CourseGoal[] = ['exam', 'understand', 'reference']
const EXTRAS: CourseExtra[] = ['exercises', 'visuals', 'code', 'exam-practice']

const label = {
  length: (x: CourseLength) => ({ short: t('Short'), normal: t('Normal'), full: t('Complete') })[x],
  level: (x: Level) => ({ beginner: t('From scratch'), intermediate: t('I know the basics'), advanced: t('Advanced') })[x],
  goal: (x: CourseGoal) => ({ exam: t('Pass an exam'), understand: t('Understand it'), reference: t('Look things up') })[x],
  extra: (x: CourseExtra) => ({ exercises: t('Exercises'), visuals: t('Visuals'), code: t('Code'), 'exam-practice': t('Exam practice') })[x],
}

function remembered(): Shape {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Shape> | null
    if (!s) return DEFAULT
    return {
      length: LENGTHS.includes(s.length!) ? s.length! : DEFAULT.length,
      level: LEVELS.includes(s.level!) ? s.level! : DEFAULT.level,
      goal: GOALS.includes(s.goal!) ? s.goal! : DEFAULT.goal,
      include: Array.isArray(s.include) ? EXTRAS.filter((x) => s.include!.includes(x)) : DEFAULT.include,
      wishes: '', // what else to say is about one course
    }
  } catch { return DEFAULT }
}
/** The answers, kept for the next course in this browser. */
export function useShape(): [Shape, (s: Shape) => void] {
  const [shape, setShape] = useState(remembered)
  const change = (s: Shape) => {
    setShape(s)
    try { localStorage.setItem(KEY, JSON.stringify({ ...s, wishes: undefined })) } catch { /* private mode: it still applies to this course */ }
  }
  return [shape, change]
}

/** The answers as plain English sentences, for a coding assistant or a chat (the job sends them as fields). */
export function shapeWords(s: Shape): string {
  const has = (x: CourseExtra) => s.include.includes(x)
  return [
    s.length === 'short' && 'Keep it short, the essentials only.',
    s.length === 'full' && 'Make it complete, with every topic in depth.',
    { beginner: 'I am starting from scratch.', intermediate: 'I know the basics.', advanced: 'I am advanced, skip the basics.' }[s.level],
    { exam: 'It is to pass an exam.', understand: 'I want to understand it, intuition first.', reference: 'I want a reference to look things up.' }[s.goal],
    !has('exercises') && 'No exercises, notes to read only.',
    !has('visuals') && 'Few visuals.',
    has('code') && 'Include runnable code.',
    has('exam-practice') && has('exercises') && 'End with exam practice.',
  ].filter(Boolean).join(' ')
}

const option = (on: boolean) => `inline-flex h-8 items-center justify-center rounded-[6px] border px-3 text-[13px] cursor-pointer ${on ? 'border-accent bg-accent-soft font-medium' : 'border-border hover:bg-hover'}`

function Choice<T extends string>({ id, name, values, value, text, onChange }: { id: string; name: string; values: T[]; value: T; text: (x: T) => string; onChange: (x: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <p id={id} className="w-[88px] shrink-0 text-[13px] text-muted">{name}</p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {values.map((x) => <button key={x} type="button" role="radio" aria-checked={value === x} onClick={() => onChange(x)} className={option(value === x)}>{text(x)}</button>)}
      </div>
    </div>
  )
}

/** `children`: more questions about the course (its language), shown before the free box. */
export function ShapeForm({ shape, onChange, children }: { shape: Shape; onChange: (s: Shape) => void; children?: ReactNode }) {
  const set = (part: Partial<Shape>) => onChange({ ...shape, ...part })
  const toggle = (x: CourseExtra) => set({ include: shape.include.includes(x) ? shape.include.filter((y) => y !== x) : EXTRAS.filter((y) => y === x || shape.include.includes(y)) })
  const reading = !shape.include.includes('exercises')
  return (
    <section aria-labelledby="shape" className="mt-8">
      <h2 id="shape" className="text-[16px] font-semibold">{t('How do you want your course?')}</h2>
      <div className="mt-3 flex flex-col gap-3">
        <Choice id="shape-length" name={t('Length')} values={LENGTHS} value={shape.length} text={label.length} onChange={(length) => set({ length })} />
        <Choice id="shape-level" name={t('Level')} values={LEVELS} value={shape.level} text={label.level} onChange={(level) => set({ level })} />
        <Choice id="shape-goal" name={t('What for')} values={GOALS} value={shape.goal} text={label.goal} onChange={(goal) => set({ goal })} />
        <fieldset className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <legend className="sr-only">{t('Include')}</legend>
          <p aria-hidden className="w-[88px] shrink-0 text-[13px] text-muted">{t('Include')}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {EXTRAS.map((x) => (
              <label key={x} className={`flex items-center gap-1.5 text-[13.5px] ${x === 'exam-practice' && reading ? 'text-subtle' : ''}`}>
                <input type="checkbox" checked={shape.include.includes(x) && !(x === 'exam-practice' && reading)} disabled={x === 'exam-practice' && reading} onChange={() => toggle(x)} className="accent-[var(--accent)]" />
                {label.extra(x)}
              </label>
            ))}
          </div>
        </fieldset>
        {reading && <p role="status" className="text-[13px] text-warn sm:pl-[100px]">{t('Without exercises the course is notes to read: it won’t appear in Study.')}</p>}
        {children}
        <label className="block text-[13px] font-medium">{t('Anything else? (optional)')}
          <textarea value={shape.wishes} onChange={(e) => set({ wishes: e.target.value })} maxLength={2000} rows={2} placeholder={t('e.g. The exam covers chapters 1 to 4 and is mostly problems')}
            className="mt-1.5 w-full rounded-[6px] border border-border-strong bg-bg px-3 py-2 text-[14px] font-normal outline-none focus:border-accent" />
        </label>
      </div>
    </section>
  )
}
