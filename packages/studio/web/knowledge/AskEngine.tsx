// Who answers a question: the local AI (Ollama), a cloud AI with your own key, or Claude from this computer. The choice
// is remembered on this device, so every short question uses the same one. Whenever an answer comes from outside this
// computer, the page says what goes where.
import { useSyncExternalStore } from 'react'
import { Link } from 'wouter'
import { useEngines, useSession } from '../api/queries'
import { t } from '../i18n'

export type Engine = 'local' | 'cloud' | 'claude'
/** `cloudName`: the cloud AI's service. `ollamaCloud`: the local AI's model is one of Ollama's cloud models. */
export interface AskEngineChoice { using: Engine | null; local: boolean; cloud: boolean; claude: boolean; known: boolean; cloudName: string; ollamaCloud: boolean; choose(e: Engine): void }

const KEY = 'mdl-ask-engine'
const listeners = new Set<() => void>()
const saved = (): Engine | null => { try { const v = localStorage.getItem(KEY); return v === 'local' || v === 'cloud' || v === 'claude' ? v : null } catch { return null } }
let chosen = saved()
const choose = (e: Engine) => { chosen = e; try { localStorage.setItem(KEY, e) } catch { /* this visit only */ } for (const l of listeners) l() }

/** `claude: false` for questions Claude does not answer (the passage toolbar, key ideas). */
export function useAskEngine({ claude: withClaude = true }: { claude?: boolean } = {}): AskEngineChoice {
  const engines = useEngines()
  const session = useSession()
  const pick = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => chosen)
  const local = !!engines.data?.local.available
  const cloud = !!engines.data?.cloud?.available
  const claude = withClaude && !!engines.data?.claude.available && !!session.data?.caps.includes('ai')
  const open = (e: Engine | null) => (e === 'local' ? local : e === 'cloud' ? cloud : e === 'claude' ? claude : false)
  const using = open(pick) ? pick : local ? 'local' : cloud ? 'cloud' : claude ? 'claude' : null
  return { using, local, cloud, claude, known: !!engines.data, cloudName: engines.data?.cloud?.name ?? t('Cloud AI'), ollamaCloud: !!engines.data?.local.cloud, choose }
}

/** What goes where, for the engine answering. */
export function engineNotice(e: AskEngineChoice, progress = false): string | null {
  if (e.using === 'claude') return progress ? t('Claude answers. The passages and titles it reads, and your study progress, go to Anthropic, under your own account.') : t('Claude answers. The passages and titles it reads go to Anthropic, under your own account.')
  if (e.using === 'cloud') return progress ? t('{name} answers. The passages and titles it reads, and your study progress, go to {name}, under your key.', { name: e.cloudName }) : t('{name} answers. The passages and titles it reads go to {name}, under your key.', { name: e.cloudName })
  if (e.using === 'local' && e.ollamaCloud) return t('An Ollama cloud model answers. The passages and titles it reads go to Ollama\'s servers, under your Ollama account.')
  return null
}
/** The engine for a short question that Claude does not answer, if there is one. */
export const quickOf = (e: AskEngineChoice): 'local' | 'cloud' | null => (e.using === 'claude' ? null : e.using)
const openOf = (e: AskEngineChoice) => (['local', 'cloud', 'claude'] as const).filter((x) => e[x])
/** Whether EnginePick has anything to show: a choice, or where the answers come from. */
export const engineShown = (e: AskEngineChoice) => openOf(e).length > 1 || !!engineNotice(e)
const nameOf = (e: Engine, c: AskEngineChoice) => (e === 'local' ? (c.ollamaCloud ? t('Ollama cloud') : t('Local AI')) : e === 'cloud' ? c.cloudName : 'Claude')

export function EnginePick({ ws, engine, progress = false, compact = false }: { ws: string; engine: AskEngineChoice; progress?: boolean; compact?: boolean }) {
  const { using, known, choose: pickEngine } = engine
  if (known && !using) return <p className="mt-2 text-[12.5px] text-muted">{t('Asking needs the local AI (Ollama), a cloud AI or Claude.')} <Link href={`/w/${ws}/settings#local-ai`} className="underline underline-offset-2 hover:text-text">{t('AI settings')}</Link></p>
  const open = openOf(engine)
  const notice = engineNotice(engine, progress)
  if (open.length < 2 && !notice) return null
  return (
    <div className={`${compact ? '' : 'mt-2 '}flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]`}>
      {open.length > 1 && (
        <span role="radiogroup" aria-label={t('Answers from')} className="inline-flex flex-wrap gap-1">
          {open.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={using === e} onClick={() => pickEngine(e)}
              className={`h-7 rounded-[6px] border px-2 cursor-pointer ${using === e ? 'border-accent bg-accent-soft font-medium' : 'border-border text-muted hover:bg-hover'}`}>{nameOf(e, engine)}</button>
          ))}
        </span>
      )}
      {notice && <span className="text-muted">{notice}</span>}
    </div>
  )
}
