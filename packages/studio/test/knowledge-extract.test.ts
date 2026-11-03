import { describe, it, expect } from 'vitest'
import { parseDocument } from '@mdlearn/core'
import { extractFacts } from '../server/knowledge/extract'

const SRC = `# Radar notes

Intro paragraph about radar that is long enough to be a summary of the document.

## 1. Basics

**Backscatter** is the power returned toward the radar by the target and its surroundings. It depends on roughness.

**Speckle**: granular noise from coherent summation of echoes. See [the SAR physics](04_sar.md#speckle) and [elsewhere](https://esa.int).

- **Gain** — antenna power concentration relative to isotropic. Dimensionless.
- Plain item without a term.

| Symbol | Meaning |
|---|---|
| $\\sigma^0$ | normalised radar cross-section |
| $R$ | slant range |

**Step 1 — isotropic spreading.** A transmitter radiates power over a sphere.

Power spreads as the inverse square of the range, which gives:

$$S = \\frac{P_t}{4\\pi R^2}$$

## 2. Next

<details>
<summary>Derivation</summary>

Second formula follows:

$$P_r = S A_e$$

</details>

See [basics](../notes/other.md).
`
const doc = parseDocument(SRC, { path: 'docs/radar.md' })
const facts = extractFacts(doc, SRC)

describe('extractFacts', () => {
  it('finds display formulas with their section and the sentence leading to them', () => {
    expect(facts.formulas.map((f) => f.tex)).toEqual(['S = \\frac{P_t}{4\\pi R^2}', 'P_r = S A_e'])
    expect(facts.formulas[0].section).toMatchObject({ num: '1', title: 'Basics' })
    expect(facts.formulas[0].lead).toMatch(/inverse square of the range/)
    expect(facts.formulas[1].section?.num).toBe('2') // inside <details>
  })
  it('finds definitions in sentences, "term: …", list items and tables — but not step labels', () => {
    const t = Object.fromEntries(facts.terms.map((x) => [x.term, x.definition]))
    expect(t['Backscatter']).toMatch(/^The power returned toward the radar/)
    expect(t['Speckle']).toMatch(/^Granular noise from coherent summation/)
    expect(t['Gain']).toMatch(/^Antenna power concentration/)
    expect(t['$\\sigma^0$']).toBe('normalised radar cross-section')
    expect(t['$R$']).toBe('slant range')
    expect(Object.keys(t).some((k) => /^Step/.test(k))).toBe(false)
    expect(t['Backscatter'].split('. ')).toHaveLength(1) // one sentence
  })
  it('lists the documents it points to, resolved against its own folder, never external links', () => {
    expect(facts.links).toEqual(expect.arrayContaining([{ to: 'docs/04_sar.md', count: 1, kind: 'link' }, { to: 'notes/other.md', count: 1, kind: 'link' }]))
    expect(facts.links.some((l) => l.to.includes('esa.int'))).toBe(false)
  })
  it('splits the text into chunks that know their section, each at most ~400 words', () => {
    expect(facts.chunks.length).toBeGreaterThan(0)
    expect(facts.chunks.every((c) => c.text.split(/\s+/).length <= 460)).toBe(true)
    expect(facts.chunks.find((c) => /Backscatter/.test(c.text))?.section?.num).toBe('1')
  })
  it('keeps the document facts', () => {
    expect(facts).toMatchObject({ path: 'docs/radar.md', title: 'Radar notes' })
    expect(facts.intro).toMatch(/^Intro paragraph about radar/)
  })
})

const NOTE = `---
id: opt-intro
study: true
---

# Optimización

## Funciones

Una <mark data-tone="definition">función de varias variables</mark> es una regla

$$f : \\mathbb{R}^n \\to \\mathbb{R}$$

que toma un vector de entradas y produce un solo número.

El <mark data-tone="definition">dominio</mark> $D$ es el conjunto de entradas permitidas. Puede ser una región del plano.

La <mark data-tone="definition">teoría de la decisión</mark> estudia cómo elegir entre alternativas según un criterio.

<mark data-tone="key">Contextos distintos, la misma idea matemática.</mark>

**Gradiente** es el vector de todas las derivadas parciales de una función.

## Clasificación

- **Mínimo local**: los valores cercanos son mayores o iguales.
- **Máximo local**: los valores cercanos son menores o iguales.
- **Punto de silla**: la función sube en unas direcciones y baja en otras.

**Paso 1**: calcula el gradiente.
`
const noteFacts = extractFacts(parseDocument(NOTE, { path: '01-intro.md' }), NOTE)
const byTerm = (ts: typeof noteFacts.terms) => Object.fromEntries(ts.map((x) => [x.term, x]))

describe('definitions in notes in other languages', () => {
  it('reads the terms an author marked as definitions, with the sentence around them', () => {
    const t = byTerm(noteFacts.terms)
    expect(t['dominio']).toMatchObject({ kind: 'mark', definition: 'El dominio $D$ es el conjunto de entradas permitidas.' })
    expect(t['teoría de la decisión'].definition).toBe('La teoría de la decisión estudia cómo elegir entre alternativas según un criterio.')
    expect(Object.keys(t)).not.toContain('Contextos distintos, la misma idea matemática.') // a key idea, not a definition
  })
  it('follows a definition across the formula that interrupts it, but not into the next sentence', () => {
    expect(byTerm(noteFacts.terms)['función de varias variables'].definition).toBe('Una función de varias variables es una regla $$f : \\mathbb{R}^n \\to \\mathbb{R}$$ que toma un vector de entradas y produce un solo número.')
    const src = '# T\n\nLas <mark data-tone="definition">parciales</mark> son\n\n$$f_x = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$\n\nEn $f_x$ solo cambia $x$.\n\nUn **punto** del <mark data-tone="definition">dominio</mark> es una entrada válida de la función.\n'
    const t = byTerm(extractFacts(parseDocument(src, { path: 'p.md' }), src).terms)
    expect(t['parciales'].definition).toBe('Las parciales son $$f_x = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$')
    expect(Object.keys(t)).toEqual(['parciales', 'dominio']) // bold in a paragraph that marks its definition is not a second guess
  })
  it('knows how "X is …" is said in Spanish, Italian, French and Catalan', () => {
    expect(byTerm(noteFacts.terms)['Gradiente']).toMatchObject({ kind: 'is', definition: 'El vector de todas las derivadas parciales de una función.' })
    for (const [lang, line] of [['it', '**Dominio** è l’insieme dei valori di ingresso ammessi dalla funzione.'], ['fr', '**Domaine** désigne l’ensemble des entrées permises par la fonction.'], ['ca', '**Domini** és el conjunt d’entrades permeses per la funció.'], ['es', '**Dominio** se llama al conjunto de entradas permitidas por la función.']]) {
      const src = `# T\n\n${line}\n`
      expect(extractFacts(parseDocument(src, { path: `${lang}.md` }), src).terms.map((x) => x.kind), lang).toEqual(['is'])
    }
  })
  it('keeps one sentence when the next starts with an accented capital', () => {
    const src = '# T\n\n**Hessiano** es la matriz de las segundas derivadas parciales. Él decide la curvatura.\n'
    expect(extractFacts(parseDocument(src, { path: 'h.md' }), src).terms[0].definition).toBe('La matriz de las segundas derivadas parciales.')
  })
  it('treats a list where every item is "term: text" as a glossary, but not a lone label', () => {
    const t = byTerm(noteFacts.terms)
    expect(t['Mínimo local']).toMatchObject({ kind: 'list', definition: 'Los valores cercanos son mayores o iguales.' })
    expect(t['Punto de silla'].kind).toBe('list')
    expect(t['Paso 1']).toBeUndefined()
  })
})
