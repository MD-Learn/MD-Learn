// Updates. The Windows installer and the AppImage download a new version in the background and ask to restart
// (or install it when you quit). macOS (unsigned, so it cannot replace itself), the .deb and the zips only check the
// release's feed and offer its download page. Checks run 30 s after start and every 6 hours, unless turned off in
// Help; they contact github.com only. MDLEARN_NO_UPDATES=1 turns them off; MDLEARN_UPDATE_TEST_URL points them at a
// feed on this computer (for trying an update before a release).
import { app, dialog, net, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dueForCheck, feedName, feedVersion, installKind, isNewer, selfUpdates, testFeed, updatePrefs, type UpdatePrefs } from './rules'
import { strings } from './strings'

const RELEASES = 'https://github.com/MD-Learn/MD-Learn/releases'
const FIRST_CHECK_MS = 30_000
const TICK_MS = 60 * 60_000 // whether a check is due (every 6 h) is asked hourly, so a sleeping laptop catches up
const FEED_TIMEOUT_MS = 15_000

/** `title`: the Help menu's name in the system language (Electron names it in English outside macOS). */
export interface Updates { title: string; menu(): MenuItemConstructorOptions[] }
/** `beforeInstall`: stop the server and let go of the single-instance lock, so the new version can start. */
export function startUpdates(o: { window(): BrowserWindow | null; beforeInstall(): Promise<void> }): Updates {
  const kind = installKind({ platform: process.platform, packaged: app.isPackaged, appImage: process.env.APPIMAGE, exe: process.execPath,
    hasUninstaller: existsSync(join(dirname(process.execPath), 'Uninstall MDlearn.exe')) })
  const off = kind === 'dev' || process.env.MDLEARN_NO_UPDATES === '1'
  const feed = testFeed(process.env.MDLEARN_UPDATE_TEST_URL)
  const s = strings(app.getLocale())
  const file = join(app.getPath('userData'), 'updates.json')
  let prefs: UpdatePrefs = (() => { try { return updatePrefs(JSON.parse(readFileSync(file, 'utf8'))) } catch { return updatePrefs(undefined) } })()
  const keep = (next: UpdatePrefs) => { prefs = next; try { writeFileSync(file, JSON.stringify(prefs)) } catch { /* only this run remembers */ } }
  const box = (opts: Electron.MessageBoxOptions) => { const w = o.window(); return w ? dialog.showMessageBox(w, opts) : dialog.showMessageBox(opts) }
  const failed = (e: unknown) => void box({ type: 'warning', message: s('failedTitle'), detail: (e as Error).message?.split('\n')[0] ?? String(e) })
  // `checking`: a check by hand reports its own failure. `wanted`: it asked, so the version it finds is offered even
  // if an automatic check offered it before (the download finishes after the check returns).
  let checking = false, wanted = false

  if (!off && selfUpdates(kind)) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true // "Later" installs it when you quit
    autoUpdater.allowDowngrade = false
    if (feed) autoUpdater.setFeedURL({ provider: 'generic', url: feed })
    autoUpdater.on('update-downloaded', (info) => {
      // an automatic check offers a version once; it still installs on quit
      if (!wanted && prefs.told === info.version) return
      wanted = false
      keep({ ...prefs, told: info.version })
      void box({ type: 'info', message: s('readyTitle', info.version), detail: s('readyDetail'), buttons: [s('restart'), s('later')], defaultId: 0, cancelId: 1 }).then(async ({ response }) => {
        if (response !== 0) return
        await o.beforeInstall()
        autoUpdater.quitAndInstall(false, true)
      })
    })
    autoUpdater.on('error', (e) => { if (!checking && wanted) { wanted = false; failed(e) } })
  }

  /** Only the version in the release's feed (an install that cannot replace itself). */
  async function newestInFeed(): Promise<string | null> {
    const res = await net.fetch(`${feed ?? `${RELEASES}/latest/download`}/${feedName(process.platform)}`, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`github.com answered ${res.status}.`)
    return feedVersion(await res.text())
  }
  async function check(byHand: boolean) {
    keep({ ...prefs, lastCheck: Date.now() })
    try {
      if (selfUpdates(kind)) {
        if (byHand) wanted = true
        checking = true
        const r = await autoUpdater.checkForUpdates().finally(() => { checking = false })
        const v = r?.updateInfo.version
        if (!r?.isUpdateAvailable) wanted = false
        if (byHand) await box({ type: 'info', ...(r?.isUpdateAvailable && v ? { message: s('availableTitle', v), detail: s('downloading', v) } : { message: s('latestTitle'), detail: s('latestDetail', app.getVersion()) }) })
        return
      }
      const v = await newestInFeed()
      if (!v || !isNewer(v, app.getVersion())) { if (byHand) await box({ type: 'info', message: s('latestTitle'), detail: s('latestDetail', app.getVersion()) }); return }
      if (!byHand && prefs.told === v) return
      keep({ ...prefs, told: v })
      const { response } = await box({ type: 'info', message: s('availableTitle', v), detail: s('availableDetail'), buttons: [s('download'), s('later')], defaultId: 0, cancelId: 1 })
      if (response === 0 && !feed) void shell.openExternal(`${RELEASES}/tag/v${v}`)
    } catch (e) {
      wanted = false
      if (byHand) failed(e)
    }
  }
  if (!off) {
    const auto = () => { if (dueForCheck(prefs, Date.now())) void check(false) }
    setTimeout(auto, FIRST_CHECK_MS)
    setInterval(auto, TICK_MS)
  }
  return {
    title: s('help'),
    menu: () => off
      ? [{ label: s('check'), enabled: false }, ...(kind === 'dev' ? [] : [{ label: s('off'), enabled: false }])]
      : [
          { label: s('check'), click: () => void check(true) },
          { label: s('auto'), type: 'checkbox', checked: prefs.auto, click: (item) => keep({ ...prefs, auto: item.checked }) },
        ],
  }
}
