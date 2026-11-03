// First step of a course: what it is about, and any files you have, and what MDlearn could read in each.
import { useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { classApi } from '../api/queries'
import { useUi } from '../state/ui'
import { ANY, CLASS_ACCEPT, fromDrop, fromInput, nameFor, type Picked } from '../lib/upload'
import { Button, ErrorNote } from '../ui/primitives'
import type { ClassFile, ClassUpload } from '../../shared/types'
import { t, tp } from '../i18n'

const field = 'mt-1.5 h-9 w-full rounded-[6px] border border-border-strong bg-bg px-3 text-[14px] outline-none focus:border-accent'

export function FilesStep({ ws, onDone }: { ws?: string; onDone: (u: ClassUpload) => void }) {
  const handedOver = useUi((u) => u.classFiles)
  const setHandedOver = useUi((u) => u.setClassFiles)
  const [files, setFiles] = useState<Picked[]>(() => handedOver.filter((p) => CLASS_ACCEPT.test(p.path)))
  const [left, setLeft] = useState<string[]>(() => handedOver.filter((p) => !CLASS_ACCEPT.test(p.path)).map((p) => p.file.name))
  const [name, setName] = useState(handedOver.length ? nameFor(handedOver) : '')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const input = useRef<HTMLInputElement>(null)
  /** Take what an AI can read, and say what was left out rather than drop it silently. */
  const add = (picked: Picked[]) => {
    const more = picked.filter((p) => CLASS_ACCEPT.test(p.path))
    setLeft(picked.filter((p) => !CLASS_ACCEPT.test(p.path)).map((p) => p.file.name))
    setFiles((now) => [...now, ...more.filter((p) => !now.some((x) => x.path === p.path && x.file.size === p.file.size))])
    setName((n) => n || (more.length ? nameFor(more) : ''))
  }
  const send = async () => {
    setBusy(true); setError(null)
    try { const u = await (ws ? classApi.add(ws, files) : classApi.create(name, files)); setHandedOver([]); onDone(u) }
    catch (e) { setError(e) } finally { setBusy(false) }
  }
  return (
    <div className="mt-6 flex flex-col gap-4">
      {!ws && (
        <label className="block text-[13px] font-medium">{t('What do you want to learn?')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Marketing for a small business')} maxLength={100} className={field} />
        </label>
      )}
      <div role="group" aria-label={t('Your class files')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
        onDrop={async (e) => { e.preventDefault(); setDragging(false); add(await fromDrop(e.dataTransfer, ANY)) }}
        className={`rounded-[8px] border border-dashed p-5 text-center ${dragging ? 'border-accent bg-accent-soft' : 'border-border-strong'}`}>
        <Upload className="mx-auto size-5 text-muted" strokeWidth={1.6} aria-hidden />
        <p className="mt-2 text-[14px] font-medium">{ws ? t('Drop your class files here') : t('Drop any files you have here (optional)')}</p>
        <p className="mt-0.5 text-[13px] text-muted">{t('PDF, PowerPoint, Word, pictures, code, data or text, and whole folders.')} <button onClick={() => input.current?.click()} className="underline underline-offset-2 hover:text-text cursor-pointer">{t('Choose files')}</button></p>
        <input ref={input} type="file" multiple hidden aria-label={t('Choose files')} onChange={(e) => { add(fromInput(e.target.files, ANY)); e.target.value = '' }} />
      </div>
      {!!left.length && (
        <p role="status" className="text-[13px] text-warn">
          {t('Left out, because an AI can’t read them: {names}', { names: left.slice(0, 6).join(', ') + (left.length > 6 ? ` +${left.length - 6}` : '') })}
          {left.some((n) => /\.(xlsx?|ods|numbers)$/i.test(n)) && <> {t('Save spreadsheets as .csv to include them.')}</>}
        </p>
      )}
      {!!files.length && (
        <ul className="divide-y divide-border border-y border-border">
          {files.map((p) => (
            <li key={`${p.path}-${p.file.size}`} className="flex items-center gap-2.5 py-1.5 text-[13.5px]">
              <FileText className="size-4 shrink-0 text-subtle" strokeWidth={1.7} aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={p.path}>{p.path}</span>
              <button aria-label={t('Remove {name}', { name: p.file.name })} onClick={() => setFiles((now) => now.filter((x) => x !== p))} className="rounded p-1 text-muted hover:bg-hover hover:text-text cursor-pointer"><X className="size-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      {!!error && <ErrorNote error={error} />}
      <div><Button variant="primary" busy={busy} disabled={ws ? !files.length : !name.trim()} onClick={() => void send()}>{ws ? t('Add these files') : t('Continue')}</Button></div>
    </div>
  )
}

function fileNote(f: ClassFile): string {
  switch (f.problem) {
    case 'old-format': return t('Kept, but this old format can’t be read here. Save it as .pptx or .docx, or attach it in a chat.')
    case 'unknown-type': return t('Kept, but this kind of file can’t be read here.')
    case 'no-text': return t('Kept. It holds no text (perhaps a scan), so your AI will read the pages itself.')
    case 'unreadable': return t('Kept, but it could not be opened. It may be damaged.')
  }
  const parts = [
    ...(f.slides ? [tp(f.slides, '{n} slide', '{n} slides')] : []),
    ...(f.kind === 'word' || f.kind === 'pdf' ? [t('text read')] : []),
    ...(f.pictures ? [tp(f.pictures, '{n} picture', '{n} pictures')] : []),
  ]
  if (parts.length) return parts.join(', ')
  return f.kind === 'code' || f.kind === 'data' ? t('kept as it is: the AI reads it itself') : f.kind === 'picture' ? t('kept: the AI looks at it itself') : t('kept as it is')
}

export function FileResults({ files }: { files: ClassFile[] }) {
  return (
    <ul aria-label={t('What was read')} className="mt-4 divide-y divide-border border-y border-border text-[13.5px]">
      {files.map((f) => (
        <li key={f.path} className="py-2">
          <p className="truncate font-medium">{f.name}</p>
          <p className={`text-[13px] ${f.problem ? 'text-warn' : 'text-muted'}`}>{fileNote(f)}</p>
          {!!f.equations && <p className="text-[13px] text-warn">{tp(f.equations, '{n} equation can’t be read as text. An AI that reads the original file will see it.', '{n} equations can’t be read as text. An AI that reads the original file will see them.')}</p>}
          {!!f.skipped && <p className="text-[13px] text-muted">{tp(f.skipped, '{n} picture in another format was left out.', '{n} pictures in other formats were left out.')}</p>}
        </li>
      ))}
    </ul>
  )
}
