// Collects every Czech text the app can speak → scripts/audio-texts.json ([{ h, text }]) for make-audio.py.
// The key is audioKey() from src/lib/audiokey.ts: the browser looks up public/audio/<h>.mp3 with the same function.
// Run: node scripts/audio-texts.mjs   (after npm run parse)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { audioKey, speechText } from '../src/lib/audiokey.ts'

const here = dirname(fileURLToPath(import.meta.url))
const data = (f) => JSON.parse(readFileSync(join(here, '../src/data', f + '.json'), 'utf8'))
const texts = new Set()
const add = (s) => {
  if (!s || s.includes('…') || s.includes('___')) return
  texts.add(s)
  if (s.includes(' / ')) texts.add(s.split(' / ')[0].trim()) // games speak the first alternative, drills the whole answer
}

const { weeks } = data('curriculum')
for (const w of weeks) for (const x of [...w.vocabA, ...w.vocabB, ...w.sentences]) add(x.cz)
const P = data('practice')
for (const l of P.ladders) for (const s of l.steps) add(s.cz)
for (const c of [...P.cases, ...P.pluralCases]) for (const k of ['nom', 'acc', 'gen', 'dat', 'loc', 'ins']) add(c[k])
for (const v of P.verbs) {
  v.present.forEach(add)
  const refl = v.past.endsWith(' se'), l = v.past.replace(/ se$/, ''), pl = l.endsWith('šel') ? l.slice(0, -3) + 'šli' : l + 'i'
  ;(refl ? [`${l} jsem se`, `${l} ses`, `${l} se`, `${pl} jsme se`, `${pl} jste se`, `${pl} se`] : [`${l} jsem`, `${l} jsi`, l, `${pl} jsme`, `${pl} jste`, pl]).forEach(add)
  if (Array.isArray(v.future)) v.future.forEach(add)
}
for (const e of data('exercises')) add(e.cz)
for (const t of data('grammar')) for (const p of t.practice) add(p.cz)
for (const r of data('roleplay')) for (const l of r.lines) add(l.cz)
for (const g of [...data('phrasebook'), ...data('wordgroups')]) for (const it of g.items) add(it.cz)
for (const w of data('wordbook')) add(w.cz)
for (const f of data('frequency')) add(f.cz)
// exam: transcripts and examiner lines, one line per speaker, labels removed (as Exam.tsx speaks them)
const bySpeaker = (line) => line.split(/\s(?=\p{Lu}[\p{Ll}]{1,14}( \d)?: )/u).filter((x) => x && !/^ \d$/.test(x))
const speakable = (line) => line.replace(/^[^:]{1,25}:\s*/, '')
for (const m of data('exam').mocks) for (const p of m.parts) for (const t of p.tasks) {
  if (p.name === 'Listening') for (const l of [...t.text, ...t.items.map((i) => i.text)].filter(Boolean).flatMap(bySpeaker)) add(speakable(l))
  if (p.name === 'Speaking') for (const l of t.text.filter((l) => /^Examiner:/i.test(l))) add(speakable(l))
}
// pronunciation lab (src/lib/pron.ts)
for (const m of readFileSync(join(here, '../src/lib/pron.ts'), 'utf8').matchAll(/\b(?:a|b|cz): '([^']+)'/g)) add(m[1])

const out = new Map()
for (const t of texts) { const s = speechText(t); if (s) out.set(audioKey(s), s) }
writeFileSync(join(here, 'audio-texts.json'), JSON.stringify([...out].map(([h, text]) => ({ h, text }))))
console.log(`${out.size} texts to speak`)
