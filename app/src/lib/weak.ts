// Weakness radar: which patterns you get wrong most (recently), with readable names.
import type { ErrorRow } from './db'

export function patternName(id: string) {
  let m
  if ((m = id.match(/^verb-(\w+)/))) return `Verbs: ${m[1]} tense`
  if ((m = id.match(/^case-(pl-)?(\w+)/))) return `Cases: ${{ nom: 'nominative', acc: 'accusative', gen: 'genitive', dat: 'dative', loc: 'locative', ins: 'instrumental' }[m[2]] ?? m[2]}${m[1] ? ' plural' : ''}`
  if ((m = id.match(/^w(\d+)-(vocab|sentences)/))) return `Week ${m[1]} ${m[2] === 'vocab' ? 'words' : 'sentences'}`
  if ((m = id.match(/^ex-w(\d+)-(\w+)/))) return `Week ${m[1]} exercises (${m[2]})`
  if ((m = id.match(/^ladder-(.+)/))) return `Sentences: ${m[1]}`
  if ((m = id.match(/^grammar-(.+)/))) return `Grammar: ${m[1]}`
  if ((m = id.match(/^(words|phrases|freq)-(.+)/))) return `${{ words: 'Words', phrases: 'Phrasebook', freq: 'Frequency' }[m[1]]}: ${m[1] === 'freq' ? `band ${+m[2] + 1}` : m[2]}`
  if ((m = id.match(/^roleplay-(.+)/))) return `Role-play: ${m[1]}`
  return id
}

/** Top weaknesses: error count, weighted down when not seen for a while (half-life two weeks). */
export function weakest(errors: ErrorRow[], n = 3) {
  const now = Date.now()
  const by = new Map<string, { pattern: string; score: number; count: number; tags: Set<string> }>()
  for (const e of errors) {
    const w = e.count * Math.pow(0.5, (now - e.lastSeen) / (14 * 864e5))
    const cur = by.get(e.patternId) ?? { pattern: e.patternId, score: 0, count: 0, tags: new Set<string>() }
    cur.score += w; cur.count += e.count; cur.tags.add(e.tag)
    by.set(e.patternId, cur)
  }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, n)
}
