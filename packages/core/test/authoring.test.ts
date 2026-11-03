import { describe, it, expect } from 'vitest'
import { splitBundle, safeBundlePath, fixMessage, coursePrompt, compile } from '../src/index.js'
import { MAX_BUNDLE_FILES } from '../src/authoring.js'

const LESSON = (title: string) => `---\ntitle: ${title}\nlevel: beginner\n---\n\n## A card\n\nText.\n`

describe('chat bundles', () => {
  it('splits files after `<!-- file: -->` lines, inside fences, and ignores the chat around them', () => {
    const answer = `Here is your course!

<!-- file: tides/course.md -->
~~~~markdown
# Tides
~~~~

<!-- file: tides/01-why-tides.learn.md -->
~~~~markdown
${LESSON('Why tides')}
:::code
Write \`f\`.
\`\`\`python
def f(): ...
\`\`\`
\`\`\`python test
assert f() is None
\`\`\`
:::
~~~~
Hope this helps.`
    const files = splitBundle(answer)
    expect(files.map((f) => f.path)).toEqual(['tides/course.md', 'tides/01-why-tides.learn.md'])
    expect(files[1].content).toContain('```python test') // code fences inside the file survive
    expect(files[1].content).not.toContain('~~~~')
    expect(files[1].content).not.toContain('Hope this helps')
  })
  it('takes the last closing fence when the chat wrapped a file in the same backtick fence it uses inside', () => {
    const files = splitBundle('<!-- file: a.learn.md -->\n```markdown\n---\ntitle: A\n---\n## C\n```js\nx\n```\n```\n')
    expect(files[0].content).toContain('```js\nx\n```')
  })
  it('reads raw files between markers and a lone lesson without markers', () => {
    expect(splitBundle(`<!-- file: one.learn.md -->\n${LESSON('One')}\n<!-- file: two.md -->\n${LESSON('Two')}`).map((f) => f.path)).toEqual(['one.learn.md', 'two.learn.md'])
    expect(splitBundle(LESSON('Plate Tectonics 101'))).toMatchObject([{ path: 'plate-tectonics-101.learn.md' }])
  })
  it('keeps paths inside the folder and makes them lessons', () => {
    expect(safeBundlePath('../etc/passwd')).toBeNull()
    expect(safeBundlePath('/abs/x.learn.md')).toBe('abs/x.learn.md')
    expect(safeBundlePath('C:\\notes\\Intro Lesson.md')).toBe('C-/notes/Intro-Lesson.learn.md')
    expect(safeBundlePath('`intro`')).toBe('intro.learn.md')
    expect(safeBundlePath('a/b/c/d/e.learn.md')).toBeNull()
    expect(splitBundle(`<!-- file: x.learn.md -->\n${LESSON('A')}\n<!-- file: x.learn.md -->\n${LESSON('B')}`).map((f) => f.path)).toEqual(['x.learn.md', 'x-2.learn.md'])
  })
  it('stays fast on hostile input: no backtracking on long lines, a cap on the number of files', () => {
    const spaces = ' '.repeat(400_000)
    for (const evil of [`<!-- file: a${spaces}x\n${LESSON('A')}`, `title:${spaces}x\n## A`, `<!-- file: a.learn.md -->\n\`\`\`${spaces}x\n${LESSON('A')}`]) {
      const t0 = performance.now()
      splitBundle(evil)
      expect(performance.now() - t0).toBeLessThan(500)
    }
    const many = (n: number) => Array.from({ length: n }, () => `<!-- file: a.learn.md -->\n${LESSON('A')}`).join('\n')
    const t0 = performance.now()
    expect(splitBundle(many(MAX_BUNDLE_FILES)).at(-1)!.path).toBe(`a-${MAX_BUNDLE_FILES}.learn.md`)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(() => splitBundle(many(MAX_BUNDLE_FILES + 1))).toThrow(/at most 100/)
  })
  it('asks the chat to fix only the flagged lines', () => {
    const bad = compile('---\ntitle: T\n---\n## A\n:::quiz\nQ?\n- [ ] a\n- [ ] b\n:::\n')
    const msg = fixMessage([{ path: 'a.learn.md', diagnostics: bad.diagnostics }, { path: 'ok.learn.md', diagnostics: [] }])
    expect(msg).toMatch(/Fix only the lines named/)
    expect(msg).toContain('<!-- file: a.learn.md -->')
    expect(msg).toMatch(/- \d+:\d+ E\d+/)
    expect(msg).not.toContain('ok.learn.md')
    expect(fixMessage([{ path: 'ok.learn.md', diagnostics: [] }])).toBe('')
  })
})

describe('course prompt', () => {
  it('works with and without notes, and names the right way to save', () => {
    const none = coursePrompt({ topic: 'Tides', minutes: 30 })
    expect(none).toMatch(/no notes/)
    expect(none).toMatch(/save_lesson/)
    expect(none).toContain('tides/01-slug.md')
    const notes = coursePrompt({ topic: 'Tides', notes: 'notes/tides.md', save: 'write', language: 'Italian' })
    expect(notes).toMatch(/notes\/tides\.md/)
    expect(notes).toMatch(/lint_lesson/)
    expect(notes).toMatch(/Italian/)
  })
  it('holds a course to the language asked for, and to the language of its material otherwise', () => {
    expect(coursePrompt({ topic: 'Tides', classFiles: 'sources', language: 'Spanish' })).toContain('Write everything in Spanish, whatever language the sources are in')
    expect(coursePrompt({ topic: 'Tides', language: 'Spanish' })).toContain('Write everything in Spanish')
    expect(coursePrompt({ topic: 'Tides', classFiles: 'sources' })).toContain('Write in the language of the files')
    expect(coursePrompt({ topic: 'Tides' })).toContain('Write in the language of this request')
  })
})

describe('what a course is, for the AI', () => {
  it('is notes that are studied, not a deck of cards', () => {
    const p = coursePrompt({ topic: 'Marketing' })
    expect(p).toContain('marketing/01-slug.md')
    expect(p).toContain('`study: true`')
    expect(p).toContain('Not a deck of cards')
    expect(p).not.toContain('.learn.md')
    expect(p).not.toContain('cards each')
  })
  it('tells the AI to read code, data and pictures among the class files itself, in every folder', () => {
    const p = coursePrompt({ topic: 'Python', classFiles: 'sources' })
    expect(p).toContain('in all its folders')
    expect(p).toContain('Code, notebooks, data and pictures are there as they are')
    expect(p).toContain('A photo of an exam, a worksheet or a whiteboard is material too')
    expect(p).toMatch(/runnable/)
  })
  it('says the same from class files', () => {
    const p = coursePrompt({ topic: 'Marketing', classFiles: 'sources' })
    expect(p).toContain('`01-slug.md`')
    expect(p).toContain('`study: true`')
    expect(p).not.toContain('.learn.md')
  })
  it('stays in the folder when asked to', () => {
    const p = coursePrompt({ topic: 'Marketing', here: true, folder: '.' })
    expect(p).toContain('`course.md`')
    expect(p).toContain('`01-slug.md`')
    expect(p).toContain('id: marketing-slug')
  })
  it('takes as long as the subject needs, unless a length is given', () => {
    expect(coursePrompt({ topic: 'Marketing' })).toContain('as long as the subject needs')
    expect(coursePrompt({ topic: 'Marketing', minutes: 60 })).toContain('about 60 minutes')
  })
  it('follows how the learner wants the course, from files or a topic', () => {
    for (const classFiles of ['sources', undefined]) {
      const short = coursePrompt({ topic: 'Optimisation', classFiles, here: true, folder: '.', length: 'short', goal: 'exam', include: ['exercises', 'code', 'exam-practice'] })
      expect(short).toContain('Keep it short: the essentials only')
      expect(short).toContain('preparing for an exam')
      expect(short).toContain('runnable code blocks')
      expect(short).toContain('End with a practice note of mixed questions')
      expect(short).toContain('Use visuals only where an idea can’t be understood without one')
      const full = coursePrompt({ topic: 'Optimisation', classFiles, here: true, folder: '.', length: 'full', goal: 'understand', include: ['exercises', 'visuals'] })
      expect(full).toContain('Make it complete')
      expect(full).toContain('intuition and examples before the formal statements')
      expect(full).not.toContain('runnable code blocks that show')
      expect(full).not.toContain('End with a practice note')
      expect(coursePrompt({ topic: 'Optimisation', classFiles, goal: 'reference' })).toContain('summary tables')
    }
    // with no time given, short means about 45 minutes
    expect(coursePrompt({ topic: 'Optimisation', length: 'short' })).toContain('about 45 minutes')
  })
  it('writes notes to read, outside Study, when exercises are left out', () => {
    for (const classFiles of ['sources', undefined]) {
      const p = coursePrompt({ topic: 'Optimisation', classFiles, include: ['visuals'] })
      expect(p).toContain('Write no exercises')
      expect(p).not.toContain('`study: true`')
    }
  })
  it('says nothing more when no answers are given', () => {
    const p = coursePrompt({ topic: 'Optimisation', classFiles: 'sources' })
    expect(p).not.toMatch(/Keep it short|Make it complete|preparing for an exam|Write no exercises|End with a practice note/)
  })
  it('says what the level means', () => {
    expect(coursePrompt({ topic: 'X', classFiles: 'sources', level: 'beginner' })).toContain('starts from scratch')
    expect(coursePrompt({ topic: 'X', level: 'intermediate' })).toContain('has the basics')
    expect(coursePrompt({ topic: 'X', level: 'advanced' })).toContain('skip the basics')
  })
  it('mentions the web only when the learner allowed it', () => {
    expect(coursePrompt({ topic: 'Marketing' })).not.toContain('WebSearch')
    expect(coursePrompt({ topic: 'Marketing', classFiles: 'sources' })).not.toContain('WebSearch')
    expect(coursePrompt({ topic: 'Marketing', web: true })).toContain('never one you remember or guess')
    expect(coursePrompt({ topic: 'Marketing', classFiles: 'sources', web: true })).toContain('`WebSearch`')
  })
})
