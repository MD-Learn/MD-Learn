// Secrets kept apart from the settings (~/.config/mdlearn/secrets.json, readable by you only): today the cloud AI's
// key. No route ever returns one; the settings page sees only whether it is there and its last four characters.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'

const FileSchema = z.object({ version: z.literal(1), cloudKey: z.string().optional() })
type Secrets = Omit<z.infer<typeof FileSchema>, 'version'>
export interface SecretsStore { get(name: keyof Secrets): string | undefined; set(name: keyof Secrets, value: string | undefined): void; file: string }

export function secretsStore(file: string): SecretsStore {
  const read = (): Secrets => {
    if (!existsSync(file)) return {}
    try { const { version: _, ...rest } = FileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))); return rest } catch { return {} }
  }
  return {
    file,
    get: (name) => read()[name],
    set(name, value) {
      const { [name]: _, ...rest } = read()
      const next = value === undefined ? rest : { ...rest, [name]: value }
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
      const tmp = `${file}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify({ version: 1, ...next }, null, 2), { mode: 0o600 })
      renameSync(tmp, file)
      try { chmodSync(file, 0o600) } catch { /* Windows: the folder's own permissions apply */ }
    },
  }
}
