import { createEmptyCard, fsrs, Rating, State, type Grade } from 'ts-fsrs'
import { db, today, type CardRow } from './db'
import type { Item } from './content'

const scheduler = fsrs() // default request_retention 0.9
export { Rating }

/** Create cards for newly introduced items (idempotent). Glossed items are typed EN→CZ, the rest are dictation. */
export const ensureCards = (items: Item[]) => db.transaction('rw', db.cards, async () => { // rw transaction: concurrent calls can't double-add
  const have = new Set((await db.cards.bulkGet(items.map((i) => i.id))).filter(Boolean).map((c) => c!.id))
  const now = new Date()
  const fresh: CardRow[] = items.filter((i) => !have.has(i.id) && !i.cz.includes('…')).map((i) => ({
    id: i.id, week: i.week, pattern: i.pattern, cz: i.cz, en: i.en, mode: i.en ? 'type' : 'listen',
    due: now, fsrs: createEmptyCard(now), introduced: today(),
  }))
  if (fresh.length) await db.cards.bulkAdd(fresh)
})

/** Due reviews first, then new cards up to today's cap. */
export async function dueQueue(newPerDay: number): Promise<CardRow[]> {
  const now = new Date()
  const due = await db.cards.where('due').belowOrEqual(now).toArray()
  const startOfDay = new Date(today()).getTime()
  const newDoneToday = await db.attempts.where('ts').aboveOrEqual(startOfDay).filter((a) => a.kind === 'review' && !!a.wasNew).count()
  const learning = due.filter((c) => c.fsrs.state !== State.New)
  const fresh = due.filter((c) => c.fsrs.state === State.New).slice(0, Math.max(0, newPerDay - newDoneToday))
  return [...learning, ...fresh]
}

export async function grade(card: CardRow, rating: Grade) {
  const next = scheduler.next(card.fsrs, new Date(), rating).card
  await db.cards.update(card.id, { fsrs: next, due: next.due })
}

/** A drill/test error makes the card due now (creating it if needed). */
export async function boost(item: Item) {
  await ensureCards([item])
  await db.cards.update(item.id, { due: new Date() })
}
