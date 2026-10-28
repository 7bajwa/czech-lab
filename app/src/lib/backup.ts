// Backup: every table to one JSON file and back. Dates are tagged so FSRS due dates survive the round trip.
import { db } from './db'

const replacer = function (this: Record<string, unknown>, k: string, v: unknown) { return this[k] instanceof Date ? { $d: (this[k] as Date).toISOString() } : v }
const reviver = (_: string, v: unknown) => (v && typeof v === 'object' && '$d' in v ? new Date((v as { $d: string }).$d) : v)

export async function exportAll() {
  const data: Record<string, unknown[]> = {}
  for (const t of db.tables) data[t.name] = await t.toArray()
  const blob = new Blob([JSON.stringify({ app: 'czechlab', version: db.verno, at: new Date().toISOString(), data }, replacer)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `czechlab-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Replaces all progress with the file's content (after the caller confirmed). */
export async function importAll(file: File) {
  const parsed = JSON.parse(await file.text(), reviver)
  if (parsed?.app !== 'czechlab' || typeof parsed.data !== 'object') throw new Error('This is not a Czech Lab backup file.')
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) { await t.clear(); const rows = parsed.data[t.name]; if (Array.isArray(rows) && rows.length) await t.bulkPut(rows) }
  })
}
