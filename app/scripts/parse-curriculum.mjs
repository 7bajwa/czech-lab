// Converts Doc/czech-26-week-curriculum.md (plan, patterns, tasks) + Doc/czech-vocabulary.md (words, sentences)
// into src/data/curriculum.json + rhythm.json.
// Czech text is kept verbatim. Run: node scripts/parse-curriculum.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const md = readFileSync(join(here, '../../Doc/czech-26-week-curriculum.md'), 'utf8').replace(/\r\n/g, '\n')
const outDir = join(here, '../src/data')

const lines = md.split('\n')
const FIELD = /^\*\*([^*]+?):?\*\*:?\s*(.*)$/

const sentenceCase = (s) => s.charAt(0) + s.slice(1).toLowerCase()

// ---- rhythm table
const rhythm = []
{
  const start = lines.findIndex((l) => l.startsWith('| Day | Name |'))
  const head = lines[start].split('|').slice(1, -1).map((s) => s.trim())
  for (let i = start + 2; lines[i]?.startsWith('|'); i++) {
    const cells = lines[i].split('|').slice(1, -1).map((s) => s.trim())
    const row = { day: cells[0], name: cells[1], blocks: [] }
    for (let c = 2; c < cells.length; c++) if (cells[c]) row.blocks.push({ minutes: head[c], task: cells[c] })
    rhythm.push(row)
  }
}

// ---- weeks
const weeks = []
let phase = ''
let cur = null
let field = null // name of the field collecting following lines

const MAP = {
  'Can-do': 'canDo', Speaking: 'speaking', 'Speaking (Thu)': 'speaking', Writing: 'writing', 'Writing (Fri)': 'writing',
  Input: 'input', 'Real-life task': 'realLife', 'Exam link': 'examLink', 'Weekly test': 'weeklyTest',
}

for (const l of lines) {
  const ph = l.match(/^# PHASE \d+: (.+?) \(Weeks/)
  if (ph) { phase = sentenceCase(ph[1]); continue }
  if (/^# /.test(l)) { cur = null; continue } // AFTER A2, COVERAGE MAP …
  const wk = l.match(/^## WEEK (\d+): (.+)$/)
  if (wk) {
    cur = { week: +wk[1], phase, title: wk[2].replace(/\*/g, ''), canDo: '', patternLab: [], vocabA: [], vocabB: [], sentences: [],
      speaking: '', writing: '', input: '', realLife: '', examLink: '', weeklyTest: '', plan: null, notes: [], mock: null }
    weeks.push(cur); field = null; continue
  }
  if (!cur) continue
  if (l.startsWith('|')) {
    const cells = l.split('|').slice(1, -1).map((s) => s.trim())
    if (cells[0] === 'Day' || cells[0].startsWith('---')) continue
    ;(cur.plan ??= []).push({ day: cells[0], plan: cells[1] })
    continue
  }
  const f = l.match(FIELD)
  if (f) {
    const [, name, rest] = f
    field = null
    if (MAP[name]) cur[MAP[name]] = rest
    else if (name.startsWith('Pattern Lab')) field = 'patternLab'
    else if (/^(Sentence bank|Vocabulary|Numbers)/.test(name)) field = 'skip' // read from czech-vocabulary.md
    else { cur.notes.push({ title: name, text: rest }); field = 'notes' }
    if (/^(Mock \d|Decision|If the gate)/.test(name)) cur.mock = { title: name, text: rest }
    continue
  }
  if (!l.trim() || l.startsWith('---')) continue
  if (field === 'skip') continue
  if (field === 'patternLab') cur.patternLab.push(l.replace(/^(\d+\.|-)\s+/, ''))
  else if (field === 'notes') cur.notes.at(-1).text += '\n' + l
  else cur.notes.push({ title: '', text: l })
}
// The Week 25 gate lives in its Friday plan row
for (const w of weeks) if (!w.mock && /Mock|gate/i.test(JSON.stringify(w.plan ?? ''))) w.mock = { title: 'Plan', text: w.plan.filter((p) => /Mock|gate/i.test(p.plan)).map((p) => `${p.day}: ${p.plan}`).join('\n') }

// ---- words and sentences: "## Week N" > "### Vocabulary A|B|Sentence bank" > | Czech | English | Note |
{
  const vmd = readFileSync(join(here, '../../Doc/czech-vocabulary.md'), 'utf8').replace(/\r\n/g, '\n')
  let w = null, list = null
  for (const l of vmd.split('\n')) {
    const wk = l.match(/^## Week (\d+)/)
    if (wk) { w = weeks[+wk[1] - 1]; list = null; continue }
    const sec = l.match(/^### (.+)/)
    if (sec) { list = /Sentence/.test(sec[1]) ? 'sentences' : / B$/.test(sec[1]) ? 'vocabB' : 'vocabA'; continue }
    if (!w || !list || !l.startsWith('|')) continue
    const [cz, en = '', note = ''] = l.split('|').slice(1, -1).map((c) => c.trim())
    if (!cz || cz === 'Czech' || /^-+$/.test(cz)) continue
    w[list].push(list === 'sentences' ? { cz, en, chunk: note.includes('★') } : { cz, en })
  }
}

// ---- games content: Doc/czech-practice.md → practice.json (## Verbs | ## Cases | ## Plural cases | ## Sentence ladders > ### title)
const practice = { verbs: [], cases: [], pluralCases: [], ladders: [] }
{
  const pmd = readFileSync(join(here, '../../Doc/czech-practice.md'), 'utf8').replace(/\r\n/g, '\n')
  let part = null
  for (const l of pmd.split('\n')) {
    const h2 = l.match(/^## (.+)/)
    if (h2) { part = /Verb/.test(h2[1]) ? 'verbs' : /Plural/.test(h2[1]) ? 'pluralCases' : /Case/.test(h2[1]) ? 'cases' : 'ladders'; continue }
    const h3 = l.match(/^### (.+)/)
    if (h3 && part === 'ladders') { practice.ladders.push({ title: h3[1], steps: [] }); continue }
    if (!part || !l.startsWith('|')) continue
    const c = l.split('|').slice(1, -1).map((x) => x.trim())
    if (/^-+$/.test(c[0]) || ['Verb', 'Czech'].includes(c[0]) || c[0].startsWith('Nominative')) continue
    if (part === 'verbs') practice.verbs.push({ verb: c[0], en: c[1], week: +c[2], present: c.slice(3, 9), past: c[9],
      future: c[10] === 'budu' || c[10] === '-' ? c[10] : c[10].split(' · ') })
    else if (part === 'cases' || part === 'pluralCases') practice[part].push({ nom: c[0], en: c[1], gender: c[2], acc: c[3], gen: c[4], dat: c[5], loc: c[6], ins: c[7] })
    else practice.ladders.at(-1).steps.push({ cz: c[0], en: c[1], week: +c[2], grammar: c[3] })
  }
  console.assert(practice.verbs.every((v) => v.present.length === 6 && v.past && (typeof v.future === 'string' || v.future.length === 6)), 'verb rows need 6 forms')
  console.assert(new Set(practice.verbs.map((v) => v.verb)).size === practice.verbs.length, 'duplicate verb row')
  console.assert([...practice.cases, ...practice.pluralCases].every((x) => x.ins), 'case rows need 6 cases')
  console.log(`games: ${practice.verbs.length} verbs, ${practice.cases.length} case phrases, ${practice.pluralCases.length} plural phrases, ${practice.ladders.length} ladders (${practice.ladders.flatMap((l) => l.steps).length} sentences)`)
}

// ---- weekly exercises: Doc/czech-exercises.md → exercises.json (## Week N > | Type | Prompt | Czech | English | Note |)
const exercises = []
{
  const emd = readFileSync(join(here, '../../Doc/czech-exercises.md'), 'utf8').replace(/\r\n/g, '\n')
  let week = 0
  for (const l of emd.split('\n')) {
    const wk = l.match(/^## Week (\d+)/)
    if (wk) { week = +wk[1]; continue }
    if (!week || !l.startsWith('|')) continue
    const [type, prompt, cz, en] = l.split('|').slice(1, -1).map((x) => x.trim())
    if (type === 'Type' || /^-+$/.test(type)) continue
    exercises.push({ week, type, prompt, cz, en })
  }
  const bad = exercises.filter((e) => !['gap', 'transform', 'dialogue', 'scene'].includes(e.type) || !e.cz || !e.en
    || (e.type === 'gap') !== e.prompt.includes('___') || (e.type === 'scene') === !!e.prompt)
  console.assert(!bad.length, 'bad exercise rows: ' + bad.map((e) => `w${e.week} ${e.cz}`).join(', '))
  const per = Object.entries(Object.groupBy(exercises, (e) => e.week)).map(([w, l]) => `${w}:${l.length}`)
  console.log(`exercises: ${exercises.length} (per week ${per.join(' ')})`)
}

// ---- self-checks + missing-field report
console.assert(weeks.length === 26, 'expected 26 weeks, got ' + weeks.length)
console.assert(rhythm.length === 6, 'expected 6 rhythm rows')
console.assert(weeks[0].sentences.length === 12 && weeks[0].sentences[0].cz === 'Dobrý den. Jak se máte?', 'week 1 sentences')
console.assert(weeks[1].sentences[5].chunk === true, 'week 2 ★ chunk')
console.assert(weeks[0].vocabA[0].cz === 'ano' && weeks[0].vocabA[0].en === 'yes', 'vocab table ano/yes')
for (const w of weeks) {
  const missing = ['canDo', 'patternLab', 'vocabA', 'vocabB', 'sentences', 'speaking', 'writing', 'input', 'realLife', 'examLink', 'weeklyTest']
    .filter((k) => !w[k] || (Array.isArray(w[k]) && !w[k].length))
    .filter((k) => !(k === 'vocabB' && w.vocabA.length)) // single "Vocabulary" list weeks
  if (w.plan) console.log(`Week ${w.week}: plan week (day table${w.mock ? ' + mock' : ''}), no ${missing.join(', ') || '-'}`)
  else if (missing.length) console.log(`Week ${w.week}: missing ${missing.join(', ')}`)
}
const noEn = weeks.flatMap((w) => [...w.vocabA, ...w.vocabB]).filter((v) => !v.en).length
console.log(`${weeks.length} weeks, ${weeks.flatMap((w) => [...w.vocabA, ...w.vocabB]).length} vocab items (${noEn} without English gloss), ${weeks.flatMap((w) => w.sentences).length} sentences`)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'curriculum.json'), JSON.stringify({ weeks }, null, 1))
writeFileSync(join(outDir, 'rhythm.json'), JSON.stringify(rhythm, null, 1))
writeFileSync(join(outDir, 'practice.json'), JSON.stringify(practice, null, 1))
writeFileSync(join(outDir, 'exercises.json'), JSON.stringify(exercises, null, 1))
