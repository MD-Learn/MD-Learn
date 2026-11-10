// A throw-away MDlearn Studio for the walkthrough capture: an empty library and its own settings file under BASE,
// so nothing on this computer (settings, library, progress) is read or changed. BASE must not exist yet.
// COURSE: a course folder to copy into the library (as "Heat engines") and open; OLLAMA: answer Ask and Explain with the
// local Ollama model qwen3:8b; GROWTH: show the companion's level. Prints {"url", "base", "library"} once listening.
import { cpSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const REPO = process.env.MDLEARN_REPO
const PORT = Number(process.env.PORT ?? 4811)
const { startStudio } = await import(join(REPO, 'packages/studio/dist/server/index.js'))

const wanted = process.env.BASE
const base = wanted && !existsSync(wanted) ? wanted : mkdtempSync(join(tmpdir(), 'mdl-walkthrough-'))
const library = join(base, 'MDlearn', 'library')
mkdirSync(library, { recursive: true })
const settingsFile = join(base, 'studio.json')
// tour seen, growth notices off and no update checks, so nothing pops over the footage
const settings = { libraryDir: library, onboarding: { tourDone: true }, companion: { growth: process.env.GROWTH === '1' }, updates: { check: false } }
if (process.env.OLLAMA === '1') settings.ollama = { url: 'http://127.0.0.1:11434', model: 'qwen3:8b', embedModel: 'embeddinggemma' }
writeFileSync(settingsFile, JSON.stringify(settings))
let root
if (process.env.COURSE) { root = join(library, 'Heat engines'); cpSync(process.env.COURSE, root, { recursive: true }) }
const studio = await startStudio({ port: PORT, settingsFile, ...(root ? { root } : {}) })
console.log(JSON.stringify({ url: studio.url, base, library }))
