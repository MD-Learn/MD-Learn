// Test server: copies the core test curriculum (plus a visuals document) to a temp folder and serves it.
import { cpSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { startStudio } from '../dist/server/index.js'

const here = import.meta.dirname
const LONG = ('range gain target antenna power ' + 'listens ').repeat(16)
const root = mkdtempSync(join(tmpdir(), 'mdl-e2e-'))
cpSync(resolve(here, '../../core/test/fixtures/curriculum'), root, { recursive: true })
mkdirSync(join(root, 'demo'), { recursive: true })
writeFileSync(join(root, 'demo/visuals.md'), `# Visuals

:::plot[Power law]{y=log}
$$P = \\frac{A}{R^4}$$
- $R$ in [1, 10] — range
- $A$ = 1 in [0.1, 10] log — gain
:::

:::formula[Energy]
$$E = m c^2$$
- $m$ — mass
- $c^2$ — speed of light, squared
:::

:::animate[Two steps]
1. $$a = b$$ First.
2. $$a + 1 = b + 1$$ Second.
:::

:::sim[Runaway]{height=160}
Never stops.
\`\`\`js
while (true) {}
\`\`\`
:::
`)
writeFileSync(join(root, 'demo/radar-terms.md'), `# Radar terms

## 1. Basics

**Backscatter** is the power returned toward the radar by the target and its surroundings.

Power spreads with range, which gives the received power:

$$P_r = \\frac{P_t G^2 \\lambda^2 \\sigma}{(4\\pi)^3 R^4}$$

Later, backscatter depends on roughness. See [the visuals](visuals.md) and [Python](python.md).

## 2. More

Backscatter again, now in a second section.
`)
// a note as a course writes it: Spanish, a marked definition, a list of definitions and an "explain" question
const filler = 'Cada decisión real depende de muchas cantidades a la vez, y por eso necesitamos funciones que las tengan en cuenta todas juntas. '
writeFileSync(join(root, 'demo/apuntes.md'), `# Optimización

## Funciones

Una <mark data-tone="definition">función de varias variables</mark> es una regla que toma varias entradas y devuelve un solo número.

${filler.repeat(8)}

- **Mínimo local**: los valores cercanos son mayores o iguales.
- **Máximo local**: los valores cercanos son menores o iguales.

## Explicar

:::explain
Explica con tus palabras qué es una función de varias variables.
> - Toma varias entradas a la vez.
> - Devuelve un solo número.
:::

${filler.repeat(4)}
`)
writeFileSync(join(root, 'demo/long-sheet.md'), `# Long sheet

## 1. First part

${LONG}

**Aperture** is the effective area with which an antenna collects power from a passing wave.

$$A_e = \\frac{G \\lambda^2}{4\\pi}$$

## 2. Second part

${LONG}

$$S = \\frac{P_t}{4\\pi R^2}$$
`)
writeFileSync(join(root, 'demo/editable.md'), '# Editable\n\nFirst paragraph.\n')
writeFileSync(join(root, 'demo/picture-notes.md'), '# Picture notes\n\nStart here.\n')
writeFileSync(join(root, 'demo/web-pictures.md'), `# Web pictures

![A tide gauge](https://pictures.example.org/gauge.png)

<img src="https://pictures.example.org/from-html.png" alt="A chart in HTML" width="120">

![A lost picture](https://pictures.example.org/gone.png)
`)
writeFileSync(join(root, 'demo/web-tricks.md'), `# Tricks

<table background="https://tricks.example.org/table.png"><tr><td>A cell</td></tr></table>

<svg width="40" height="40"><image href="https://tricks.example.org/svg.png" width="40" height="40"/></svg>

<svg width="40" height="40"><filter id="f"><feImage href="https://tricks.example.org/filter.png"/></filter><rect width="40" height="40" filter="url(#f)"/></svg>
`)
// Related passages: a document on two subjects, and one document for each
const glacierText = 'Glacier ice creeps downhill under its own weight, and basal sliding over meltwater speeds the flow of the ice. '
const riverText = 'A braided river splits around sediment bars, and every flood moves the gravel and reshapes the channels. '
writeFileSync(join(root, 'demo/landscapes.md'), `# Landscapes\n\n## How ice moves\n\n${`${glacierText.repeat(6)}\n\n`.repeat(12)}## How rivers braid\n\n${`${riverText.repeat(6)}\n\n`.repeat(12)}`)
writeFileSync(join(root, 'demo/ice-sheets.md'), `# Ice sheets\n\n## Creep and sliding\n\n${glacierText.repeat(2)}\n`)
writeFileSync(join(root, 'demo/river-bars.md'), `# River bars\n\n## Gravel in floods\n\n${riverText.repeat(2)}\n`)
// a 6 s VP8 clip with captions, a question it pauses for at 0:02, and a YouTube video (never contacted in tests)
mkdirSync(join(root, 'demo/clips'), { recursive: true })
cpSync(resolve(here, 'fixtures/clip.webm'), join(root, 'demo/clips/clip.webm'))
cpSync(resolve(here, 'fixtures/clip.vtt'), join(root, 'demo/clips/clip.vtt'))
writeFileSync(join(root, 'demo/video.md'), `# Video

## Watching

::video[clips/clip.webm]{title="Blue clip" captions=clips/clip.vtt}

:::quiz{at=0:02}
Which colour fills the screen?
- [x] Blue
- [ ] Red
  > It is blue from start to end.
:::

## Online

::video[https://youtu.be/dQw4w9WgXcQ]{start=1:00 end=2:00}
`)
writeFileSync(join(here, '.root'), root) // tests reset progress here between study runs
cpSync(resolve(here, '../../core/test/fixtures/02-bayes-theorem.learn.md'), join(root, 'learn/02-bayes-theorem.learn.md'))
writeFileSync(join(root, 'demo/python.md'), `# Python

\`\`\`python
x = 41
print(x + 1)
\`\`\`

\`\`\`python
print(x * 2)
\`\`\`

\`\`\`python
while True:
    pass
\`\`\`
`)
// A stand-in for Ollama (so nothing here needs a GPU): both models installed, embeddings are word-bag hashes,
// answers cite the first passage they were given; a download takes a moment and then lists the model.
let installed = [{ name: 'qwen3:8b', size: 5.2e9 }, { name: 'embeddinggemma:latest', size: 6.2e8 }, { name: 'gpt-oss:120b-cloud', size: 384, remote_host: 'https://ollama.com:443' }]
const bag = (text) => { const v = new Array(48).fill(0); for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) { let h = 0; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 48; v[h] += 1 } return v }
const ollama = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/page') { res.setHeader('content-type', 'text/html'); res.end(`<html><head><title>Imported article</title></head><body><article><h1>An imported article</h1><p>${'Radar measures the delay and the Doppler shift of an echo to find range and speed. '.repeat(8)}</p><p>Energy and mass are related by <span class="katex"><annotation encoding="application/x-tex">E = mc^2</annotation></span> in every frame.</p></article></body></html>`); return }
  if (req.url === '/api/tags') { res.end(JSON.stringify({ models: installed })); return }
  if (req.url === '/api/version') { res.end(JSON.stringify({ version: '0.17.4' })); return }
  // a stand-in for the npm registry ("a new version is out"); the check is off until a test turns it on
  if (req.url === '/registry/mdlearn/latest') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ name: 'mdlearn', version: '9.9.9' })); return }
  let body = ''
  req.on('data', (d) => (body += d)).on('end', () => {
    const j = JSON.parse(body || '{}')
    if (req.url === '/api/embed') { res.end(JSON.stringify({ embeddings: j.input.map(bag) })); return }
    if (req.url === '/api/delete') { installed = installed.filter((m) => m.name !== j.model); res.end(); return }
    if (req.url === '/api/pull') {
      res.setHeader('content-type', 'application/x-ndjson')
      const total = 2.5e9
      let step = 0
      const tick = setInterval(() => {
        step++
        if (step <= 4) { res.write(JSON.stringify({ status: 'pulling layer', total, completed: total * step / 4 }) + '\n'); return }
        clearInterval(tick)
        installed = [...installed.filter((m) => m.name !== j.model), { name: j.model, size: total }]
        res.end(JSON.stringify({ status: 'success' }) + '\n')
      }, 400)
      return
    }
    res.setHeader('content-type', 'application/x-ndjson')
    const teach = j.messages?.[0]?.content?.includes('teach-back')
    const reply = teach ? JSON.stringify({ ideas: [{ index: 1, verdict: 'covered', evidence: 'power drops fast' }, { index: 2, verdict: 'missing' }], misconceptions: [{ quote: 'doubling the range halves the power', correction: 'Doubling the range divides the power by sixteen.' }], followUp: 'Why the fourth power and not the second?', feedback: 'You have the main idea.' })
      : j.format ? JSON.stringify({ ideas: ['Received power falls with the fourth power of range.', 'Gain counts twice, so doubling it quadruples the power.'] }) : j.messages?.at(-1)?.content?.includes('Passages:') ? 'Backscatter is the power returned toward the radar [1].' : 'Fine.'
    for (const piece of reply.match(/.{1,12}/g)) res.write(JSON.stringify({ message: { content: piece }, done: false }) + '\n')
    res.end(JSON.stringify({ done: true }) + '\n')
  })
}).listen(0)
await new Promise((r) => ollama.once('listening', r))
writeFileSync(join(here, '.ollama-port'), String(ollama.address().port))
// A stand-in for an OpenAI-compatible cloud AI (Settings → Cloud AI): it checks the key and streams its answers
const CLOUD_KEY = 'sk-e2e-cloud-0123456789abcd'
const cloud = createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${CLOUD_KEY}`) { res.statusCode = 401; res.end(JSON.stringify({ error: { message: 'Invalid API key.' } })); return }
  if (req.url === '/v1/models') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'cloud-small' }, { id: 'cloud-large' }] })); return }
  let body = ''
  req.on('data', (d) => (body += d)).on('end', () => {
    const j = JSON.parse(body || '{}')
    const system = j.messages?.[0]?.content ?? ''
    const reply = system.includes('teach-back') ? JSON.stringify({ ideas: [{ index: 1, verdict: 'covered', evidence: 'from the cloud' }, { index: 2, verdict: 'missing' }], misconceptions: [], followUp: 'What does the cloud say next?', feedback: 'Feedback from the cloud.' })
      : j.response_format ? JSON.stringify({ ideas: ['A key idea from the cloud.', 'Another idea from the cloud.'] })
      : j.messages?.at(-1)?.content?.includes('Passages:') ? 'From the cloud: backscatter is the power returned [1].' : 'From the cloud: the passage, step by step.'
    res.setHeader('content-type', 'text/event-stream')
    for (const piece of reply.match(/.{1,12}/g)) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    res.end('data: [DONE]\n\n')
  })
}).listen(0, '127.0.0.1')
await new Promise((r) => cloud.once('listening', r))
writeFileSync(join(here, '.cloud-port'), String(cloud.address().port))
// A stand-in for SciNet's API: two papers, one read from the PDF's text and one by Marker
const PAPERS = [
  { id: 1, title: 'Statistical physics of adaptation', year: 2016, status: 'ready', authors: ['N. Perunov', 'J. England'], venue: 'Physical Review X', abstract: 'How driven matter comes to look adapted to its environment.', doi: null, arxiv_id: '1412.1875', page_count: 12, parse: { tier: 0, parser: 'pymupdf' } },
  { id: 2, title: 'A paper read by Marker', year: 2021, status: 'ready', authors: [], venue: null, abstract: null, doi: null, arxiv_id: null, page_count: 3, parse: { tier: 1, parser: 'marker' } },
]
const scinet = createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  const send = (body) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
  const one = PAPERS.find((p) => u.pathname.startsWith(`/api/papers/${p.id}`))
  if (u.pathname === '/api/health') send({ status: 'ok', version: '0.9.0', pipeline_version: 3 })
  else if (u.pathname === '/api/papers') send({ items: PAPERS.filter((p) => p.title.toLowerCase().includes((u.searchParams.get('q') ?? '').toLowerCase())), total: PAPERS.length, offset: 0, limit: 30 })
  else if (u.pathname === '/api/search/semantic') send({ mode: 'semantic', query: u.searchParams.get('q'), hits: [{ paper_id: 1, title: PAPERS[0].title, score: 0.8, snippet: 'Driven matter and dissipation.' }] })
  else if (one && u.pathname.endsWith('/markdown')) { res.setHeader('content-type', 'text/plain'); res.end(`## Introduction\n\n${'Work absorbed from the drive, with α and β and σ and μ and Σ as the symbols of the story. '.repeat(8)}\n`) }
  else if (one) send(one)
  else { res.statusCode = 404; send({ detail: 'not found' }) }
}).listen(0, '127.0.0.1')
await new Promise((r) => scinet.once('listening', r))
writeFileSync(join(here, '.scinet-port'), String(scinet.address().port))
const cfgDir = mkdtempSync(join(tmpdir(), 'mdl-e2e-cfg-'))
const settingsFile = join(cfgDir, 's.json')
// the welcome tour is tested on its own (onboarding.spec), and so is the companion's growth (companion.spec), whose
// notices would land in other tests; the library (tutorial, uploads) stays in the temp folder
writeFileSync(settingsFile, JSON.stringify({ ollama: { url: `http://127.0.0.1:${ollama.address().port}`, model: 'qwen3:8b', embedModel: 'embeddinggemma' },
  scinet: { url: `http://127.0.0.1:${scinet.address().port}` }, libraryDir: join(cfgDir, 'library'), onboarding: { tourDone: true }, companion: { growth: false }, updates: { check: false } }))
// the network behind web pictures: every test address is public, and gone.png is gone
const PICTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const pictureFetch = { resolve: async () => ['93.184.216.34'], fetch: async (url) => (String(url).endsWith('/gone.png') ? new Response('gone', { status: 404 }) : new Response(PICTURE)) }
const s = await startStudio({ root, port: 4799, fakeAi: true, fakeTex: true, settingsFile, pictureFetch, updatesUrl: `http://127.0.0.1:${ollama.address().port}/registry/mdlearn/latest` })
console.log(`e2e studio on ${s.url} (folder ${root})`)
