import Dexie, { type EntityTable } from 'dexie'
import type { Card as FsrsCard } from 'ts-fsrs'
import type { ErrorTag } from './check'

export type Profile = {
  id: 'me'; examDate: string; dailyMinutes: number; newPerDay: number; ttsRate: number; fontSize: number
  currentWeek: number; currentDay: number // 0=Mon … 4=Fri; only advances when a day is finished, so missed days shift the plan
  maxWeek: number; repairDays: number; apiKey: string
  realLife: Record<number, string> // week -> one-sentence check-in
  sound: boolean; haptics: boolean; audioAfter: boolean // answer cues + speak the right answer after submitting
  autoFlip: number // flashcards: seconds before the card flips itself (0 = off)
  speed: 'gradual' | 'constant'; level: 1 | 2 | 3 // timed games: speed-up mode and start speed
}
export type CardRow = { id: string; week: number; pattern: string; cz: string; en: string; mode: 'type' | 'listen'; due: Date; fsrs: FsrsCard; introduced: string }
export type Attempt = { id?: number; itemId: string; kind: 'drill' | 'review' | 'test'; response: string; correct: boolean; tag?: ErrorTag; wasNew?: boolean; ts: number }
export type Session = { id?: number; date: string; week: number; day: number; blocksDone: number[]; minutes: number; finished: boolean }
export type WeeklyTest = { id?: number; week: number; score: number; total: number; passed: boolean; outcome: 'unlock' | 'repair' | 'repeat'; ts: number }
export type ErrorRow = { tag: ErrorTag; patternId: string; count: number; lastSeen: number }
export type Report = { id?: number; itemId: string; note: string; ts: number }
/** A word/phrase/sentence card shared by Flashcards, Match and Falling words (FSRS, so items you never miss wait longer). */
export type LexRow = { id: string; due: Date; fsrs: FsrsCard }
export type ExamResult = { id?: number; mock: string; part: string; score: number; max: number; ts: number }

export const db = new Dexie('czechlab') as Dexie & {
  profile: EntityTable<Profile, 'id'>
  cards: EntityTable<CardRow, 'id'>
  attempts: EntityTable<Attempt, 'id'>
  sessions: EntityTable<Session, 'id'>
  weeklyTests: EntityTable<WeeklyTest, 'id'>
  errors: Dexie.Table<ErrorRow, [ErrorTag, string]>
  reports: EntityTable<Report, 'id'>
  lex: EntityTable<LexRow, 'id'>
  examResults: EntityTable<ExamResult, 'id'>
}
db.version(1).stores({
  profile: 'id',
  cards: 'id, due, week',
  attempts: '++id, itemId, ts, kind',
  sessions: '++id, date, [week+day]',
  weeklyTests: '++id, week',
  errors: '[tag+patternId], tag',
  reports: '++id',
})
// v2: card ids changed from row index to Czech text; drop the old index-based cards (they'd duplicate)
db.version(2).stores({}).upgrade((tx) => tx.table('cards').filter((c) => /-(vocabA|vocabB|s)-\d+$/.test(c.id)).delete())

db.version(3).stores({ lex: 'id, due', examResults: '++id, mock, ts' })

export const today = () => new Date().toISOString().slice(0, 10)

export function defaultProfile(): Profile {
  const exam = new Date(Date.now() + 26 * 7 * 864e5)
  return { id: 'me', examDate: exam.toISOString().slice(0, 10), dailyMinutes: 90, newPerDay: 12, ttsRate: 1, fontSize: 18,
    currentWeek: 1, currentDay: 0, maxWeek: 1, repairDays: 0, apiKey: '', realLife: {},
    sound: true, haptics: true, audioAfter: true, autoFlip: 0, speed: 'gradual', level: 1 }
}

export async function getProfile(): Promise<Profile> {
  const p = await db.profile.get('me')
  if (!p) { await db.profile.put(defaultProfile()); return defaultProfile() }
  return { ...defaultProfile(), ...p } // fields added in later versions get their defaults
}
export const saveProfile = (p: Partial<Profile>) => db.profile.update('me', p)

export async function logError(tag: ErrorTag, patternId: string) {
  const row = await db.errors.get([tag, patternId])
  await db.errors.put({ tag, patternId, count: (row?.count ?? 0) + 1, lastSeen: Date.now() })
}
