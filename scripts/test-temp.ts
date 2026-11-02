// Every temp folder a test run makes goes into one folder, removed when the run ends: tests that forget to clean up
// would otherwise leave thousands behind, and /tmp is often kept in memory.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'mdlearn-tests-'))
  process.env.TMPDIR = dir
  return () => rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
}
