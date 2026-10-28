// Cards for Flashcards, Match and Falling words: one FSRS schedule per item, so items you always get right come back later.
import { createEmptyCard, fsrs, Rating, State, type Grade } from 'ts-fsrs'
import { db, type LexRow } from './db'

export type LexItem = { id: string; cz: string; en: string; note?: string }
const scheduler = fsrs()
export { Rating }

/** Order a deck for play: due items (most overdue first), then new ones (deck order), then the rest (soonest due first). */
export async function lexOrder<T extends LexItem>(items: T[]): Promise<{ list: T[]; due: number; fresh: number }> {
  const rows = new Map((await db.lex.bulkGet(items.map((i) => i.id))).filter(Boolean).map((r) => [r!.id, r!]))
  const now = Date.now()
  const at = (i: T) => rows.get(i.id)?.due.getTime() ?? Infinity
  const due = items.filter((i) => at(i) <= now).sort((a, b) => at(a) - at(b))
  const fresh = items.filter((i) => !rows.has(i.id))
  const later = items.filter((i) => rows.has(i.id) && at(i) > now).sort((a, b) => at(a) - at(b))
  return { list: [...due, ...fresh, ...later], due: due.length, fresh: fresh.length }
}

export async function lexGrade(id: string, rating: Grade) {
  const row: LexRow = (await db.lex.get(id)) ?? { id, due: new Date(), fsrs: createEmptyCard(new Date()) }
  const next = scheduler.next(row.fsrs, new Date(), rating).card
  await db.lex.put({ id, fsrs: next, due: next.due })
}

export const isNew = async (id: string) => ((await db.lex.get(id))?.fsrs.state ?? State.New) === State.New
