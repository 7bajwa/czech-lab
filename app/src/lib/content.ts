import curriculum from '../data/curriculum.json'
import rhythm from '../data/rhythm.json'
import { parseConjugations } from './conj.ts'

export type Pair = { cz: string; en: string }
export type Sentence = Pair & { chunk: boolean }
export type Week = {
  week: number; phase: string; title: string; canDo: string; patternLab: string[]
  vocabA: Pair[]; vocabB: Pair[]; sentences: Sentence[]
  speaking: string; writing: string; input: string; realLife: string; examLink: string; weeklyTest: string
  plan: { day: string; plan: string }[] | null; notes: { title: string; text: string }[]
  mock: { title: string; text: string } | null
}
export type RhythmDay = { day: string; name: string; blocks: { minutes: string; task: string }[] }

export const WEEKS = curriculum.weeks as Week[]
export const RHYTHM = (rhythm as RhythmDay[]).slice(0, 5) // Mon-Fri; Sat is optional
export const getWeek = (n: number) => WEEKS[n - 1]
// Slice 1 wires weeks 1-2 end-to-end; later weeks are parsed but not unlocked yet.
export const LAST_BUILT_WEEK = 2

/** A learnable unit: vocabulary entry or sentence. ids come from the Czech text, so editing or reordering other rows keeps cards. */
export type Item = { id: string; week: number; kind: 'vocabA' | 'vocabB' | 'sentence'; cz: string; en: string; chunk: boolean; pattern: string }

export function weekItems(w: Week): Item[] {
  const v = (kind: 'vocabA' | 'vocabB') => w[kind].map((p): Item => ({ id: `w${w.week}-v-${p.cz}`, week: w.week, kind, cz: p.cz, en: p.en, chunk: false, pattern: `w${w.week}-vocab` }))
  const s = w.sentences.map((p): Item => ({ id: `w${w.week}-s-${p.cz}`, week: w.week, kind: 'sentence', cz: p.cz, en: p.en, chunk: p.chunk, pattern: `w${w.week}-sentences` }))
  const seen = new Set<string>()
  return [...v('vocabA'), ...v('vocabB'), ...s].filter((it) => !seen.has(it.id) && !!seen.add(it.id)) // a word listed twice is one card
}

/** Items introduced by weekday (0=Mon): Mon vocab A, Wed vocab B + sentence bank. */
export const itemsUpToDay = (w: Week, day: number) => weekItems(w).filter((it) => it.kind === 'vocabA' || day >= 2)

/** Can it be typed as an answer? Placeholders like "Je mi … let." can't be checked. */
export const typeable = (it: Item) => !it.cz.includes('…')

export { PRONOUNS, type Conjugation } from './conj.ts'
export const conjugations = (w: Week) => parseConjugations(w.week, w.patternLab)

/** Every conjugation unlocked up to and including week n (mini tables only show these). */
export const conjugationsUpTo = (n: number) => WEEKS.slice(0, n).flatMap(conjugations)
