// The desktop app's small decisions, kept apart from Electron so they can be tested: reading the server's
// address from its output, and where a link may open.

/**
 * The line the server prints once it listens, with the token the app gave it (so no other line it prints can
 * stand in for it): `MDLEARN_READY <token> http://localhost:4757/`. The address comes back as 127.0.0.1, where the
 * server listens: `localhost` may also mean ::1, where another program could.
 */
export function readyUrl(output: string, token: string): string | null {
  if (!token) return null
  for (const line of output.split('\n')) {
    const m = /^MDLEARN_READY (\S+) http:\/\/(?:localhost|127\.0\.0\.1):(\d{2,5})\/\s*$/.exec(line)
    if (m && m[1] === token) return `http://127.0.0.1:${m[2]}/`
  }
  return null
}

export type Opening = { where: 'window' | 'external'; url: string } | { where: 'deny' }
/**
 * Studio's own pages open in an app window (a PDF in a new tab, say); web and mail links in the browser or mail
 * app, as parsed (that is what was checked); anything else (file:, javascript:, other schemes, user:pass@) nowhere.
 */
export function openingFor(url: string, appOrigin: string): Opening {
  let u: URL
  try { u = new URL(url) } catch { return { where: 'deny' } }
  if (u.origin === appOrigin) return { where: 'window', url: u.href }
  if (u.username || u.password) return { where: 'deny' }
  return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? { where: 'external', url: u.href } : { where: 'deny' }
}

/** A saved window position is used only if it is still on a screen (a monitor may have gone). */
export interface Bounds { x: number; y: number; width: number; height: number }
/** The four numbers of a saved position, and nothing else the file may hold. */
export function boundsFrom(saved: unknown): Bounds | null {
  const o = (saved ?? {}) as Record<string, unknown>
  const [x, y, width, height] = [o.x, o.y, o.width, o.height]
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  return ok(x) && ok(y) && ok(width) && ok(height) ? { x, y, width, height } : null
}
export function onScreen(saved: Bounds, screens: Bounds[]): boolean {
  return saved.width >= 400 && saved.height >= 300 && screens.some((s) =>
    saved.x + 40 >= s.x && saved.y + 20 >= s.y && saved.x + 40 <= s.x + s.width && saved.y + 20 <= s.y + s.height)
}

// ---- updates (src/updates.ts): what this install can do, the release feed, and when to look again

/** How this copy was installed: the Windows installer and the AppImage replace themselves; the rest are told where to download. */
export type InstallKind = 'nsis' | 'appimage' | 'mac' | 'deb' | 'zip' | 'dev'
export function installKind(o: { platform: NodeJS.Platform; packaged: boolean; appImage?: string; hasUninstaller: boolean; exe: string }): InstallKind {
  if (!o.packaged) return 'dev'
  if (o.platform === 'win32') return o.hasUninstaller ? 'nsis' : 'zip'
  if (o.platform === 'darwin') return 'mac'
  if (o.appImage) return 'appimage'
  return /^\/(opt|usr)\//.test(o.exe) ? 'deb' : 'zip'
}
export const selfUpdates = (k: InstallKind) => k === 'nsis' || k === 'appimage'

/** The file each release carries for this system, with the newest version in it. */
export const feedName = (platform: NodeJS.Platform) => (platform === 'win32' ? 'latest.yml' : platform === 'darwin' ? 'latest-mac.yml' : 'latest-linux.yml')
export function feedVersion(yml: string): string | null {
  const m = /^version:\s*['"]?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)['"]?\s*$/m.exec(yml)
  return m ? m[1] : null
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/
/** Whether `a` is a later version than `b` (a pre-release comes before its release). */
export function isNewer(a: string, b: string): boolean {
  const x = VERSION.exec(a), y = VERSION.exec(b)
  if (!x || !y) return false
  for (let i = 1; i <= 3; i++) { const d = Number(x[i]) - Number(y[i]); if (d) return d > 0 }
  if (!x[4] || !y[4]) return !x[4] && !!y[4]
  return x[4].localeCompare(y[4], 'en', { numeric: true }) > 0
}

/** MDLEARN_UPDATE_TEST_URL, for trying an update against a feed on this computer: http://127.0.0.1 only. */
export function testFeed(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' && u.hostname === '127.0.0.1' && !u.username && !u.password ? u.href.replace(/\/+$/, '') : null
  } catch { return null }
}

/** `told`: the version already offered by an automatic check (it is not offered again until a newer one). */
export interface UpdatePrefs { auto: boolean; told?: string; lastCheck?: number }
export function updatePrefs(saved: unknown): UpdatePrefs {
  const o = (saved ?? {}) as Record<string, unknown>
  return {
    auto: o.auto !== false,
    ...(typeof o.told === 'string' && VERSION.test(o.told) ? { told: o.told } : {}),
    ...(typeof o.lastCheck === 'number' && Number.isFinite(o.lastCheck) ? { lastCheck: o.lastCheck } : {}),
  }
}
export const UPDATE_EVERY_MS = 6 * 60 * 60_000
export const dueForCheck = (p: UpdatePrefs, now: number) => p.auto && (p.lastCheck === undefined || now - p.lastCheck >= UPDATE_EVERY_MS)
