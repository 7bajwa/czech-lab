// ---- verb tables pulled from Pattern Lab bullets ("být (to be): jsem · jsi · je · jsme · jste · jsou")
export const PRONOUNS = ['já', 'ty', 'on / ona', 'my', 'vy', 'oni']
export type Conjugation = { id: string; week: number; lemma: string; gloss: string; forms: string[]; rule: string }

export function parseConjugations(week: number, patternLab: string[]): Conjugation[] {
  const out: Conjugation[] = []
  patternLab.forEach((bullet) => {
    const plain = bullet.replace(/\*/g, '')
    const run = /([\p{L}]+(?: · [\p{L}]+){5})(?![\p{L}])/gu
    let last = ''
    for (const m of plain.matchAll(run)) {
      const prefix = plain.slice(0, m.index)
      const h = prefix.match(/(-?[\p{L}]+(?: \/ -?[\p{L}]+)?)(?:\s*\(([^)]*)\))?:\s*$/u)
      if (!h || /^\p{Lu}/u.test(h[1]) && h[1] !== 'Negative') continue // "Frequency: vždy · často …" is a word list, not a verb
      let lemma = h[1], gloss = h[2] ?? ''
      if (lemma === 'Negative') { lemma = last; gloss = 'negative' }
      else if (lemma.startsWith('-')) { lemma = gloss.split(',')[0]; gloss = h[1] }
      else if (lemma === 'future') { lemma = 'být'; gloss = 'future' }
      if (!/t$/.test(lemma)) continue // infinitives end in -t; "Question words: kdo · co …" is not a verb
      last = lemma
      out.push({ id: `w${week}-conj-${out.length}`, week, lemma, gloss, forms: m[1].split(' · '), rule: bullet })
    }
  })
  return out
}

