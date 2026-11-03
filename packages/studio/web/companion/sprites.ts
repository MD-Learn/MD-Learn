// The pixel companion: a 12×12 one-colour creature with two frames for each thing it can be doing. Plain data, so
// it stays small and can't do anything but show what the app is really doing. As it grows it gains one feature per
// stage (a tuft, feet, arms, a crown), drawn on the body so they move with it.
export type Activity = 'idle' | 'reading' | 'working' | 'searching' | 'listening' | 'happy' | 'asleep'
type Cell = readonly [number, number]
export const GRID = 12

const BODY = ['...######...', '..########..', '.##########.', '.##########.', '.##########.', '.##########.', '.##########.', '.##########.', '.##.####.##.']
const BODY_TOP = 2 // the rows above it hold what floats over its head
const EYES = {
  open: [[3, 5], [3, 6], [8, 5], [8, 6]],
  closed: [[3, 6], [4, 6], [7, 6], [8, 6]],
  left: [[2, 5], [2, 6], [7, 5], [7, 6]],
  right: [[4, 5], [4, 6], [9, 5], [9, 6]],
  down: [[3, 6], [3, 7], [8, 6], [8, 7]],
  glad: [[2, 6], [3, 5], [4, 6], [7, 6], [8, 5], [9, 6]],
} satisfies Record<string, Cell[]>

/** What each stage adds to the body, in body coordinates (stage 5's crown takes the place of stage 2's tuft). */
const TUFT: Cell[] = [[5, 1], [6, 1]], FEET: Cell[] = [[1, 11], [2, 11], [9, 11], [10, 11]], ARMS: Cell[] = [[0, 6], [0, 7], [11, 6], [11, 7]]
const CROWN: Cell[] = [[3, 1], [5, 1], [6, 1], [8, 1]]
export const STAGES = 5
const GROWN: Cell[][] = [[], TUFT, [...TUFT, ...FEET], [...TUFT, ...FEET, ...ARMS], [...CROWN, ...FEET, ...ARMS]]

interface Spec { eyes: keyof typeof EYES; lift?: number; extra?: Cell[] }
/** Cells of one frame: the body less its eyes, with what it has grown, raised a row if `lift`, plus anything floating beside it. */
function frame({ eyes, lift = 0, extra = [] }: Spec, stage: number): Cell[] {
  const holes = new Set(EYES[eyes].map(([x, y]) => `${x},${y}`))
  const body = BODY.flatMap((row, i) => [...row].flatMap((c, x): Cell[] => {
    const y = i + BODY_TOP
    return c === '#' && !holes.has(`${x},${y}`) ? [[x, y] as Cell] : []
  }))
  const grown = GROWN[Math.min(STAGES, Math.max(1, stage)) - 1]
  return [...[...body, ...grown].map(([x, y]): Cell => [x, y - lift]), ...extra]
}

const SPARK: Cell[][] = [[[10, 0], [9, 1], [11, 1]], [[1, 0], [0, 1], [2, 1]]]
const SNORE: Cell[][] = [[[9, 1], [10, 1]], [[10, 0], [11, 0]]]
const EARS: Cell[][] = [[[2, 0], [2, 1], [9, 0], [9, 1]], [[2, 1], [9, 1]]]

type Beat = 'blink' | 'steady' | 'slow'
const SPECS: Record<Activity, { frames: [Spec, Spec]; beat: Beat }> = {
  idle: { frames: [{ eyes: 'open' }, { eyes: 'closed' }], beat: 'blink' },
  reading: { frames: [{ eyes: 'down' }, { eyes: 'closed' }], beat: 'blink' },
  working: { frames: [{ eyes: 'open', extra: SPARK[0] }, { eyes: 'open', lift: 1, extra: SPARK[1] }], beat: 'steady' },
  searching: { frames: [{ eyes: 'left' }, { eyes: 'right' }], beat: 'steady' },
  listening: { frames: [{ eyes: 'open', extra: EARS[0] }, { eyes: 'open', extra: EARS[1] }], beat: 'slow' },
  happy: { frames: [{ eyes: 'glad' }, { eyes: 'glad', lift: 1 }], beat: 'steady' },
  asleep: { frames: [{ eyes: 'closed', extra: SNORE[0] }, { eyes: 'closed', extra: SNORE[1] }], beat: 'slow' },
}
export type Frames = Record<Activity, { frames: [Cell[], Cell[]]; beat: Beat }>
/** Every state's two frames at a stage of growth (1 to 5). */
export function framesAt(stage: number): Frames {
  return Object.fromEntries(Object.entries(SPECS).map(([a, { frames, beat }]) => [a, { frames: [frame(frames[0], stage), frame(frames[1], stage)], beat }])) as Frames
}
export const FRAMES = framesAt(1)
export const toPath = (cells: readonly Cell[]) => cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')
