// Settings → Cloud AI: a service with your own key for the short questions (Ask, Explain, Correct with AI, teach-back,
// key ideas, Visualise). The key is sent once and never shown again; only this computer can see or change any of it.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, KeyRound } from 'lucide-react'
import { cloudAiApi, keys, useSession, type CloudAiInfo } from '../api/queries'
import { Button, ErrorNote, Spinner } from '../ui/primitives'
import { t, tp } from '../i18n'
import { Section } from './Section'

const field = 'h-8 rounded-[6px] border border-border-strong bg-bg px-2.5 text-[13px] text-text outline-none focus:border-focus'

export function CloudAi() {
  const session = useSession()
  const mine = session.data?.caps.includes('ai') ?? false
  return (
    <Section id="cloud-ai" title={t('Cloud AI')}
      intro={t('Instead of the local AI, a service you have a key for can answer the short questions: Ask, Explain, Correct with AI, teach-back, key ideas and visuals. Courses are still written by Claude.')}>
      {session.data && !mine ? <p className="text-[13px] text-muted">{t('The cloud AI is set up on the computer running MDlearn Studio.')}</p> : session.data && <CloudForm />}
    </Section>
  )
}

function CloudForm() {
  const qc = useQueryClient()
  const info = useQuery({ queryKey: keys.cloudAi, queryFn: cloudAiApi.info })
  const [provider, setProvider] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [key, setKey] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [test, setTest] = useState<{ reply: string; label: string } | null>(null)
  const d = info.data
  useEffect(() => { if (d) { setProvider(d.provider ?? ''); setBaseUrl(d.baseUrl ?? ''); setModel(d.model ?? '') } }, [d])
  const done = (next: CloudAiInfo) => { qc.setQueryData(keys.cloudAi, next); void qc.invalidateQueries({ queryKey: keys.engines }); setKey(''); setReplacing(false); setTest(null) }
  const save = useMutation({ mutationFn: cloudAiApi.save, onSuccess: done })
  const load = useMutation({ mutationFn: cloudAiApi.models, onSuccess: (r) => setModels(r.models) })
  const check = useMutation({ mutationFn: cloudAiApi.test, onSuccess: setTest })
  if (info.isLoading) return <Spinner />
  if (info.error || !d) return <ErrorNote error={info.error} retry={() => void info.refetch()} />

  const preset = d.providers.find((p) => p.id === provider)
  const other = provider === 'other'
  const sameService = provider === (d.provider ?? '')
  const submit = () => save.mutate({ provider, ...(other ? { baseUrl } : {}), model: sameService || model ? model : '', ...(key.trim() ? { key: key.trim() } : {}) })
  const failed = save.error ?? load.error ?? check.error
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (provider) submit() }}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12.5px] text-muted">{t('Service')}
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModels([]); if (e.target.value !== d.provider) setModel('') }} className={`${field} cursor-pointer pr-7`}>
            <option value="" disabled>{t('Choose one…')}</option>
            {d.providers.map((p) => <option key={p.id} value={p.id}>{p.id === 'other' ? t('Other (OpenAI-compatible)') : p.name}</option>)}
          </select>
        </label>
        {other && (
          <label className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1 text-[12.5px] text-muted">{t('Address')}
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.org/v1" spellCheck={false} className={`${field} font-mono`} />
          </label>
        )}
        {preset?.keys && <a href={preset.keys} target="_blank" rel="noopener noreferrer" className="pb-1.5 text-[12.5px] text-muted underline underline-offset-2 hover:text-text">{t('Get a key')}</a>}
      </div>
      {provider && (
        <div className="flex flex-col gap-1 text-[12.5px] text-muted">
          <span>{t('Key')}</span>
          {d.hasKey && !replacing && sameService ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text">
              <span className="inline-flex items-center gap-1.5"><KeyRound className="size-3.5 text-muted" aria-hidden />{d.fromEnv ? t('From MDLEARN_CLOUD_KEY, ending in {end}', { end: d.keyEnd ?? '' }) : t('Saved, ending in {end}', { end: d.keyEnd ?? '' })}</span>
              {!d.fromEnv && <button type="button" onClick={() => setReplacing(true)} className="text-muted underline underline-offset-2 hover:text-text cursor-pointer">{t('Replace')}</button>}
              {!d.fromEnv && <button type="button" onClick={() => save.mutate({ clearKey: true })} className="text-muted underline underline-offset-2 hover:text-text cursor-pointer">{t('Remove')}</button>}
            </span>
          ) : (
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} aria-label={t('Key')} placeholder={t('Paste the key here')} className={`${field} max-w-[30rem] font-mono`} />
          )}
        </div>
      )}
      {provider && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1 text-[12.5px] text-muted">{t('Model')}
            <input value={model} onChange={(e) => setModel(e.target.value)} list="cloud-models" spellCheck={false} placeholder={t('Its name, as the service writes it')} className={`${field} font-mono`} />
            <datalist id="cloud-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <Button type="button" size="sm" variant="secondary" busy={load.isPending} disabled={!d.hasKey || !sameService} onClick={() => load.mutate()}>{t('Load models')}</Button>
        </div>
      )}
      {models.length > 0 && <p className="text-[12.5px] text-muted">{tp(models.length, '{n} model: start typing to pick it.', '{n} models: start typing to pick one.')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="primary" busy={save.isPending} disabled={!provider || (other && !baseUrl.trim())}>{t('Save')}</Button>
        <Button type="button" size="sm" variant="secondary" busy={check.isPending} disabled={!d.available || !sameService || save.isPending} onClick={() => check.mutate()}>{t('Try it')}</Button>
        {d.available && <span className="inline-flex items-center gap-1 text-[12.5px] text-good"><CircleCheck className="size-3.5" aria-hidden />{t('Ready: {name} · {model}', { name: d.name ?? '', model: d.model ?? '' })}</span>}
      </div>
      {test && <p className="text-[13px]" role="status"><span className="text-muted">{test.label}:</span> {test.reply}</p>}
      {failed && <p role="alert" className="text-[13px] text-bad">{(failed as Error).message}</p>}
      <p className="max-w-[62ch] text-[12.5px] text-muted">{t('Only when you choose it for a question, the passages, titles and question it needs go to that service, under your key; some services charge for each question. The key stays on this computer, in a file only you can read, and is never shown again.')}</p>
    </form>
  )
}
