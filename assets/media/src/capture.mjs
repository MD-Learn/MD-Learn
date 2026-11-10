// Records the walkthrough's UI segments from a throw-away MDlearn Studio.
//   node capture.mjs --rehearse   walk every step and check every target, no recording
//   node capture.mjs              record: frames from the CDP screencast (native 1920x1080), one folder per segment,
//                                 then each segment becomes a constant 30 fps MP4 plus <segment>.marks.json
// The course on screen is the real one in ./demo-course (lint clean), copied into the course folder file by file, the way
// a coding assistant writes it there.
import { spawn, execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'

const HERE = import.meta.dirname                       // assets/media/src
const REPO = resolve(HERE, '../../..')
const WORK = process.env.WALKTHROUGH_WORK ?? join(homedir(), '.cache/mdlearn-walkthrough')
const { chromium } = await import(join(REPO, 'node_modules/playwright/index.mjs'))
const FIX = join(REPO, 'packages/studio/test/fixtures/class')
const COURSE = join(HERE, 'demo-course')
const OUT = join(WORK, 'capture/segments')
const REHEARSE = process.argv.includes('--rehearse')
// --only yours: record just the "make it yours" segment (fonts, highlights, Explain and the companion, answered by the
// local Ollama model qwen3:8b), on the demo course opened directly
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : ''
const VIEW = { width: 1280, height: 720 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- server ----------
async function startServer() {
  const child = spawn('node', [join(HERE, 'serve.mjs')], {
    env: { ...process.env, MDLEARN_REPO: REPO, PORT: '4811', BASE: REHEARSE || ONLY ? '' : (process.env.DEMO_BASE ?? '/tmp/student'),
      ...(ONLY === 'yours' ? { COURSE: COURSE, OLLAMA: '1', GROWTH: '1' } : {}) },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const line = await new Promise((resolve, reject) => {
    const rl = createInterface({ input: child.stdout })
    rl.on('line', (l) => { if (l.startsWith('{')) resolve(l) })
    child.on('exit', (c) => reject(new Error(`server exited ${c}`)))
  })
  const info = JSON.parse(line)
  return { child, ...info, url: new URL(info.url).origin + '/' } // with a folder open, Studio's url points into it
}

// ---------- recorder: CDP screencast with timestamps ----------
class Recorder {
  constructor(page, name) { this.page = page; this.name = name; this.dir = join(OUT, name); this.frames = []; this.marks = [] }
  async start() {
    if (REHEARSE) return
    mkdirSync(this.dir, { recursive: true })
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = join(this.dir, `f${String(this.frames.length).padStart(5, '0')}.jpg`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      this.frames.push({ file, t: metadata.timestamp })
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 })
    // a tiny scroll-free repaint so the first frame arrives at once
    await this.page.mouse.move(cursor.x + 1, cursor.y)
    await sleep(120)
    this.t0 = Date.now() / 1000
  }
  mark(name) { const t = Date.now() / 1000; this.marks.push({ name, t }); console.log(`  mark ${this.name}:${name}`) }
  async stop() {
    if (REHEARSE) return
    await sleep(200)
    const tEnd = Date.now() / 1000
    await this.cdp.send('Page.stopScreencast')
    await sleep(200)
    const f = this.frames
    if (f.length < 2) throw new Error(`${this.name}: only ${f.length} frames`)
    const first = f[0].t
    const lines = f.map((fr, i) => `file '${fr.file}'\nduration ${Math.max((i + 1 < f.length ? f[i + 1].t : tEnd) - fr.t, 0.001).toFixed(4)}`)
    lines.push(`file '${f.at(-1).file}'`) // the concat demuxer needs it to honour the last duration; -t trims the rest
    writeFileSync(join(OUT, `${this.name}.txt`), lines.join('\n') + '\n')
    writeFileSync(join(OUT, `${this.name}.marks.json`), JSON.stringify({ duration: tEnd - first, marks: this.marks.map((m) => ({ name: m.name, t: +(m.t - first).toFixed(3) })) }, null, 2))
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(OUT, `${this.name}.txt`),
      '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-r', '30', '-t', (tEnd - first).toFixed(3), join(OUT, `${this.name}.mp4`)])
    console.log(`  ${this.name}: ${f.length} frames, ${(tEnd - first).toFixed(1)} s -> segments/${this.name}.mp4`)
  }
}

// ---------- cursor and gestures ----------
const cursor = { x: 900, y: 420 }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
async function moveTo(page, x, y, ms = 650) {
  const from = { ...cursor }
  const steps = Math.max(8, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const e = ease(i / steps)
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
    await sleep(ms / steps)
  }
  cursor.x = x; cursor.y = y
}
async function need(page, locator, label) {
  try { await locator.waitFor({ state: 'visible', timeout: 10_000 }) } catch {
    const seen = await page.evaluate(() => [...document.querySelectorAll('a, button, input, [role]')].filter((e) => e.offsetParent).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)).join(' | '))
    throw new Error(`NOT FOUND: ${label}\n  visible: ${seen.slice(0, 1500)}`)
  }
  console.log(`  ok: ${label}`)
  return locator
}
async function center(page, locator, label) {
  await need(page, locator, label)
  const b = await locator.boundingBox()
  if (!b) throw new Error(`no box: ${label}`)
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}
async function hover(page, locator, label, ms = 650, hold = 500) {
  const c = await center(page, locator, label)
  await moveTo(page, c.x, c.y, ms)
  await sleep(hold)
  return c
}
async function click(page, locator, label, { ms = 650, before = 180, after = 600 } = {}) {
  const c = await center(page, locator, label)
  await moveTo(page, c.x, c.y, ms)
  await sleep(before)
  await page.mouse.down(); await sleep(70); await page.mouse.up()
  await sleep(after)
}
/** Smooth wheel scroll so the element's top lands near `top` px from the viewport top. */
async function scrollTo(page, locator, label, top = 110, ms = 900) {
  await need(page, locator, label)
  for (let pass = 0; pass < 3; pass++) {
    const b = await locator.boundingBox()
    const delta = b.y - top
    if (Math.abs(delta) < 12) break
    const steps = Math.max(10, Math.round(ms / 16))
    let done = 0
    for (let i = 1; i <= steps; i++) {
      const want = delta * ease(i / steps)
      await page.mouse.wheel(0, want - done); done = want
      await sleep(ms / steps)
    }
    await sleep(250)
  }
}
async function injectCursor(ctx) {
  await ctx.addInitScript(() => {
    const mount = () => {
      if (document.getElementById('demo-cursor')) return
      const c = document.createElement('div')
      c.id = 'demo-cursor'
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 2.5 19.5 12.2 12.6 13.4 9.4 20.6Z" fill="#fff" stroke="#1d1d1b" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:22px;height:22px;margin:-3px 0 0 -4px;filter:drop-shadow(0 1px 1.5px rgb(0 0 0 / .35));transform:translate(-100px,-100px)'
      document.documentElement.appendChild(c)
      addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)` }, true)
      addEventListener('mousedown', (e) => {
        const r = document.createElement('div')
        r.style.cssText = `position:fixed;left:${e.clientX - 16}px;top:${e.clientY - 16}px;width:32px;height:32px;border-radius:50%;border:2px solid rgb(44 44 43 / .55);z-index:2147483646;pointer-events:none;transition:transform .45s ease-out, opacity .45s ease-out;transform:scale(.3);opacity:1`
        document.documentElement.appendChild(r)
        requestAnimationFrame(() => { r.style.transform = 'scale(1.25)'; r.style.opacity = '0' })
        setTimeout(() => r.remove(), 600)
      }, true)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
    else mount()
  })
}

// ---------- the segments ----------
async function segHome(page, url) {
  await page.goto(url); await page.waitForLoadState('networkidle')
  await page.mouse.move(cursor.x, cursor.y)
  const rec = new Recorder(page, 'home'); await rec.start()
  await sleep(900)
  for (const step of ['Say what you want to learn', 'An AI writes better notes', 'Study a few minutes a day']) await hover(page, page.getByText(step).first(), `step: ${step}`, 900, 700)
  await hover(page, page.getByRole('link', { name: /Make a course/ }).first(), 'Make a course card', 900, 1600)
  await hover(page, page.getByRole('button', { name: /New here\? Open the tutorial/ }), 'tutorial card', 800, 1200)
  await sleep(800)
  await rec.stop()
}

async function segCourse(page, url) {
  await page.goto(url); await page.waitForLoadState('networkidle')
  await page.mouse.move(cursor.x, cursor.y)
  const rec = new Recorder(page, 'course'); await rec.start()
  await sleep(500)
  rec.mark('open')
  await click(page, page.getByRole('link', { name: /Make a course/ }).first(), 'Make a course', { after: 900 })
  rec.mark('type')
  const topic = page.getByLabel('What do you want to learn?')
  await click(page, topic, 'topic field', { after: 250 })
  await topic.pressSequentially('Heat engines', { delay: 75 })
  await sleep(500)
  rec.mark('files')
  const chooser = page.waitForEvent('filechooser')
  await click(page, page.getByRole('button', { name: 'Choose files' }), 'Choose files', { after: 100 })
  await (await chooser).setFiles([join(FIX, 'Lecture 3.pptx'), join(FIX, 'Handout 2.docx')])
  await need(page, page.getByRole('button', { name: 'Remove Handout 2.docx' }), 'files listed')
  await sleep(900)
  rec.mark('continue')
  await click(page, page.getByRole('button', { name: 'Continue' }), 'Continue', { after: 100 })
  const read = await need(page, page.getByRole('list', { name: 'What was read' }), 'What was read')
  rec.mark('read')
  await sleep(500)
  await hover(page, read.getByText('3 slides, 1 picture'), 'slides read', 700, 900)
  await hover(page, read.getByText('text read, 1 picture'), 'handout read', 500, 900)
  rec.mark('form')
  const form = page.getByRole('region', { name: 'How do you want your course?' })
  await scrollTo(page, form, 'course form', 70, 800)
  await hover(page, form.getByRole('radio', { name: 'Complete' }), 'Length: Complete', 600, 300)
  await click(page, form.getByRole('radio', { name: 'Understand it' }), 'What for: Understand it', { ms: 600, after: 500 })
  rec.mark('writer')
  await scrollTo(page, page.getByRole('heading', { name: 'Who writes the course?' }), 'Who writes', 150, 800)
  await hover(page, page.getByRole('radio', { name: /Claude, from here/ }), 'Claude, from here', 600, 500)
  await hover(page, page.getByRole('radio', { name: /A chat/ }), 'A chat', 600, 400)
  await click(page, page.getByRole('radio', { name: /My coding assistant/ }), 'My coding assistant', { ms: 600, after: 700 })
  await click(page, page.getByRole('button', { name: 'Get the folder ready' }), 'Get the folder ready', { after: 200 })
  await need(page, page.getByText('The course appears here as it is written.'), 'waiting for the course')
  rec.mark('ready')
  const code = await page.locator('code').first().innerText()
  const root = /cd "([^"]+)"/.exec(code)[1]
  await scrollTo(page, page.getByRole('tab', { name: 'Claude Code' }), 'assistant tabs', 300, 700)
  await hover(page, page.locator('code').first(), 'command', 700, 900)
  rec.mark('writing')
  for (const f of ['course.md', '01-energy-in-work-out.md', '02-the-carnot-limit.md', '03-why-real-engines-fall-short.md']) {
    copyFileSync(join(COURSE, f), join(root, f))
    await sleep(850)
  }
  const done = await need(page, page.getByRole('link', { name: 'Start studying' }), 'Start studying')
  rec.mark('written')
  await hover(page, done, 'Start studying', 700, 1800)
  await rec.stop()
  return root
}

async function segSource(page, url, ws) {
  await page.goto(`${url}w/${ws}/doc?path=${encodeURIComponent('02-the-carnot-limit.md')}`); await page.waitForLoadState('networkidle')
  await need(page, page.getByRole('heading', { name: 'The Carnot limit', level: 1 }), 'note title')
  await page.mouse.move(cursor.x, cursor.y)
  const rec = new Recorder(page, 'source'); await rec.start()
  await sleep(700)
  rec.mark('toggle')
  await click(page, page.getByRole('button', { name: 'Show Markdown source' }), 'Show Markdown source', { ms: 800, after: 1200 })
  await moveTo(page, 760, 430, 700)
  await page.mouse.wheel(0, 1)
  for (let i = 0; i < 70; i++) { await page.mouse.wheel(0, 6); await sleep(30) }
  await sleep(1500)
  await rec.stop()
  // back to the rendered page for the next segment
  await page.getByRole('button', { name: /Markdown source|rendered/i }).first().click().catch(() => {})
}

async function segFeatures(page, url, ws) {
  await page.goto(`${url}w/${ws}/doc?path=${encodeURIComponent('02-the-carnot-limit.md')}`); await page.waitForLoadState('networkidle')
  await need(page, page.getByRole('heading', { name: 'The Carnot limit', level: 1 }), 'note title')
  await sleep(800)
  // start with the formula block already in view
  const formula = page.getByText('The Carnot efficiency', { exact: true }).nth(1)
  await scrollTo(page, formula, 'formula block', 120, 200)
  await page.mouse.move(cursor.x, cursor.y)
  const rec = new Recorder(page, 'features'); await rec.start()
  await sleep(600)
  rec.mark('formula')
  for (const name of [/highest efficiency any engine/, /cold reservoir, in kelvin/, /hot reservoir, in kelvin/]) await hover(page, page.getByRole('button', { name }), `term ${name}`, 650, 750)
  rec.mark('plot')
  const slider = page.getByRole('slider').first()
  await scrollTo(page, page.getByText('The Carnot efficiency as the hot side heats up'), 'plot', 70, 900)
  const s = await center(page, slider, 'plot slider')
  const at = (v) => s.b.x + s.b.width * ((v - 200) / 200)
  await moveTo(page, at(290), s.y, 700)
  await sleep(250)
  await page.mouse.down()
  for (const [v, ms] of [[380, 1300], [220, 1500], [300, 900]]) await moveTo(page, at(v), s.y, ms)
  await page.mouse.up()
  await sleep(500)
  rec.mark('animate')
  await scrollTo(page, page.getByText('The Carnot cycle, one step at a time'), 'animation', 120, 900)
  for (let i = 0; i < 3; i++) await click(page, page.getByRole('button', { name: 'Next step' }).first(), `Next step ${i + 1}`, { ms: i ? 300 : 650, after: 1150 })
  rec.mark('study')
  await click(page, page.getByRole('link', { name: 'Study', exact: true }), 'sidebar Study', { ms: 800, after: 300 })
  await need(page, page.getByText(/^Today:/), 'study header')
  await sleep(900)
  rec.mark('answer')
  await need(page, page.getByText('A steam engine takes in 1000 J of heat in one cycle'), 'first card is the energy quiz')
  await click(page, page.getByRole('radio', { name: /400 J of work and 600 J of heat out/ }), 'right option', { ms: 800, after: 500 })
  await click(page, page.getByRole('button', { name: 'Check' }), 'Check', { after: 300 })
  await need(page, page.getByText('Were you sure?'), 'were you sure')
  rec.mark('sure')
  await sleep(700)
  await click(page, page.getByRole('button', { name: /Yes, sure/ }), 'Yes, sure', { ms: 600, after: 200 })
  await need(page, page.getByRole('status').filter({ hasText: /Right/ }), 'verdict')
  rec.mark('verdict')
  await sleep(2400)
  rec.mark('today')
  await click(page, page.getByRole('link', { name: 'Today', exact: true }), 'sidebar Today', { ms: 800, after: 300 })
  await need(page, page.getByRole('heading', { name: 'Today' }), 'Today page')
  await sleep(600)
  await hover(page, page.getByRole('button', { name: /Continue|Start/ }).first(), 'session button', 800, 1800)
  await rec.stop()
}

/** Smooth wheel scroll so `phrase` sits `at` px from the top of the window. */
async function scrollPhrase(page, phrase, label, at, steps = 26) {
  const y = await page.evaluate((ph) => {
    const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT)
    for (let node; (node = walker.nextNode());) {
      const i = node.textContent.indexOf(ph)
      if (i < 0) continue
      const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + ph.length)
      return range.getClientRects()[0].top
    }
    return null
  }, phrase)
  if (y === null) throw new Error(`NOT FOUND: phrase for ${label}`)
  console.log(`  ok: ${label}`)
  for (let i = 1; i <= steps; i++) { await page.mouse.wheel(0, (y - at) / steps); await sleep(16) }
  await sleep(300)
}
/** Select `phrase` in the reading column with a visible mouse drag (scrolling to it smoothly first if needed). */
async function selectPhrase(page, phrase, label, at = null, ms = 500) {
  const rect = () => page.evaluate((ph) => {
    const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT)
    for (let node; (node = walker.nextNode());) {
      const i = node.textContent.indexOf(ph)
      if (i < 0) continue
      const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + ph.length)
      const rs = [...range.getClientRects()], a = rs[0], z = rs.at(-1)
      return { x0: a.left + 1, y0: a.top + a.height / 2, x1: z.right - 1, y1: z.top + z.height / 2 }
    }
    return null
  }, phrase)
  let r = await rect()
  if (!r) throw new Error(`NOT FOUND: phrase for ${label}`)
  if (at !== null || r.y0 < 90 || r.y1 > VIEW.height - 90) {
    const delta = r.y0 - (at ?? VIEW.height * 0.4), steps = 40
    for (let i = 1; i <= steps; i++) { await page.mouse.wheel(0, delta / steps); await sleep(16) }
    await sleep(350); r = await rect()
  }
  console.log(`  ok: ${label}`)
  await moveTo(page, r.x0, r.y0, ms)
  await sleep(120); await page.mouse.down()
  await moveTo(page, r.x1, r.y1, ms)
  await page.mouse.up(); await sleep(350)
}
/** Wait until the text inside `root` stops growing (a streamed AI answer), at least `min` ms. */
async function settled(page, root, label, min = 3000, quiet = 2500, max = 120_000, grow = 200) {
  const t0 = Date.now()
  const base = await root.evaluate((e) => e.innerText.length)
  let last = -1, since = Date.now()
  for (;;) {
    const len = await root.evaluate((e) => e.innerText.length)
    if (len !== last) { last = len; since = Date.now() }
    if (len - base >= grow && Date.now() - t0 > min && Date.now() - since > quiet) break
    if (Date.now() - t0 > max) throw new Error(`no settled answer: ${label}`)
    await sleep(250)
  }
  console.log(`  ok: ${label} (${((Date.now() - t0) / 1000).toFixed(1)} s, +${last - base} chars)`)
}

async function segYours(page, url, ws) {
  const EXPLAIN = 'That never happens, so no engine can beat the reversible one.'
  await page.goto(`${url}w/${ws}/doc?path=${encodeURIComponent('02-the-carnot-limit.md')}`); await page.waitForLoadState('networkidle')
  await need(page, page.getByRole('heading', { name: 'The Carnot limit', level: 1 }), 'note title')
  await sleep(800)
  await scrollTo(page, page.getByText('Why should the', { exact: false }).first(), 'reversible paragraph', 300, 200)
  await page.mouse.move(cursor.x, cursor.y)
  const rec = new Recorder(page, 'yours'); await rec.start()
  await sleep(300)
  rec.mark('font')
  await click(page, page.getByRole('button', { name: 'Font and text size' }), 'Font and text size', { ms: 550, before: 100, after: 300 })
  const menu = page.getByRole('dialog', { name: 'Font and text size' })
  await click(page, menu.getByRole('radio', { name: 'Easy to read' }), 'Easy to read', { ms: 420, before: 100, after: 500 })
  await click(page, menu.getByRole('button', { name: 'Bigger text' }), 'Bigger text', { ms: 380, before: 80, after: 450 })
  await page.keyboard.press('Escape'); await sleep(200)
  rec.mark('highlight')
  // once: the passage to explain high in the window, so its explanation has room below it in the notes column
  await scrollPhrase(page, EXPLAIN, 'passage to explain', 160)
  await selectPhrase(page, 'from cold to hot', 'phrase to highlight', null, 400)
  await click(page, page.getByRole('group', { name: 'Highlight colour' }).getByRole('button', { name: 'Yellow' }), 'Yellow', { ms: 350, before: 100, after: 700 })
  rec.mark('explain')
  await selectPhrase(page, EXPLAIN, 'phrase to explain', null, 450)
  await click(page, page.getByRole('toolbar', { name: 'Selected text' }).getByRole('button', { name: 'Explain' }), 'Explain', { ms: 420, before: 100, after: 150 })
  rec.mark('explain-asked')
  await moveTo(page, 760, 600, 600)
  await settled(page, page.locator('aside, [role=complementary]').last(), 'explanation')
  rec.mark('explain-done')
  await sleep(1200)
  rec.mark('companion')
  await click(page, page.getByTitle('Ask about your course'), 'Pixel, the companion', { ms: 650, before: 100, after: 400 })
  const box = page.getByPlaceholder('Ask anything about your course')
  await click(page, box, 'question box', { ms: 300, before: 80, after: 100 })
  await box.pressSequentially('Why must the Carnot formula use kelvin?', { delay: 30 })
  await sleep(200); await page.keyboard.press('Enter')
  rec.mark('companion-asked')
  await moveTo(page, cursor.x + 150, cursor.y - 240, 700)
  await settled(page, page.getByRole('dialog', { name: 'Companion' }), 'companion answer', 4000)
  rec.mark('companion-done')
  await sleep(2200)
  await rec.stop()
}

// ---------- run ----------
mkdirSync(OUT, { recursive: true })
const server = await startServer()
console.log(`studio ${server.url} (${server.base})${REHEARSE ? ' — rehearsal' : ''}`)
const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1.5'] })
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1.5, colorScheme: 'light', reducedMotion: 'no-preference' })
await injectCursor(ctx)
const page = await ctx.newPage()
let failed = false
try {
  if (ONLY === 'yours') {
    const ws = (await page.goto(server.url), await page.evaluate(() => fetch('/api/workspaces').then((r) => r.json()))).find((w) => w.name === 'Heat engines').id
    console.log('# yours'); await segYours(page, server.url, ws)
    console.log(REHEARSE ? 'REHEARSAL PASSED' : 'RECORDING DONE')
    throw null // done: skip the other segments
  }
  console.log('# home'); await segHome(page, server.url)
  console.log('# course'); await segCourse(page, server.url)
  const ws = (await page.evaluate(() => fetch('/api/workspaces').then((r) => r.json()))).find((w) => w.name === 'Heat engines').id
  console.log('# source'); await segSource(page, server.url, ws)
  console.log('# features'); await segFeatures(page, server.url, ws)
  console.log(REHEARSE ? 'REHEARSAL PASSED' : 'RECORDING DONE')
} catch (e) {
  if (e !== null) {
    failed = true
    console.error(e.message)
    await page.screenshot({ path: join(WORK, 'capture-failure.png') }).catch(() => {})
  }
} finally {
  await browser.close()
  server.child.kill('SIGTERM')
}
process.exit(failed ? 1 : 0)
