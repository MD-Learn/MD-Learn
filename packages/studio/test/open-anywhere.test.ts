import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync } from 'node:fs'
import { join, parse } from 'node:path'
import { tmpdir } from 'node:os'
import { settingsStore } from '../server/settings'
import { Workspaces, workspaceId } from '../server/workspaces'

const made: string[] = []
const tmp = (p: string) => { const d = realpathSync(mkdtempSync(join(tmpdir(), p))); made.push(d); return d }
const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** A home folder with one course in it, and Studio's settings beside it. */
function setup() {
  const home = tmp('mdl-home-')
  process.env.HOME = home; process.env.USERPROFILE = home
  const course = join(home, 'ESA-PROJECTS')
  mkdirSync(join(course, 'learn'), { recursive: true })
  writeFileSync(join(course, 'learn', 'orbits.learn.md'), '---\nid: orbits\ntitle: Orbits\n---\n\n# Orbits\n')
  const settings = settingsStore(join(tmp('mdl-cfg-'), 's.json'))
  return { home, course, settings, workspaces: new Workspaces(settings) }
}

describe('opening folders from anywhere', () => {
  it('will not open the whole home folder, or the top of the disk, as one folder of notes', () => {
    const { home, course, workspaces } = setup()
    expect(() => workspaces.open(home)).toThrow(/whole home folder/)
    expect(() => workspaces.open('~')).toThrow(/whole home folder/)
    expect(() => workspaces.open(parse(home).root)).toThrow(/whole home folder/)
    expect(workspaces.open(course).root).toBe(course)
  })

  it('leaves out a home folder that an older version kept among the recents', () => {
    const { home, course, settings, workspaces } = setup()
    settings.update((s) => ({ ...s, recents: [{ root: home, lastOpened: 2 }, { root: course, lastOpened: 1 }] }))
    expect(workspaces.list().map((w) => w.root)).toEqual([course])
    expect(workspaces.get(workspaceId(home))).toBeUndefined()
    expect(workspaces.get(workspaceId(course))?.root).toBe(course)
  })
})
