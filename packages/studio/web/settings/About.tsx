// Settings → About: the version in use, and whether a newer one is out. The npm install asks the registry at most once
// a day (this switch turns it off); the desktop app updates itself (Help → Check for updates…).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, updatesApi, useSession, useUpdates } from '../api/queries'
import { Section } from './Section'
import { Command } from './Command'
import { t } from '../i18n'

export function About() {
  const qc = useQueryClient()
  const session = useSession()
  const u = useUpdates()
  const mine = session.data?.caps.includes('ai') ?? false
  const set = useMutation({ mutationFn: updatesApi.set, onSuccess: (next) => qc.setQueryData(keys.updates, next) })
  const d = u.data
  return (
    <Section id="about" title={t('About')}>
      <p className="text-[13.5px]">{t('MDlearn {version}', { version: session.data?.version ?? d?.current ?? '' })}</p>
      {d?.desktop ? <p className="text-[13px] text-muted">{t('The app updates itself: Help → Check for updates…')}</p> : d && (
        <>
          {d.newer && d.latest && <NewVersion latest={d.latest} />}
          <label className="flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" checked={set.isPending ? set.variables : d.check} disabled={!mine} onChange={(e) => set.mutate(e.target.checked)} className="mt-0.5" />
            <span>{t('Look for new versions')}<span className="block text-[12.5px] text-muted">{t('Once a day, MDlearn asks the npm registry for the number of its newest version. Nothing about you or your notes is sent.')}</span></span>
          </label>
        </>
      )}
    </Section>
  )
}

/** "MDlearn X is out", with the commands that get it. */
export function NewVersion({ latest }: { latest: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border p-3 text-[13.5px]" role="status">
      <p className="font-medium">{t('MDlearn {version} is out', { version: latest })}</p>
      <p className="text-[12.5px] text-muted">{t('Update it with one of these, then start it again:')}</p>
      <Command text="npm i -g mdlearn@latest" />
      <Command text="npx mdlearn@latest studio" />
    </div>
  )
}
