// The home page says once that a newer version is out, until it is dismissed (per device, per version).
import { useState } from 'react'
import { X } from 'lucide-react'
import { useUpdates } from '../api/queries'
import { Command } from '../settings/Command'
import { IconButton } from '../ui/primitives'
import { t } from '../i18n'

const KEY = 'mdl-update-dismissed'
const dismissedVersion = () => { try { return localStorage.getItem(KEY) } catch { return null } }

export function UpdateNotice() {
  const u = useUpdates()
  const [dismissed, setDismissed] = useState(dismissedVersion)
  const latest = u.data?.newer ? u.data.latest : null
  if (!latest || dismissed === latest) return null
  const dismiss = () => { try { localStorage.setItem(KEY, latest) } catch { /* this visit only */ } setDismissed(latest) }
  return (
    <div role="status" className="mt-6 flex items-start gap-3 rounded-[10px] border border-border p-3 text-[13.5px]">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('MDlearn {version} is out', { version: latest })}</p>
        <div className="mt-2"><Command text="npm i -g mdlearn@latest" /></div>
        <p className="mt-1.5 text-[12.5px] text-muted">{t('Then start it again. Settings → About can stop this check.')}</p>
      </div>
      <IconButton icon={X} label={t('Dismiss')} onClick={dismiss} />
    </div>
  )
}
