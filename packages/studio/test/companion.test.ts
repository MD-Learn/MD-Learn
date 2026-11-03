import { describe, it, expect } from 'vitest'
import { FRAMES, GRID, STAGES, framesAt, toPath } from '../web/companion/sprites'

describe('the pixel companion', () => {
  it.each(Object.entries(FRAMES))('%s has two different frames inside its grid', (_, { frames }) => {
    expect(toPath(frames[0])).not.toBe(toPath(frames[1]))
    for (const cells of frames) for (const [x, y] of cells) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(GRID)
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(GRID)
    }
  })
  it('keeps nothing but its picture: each state looks different from the others', () => {
    const looks = Object.values(FRAMES).map((f) => toPath(f.frames[0]))
    expect(new Set(looks).size).toBe(looks.length)
  })
  it('grows a visible feature at each stage, and stays inside its grid and distinct in every state', () => {
    const stages = Array.from({ length: STAGES }, (_, i) => framesAt(i + 1))
    expect(new Set(stages.map((f) => toPath(f.idle.frames[0]))).size).toBe(STAGES)
    for (const f of stages) {
      expect(new Set(Object.values(f).map((x) => toPath(x.frames[0]))).size).toBe(Object.keys(f).length)
      for (const { frames } of Object.values(f)) {
        expect(toPath(frames[0])).not.toBe(toPath(frames[1]))
        for (const cells of frames) for (const [x, y] of cells) expect(x >= 0 && x < GRID && y >= 0 && y < GRID).toBe(true)
      }
    }
  })
})
