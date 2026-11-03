// A note counts as read when its end has been on screen and you have spent enough active time on it: a third of its
// reading time, between 20 seconds and 4 minutes, counted only while the tab is visible and you are not away. The
// server counts each note once, and only notes long enough to be one (it checks the same length).
import { useEffect, useRef, useState } from 'react'
import { companionApi } from '../api/queries'
import { useAway } from '../companion/useActivity'

const WPM = 230, MIN_SECONDS = 20, MAX_SECONDS = 240, MIN_WORDS = 150, RETRY_SECONDS = 30

/** Returns the ref for an element at the very end of the note. */
export function useFinishedReading(ws: string, path: string | undefined, words: number, minutes: number | undefined, on: boolean): (el: HTMLElement | null) => void {
  const [end, setEnd] = useState<HTMLElement | null>(null)
  const away = useRef(false)
  away.current = useAway()
  useEffect(() => {
    if (!on || !path || !end || words < MIN_WORDS || path.startsWith('sources/')) return
    let need = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, ((minutes ?? words / WPM) * 60) / 3))
    let seen = 0, reached = false, done = false
    const finish = () => {
      if (done || !reached || seen < need) return
      done = true
      companionApi.read(ws, path).catch(() => { done = false; need = seen + RETRY_SECONDS }) // the server was away: try again a little later
    }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { reached = true; finish() } })
    io.observe(end)
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible' && !away.current) { seen++; finish() } }, 1000)
    return () => { io.disconnect(); clearInterval(tick) }
  }, [ws, path, end, words, minutes, on])
  return setEnd
}
