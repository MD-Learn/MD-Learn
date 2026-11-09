// Stands in for server/start.mjs to test how it is tied to the app: FAKE_HANG=1 makes closing never finish.
import { tieToApp } from '../server/lifecycle.mjs'

tieToApp({
  close: () => (process.env.FAKE_HANG === '1' ? new Promise(() => {}) : Promise.resolve()),
  file: import.meta.filename, everyMs: 100, graceMs: Number(process.env.FAKE_GRACE ?? 500),
})
setInterval(() => {}, 1000) // a server keeps the process alive
process.stdout.write(`ready ${process.pid}\n`)
