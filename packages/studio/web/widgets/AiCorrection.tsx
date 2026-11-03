// "Correct with AI" under your answer to an explain-in-your-own-words question: the local AI or Claude compares it with
// the question's key ideas and the text around it. A suggestion only: nothing is scored, and in Study you still rate yourself.
import { useState } from 'react'
import { Check, CircleDashed, MessageCircleQuestion, Sparkles, TriangleAlert, X } from 'lucide-react'
import { api } from '../api/client'
import { EnginePick, useAskEngine } from '../knowledge/AskEngine'
import { Button } from '../ui/primitives'
import type { TeachResult } from '../../shared/types'
import { currentLang, t } from '../i18n'

/** Where the question is: a document (its path), or a lesson or Study card (found by the question's id alone). */
export interface CorrectWith { ws: string; doc?: string }
type How = 'all' | 'partly' | 'missed'
const MARK = {
  covered: { Icon: Check, tone: 'text-good', word: () => t('covered') },
  partly: { Icon: CircleDashed, tone: 'text-warn', word: () => t('partly') },
  missing: { Icon: X, tone: 'text-bad', word: () => t('missing') },
} as const
/** Enough to judge: a few words, not a single one. */
export const MIN_WORDS = 3
const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function AiCorrection({ at, widgetId, text, onUse }: { at: CorrectWith; widgetId: string; text: string; onUse?: (how: How) => void }) {
  const engine = useAskEngine()
  const [r, setR] = useState<TeachResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enough = wordsIn(text) >= MIN_WORDS
  const run = async () => {
    if (!engine.using) return
    setBusy(true); setError(null)
    try { setR(await api.post<TeachResult>(`/api/w/${at.ws}/teachback`, { ...(at.doc ? { doc: at.doc } : {}), widget: widgetId, text, lang: currentLang(), engine: engine.using })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  if (!r) return (
    <div className="mt-4 font-ui">
      <Button size="sm" variant="secondary" icon={Sparkles} busy={busy} disabled={!enough || !engine.using} onClick={() => void run()}>{t('Correct with AI')}</Button>
      {!enough && <p className="mt-1 text-[12.5px] text-muted">{t('Write a few words first.')}</p>}
      <EnginePick ws={at.ws} engine={engine} />
      {error && <p className="mt-1 text-[12.5px] text-bad" role="alert">{error}</p>}
    </div>
  )
  const covered = r.ideas.filter((i) => i.verdict === 'covered').length
  const how: How = covered === r.ideas.length && r.ideas.length ? 'all' : covered || r.ideas.some((i) => i.verdict === 'partly') ? 'partly' : 'missed'
  return (
    <section className="mt-4 rounded-[8px] border border-border p-3 font-ui text-[13.5px]" role="status" aria-label={t('AI correction')}>
      <p className="text-[12px] font-medium text-muted">{t('AI correction · {done} of {total} key ideas', { done: covered, total: r.ideas.length })}</p>
      {r.feedback && <p className="mt-1.5">{r.feedback}</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {r.ideas.map((i, k) => {
          const m = MARK[i.verdict]
          return (
            <li key={k} className="flex gap-2">
              <m.Icon className={`mt-0.5 size-4 shrink-0 ${m.tone}`} aria-hidden />
              <span className="min-w-0"><span className="sr-only">{m.word()}: </span>{i.idea}
                {i.evidence && i.verdict !== 'missing' && <span className="block text-[12.5px] text-muted">{t('You wrote: “{quote}”', { quote: i.evidence })}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {r.misconceptions.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium"><TriangleAlert className="size-4 text-warn" aria-hidden />{t('To correct')}</p>
          <ul className="mt-1 flex flex-col gap-1.5">{r.misconceptions.map((m, k) => <li key={k}><span className="text-muted">“{m.quote}”</span><span className="block">{m.correction}</span></li>)}</ul>
        </div>
      )}
      {r.followUp && <p className="mt-3 flex gap-1.5"><MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /><span>{r.followUp}</span></p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        {onUse && <button onClick={() => onUse(how)} className="underline underline-offset-2 text-muted hover:text-text cursor-pointer">{t('Use this: “{rating}”', { rating: how === 'all' ? t('Got all of it') : how === 'partly' ? t('Partly') : t('Missed it') })}</button>}
        <button onClick={() => setR(null)} className="underline underline-offset-2 text-muted hover:text-text cursor-pointer">{t('Correct again')}</button>
      </div>
      <p className="mt-2 text-[12px] text-muted">{t('AI feedback is a suggestion and can be wrong: check it against the text. Nothing here changes your schedule.')}</p>
    </section>
  )
}
