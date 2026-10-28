// Game questions built from Doc/czech-practice.md (verbs, cases, ladders) and the weekly vocabulary.
import type { ErrorTag } from './check'

export type Verb = { verb: string; en: string; week: number; present: string[]; past: string; future: 'budu' | '-' | string[] }
export type CasePhrase = { nom: string; en: string; gender: string; acc: string; gen: string; dat: string; loc: string; ins: string }
export type Ladder = { title: string; category?: string; steps: { cz: string; en: string; week: number; grammar: string }[] }
export type Practice = { verbs: Verb[]; cases: CasePhrase[]; pluralCases: CasePhrase[]; ladders: Ladder[] }
export type Exercise = { week: number; type: 'gap' | 'transform' | 'dialogue' | 'scene'; prompt: string; cz: string; en: string }

export type Tense = 'present' | 'past' | 'future'
export type CaseKey = 'nom' | 'acc' | 'gen' | 'dat' | 'loc' | 'ins'
export type Question = { id: string; prompt: string; hint?: string; target: string; options: string[]; rule: string; tag: ErrorTag; pattern: string; week?: number }

export const PERSONS = ['já', 'ty', 'on / ona', 'my', 'vy', 'oni']
const first = (s: string) => s.split(' / ')[0].trim()
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/** Up to 3 distinct wrong options (first alternative of each), plus the answer, shuffled. */
export function withOptions(target: string, pool: string[]) {
  const t = first(target)
  const wrong = shuffle([...new Set(pool.map(first))].filter((p) => p !== t)).slice(0, 3)
  return shuffle([t, ...wrong])
}

// ---- verbs
export const TENSE_RULE: Record<Tense, string> = {
  present: 'Present endings carry the person: -m / -u = I, -š = you, no ending = he/she, -me = we, -te = you (pl), -jí / -ou / -í = they.',
  past: 'Past = the -l form + jsem / jsi for I / you (dělal jsem); he/she has no jsem (dělal); plural -li + jsme / jste (dělali jsme).',
  future: 'Future = budu, budeš, bude, budeme, budete, budou + infinitive. Perfective verbs (dát, koupit…) use their present forms instead.',
}

/** The six forms of a verb in a tense (null = this verb has no form of its own in that tense). */
export function verbForms(v: Verb, tense: Tense): string[] | null {
  if (tense === 'present') return v.present
  if (tense === 'future') {
    if (v.future === '-') return null
    if (Array.isArray(v.future)) return v.future
    const refl = v.verb.endsWith(' se'), inf = v.verb.replace(/ se$/, '')
    return ['budu', 'budeš', 'bude', 'budeme', 'budete', 'budou'].map((b) => (refl ? `${b} se ${inf}` : `${b} ${inf}`))
  }
  const refl = v.past.endsWith(' se'), l = v.past.replace(/ se$/, '')
  const pl = l.endsWith('šel') ? l.slice(0, -3) + 'šli' : l + 'i' // šel → šli, přišel → přišli
  if (refl) return [`${l} jsem se`, `${l} ses / ${l} jsi se`, `${l} se`, `${pl} jsme se`, `${pl} jste se`, `${pl} se`]
  const pron = ['já jsem', 'ty jsi', '', 'my jsme', 'vy jste', '']
  return [`${l} jsem`, `${l} jsi`, l, `${pl} jsme`, `${pl} jste`, pl].map((f, i) => (pron[i] ? `${f} / ${pron[i]} ${i < 3 ? l : pl}` : f))
}

/** All six persons of one verb, in order já → oni (the "I sing, you sing, he sings…" table). */
export function verbQuestions(v: Verb, tense: Tense): Question[] {
  const forms = verbForms(v, tense)
  if (!forms) return []
  return forms.map((f, p) => ({
    id: `verb:${v.verb}:${tense}:${p}`, prompt: `${v.verb} · ${PERSONS[p]}`, hint: `${v.en} · ${tense}${p === 2 || p === 5 ? ' (m)' : ''}`,
    target: f, options: withOptions(f, forms), rule: TENSE_RULE[tense], tag: tense === 'present' ? 'verb form' : 'tense', pattern: `verb-${tense}`, week: v.week,
  }))
}

// ---- cases
export const CASES: { key: CaseKey; name: string; frame: string; rule: string }[] = [
  { key: 'nom', name: 'Nominative', frame: 'To je …', rule: 'Nominative (kdo? co?): the dictionary form.' },
  { key: 'acc', name: 'Accusative', frame: 'Vidím …', rule: 'Accusative (koho? co?): f -a → -u, adjective -á → -ou; m animate -a, adjective -ého; m inanimate and neuter stay the same.' },
  { key: 'gen', name: 'Genitive', frame: 'bez …', rule: 'Genitive (koho? čeho?) after bez, do, z, u, od: m / n -a or -u, f -y / -e, adjective -ého (m, n) / -é (f).' },
  { key: 'dat', name: 'Dative', frame: 'k / ke …', rule: 'Dative (komu? čemu?) after k / ke: m -ovi / -u / -i, f -e / -ě / -i, adjective -ému (m, n) / -é (f).' },
  { key: 'loc', name: 'Locative', frame: 'o …', rule: 'Locative (o kom? o čem?) after o, v, na: m -ovi / -ě / -u / -i, f -e / -ě / -i, adjective -ém (m, n) / -é (f).' },
  { key: 'ins', name: 'Instrumental', frame: 's / se …', rule: 'Instrumental (kým? čím?) after s / se: m / n -em, f -ou / -í, adjective -ým (m, n) / -ou (f).' },
]

export const PLURAL_RULE: Record<CaseKey, string> = {
  nom: 'Nominative plural (To jsou …): adjective -é, m animate -í (dobří); nouns -y / -e / -i, n -a.',
  acc: 'Accusative plural: m animate -y (kamarády, bratry), adjective -é; everything else = the nominative plural.',
  gen: 'Genitive plural after bez, do, z, u, od: adjective -ých; m -ů; f -a and n -o nouns drop the ending (žen, knih, aut); f -e nouns -í or nothing (židlí, ulic).',
  dat: 'Dative plural after k / ke: adjective -ým; nouns -ům (m, n), -ám (f -a), -ím (f -e); děti → dětem.',
  loc: 'Locative plural after o, v, na: adjective -ých; nouns -ech / -ích (m, n), -ách (f -a), -ích (f -e); k → c: klucích.',
  ins: 'Instrumental plural after s / se: adjective -ými; nouns -y (m, n), -ami (f -a), -emi (f -e); děti → dětmi.',
}

export function caseQuestion(c: CasePhrase, key: CaseKey, plural = false): Question {
  const meta = CASES.find((x) => x.key === key)!
  const all = CASES.map((x) => c[x.key])
  return {
    id: `case:${c.nom}:${key}`, prompt: `${key === 'nom' && plural ? 'To jsou …' : meta.frame} ${c.nom}`, hint: `${meta.name}${plural ? ' plural' : ''} · ${c.en} · ${c.gender}`,
    target: c[key], options: withOptions(c[key], all), rule: plural ? PLURAL_RULE[key] : meta.rule, tag: 'case', pattern: `case-${plural ? 'pl-' : ''}${key}`,
  }
}

// ---- sentence ladders and words
export const ladderQuestions = (l: Ladder): Question[] => l.steps.map((s, i) => ({
  id: `ladder:${l.title}:${s.cz}`, prompt: s.en, hint: `Step ${i + 1} / ${l.steps.length} · week ${s.week} · ${s.grammar}`,
  target: s.cz, options: withOptions(s.cz, l.steps.map((x) => x.cz)), rule: s.grammar, tag: 'word order', pattern: `ladder-${l.title}`, week: s.week,
}))

export const wordQuestions = (items: { id: string; cz: string; en: string; week: number }[]): Question[] => items.map((it) => ({
  id: `word:${it.id}`, prompt: it.en, hint: `week ${it.week}`, target: it.cz, options: withOptions(it.cz, items.map((x) => x.cz)),
  rule: 'Learn the word with its diacritics: they change the sound and the meaning.', tag: 'vocabulary', pattern: `w${it.week}-vocab`, week: it.week,
}))

// ---- weekly exercises (Doc/czech-exercises.md): played in file order, so the scene rows stay a story
const fill = (e: Exercise) => e.prompt.replace(/\s*\([^)]*\)\s*$/, '').replace('___', first(e.cz))
const exTag = (e: Exercise): ErrorTag => e.type === 'gap' ? 'vocabulary' : e.type !== 'transform' ? 'word order'
  : /past|future|zítra|včera/.test(e.prompt) ? 'tense' : /→ (ty|vy|on|ona|my|oni|negative)/.test(e.prompt) ? 'verb form' : 'case'

export const exerciseQuestions = (list: Exercise[]): Question[] => list.map((e, i) => ({
  id: `ex:${e.week}:${e.cz}`, prompt: e.type === 'scene' ? e.en : e.prompt,
  hint: { gap: `Fill the gap · ${e.en}`, transform: `Change it · ${e.en}`, dialogue: `Reply · ${e.en}`, scene: `Scene line ${list.slice(0, i + 1).filter((x) => x.type === 'scene').length} · say it in Czech` }[e.type],
  target: e.cz, options: withOptions(e.cz, list.filter((x) => x.type === e.type).map((x) => x.cz)),
  rule: e.type === 'gap' ? `${fill(e)} (${e.en})` : e.en, tag: exTag(e), pattern: `ex-w${e.week}-${e.type}`, week: e.week,
}))

/** Word tiles for "build the sentence": the target's words, shuffled, without end punctuation. */
export const tiles = (target: string) => shuffle(first(target).replace(/[.!?]$/, '').split(' '))

export { shuffle, first }
