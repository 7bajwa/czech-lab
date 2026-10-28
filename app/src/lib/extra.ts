// Big content (phrasebook, frequency list, word groups, wordbook): imported only by the lazily loaded screens.
import phrasebookData from '../data/phrasebook.json'
import wordgroupsData from '../data/wordgroups.json'
import wordbookData from '../data/wordbook.json'
import frequencyData from '../data/frequency.json'
import practiceData from '../data/practice.json'
import everydayData from '../data/everyday.json'
import { WEEKS, weekItems } from './content'
import type { LexItem } from './lex'
import type { Practice } from './games'

export type Group<T> = { category: string; items: T[] }
export type Freq = { rank: number; cz: string; type: string; en: string }
export const PHRASEBOOK = phrasebookData as Group<{ cz: string; en: string }>[]
export const WORDGROUPS = wordgroupsData as Group<{ cz: string; en: string; gender: string }>[]
export const WORDBOOK = wordbookData as { en: string; cz: string; type: string }[]
export const FREQUENCY = frequencyData as Freq[]
export const P = practiceData as Practice

export type Source = 'words' | 'freq' | 'phrases' | 'everyday' | 'week' | 'sentences'
const EVERYDAY = everydayData as { level: number; n: number; title: string; words: { cz: string; en: string; note: string }[]; phrases: { cz: string; en: string }[] }[]
export const SOURCES: { id: Source; label: string }[] = [
  { id: 'words', label: 'Word groups' }, { id: 'freq', label: 'Frequency' }, { id: 'phrases', label: 'Phrasebook' }, { id: 'everyday', label: 'Everyday Czech' },
  { id: 'week', label: 'Week vocab' }, { id: 'sentences', label: 'Sentences' },
]
export const FREQ_BAND = 100
const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' }

/** The categories a source offers, as picker options. */
export function deckOptions(s: Source): { value: string; label: string }[] {
  if (s === 'words') return WORDGROUPS.map((g) => ({ value: g.category, label: `${g.category} (${g.items.length})` }))
  if (s === 'phrases') return PHRASEBOOK.map((g) => ({ value: g.category, label: `${g.category} (${g.items.length})` }))
  if (s === 'everyday') return EVERYDAY.map((l, i) => ({ value: String(i), label: `L${l.level}.${l.n} ${l.title}` }))
  if (s === 'freq') return Array.from({ length: Math.ceil(FREQUENCY.length / FREQ_BAND) }, (_, b) => ({ value: String(b), label: `Words ${b * FREQ_BAND + 1}–${Math.min(FREQUENCY.length, (b + 1) * FREQ_BAND)}` }))
  if (s === 'week') return WEEKS.filter((w) => w.vocabA.length).map((w) => ({ value: String(w.week), label: `Week ${w.week}: ${w.title}` }))
  return P.ladders.map((l, i) => ({ value: String(i), label: `${l.title} · ${l.category ?? ''}` }))
}

/** Items of one deck. ids are stable (built from the Czech text) so FSRS history survives edits elsewhere. */
export function deckItems(s: Source, value: string): LexItem[] {
  if (s === 'words') return (WORDGROUPS.find((g) => g.category === value)?.items ?? []).map((w) => ({ id: `wg:${w.cz}`, cz: w.cz, en: w.en, note: GENDER[w.gender] ?? '' }))
  if (s === 'phrases') return (PHRASEBOOK.find((g) => g.category === value)?.items ?? []).map((w) => ({ id: `pb:${w.cz}`, cz: w.cz, en: w.en }))
  if (s === 'everyday') { const l = EVERYDAY[+value]; return l ? [...l.words, ...l.phrases].map((w) => ({ id: `ed:${w.cz}`, cz: w.cz, en: w.en })) : [] }
  if (s === 'freq') return FREQUENCY.slice(+value * FREQ_BAND, (+value + 1) * FREQ_BAND).map((f) => ({ id: `fq:${f.cz}`, cz: f.cz, en: f.en, note: `#${f.rank} · ${f.type}` }))
  if (s === 'week') return weekItems(WEEKS[+value - 1]).filter((i) => i.kind !== 'sentence' && i.en && !i.cz.includes('…')).map((i) => ({ id: `wk:${i.cz}`, cz: i.cz, en: i.en }))
  const l = P.ladders[+value]
  return (l?.steps ?? []).map((st) => ({ id: `sn:${st.cz}`, cz: st.cz, en: st.en, note: st.grammar }))
}
