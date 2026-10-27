import { WEEKS, conjugations, itemsUpToDay, typeable, weekItems, PRONOUNS, type Item, type Week } from './content'

// Drills are generated only from the curriculum's own vocab, sentence bank and verb tables, so they are verified by construction.
export type Drill = {
  key: string; itemId: string; type: 'translate' | 'listen' | 'conjugate'
  prompt: string; target: string; check: 'vocab' | 'sentence' | 'conjugation'; pattern: string; rule?: string; item?: Item
}

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

const itemDrill = (it: Item, type: 'translate' | 'listen'): Drill => ({
  key: `${type}:${it.id}`, itemId: it.id, type, item: it, target: it.cz, pattern: it.pattern,
  check: it.kind === 'sentence' ? 'sentence' : 'vocab',
  prompt: type === 'translate' ? it.en : 'Listen and type what you hear',
})

function conjDrills(w: Week): Drill[] {
  return conjugations(w).flatMap((c) => c.forms.map((form, p): Drill => ({
    key: `conj:${c.id}:${p}`, itemId: c.id, type: 'conjugate', target: form, check: 'conjugation', pattern: c.id, rule: c.rule,
    prompt: `${c.lemma}${c.gloss === 'negative' ? ' (negative)' : c.gloss === 'future' ? ' (future)' : ''} · ${PRONOUNS[p]} …`,
  })))
}

/** A mixed drill set for the week up to the given weekday. */
export function buildDrills(w: Week, day: number, n = 12): Drill[] {
  const items = itemsUpToDay(w, day).filter(typeable)
  const pool = [
    ...items.filter((i) => i.en).map((i) => itemDrill(i, 'translate')),
    ...items.map((i) => itemDrill(i, 'listen')),
    ...conjDrills(w),
  ]
  return dedupeByItem(shuffle(pool)).slice(0, n)
}

/** Weekly test: 20 auto-scored items — verb forms, EN→CZ production, and listening dictation. */
export function buildWeeklyTest(w: Week): Drill[] {
  const items = shuffle(weekItems(w).filter(typeable))
  const conj = shuffle(conjDrills(w)).slice(0, 6)
  const translate = items.filter((i) => i.en).slice(0, 14 - conj.length).map((i) => itemDrill(i, 'translate'))
  const used = new Set(translate.map((d) => d.itemId))
  const listen = items.filter((i) => !used.has(i.id)).slice(0, 20 - conj.length - translate.length).map((i) => itemDrill(i, 'listen'))
  return shuffle([...conj, ...translate, ...listen])
}

/** Repair drills from the items with the most logged errors. */
export function buildRepair(errorCounts: Map<string, number>, n = 12): Drill[] {
  const top = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const out: Drill[] = []
  for (const id of top) {
    const it = ITEM_INDEX.get(id)
    if (it && typeable(it)) out.push(itemDrill(it, it.en ? 'translate' : 'listen'))
    else { const d = CONJ_INDEX.get(id); if (d) out.push(...shuffle(d).slice(0, 2)) }
    if (out.length >= n) break
  }
  return out.slice(0, n)
}

function dedupeByItem(ds: Drill[]) {
  const seen = new Set<string>()
  return ds.filter((d) => (d.type === 'conjugate' ? true : !seen.has(d.itemId) && !!seen.add(d.itemId)))
}

const ITEM_INDEX = new Map(WEEKS.flatMap(weekItems).map((i) => [i.id, i]))
const CONJ_INDEX = new Map<string, Drill[]>()
for (const w of WEEKS) for (const d of conjDrills(w)) CONJ_INDEX.set(d.itemId, [...(CONJ_INDEX.get(d.itemId) ?? []), d])
