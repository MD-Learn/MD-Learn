import { describe, it, expect } from 'vitest'
import { READ_FONTS, DEFAULT_SIZE, MAX_SIZE, MIN_SIZE, clampSize, fontOf, nextSize } from '../web/lib/reading'

describe('reading font and size', () => {
  it('keeps the size within what a note can show', () => {
    expect(clampSize(10)).toBe(MIN_SIZE)
    expect(clampSize(40)).toBe(MAX_SIZE)
    expect(clampSize(19.6)).toBe(20)
    expect(clampSize(Number.NaN)).toBe(DEFAULT_SIZE)
  })
  it('steps one point at a time, and back to the default', () => {
    expect(nextSize(18, 1)).toBe(19)
    expect(nextSize(MAX_SIZE, 1)).toBe(MAX_SIZE)
    expect(nextSize(MIN_SIZE, -1)).toBe(MIN_SIZE)
    expect(nextSize(25, 0)).toBe(DEFAULT_SIZE)
  })
  it('falls back to the serif for a font it does not know', () => {
    expect(fontOf('dyslexia')).toBe('dyslexia')
    expect(fontOf('comic-sans')).toBe('serif')
    expect(fontOf(null)).toBe('serif')
    expect(READ_FONTS).toEqual(['serif', 'times', 'sans', 'easy', 'dyslexia', 'mono'])
  })
})
