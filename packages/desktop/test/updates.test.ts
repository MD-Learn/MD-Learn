import { describe, it, expect } from 'vitest'
import { feedName, feedVersion, installKind, isNewer, selfUpdates, testFeed, updatePrefs, dueForCheck, UPDATE_EVERY_MS } from '../src/rules'

describe('how the desktop app updates', () => {
  it('knows how it was installed', () => {
    const base = { packaged: true, appImage: undefined, hasUninstaller: false, exe: '/home/me/MDlearn/mdlearn' }
    expect(installKind({ ...base, platform: 'win32', hasUninstaller: true, exe: 'C:\\Users\\me\\AppData\\Local\\Programs\\MDlearn\\MDlearn.exe' })).toBe('nsis')
    expect(installKind({ ...base, platform: 'win32', exe: 'D:\\apps\\MDlearn\\MDlearn.exe' })).toBe('zip')
    expect(installKind({ ...base, platform: 'linux', appImage: '/home/me/Apps/MDlearn.AppImage' })).toBe('appimage')
    expect(installKind({ ...base, platform: 'linux', exe: '/opt/MDlearn/mdlearn' })).toBe('deb')
    expect(installKind({ ...base, platform: 'linux' })).toBe('zip')
    expect(installKind({ ...base, platform: 'darwin', exe: '/Applications/MDlearn.app/Contents/MacOS/MDlearn' })).toBe('mac')
    expect(installKind({ ...base, platform: 'linux', packaged: false })).toBe('dev')
  })
  it('installs by itself only where it can replace itself: the Windows installer and the AppImage', () => {
    expect(['nsis', 'appimage', 'mac', 'deb', 'zip', 'dev'].filter((k) => selfUpdates(k as never))).toEqual(['nsis', 'appimage'])
  })
  it('reads the version from the release feed of its system', () => {
    expect(feedName('win32')).toBe('latest.yml')
    expect(feedName('darwin')).toBe('latest-mac.yml')
    expect(feedName('linux')).toBe('latest-linux.yml')
    expect(feedVersion('version: 1.9.1\nfiles:\n  - url: MDlearn-1.9.1-linux-x86_64.AppImage\n')).toBe('1.9.1')
    expect(feedVersion("version: '2.0.0-beta.1'\n")).toBe('2.0.0-beta.1')
    expect(feedVersion('not a feed')).toBeNull()
  })
  it('compares versions as numbers, and a test build is older than its release', () => {
    expect(isNewer('1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('1.9.0', '1.9.0')).toBe(false)
    expect(isNewer('1.8.9', '1.9.0')).toBe(false)
    expect(isNewer('1.9.1', '1.9.1-test')).toBe(true)
    expect(isNewer('1.9.1-test', '1.9.0')).toBe(true)
    expect(isNewer('garbage', '1.9.0')).toBe(false)
  })
  it('takes a test feed only on this computer', () => {
    expect(testFeed('http://127.0.0.1:8123/feed/')).toBe('http://127.0.0.1:8123/feed')
    expect(testFeed(undefined)).toBeNull()
    for (const bad of ['https://example.org/feed', 'http://localhost.evil.org:8123/', 'http://192.168.1.2:8000/', 'file:///tmp/feed', 'http://u:p@127.0.0.1:1/'])
      expect(testFeed(bad), bad).toBeNull()
  })
  it('reads its saved choices, checking automatically unless turned off', () => {
    expect(updatePrefs(undefined)).toEqual({ auto: true })
    expect(updatePrefs({ auto: false, told: '1.9.1', lastCheck: 5 })).toEqual({ auto: false, told: '1.9.1', lastCheck: 5 })
    expect(updatePrefs({ auto: 'yes', told: 3, extra: 1 })).toEqual({ auto: true })
  })
  it('checks again after six hours', () => {
    const now = 10 * UPDATE_EVERY_MS
    expect(dueForCheck({ auto: true }, now)).toBe(true)
    expect(dueForCheck({ auto: true, lastCheck: now - UPDATE_EVERY_MS + 1000 }, now)).toBe(false)
    expect(dueForCheck({ auto: true, lastCheck: now - UPDATE_EVERY_MS }, now)).toBe(true)
    expect(dueForCheck({ auto: false }, now)).toBe(false)
  })
})

describe('the update dialogs', () => {
  it('speak the system language, English otherwise, and every language has every line', async () => {
    const { strings } = await import('../src/strings')
    expect(strings('it-IT')('readyTitle', '1.9.1')).toBe('MDlearn 1.9.1 è pronto')
    expect(strings('ca')('restart')).toBe('Reinicia ara')
    expect(strings('de-DE')('later')).toBe('Later')
    for (const lang of ['en', 'it', 'es', 'fr', 'ca']) for (const key of ['help', 'check', 'auto', 'readyTitle', 'readyDetail', 'restart', 'later', 'availableTitle', 'availableDetail', 'download', 'downloading', 'latestTitle', 'latestDetail', 'failedTitle', 'off'] as const)
      expect(strings(lang)(key, '1').length, `${lang} ${key}`).toBeGreaterThan(0)
  })
})
