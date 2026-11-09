// Ties Studio's server to the desktop app. It stops when the app closes its stdin, sends SIGTERM, SIGINT or SIGHUP,
// or is gone without a word (it crashed or was force-quit: the server's parent changes, or on Windows, where an orphan
// keeps its parent's number, that process no longer exists). It ends at once when its own
// files disappear (the app ran from a disk image that was then ejected). Stopping never takes longer than `graceMs`,
// a second request ends it at once, and a broken pipe to the app ends it instead of turning into a loop of errors.
import { existsSync } from 'node:fs'

const gone = (pid) => { try { process.kill(pid, 0); return false } catch (e) { return e.code === 'ESRCH' } }

export function tieToApp({ close, file, parent = process.ppid, everyMs = 2000, graceMs = 3000 }) {
  let stopping = false
  const stop = () => {
    if (stopping) process.exit(0)
    stopping = true
    setTimeout(() => process.exit(0), graceMs).unref()
    Promise.resolve().then(close).catch(() => {}).finally(() => process.exit(0))
  }
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, stop)
  process.stdin.on('end', stop).on('error', stop)
  process.stdin.resume()
  for (const out of [process.stdout, process.stderr]) out.on('error', () => process.exit(0))
  setInterval(() => {
    if (!existsSync(file)) process.exit(0) // nothing more can be loaded, so closing cleanly is not tried
    if (process.ppid !== parent || gone(parent)) stop()
  }, everyMs).unref()
  return stop
}
