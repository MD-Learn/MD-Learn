import { STAGES, framesAt, toPath, GRID, type Activity } from './sprites'

const BY_STAGE = Array.from({ length: STAGES }, (_, i) => framesAt(i + 1))
export function PixelPet({ activity, stage = 1, size = 24 }: { activity: Activity; stage?: number; size?: number }) {
  const { frames, beat } = BY_STAGE[Math.min(STAGES, Math.max(1, stage)) - 1][activity]
  return (
    <svg className={`pet pet-${beat}`} viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size} shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path className="pet-a" d={toPath(frames[0])} />
      <path className="pet-b" d={toPath(frames[1])} />
    </svg>
  )
}
