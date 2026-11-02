import { describe, it, expect, afterEach } from 'vitest'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const cli = (...args: string[]) => spawnSync(process.execPath, [resolve(__dirname, '../dist/index.js'), ...args], { encoding: 'utf8' })

const made: string[] = []
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }) })
/** What `mdlearn studio` prints once it is running, started in `cwd` with its settings kept apart. */
function studioSays(cwd: string, ...args: string[]): Promise<string> {
  const config = mkdtempSync(join(tmpdir(), 'mdl-cfg-')); made.push(config)
  const p = spawn(process.execPath, [resolve(__dirname, '../dist/index.js'), 'studio', '--no-open', '--port', '47391', ...args], { cwd, env: { ...process.env, XDG_CONFIG_HOME: config } })
  let out = ''
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { p.kill(); fail(new Error(`Studio did not start: ${out}`)) }, 20_000)
    p.stdout.on('data', (b: Buffer) => { out += b; if (/Press Ctrl\+C/.test(out)) { clearTimeout(timer); p.kill(); done(out) } })
    p.stderr.on('data', (b: Buffer) => { out += b })
  })
}

describe('mdlearn in a terminal', () => {
  it('says its version', () => {
    const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { version: string }
    expect(cli('--version').stdout.trim()).toBe(version)
    expect(cli('-v').stdout.trim()).toBe(version)
  })
  it('explains a mistyped option instead of crashing', () => {
    const r = cli('--verson')
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/^mdlearn: Unknown option '--verson'\. Run "mdlearn" for the list\.\n$/)
  })
  it('starts Studio on its home page wherever it is run, and opens a folder only when asked', async () => {
    const here = realpathSync(mkdtempSync(join(tmpdir(), 'mdl-anywhere-'))); made.push(here)
    mkdirSync(join(here, 'course', 'learn'), { recursive: true })
    writeFileSync(join(here, 'course', 'learn', 'orbits.learn.md'), '---\nid: orbits\ntitle: Orbits\n---\n\n# Orbits\n')
    expect(await studioSays(here)).not.toMatch(/Folder:/)
    expect(await studioSays(join(here, 'course'))).not.toMatch(/Folder:/)
    expect(await studioSays(here, 'course')).toMatch(`Folder: ${join(here, 'course')}`)
  }, 60_000)
})
