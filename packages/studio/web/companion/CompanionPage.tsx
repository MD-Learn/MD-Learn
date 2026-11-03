// Your companion: how far it has grown, what makes it grow, the last things it counted, and the switch to stop it
// growing. Points come only from what you finish, are never lost, and nothing here counts time in the app.
import { lazy, Suspense, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { companionApi, useCompanion } from '../api/queries'
import { useUi } from '../state/ui'
import { TopLeft } from '../layout/Shell'
import { ErrorNote, Spinner } from '../ui/primitives'
import { PixelPet } from './PixelPet'
import { useAccentColor } from './growth'
import { prettyTitle } from '../lib/title'
import type { CompanionView, GrowthKind } from '../../shared/types'
import { locale, t, tp } from '../i18n'

const Orb = lazy(() => import('./Orb'))
const DEED: Record<GrowthKind, () => string> = {
  read: () => t('Read a note'), exercise: () => t('Tried a question'), explain: () => t('Explained in your own words'), session: () => t('Finished a review'),
}

export default function CompanionPage({ ws }: { ws: string }) {
  const me = useCompanion()
  const kind = useUi((u) => u.companion)
  const color = useAccentColor()
  const qc = useQueryClient()
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { document.title = t('Your companion · MDlearn Studio') }, [])
  if (me.isLoading) return <div className="p-10"><Spinner /></div>
  if (me.error) return <ErrorNote error={me.error} retry={() => me.refetch()} />
  const c = me.data!
  const save = async (b: { growth?: boolean; name?: string }) => {
    setError(null)
    try { qc.setQueryData<CompanionView>(['companion'], await companionApi.update(b)) } catch (e) { setError((e as Error).message) }
  }
  const saveName = () => { if (name !== null && name.trim() !== (c.name ?? '')) void save({ name: name.trim() }); setName(null) }
  const share = Math.max(0, Math.min(1, (c.points - c.from) / (c.to - c.from)))
  const when = (at: number) => new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
  const ways: [string, string][] = [
    [t('Finish reading a note'), '+10'], [t('Answer a question in your notes'), '+2'],
    [t('Explain in your own words and get it corrected'), '+5'], [t('Finish a review in Study'), t('+5, and +1 a card')],
  ]
  return (
    <div className="mx-auto max-w-[640px] px-6 pb-20 pt-6 sm:px-10">
      <TopLeft><span className="px-1 text-[13px] text-muted">{t('Your companion')}</span></TopLeft>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{c.name || t('Your companion')}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-[20px] bg-accent-soft text-accent-ink" aria-hidden>
          {kind === 'orb' ? <Suspense fallback={null}><Orb activity="idle" stage={c.growth ? c.stage : 1} size={64} color={color} /></Suspense> : <PixelPet activity="idle" stage={c.growth ? c.stage : 1} size={72} />}
        </div>
        <div className="min-w-[200px] flex-1">
          <p className="text-[17px] font-semibold">{t('Level {n}', { n: c.level })}</p>
          <div role="progressbar" aria-label={t('Points to the next level')} aria-valuemin={c.from} aria-valuemax={c.to} aria-valuenow={c.points} className="mt-2 h-2 overflow-hidden rounded-full bg-hover">
            <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
          </div>
          <p className="mt-1.5 tabular text-[12.5px] text-muted">{tp(c.points, '{n} point', '{n} points')} · {t('{left} to level {next}', { left: c.to - c.points, next: c.level + 1 })}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
        <label className="block text-[13px] font-medium">{t('Its name')}
          <input value={name ?? c.name ?? ''} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder={t('Give it a name (optional)')} className="mt-1.5 block w-full max-w-[320px] rounded-[6px] border border-border-strong bg-bg px-3 py-1.5 text-[14px] font-normal outline-none focus:border-accent" />
        </label>
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" checked={c.growth} onChange={(e) => void save({ growth: e.target.checked })} className="mt-0.5 accent-[var(--accent)]" />
          <span>{t('Let it grow')}<span className="block text-[12.5px] text-muted">{c.growth ? t('It grows with what you finish, and says so beside it.') : t('It stays as it is, and nothing is counted while it does not grow.')}</span></span>
        </label>
        {kind === 'off' && <p className="text-[12.5px] text-muted">{t('It is hidden from the sidebar. Show it in Settings → Appearance.')}</p>}
        {error && <p className="text-[12.5px] text-bad" role="alert">{error}</p>}
      </div>

      <h2 className="mt-8 text-[13px] font-medium text-muted">{t('What makes it grow')}</h2>
      <ul className="mt-2 flex flex-col text-[14px]">
        {ways.map(([what, pts]) => <li key={what} className="flex justify-between gap-4 border-t border-border py-2"><span>{what}</span><span className="tabular text-muted">{pts}</span></li>)}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted">{t('Each thing counts once. Points are never lost, and time spent in the app does not count.')}</p>

      <h2 className="mt-8 text-[13px] font-medium text-muted">{t('Lately')}</h2>
      {c.log.length ? (
        <ul className="mt-2 flex flex-col text-[14px]">
          {c.log.map((l, i) => (
            <li key={`${l.at}-${i}`} className="flex justify-between gap-4 border-t border-border py-2">
              <span className="min-w-0 truncate">{DEED[l.kind]()}{l.title ? <span className="text-muted"> · {prettyTitle(l.title)}</span> : null}</span>
              <span className="shrink-0 tabular text-muted">+{l.points} · {when(l.at)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[13.5px] text-muted">{t('Nothing yet. Finish reading a note to start.')}</p>}
    </div>
  )
}
