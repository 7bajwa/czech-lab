// Run: node src/lib/selftest.ts  (Node 24 strips types)
import assert from 'node:assert/strict'
import { check, wordDiff } from './check.ts'

assert.equal(check('dobrý den', 'Dobrý den.', 'sentence').correct, true)
assert.equal(check('děkuji', 'děkuju / děkuji', 'vocab').correct, true)
assert.equal(check('Jak se jmenuješ', 'Jak se jmenujete? / Jak se jmenuješ?', 'sentence').correct, true)
assert.equal(check('dobry den', 'Dobrý den.', 'sentence').tag, 'spelling')
assert.equal(check('den dobrý', 'Dobrý den.', 'sentence').tag, 'word order')
assert.equal(check('jsi', 'jsme', 'conjugation').tag, 'verb form')
assert.deepEqual(wordDiff('mluvím česky', 'mluvím trochu česky').map((p) => p.type), ['same', 'missing', 'same'])
console.log('check.ts ok')

import { readFileSync } from 'node:fs'
import { parseConjugations } from './conj.ts'
const weeks = JSON.parse(readFileSync(new URL('../data/curriculum.json', import.meta.url), 'utf8')).weeks
const w2 = parseConjugations(2, weeks[1].patternLab)
assert.deepEqual(w2.map((c) => `${c.lemma}|${c.gloss}`), ['být|to be', 'být|negative'])
assert.deepEqual(w2[1].forms, ['nejsem', 'nejsi', 'není', 'nejsme', 'nejste', 'nejsou'])
for (const w of weeks) for (const c of parseConjugations(w.week, w.patternLab)) console.log(w.week, c.lemma, c.gloss, c.forms.join(' '))
console.log('conj.ts ok')

import { verbForms, verbQuestions, caseQuestion, exerciseQuestions, tiles, type Exercise, type Practice } from './games.ts'
const practice: Practice = JSON.parse(readFileSync(new URL('../data/practice.json', import.meta.url), 'utf8'))
const verb = (v: string) => practice.verbs.find((x) => x.verb === v)!
assert.deepEqual(verbForms(verb('jít'), 'past')!.map((f) => f.split(' / ')[0]), ['šel jsem', 'šel jsi', 'šel', 'šli jsme', 'šli jste', 'šli'])
assert.equal(verbForms(verb('učit se'), 'past')![0], 'učil jsem se')
assert.equal(verbForms(verb('učit se'), 'future')![3], 'budeme se učit')
assert.equal(verbForms(verb('dát'), 'future'), null)
assert.equal(check('já jsem dělal', verbForms(verb('dělat'), 'past')![0], 'conjugation').correct, true)
const q = verbQuestions(verb('zpívat'), 'present')
assert.equal(q.length, 6); assert.ok(q[0].options.includes('zpívám') && q[0].options.length === 4)
assert.equal(caseQuestion(practice.cases[0], 'ins').target, 's velkým stolem')
assert.equal(tiles('To je míč.').sort().join(' '), 'To je míč')
assert.ok(practice.verbs.length >= 100, 'about 100 verbs')
assert.ok(practice.pluralCases.length >= 15, 'plural phrases')
const pl = practice.pluralCases.find((c) => c.nom === 'velké stoly')!
assert.equal(caseQuestion(pl, 'ins', true).target, 's velkými stoly')
assert.equal(caseQuestion(pl, 'gen', true).pattern, 'case-pl-gen')
assert.ok(caseQuestion(pl, 'dat', true).rule.startsWith('Dative plural'))
assert.ok(practice.ladders.length >= 30 && practice.ladders.every((l) => l.steps.length >= 6))
console.log('games.ts ok')

const exercises: Exercise[] = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'))
const exWeeks = [...new Set(exercises.map((e) => e.week))]
assert.deepEqual(exWeeks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
for (const w of exWeeks) {
  const list = exercises.filter((e) => e.week === w)
  assert.ok(list.length >= 12, `week ${w} exercises`)
  assert.equal(list.filter((e) => e.type === 'scene').length, 6, `week ${w} scene has 6 lines`)
}
const w1 = exerciseQuestions(exercises.filter((e) => e.week === 1))
assert.equal(w1[0].prompt, 'Dobrý ___. Jak se máte?'); assert.equal(w1[0].target, 'den')
assert.ok(w1[0].rule.startsWith('Dobrý den. Jak se máte?'))
assert.equal(check('Jmenuju', w1[2].target, 'vocab').correct, true)
const w12 = exerciseQuestions(exercises.filter((e) => e.week === 12))
assert.equal(w12.find((q) => q.prompt.startsWith('Pracuju doma'))!.tag, 'tense')
assert.equal(check('pracovala jsem doma', w12.find((q) => q.prompt.startsWith('Pracuju doma'))!.target, 'sentence').correct, true)
const scene = w1.filter((q) => q.hint!.startsWith('Scene'))
assert.equal(scene[0].prompt, 'Hello. How are you?'); assert.equal(scene[5].hint, 'Scene line 6 · say it in Czech')
console.log('exercises ok')
