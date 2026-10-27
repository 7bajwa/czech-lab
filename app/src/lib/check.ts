// Answer checking: normalise, accept " / " alternatives, tag the error, word diff.
export type ErrorTag = 'case' | 'gender' | 'verb form' | 'tense' | 'word order' | 'spelling' | 'pronunciation' | 'vocabulary'
export type Verdict = { correct: boolean; tag?: ErrorTag; expected: string; diff: DiffPart[] }
export type DiffPart = { text: string; type: 'same' | 'missing' | 'extra' }

const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:„“"'()—–-]/g, ' ').replace(/\s+/g, ' ').trim()
const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

/** "děkuju / děkuji" and "Jak se jmenujete? / Jak se jmenuješ?" both list accepted answers. */
export const alternatives = (target: string) => target.split(' / ').map((t) => t.trim()).filter(Boolean)

export function check(answer: string, target: string, kind: 'vocab' | 'sentence' | 'conjugation'): Verdict {
  const alts = alternatives(target)
  // Short alternatives like "Ind / Indka" are separate words; full-string match covers "student / studentka" too.
  if (alts.some((t) => norm(t) === norm(answer)) || norm(target) === norm(answer)) return { correct: true, expected: target, diff: [] }
  const best = alts.reduce((a, b) => (similarity(answer, b) > similarity(answer, a) ? b : a))
  const diff = wordDiff(norm(answer), norm(best))
  let tag: ErrorTag = kind === 'conjugation' ? 'verb form' : 'vocabulary'
  if (strip(norm(best)) === strip(norm(answer))) tag = 'spelling'
  else if (norm(best).split(' ').sort().join(' ') === norm(answer).split(' ').sort().join(' ')) tag = 'word order'
  return { correct: false, tag, expected: best, diff }
}

function similarity(a: string, b: string) {
  const A = new Set(norm(a).split(' ')), B = norm(b).split(' ')
  return B.filter((w) => A.has(w)).length / Math.max(B.length, 1)
}

/** LCS word diff: 'missing' = in target but not typed, 'extra' = typed but not in target. */
export function wordDiff(answer: string, target: string): DiffPart[] {
  const a = answer ? answer.split(' ') : [], b = target ? target.split(' ') : []
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: DiffPart[] = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ text: b[j], type: 'same' }); i++; j++ }
    else if (j < b.length && (i >= a.length || L[i][j + 1] >= L[i + 1][j])) out.push({ text: b[j++], type: 'missing' })
    else out.push({ text: a[i++], type: 'extra' })
  }
  return out
}

/** One-sentence rule for a tag (shown with the corrected example). */
export const RULE_FOR_TAG: Record<ErrorTag, string> = {
  spelling: 'Diacritics change meaning: long vowels (á é í ó ú ů ý) and háček letters (č š ž ř ě) must be written.',
  'word order': 'All the right words, wrong order: Czech is flexible, but little words like "se" sit in slot 2.',
  'verb form': 'The verb ending is the pronoun: -m = I, -š = you, -me = we, -te = you (pl/formal).',
  vocabulary: 'Different word from the target. Learn the whole chunk as one unit.',
  case: 'The ending must match the case the question word asks for.',
  gender: 'Pick ten/ta/to, můj/moje, nový/nová/nové to match the noun’s gender.',
  tense: 'Check the tense: present, past or future.',
  pronunciation: 'Say it again slowly, stress on the first syllable.',
}
