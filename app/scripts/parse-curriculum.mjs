// Converts Doc/czech-26-week-curriculum.md (plan, patterns, tasks) + Doc/czech-vocabulary.md (words, sentences)
// into src/data/curriculum.json + rhythm.json.
// Czech text is kept verbatim. Run: node scripts/parse-curriculum.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const md = readFileSync(join(here, '../../Doc/czech-26-week-curriculum.md'), 'utf8').replace(/\r\n/g, '\n')
const outDir = join(here, '../src/data')
mkdirSync(outDir, { recursive: true })

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

// ---- extra docs (phrasebook, frequency, word groups, role-play, grammar, weekend, exams). A missing doc gives empty data.
const readDoc = (name) => { try { return readFileSync(join(here, '../../Doc', name), 'utf8').replace(/\r\n/g, '\n').split('\n') } catch { console.log(`(no ${name})`); return [] } }
const cellsOf = (l) => l.split('|').slice(1, -1).map((x) => x.trim())
const isHead = (c) => !c.length || /^:?-+:?$/.test(c[0]) || ['Czech', 'English', 'Rank', 'Who', 'Verb', 'Prompt', '#'].includes(c[0])

// More verbs (Doc/czech-verbs-more.md, same columns) and more ladders (Doc/czech-sentences.md, "### title · Category")
for (const l of readDoc('czech-verbs-more.md')) {
  const c = cellsOf(l)
  if (!l.startsWith('|') || isHead(c) || c.length < 11 || practice.verbs.some((v) => v.verb === c[0])) continue
  practice.verbs.push({ verb: c[0], en: c[1], week: +c[2] || 20, present: c.slice(3, 9), past: c[9], future: c[10] === 'budu' || c[10] === '-' ? c[10] : c[10].split(' · ') })
}
for (const l of practice.ladders) l.category ??= 'Core ladders'
for (const l of readDoc('czech-sentences.md')) {
  const h3 = l.match(/^### (.+?)(?: · (.+))?$/)
  if (h3) { practice.ladders.push({ title: h3[1], category: h3[2] ?? 'More', steps: [] }); continue }
  const c = cellsOf(l)
  if (!l.startsWith('|') || isHead(c) || !practice.ladders.length) continue
  practice.ladders.at(-1).steps.push({ cz: c[0], en: c[1], week: +c[2] || 1, grammar: c[3] ?? '' })
}
practice.ladders = practice.ladders.filter((l) => l.steps.length)
console.assert(practice.verbs.every((v) => v.present.length === 6 && v.present.every(Boolean)), 'verb rows need 6 present forms')

/** "## Category" + | a | b | c | tables → [{ category, items }], merging repeated categories. */
function grouped(lines, row) {
  const out = []
  let cur = null
  for (const l of lines) {
    const h = l.match(/^## (.+)/)
    if (h) { cur = out.find((g) => g.category === h[1].trim()) ?? (out.push({ category: h[1].trim(), items: [] }), out.at(-1)); continue }
    const c = cellsOf(l)
    if (!cur || !l.startsWith('|') || isHead(c)) continue
    const it = row(c)
    if (it && !cur.items.some((x) => x.cz === it.cz)) cur.items.push(it)
  }
  return out.filter((g) => g.items.length)
}

const phrasebook = grouped([1, 2, 3].flatMap((n) => readDoc(`parts/phrasebook-${n}.md`)), (c) => c[0] && c[1] ? { cz: c[0], en: c[1] } : null)
const wordgroups = grouped(readDoc('czech-wordgroups.md'), (c) => c[0] && c[1] ? { cz: c[0], en: c[1], gender: c[2] ?? '' } : null)
const wordbook = readDoc('czech-wordbook.md').filter((l) => l.startsWith('|')).map(cellsOf).filter((c) => !isHead(c) && c[1]).map((c) => ({ en: c[0], cz: c[1], type: c[2] ?? '' }))
const frequency = readDoc('czech-frequency.md').filter((l) => l.startsWith('|')).map(cellsOf).filter((c) => /^\d+$/.test(c[0]) && c[1]).map((c) => ({ rank: +c[0], cz: c[1], type: c[2], en: c[3] }))

// Role-play: "## Title" + "Place: … · A: … · B: … · Week: n" + | Who | Czech | English |
const roleplay = []
for (const l of readDoc('czech-roleplay.md')) {
  const h = l.match(/^## (.+)/)
  if (h) { roleplay.push({ title: h[1], place: '', a: '', b: '', week: 0, lines: [] }); continue }
  const r = roleplay.at(-1)
  if (!r) continue
  if (/^Place:/.test(l)) { for (const kv of l.split(' · ')) { const [k, ...v] = kv.split(':'); const key = k.trim().toLowerCase(); if (key in r) r[key] = key === 'week' ? +v.join(':').trim() : v.join(':').trim() } continue }
  const c = cellsOf(l)
  if (l.startsWith('|') && !isHead(c) && /^[AB]$/.test(c[0])) r.lines.push({ who: c[0], cz: c[1], en: c[2] })
}

// Grammar study: "## Topic" + "Level: A1 · Weeks: 1, 2" + markdown body + "### Practice" table (Prompt | Czech | English)
const grammar = []
{
  let cur = null, inPractice = false
  for (const l of readDoc('czech-grammar.md')) {
    const h = l.match(/^## (.+)/)
    if (h) { cur = { title: h[1], level: '', weeks: [], body: '', practice: [] }; grammar.push(cur); inPractice = false; continue }
    if (!cur) continue
    const m = l.match(/^Level:\s*(\S+)(?:\s*·\s*Weeks?:\s*(.+))?/)
    if (m && !cur.body.trim()) { cur.level = m[1]; cur.weeks = (m[2] ?? '').split(/[,\s]+/).flatMap((x) => { const [a, b] = x.split(/[-–]/).map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : a ? [a] : [] }); continue }
    if (/^### Practice/.test(l)) { inPractice = true; continue }
    const c = cellsOf(l)
    if (inPractice) { if (l.startsWith('|') && !isHead(c) && c[1]) cur.practice.push({ prompt: c[0], cz: c[1], en: c[2] ?? '' }); continue }
    cur.body += l + '\n'
  }
  for (const g of grammar) g.body = g.body.trim()
}

// Weekend key points: "## Week N" + bullets
const weekend = {}
{
  let wk = 0
  for (const l of readDoc('czech-weekend.md')) {
    const h = l.match(/^## Week (\d+)/)
    if (h) { wk = +h[1]; weekend[wk] = []; continue }
    if (wk && /^[-*] /.test(l)) weekend[wk].push(l.slice(2).trim())
  }
}

// Mock exams: "# Mock N" > "## Part · minutes" > "### Task n · type · points" + Instruction: / > text / - A: option / Checklist: - (n) … / table
const exam = { format: '', mocks: [] }
{
  let mock = null, part = null, task = null, inChecklist = false, head = null, inFormat = false
  for (const l of readDoc('czech-exam.md')) {
    const m1 = l.match(/^# (Mock .+)/)
    if (m1) { mock = { title: m1[1], parts: [] }; exam.mocks.push(mock); part = task = null; inFormat = false; continue }
    if (/^## Format/.test(l) && !mock) { inFormat = true; continue }
    if (inFormat) { exam.format += l + '\n'; continue }
    if (!mock) continue
    const m2 = l.match(/^## (Reading|Listening|Writing|Speaking)\s*·\s*(\d+)/)
    if (m2) { part = { name: m2[1], minutes: +m2[2], tasks: [] }; mock.parts.push(part); task = null; continue }
    const m3 = l.match(/^### Task (\d+)\s*·\s*(\w+)\s*·\s*(\d+)/)
    if (m3 && part) { task = { n: +m3[1], type: m3[2], points: +m3[3], instruction: '', text: [], options: [], items: [], checklist: [] }; part.tasks.push(task); inChecklist = false; head = null; continue }
    if (!task) continue
    if (/^Instruction:/.test(l)) task.instruction = l.replace(/^Instruction:\s*/, '')
    else if (/^Checklist:/.test(l)) inChecklist = true
    else if (/^> ?/.test(l)) task.text.push(l.replace(/^> ?/, ''))
    else if (inChecklist && /^- \(\d+\)/.test(l)) { const [, p, t] = l.match(/^- \((\d+)\)\s*(.+)/); task.checklist.push({ points: +p, text: t }) }
    else if (/^- [A-H]: /.test(l)) task.options.push({ key: l[2], text: l.slice(5).trim() })
    else if (l.startsWith('|')) {
      const c = cellsOf(l)
      if (c[0] === '#') { head = c; continue }
      if (!head || /^:?-+/.test(c[0])) continue
      const get = (k) => c[head.indexOf(k)] ?? ''
      task.items.push({ num: get('#'), text: get('Text'), question: get('Question'), opts: ['A', 'B', 'C', 'D', 'E', 'F'].filter((k) => head.includes(k) && get(k)).map((k) => ({ key: k, text: get(k) })), answer: get('Answer') })
    }
  }
  exam.format = exam.format.trim()
}

console.log(`extra: ${phrasebook.length} phrase categories (${phrasebook.flatMap((g) => g.items).length}), ${wordgroups.length} word groups (${wordgroups.flatMap((g) => g.items).length}), wordbook ${wordbook.length}, frequency ${frequency.length}, role-plays ${roleplay.length}, grammar ${grammar.length}, weekend ${Object.keys(weekend).length}, mocks ${exam.mocks.length}`)
console.log(`games now: ${practice.verbs.length} verbs, ${practice.ladders.length} ladders`)
const bump = (name, list) => { const bad = list.filter(Boolean); if (bad.length) console.log(`check ${name}:`, bad.slice(0, 5).join(' ; ')) }
bump('roleplay lines', roleplay.filter((r) => !r.lines.length).map((r) => r.title))
bump('exam tasks without items', exam.mocks.flatMap((m) => m.parts.flatMap((p) => p.tasks.filter((t) => !['write', 'speak'].includes(t.type) && !t.items.length).map((t) => `${m.title} ${p.name} ${t.n}`))))
bump('exam points', exam.mocks.flatMap((m) => m.parts.map((p) => `${m.title} ${p.name} ${p.tasks.reduce((a, t) => a + t.points, 0)}`)).filter((s) => !/(Reading|Listening) 25$|Writing 20$|Speaking 40$/.test(s)))
for (const [name, data] of Object.entries({ phrasebook, wordgroups, wordbook, frequency, roleplay, grammar, weekend, exam }))
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data))

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


writeFileSync(join(outDir, 'curriculum.json'), JSON.stringify({ weeks }, null, 1))
writeFileSync(join(outDir, 'rhythm.json'), JSON.stringify(rhythm, null, 1))
writeFileSync(join(outDir, 'practice.json'), JSON.stringify(practice, null, 1))
writeFileSync(join(outDir, 'exercises.json'), JSON.stringify(exercises, null, 1))
