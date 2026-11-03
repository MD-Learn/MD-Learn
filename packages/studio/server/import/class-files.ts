// The files of a class: originals go to sources/ (in the folders they came in), and what can be turned into text goes
// to sources/text/ with its pictures in sources/media/, so any assistant can read them. Code, notebooks, data and
// pictures stay as they are: the AI reads them itself. One file that can't be read never stops the others.
import { extname, posix } from 'node:path'
import type { Handle } from '../workspaces.js'
import { UserError } from '../workspaces.js'
import { freePath, slugify, writeNew } from './common.js'
import { slidesToMarkdown, wordToMarkdown, type OfficeText } from './office.js'
import { pdfToMarkdown } from './pdf-fast.js'
import type { ClassFile } from '../../shared/types.js'

export const SOURCES = 'sources'
const OLD_FORMAT = /\.(ppt|doc|odt|odp|key|pages)$/i

const CODE = /^\.(py|ipynb|r|rmd|jl|m|js|mjs|cjs|ts|jsx|tsx|java|kt|scala|c|h|cpp|hpp|cc|cs|go|rs|rb|php|swift|sql|sh|bash|ps1|bat|lua|pl|hs|ml|dart|f90|css|scss|html?|vue|svelte)$/
const kindOf = (name: string): ClassFile['kind'] => {
  const ext = extname(name).toLowerCase()
  return ext === '.docx' ? 'word' : ext === '.pptx' ? 'slides' : ext === '.pdf' ? 'pdf' : /^\.(png|jpe?g|gif|webp|svg)$/.test(ext) ? 'picture'
    : /^\.(md|markdown|txt|tex|bib|rst|org)$/.test(ext) ? 'text' : CODE.test(ext) ? 'code' : /^\.(csv|tsv|json|xml|ya?ml|toml)$/.test(ext) ? 'data' : 'other'
}
/** Keep the file's own name, which is what the person knows it by, without anything that could make it a path. */
const cleanName = (name: string) => {
  const clean = name.replace(/[\\/]/g, '_').replace(/[\0-\x1f]/g, '').replace(/^\.+/, '').replace(/[. ]+$/, '').slice(-120) || 'file'
  return /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(clean) ? `_${clean}` : clean // Windows reserves these names
}
/** Where a file sat in a dropped folder, kept so code can still import by path: each folder cleaned like a name, at most four. */
export const folderOf = (path: string | undefined) =>
  (path ?? '').replace(/\\/g, '/').split('/').slice(0, -1).filter((p) => p && p !== '.' && p !== '..').slice(0, 4).map(cleanName).join('/')
const GENERATED = new Set(['text', 'media']) // what MDlearn makes from the originals, not where they go

async function convert(h: Handle, stem: string, slug: string, kind: ClassFile['kind'], bytes: Uint8Array): Promise<Partial<ClassFile>> {
  const media = posix.join(SOURCES, 'media', slug)
  const url = (name: string) => posix.join('..', 'media', slug, name)
  let text: OfficeText | { markdown: string }
  if (kind === 'word') text = await wordToMarkdown(bytes, url)
  else if (kind === 'slides') text = slidesToMarkdown(bytes, url)
  else text = await pdfToMarkdown(bytes)
  const office = 'pictures' in text ? text : null
  for (const p of office?.pictures ?? []) writeNew(h, freePath(h, media, p.name.replace(/\.\w+$/, ''), extname(p.name)), p.bytes)
  const path = writeNew(h, freePath(h, posix.join(SOURCES, 'text'), slug), `# ${stem}\n\n${text.markdown}\n`)
  return { text: path, ...(office ? { pictures: office.pictures.length, skipped: office.skipped, equations: office.equations, ...(office.slides ? { slides: office.slides } : {}) } : {}) }
}

export async function addClassFile(h: Handle, rawName: string, bytes: Uint8Array, at?: string): Promise<ClassFile> {
  const name = cleanName(rawName), ext = extname(name), stem = name.slice(0, name.length - ext.length)
  const kind = kindOf(name)
  const folder = folderOf(at), dir = folder && !GENERATED.has(folder.split('/')[0]) ? posix.join(SOURCES, folder) : SOURCES
  const path = writeNew(h, freePath(h, dir, stem, ext), bytes)
  const file: ClassFile = { name, path, kind }
  if (kind === 'picture' || kind === 'text' || kind === 'code' || kind === 'data') return file
  if (kind === 'other') return { ...file, problem: OLD_FORMAT.test(name) ? 'old-format' : 'unknown-type' }
  try {
    return { ...file, ...await convert(h, stem, slugify(stem, 60) || 'file', kind, bytes) }
  } catch (e) {
    if (e instanceof UserError && e.code === 'empty') return { ...file, problem: 'no-text' }
    return { ...file, problem: 'unreadable' }
  }
}
