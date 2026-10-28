import { useEffect, useRef, useState } from 'react'
import { check, type Verdict } from '../lib/check'
import { db, logError, type Profile } from '../lib/db'
import { CASES, PLURAL_RULE, PERSONS, TENSE_RULE, caseQuestion, first, ladderQuestions, shuffle, tiles, verbForms, verbQuestions, withOptions, type CaseKey, type Question, type Tense } from '../lib/games'
import { FREQUENCY, FREQ_BAND, P, PHRASEBOOK, WORDBOOK, WORDGROUPS, deckItems } from '../lib/extra'
import type { LexItem } from '../lib/lex'
import { audioAfter, cue } from '../lib/feedback'
import { stt } from '../lib/stt'
import { tts } from '../lib/tts'
import { CzechKeys } from '../components/CzechKeys'
import { Diff } from '../components/Diff'
import { Chips, GameBar, HelpBoard, Seg, Stepper } from '../components/GameBar'
import { Match } from './games/Match'
import { Flashcards } from './games/Flashcards'
import { Falling } from './games/Falling'

type Game = 'verbs' | 'cases' | 'ladders' | 'words' | 'freq' | 'match' | 'flash' | 'falling' | 'phrases' | 'wordbook'
export type Mode = 'pick' | 'type' | 'speak' | 'build'

const GAMES: { id: Game; title: string; text: string }[] = [
  { id: 'verbs', title: 'Verbs', text: 'All persons: já, ty, on, my, vy, oni. Present, past, future, or all mixed. Most common verbs first.' },
  { id: 'cases', title: 'Cases', text: 'Adjective + noun in all cases, singular and plural, with an endings board.' },
  { id: 'ladders', title: 'Sentences', text: 'Everyday sentences from simple to complex, with the grammar of each one explained.' },
  { id: 'words', title: 'Words', text: 'Nouns and things in groups: animals, colours, food, the body, jobs…' },
  { id: 'freq', title: 'Frequency dictionary', text: 'The 5000 most used Czech words, 100 at a time.' },
  { id: 'match', title: 'Match', text: 'Match Czech to English against the clock. It speeds up; your words per minute are tracked.' },
  { id: 'flash', title: 'Flashcards', text: 'Tap to flip, swipe to grade: ← Hard, → Easy, ↑ Good, ↓ Again.' },
  { id: 'falling', title: 'Falling words', text: 'Words fall: type them in Czech before they land. Slow at first, then faster.' },
  { id: 'phrases', title: 'Phrasebook', text: 'Phrases by place and situation: café, bank, doctor, office, transport…' },
  { id: 'wordbook', title: 'Wordbook', text: 'The phrasebook’s dictionary: search English or Czech, listen, practise.' },
]

export function Games({ profile }: { profile: Profile }) {
  const [game, setGame] = useState<Game | null>(null)
  const [round, setRound] = useState<{ qs: Question[]; mode: Mode; title: string } | null>(null)
  if (round) return <Runner key={round.title + round.qs[0]?.id} {...round} rate={profile.ttsRate} onExit={() => setRound(null)} />
  const back = () => setGame(null)
  const start = (qs: Question[], mode: Mode, title: string) => qs.length && setRound({ qs, mode, title })
  if (game === 'match') return <Match onBack={back} />
  if (game === 'flash') return <Flashcards onBack={back} />
  if (game === 'falling') return <Falling onBack={back} />
  if (game === 'verbs') return <VerbSetup onBack={back} onStart={start} />
  if (game === 'cases') return <CaseSetup onBack={back} onStart={start} />
  if (game === 'ladders') return <LadderSetup onBack={back} onStart={start} />
  if (game === 'words') return <WordSetup onBack={back} onStart={start} />
  if (game === 'freq') return <FreqSetup onBack={back} onStart={start} />
  if (game === 'phrases') return <PhraseSetup onBack={back} onStart={start} />
  if (game === 'wordbook') return <Wordbook onBack={back} onStart={start} />
  return (
    <>
      <h1>Games</h1>
      <div className="game-grid">
        {GAMES.map((g) => <button key={g.id} className="card game" onClick={() => setGame(g.id)}><b>{g.title}</b><span className="muted small">{g.text}</span></button>)}
      </div>
      <p className="muted small">Game content was written or converted by Claude: check it in the Doc folder (czech-practice, czech-sentences, czech-wordgroups, czech-frequency, parts/phrasebook-*).</p>
    </>
  )
}

type SetupProps = { onBack: () => void; onStart: (qs: Question[], mode: Mode, title: string) => void }
const MODES: Record<Mode, string> = { pick: 'Pick', type: 'Type', speak: 'Speak', build: 'Build' }

function ModePicker({ mode, setMode, modes = ['pick', 'type', 'speak'] }: { mode: Mode; setMode: (m: Mode) => void; modes?: Mode[] }) {
  return <>
    <div className="muted small">How to answer</div>
    <Seg value={mode} options={modes} labels={MODES} onChange={(m) => setMode(m as Mode)} />
    {mode === 'speak' && !stt.supported() && <p className="bad">This browser has no speech recognition. Try Chrome or Edge, or your phone.</p>}
  </>
}

const Say = ({ text, rate = 1 }: { text: string; rate?: number }) => <button className="link say" aria-label={`Play ${text}`} onClick={() => tts.speak(text, rate)}>▶</button>

// ---------- verbs
const VERB_MIX = [{ value: 'top10', label: 'Mix: top 10 verbs' }, { value: 'top20', label: 'Mix: top 20 verbs' }, { value: 'top50', label: 'Mix: top 50 verbs' }]
const TENSES: Tense[] = ['present', 'past', 'future']

function VerbSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('pick')
  const [verb, setVerb] = useState(P.verbs[0].verb)
  const [tenses, setTenses] = useState<string[]>(['present'])
  const mix = verb.startsWith('top') ? P.verbs.slice(0, +verb.slice(3)) : null
  const v = P.verbs.find((x) => x.verb === verb)
  const options = [...VERB_MIX, ...P.verbs.map((x, i) => ({ value: x.verb, label: `${i + 1}. ${x.verb} — ${x.en}` }))]

  function play() {
    const label = (t: string) => (tenses.length > 1 ? ` · ${t}` : '')
    const qsOf = (x: typeof P.verbs[number]) => tenses.flatMap((t) => verbQuestions(x, t as Tense).map((q) => ({ ...q, prompt: q.prompt + label(t) })))
    const qs = mix ? shuffle(mix.flatMap(qsOf)).slice(0, 15) : tenses.length > 1 ? shuffle(qsOf(v!)) : qsOf(v!)
    onStart(qs, mode, `Verbs · ${v?.verb ?? verb} · ${tenses.join(' + ')}`)
  }
  const noForms = !mix && v && tenses.every((t) => !verbForms(v, t as Tense))

  return (
    <>
      <GameBar title="Verbs" onBack={onBack} onPlay={play} disabled={!!noForms} />
      <div className="card form">
        <Stepper label="verb" value={verb} options={options} onChange={setVerb} />
        {v && <p className="muted small">{v.en} · week {v.week}</p>}
        <div className="muted small">Tenses (pick one or more: mixed tenses come in random order)</div>
        <Chips value={tenses} options={TENSES} onChange={setTenses} />
        {v && tenses.includes('future') && v.future === '-' && <p className="muted small">This verb is perfective: its present forms already mean the future (dám = I will give).</p>}
        <HelpBoard title="See all the forms">
          {(mix ?? [v!]).map((x) => <VerbTable key={x.verb} verb={x} tenses={tenses as Tense[]} />)}
          {tenses.map((t) => <p key={t} className="small"><b>{t}:</b> {TENSE_RULE[t as Tense]}</p>)}
        </HelpBoard>
        <ModePicker mode={mode} setMode={setMode} />
      </div>
    </>
  )
}

export function VerbTable({ verb, tenses }: { verb: typeof P.verbs[number]; tenses: Tense[] }) {
  const cols = tenses.map((t) => [t, verbForms(verb, t)] as const)
  return (
    <div className="scroll-x"><table className="md">
      <caption><b lang="cs">{verb.verb}</b> <span className="muted">{verb.en}</span></caption>
      <thead><tr><th /> {cols.map(([t]) => <th key={t}>{t}</th>)}</tr></thead>
      <tbody>{PERSONS.map((p, i) => <tr key={p}><td className="muted">{p}</td>{cols.map(([t, f]) => <td key={t} lang="cs">{f ? <>{first(f[i])} <Say text={first(f[i])} /></> : <span className="muted">= present</span>}</td>)}</tr>)}</tbody>
    </table></div>
  )
}

// ---------- cases
function CaseSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('pick')
  const [caseKey, setCaseKey] = useState<CaseKey | 'mix'>('acc')
  const [number, setNumber] = useState<'singular' | 'plural'>('singular')
  const plural = number === 'plural'
  const list = plural ? P.pluralCases : P.cases
  function play() {
    const qs = list.map((c) => caseQuestion(c, caseKey === 'mix' ? CASES[1 + Math.floor(Math.random() * 5)].key : caseKey, plural))
    onStart(shuffle(qs).slice(0, 12), mode, `Cases · ${plural ? 'plural · ' : ''}${caseKey}`)
  }
  return (
    <>
      <GameBar title="Cases" onBack={onBack} onPlay={play} />
      <div className="card form">
        <Seg value={number} options={['singular', 'plural']} labels={{ singular: 'Singular', plural: 'Plural' }} onChange={(n) => setNumber(n as 'singular' | 'plural')} />
        <Seg value={caseKey} options={['acc', 'gen', 'dat', 'loc', 'ins', 'mix']} labels={{ acc: 'Vidím…', gen: 'bez…', dat: 'k…', loc: 'o…', ins: 's…', mix: 'Mix' }} onChange={(c) => setCaseKey(c as CaseKey | 'mix')} />
        <HelpBoard title="Endings board: how each case works">
          <CaseBoard plural={plural} only={caseKey === 'mix' ? null : caseKey} />
        </HelpBoard>
        <ModePicker mode={mode} setMode={setMode} />
      </div>
    </>
  )
}

const CASE_USE: Record<CaseKey, string> = {
  nom: 'subject; after "to je / to jsou"',
  acc: 'direct object (vidím, mám, chci); na / pro / za + time or direction (na poštu, pro tebe)',
  gen: 'bez, do, z, u, od, vedle, kromě; quantities (hodně, 5+); "of" (kniha mého bratra)',
  dat: 'k / ke, proti, díky; "to / for someone" (dám to bratrovi, je mi zima)',
  loc: 'only after prepositions: v / ve, na (where?), o (about), po (after)',
  ins: 's / se (with), před, za, nad, pod, mezi (where?); jet autem, být učitelem',
}

export function CaseBoard({ plural, only }: { plural: boolean; only: CaseKey | null }) {
  const list = plural ? P.pluralCases : P.cases
  const keys = CASES.map((c) => c.key).filter((k) => !only || k === only || k === 'nom')
  return <>
    <div className="scroll-x"><table className="md">
      <thead><tr><th>Case</th><th>Question / frame</th><th>Used for</th><th>Endings</th></tr></thead>
      <tbody>{CASES.filter((c) => keys.includes(c.key)).map((c) => <tr key={c.key}>
        <td><b>{c.name}</b></td><td lang="cs">{c.frame}</td><td className="small">{CASE_USE[c.key]}</td><td className="small">{(plural ? PLURAL_RULE[c.key] : c.rule).replace(/^[^:]+:\s*/, '')}</td></tr>)}</tbody>
    </table></div>
    <div className="scroll-x"><table className="md">
      <thead><tr>{keys.map((k) => <th key={k}>{CASES.find((c) => c.key === k)!.frame}</th>)}<th>English</th></tr></thead>
      <tbody>{list.map((c) => <tr key={c.nom}>{keys.map((k) => <td key={k} lang="cs">{c[k]}</td>)}<td className="muted small">{c.en} · {c.gender}</td></tr>)}</tbody>
    </table></div>
  </>
}

// ---------- sentence ladders
function LadderSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('build')
  const cats = [...new Set(P.ladders.map((l) => l.category ?? 'More'))]
  const [cat, setCat] = useState(cats[0])
  const inCat = P.ladders.map((l, i) => ({ l, i })).filter((x) => (x.l.category ?? 'More') === cat)
  const [ladder, setLadder] = useState(inCat[0].i)
  const l = P.ladders[ladder]
  const pickCat = (c: string) => { setCat(c); setLadder(P.ladders.findIndex((x) => (x.category ?? 'More') === c)) }
  return (
    <>
      <GameBar title="Sentences" onBack={onBack} onPlay={() => onStart(ladderQuestions(l), mode, `Sentences · ${l.title}`)} />
      <div className="card form">
        <div className="muted small">Category</div>
        <Stepper label="category" value={cat} options={cats.map((c) => ({ value: c, label: `${c} (${P.ladders.filter((x) => (x.category ?? 'More') === c).length})` }))} onChange={pickCat} />
        <div className="muted small">Ladder</div>
        <Stepper label="ladder" value={String(ladder)} options={inCat.map((x) => ({ value: String(x.i), label: `${x.l.title} (${x.l.steps.length})` }))} onChange={(v) => setLadder(+v)} />
        <HelpBoard title="Explain these sentences: what is used where">
          <ol className="explain">{l.steps.map((s) => <li key={s.cz}><b lang="cs">{s.cz}</b> <Say text={s.cz} /><div className="muted small">{s.en} · week {s.week}</div><div className="small">{s.grammar}</div></li>)}</ol>
        </HelpBoard>
        <ModePicker mode={mode} setMode={setMode} modes={['build', 'pick', 'type', 'speak']} />
      </div>
    </>
  )
}

// ---------- word groups, frequency, phrasebook, wordbook: all are lists of LexItems
/** Questions from cz/en items. "en-cz" = answer in Czech; "cz-en" = answer in English (any listed meaning counts). */
export function lexQuestions(items: LexItem[], dir: 'en-cz' | 'cz-en', pattern: string): Question[] {
  const en = (s: string) => s.split(/\s*[,;]\s*/).filter(Boolean).join(' / ')
  return items.map((it) => dir === 'en-cz'
    ? { id: `lex:${it.id}`, prompt: it.en, hint: it.note, target: it.cz, options: withOptions(it.cz, items.map((x) => x.cz)), rule: `${it.cz} = ${it.en}${it.note ? ` (${it.note})` : ''}`, tag: 'vocabulary' as const, pattern }
    : { id: `lex-en:${it.id}`, prompt: it.cz, hint: it.note, target: en(it.en), options: withOptions(en(it.en), items.map((x) => en(x.en))), rule: `${it.cz} = ${it.en}`, tag: 'vocabulary' as const, pattern })
}

function Direction({ dir, setDir }: { dir: string; setDir: (d: 'en-cz' | 'cz-en') => void }) {
  return <Seg value={dir} options={['en-cz', 'cz-en']} labels={{ 'en-cz': 'English → Czech', 'cz-en': 'Czech → English' }} onChange={(d) => setDir(d as 'en-cz' | 'cz-en')} />
}

function WordList({ items, rate }: { items: LexItem[]; rate: number }) {
  return <ul className="bank">{items.map((it) => <li key={it.id}><Say text={it.cz} rate={rate} /><b lang="cs">{it.cz}</b> <span className="muted">{it.en}</span>{it.note && <span className="muted small"> · {it.note}</span>}</li>)}</ul>
}

const Empty = ({ what, doc }: { what: string; doc: string }) => <p className="muted">No {what} yet: the content is being converted into Doc/{doc}.</p>

function WordSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('pick')
  const [dir, setDir] = useState<'en-cz' | 'cz-en'>('en-cz')
  const [cat, setCat] = useState(WORDGROUPS[0]?.category ?? '')
  const items = deckItems('words', cat)
  return (
    <>
      <GameBar title="Words" onBack={onBack} disabled={!items.length} onPlay={() => onStart(shuffle(lexQuestions(items, dir, `words-${cat}`)).slice(0, 15), mode, `Words · ${cat}`)} />
      <div className="card form">
        {!WORDGROUPS.length ? <Empty what="word groups" doc="czech-wordgroups.md" /> : <>
          <Stepper label="group" value={cat} options={WORDGROUPS.map((g) => ({ value: g.category, label: `${g.category} (${g.items.length})` }))} onChange={setCat} />
          <HelpBoard title={`Study the ${items.length} words`}><WordList items={items} rate={1} /></HelpBoard>
          <Direction dir={dir} setDir={setDir} />
          <ModePicker mode={mode} setMode={setMode} />
        </>}
      </div>
    </>
  )
}

const FREQ_TYPES: Record<string, (t: string) => boolean> = { all: () => true, nouns: (t) => t.startsWith('n'), verbs: (t) => t === 'v', adjectives: (t) => t === 'adj', other: (t) => !/^(n|v$|adj$)/.test(t) }

function FreqSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('pick')
  const [dir, setDir] = useState<'en-cz' | 'cz-en'>('en-cz')
  const [band, setBand] = useState('0')
  const [type, setType] = useState('all')
  const items = deckItems('freq', band).filter((_, i) => FREQ_TYPES[type](FREQUENCY[+band * FREQ_BAND + i]?.type ?? ''))
  const bands = Array.from({ length: Math.ceil(FREQUENCY.length / FREQ_BAND) }, (_, b) => ({ value: String(b), label: `Words ${b * FREQ_BAND + 1}–${Math.min(FREQUENCY.length, (b + 1) * FREQ_BAND)}` }))
  return (
    <>
      <GameBar title="Frequency dictionary" onBack={onBack} disabled={!items.length} onPlay={() => onStart(shuffle(lexQuestions(items, dir, `freq-${band}`)).slice(0, 15), mode, `Frequency · ${bands[+band]?.label}`)} />
      <div className="card form">
        {!FREQUENCY.length ? <Empty what="frequency list" doc="czech-frequency.md" /> : <>
          <Stepper label="range" value={band} options={bands} onChange={setBand} />
          <Seg value={type} options={Object.keys(FREQ_TYPES)} labels={{ all: 'All', nouns: 'Nouns', verbs: 'Verbs', adjectives: 'Adjectives', other: 'Other' }} onChange={setType} />
          <HelpBoard title={`Study these ${items.length} words`}><WordList items={items} rate={1} /></HelpBoard>
          <Direction dir={dir} setDir={setDir} />
          <ModePicker mode={mode} setMode={setMode} />
        </>}
      </div>
    </>
  )
}

function PhraseSetup({ onBack, onStart }: SetupProps) {
  const [mode, setMode] = useState<Mode>('type')
  const [dir, setDir] = useState<'en-cz' | 'cz-en'>('en-cz')
  const [cat, setCat] = useState(PHRASEBOOK[0]?.category ?? '')
  const [q, setQ] = useState('')
  const items = q.trim().length > 1
    ? PHRASEBOOK.flatMap((g) => deckItems('phrases', g.category)).filter((it) => (it.cz + ' ' + it.en).toLowerCase().includes(q.toLowerCase()))
    : deckItems('phrases', cat)
  return (
    <>
      <GameBar title="Phrasebook" onBack={onBack} disabled={!items.length} onPlay={() => onStart(shuffle(lexQuestions(items, dir, `phrases-${cat}`)).slice(0, 12), mode, `Phrasebook · ${q || cat}`)} />
      <div className="card form">
        {!PHRASEBOOK.length ? <Empty what="phrases" doc="parts/phrasebook-*.md" /> : <>
          <Stepper label="place" value={cat} options={PHRASEBOOK.map((g) => ({ value: g.category, label: `${g.category} (${g.items.length})` }))} onChange={(c) => { setCat(c); setQ('') }} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all phrases (English or Czech)…" aria-label="Search phrases" />
          <Direction dir={dir} setDir={setDir} />
          <ModePicker mode={mode} setMode={setMode} modes={['type', 'pick', 'speak', 'build']} />
        </>}
      </div>
      {items.length > 0 && <div className="card"><WordList items={items} rate={1} /></div>}
    </>
  )
}

function Wordbook({ onBack, onStart }: SetupProps) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<Mode>('pick')
  const s = q.trim().toLowerCase()
  const items: LexItem[] = WORDBOOK.filter((w) => !s || w.en.toLowerCase().includes(s) || w.cz.toLowerCase().includes(s)).map((w) => ({ id: `wb:${w.cz}`, cz: w.cz, en: w.en, note: w.type }))
  return (
    <>
      <GameBar title="Wordbook" onBack={onBack} disabled={!items.length} onPlay={() => onStart(shuffle(lexQuestions(items, 'en-cz', 'wordbook')).slice(0, 15), mode, `Wordbook${s ? ` · ${s}` : ''}`)} />
      <div className="card form">
        {!WORDBOOK.length ? <Empty what="wordbook" doc="czech-wordbook.md" /> : <>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${WORDBOOK.length} words…`} aria-label="Search the wordbook" />
          <ModePicker mode={mode} setMode={setMode} />
        </>}
      </div>
      {items.length > 0 && <div className="card"><WordList items={items.slice(0, 300)} rate={1} />{items.length > 300 && <p className="muted small">Showing 300 of {items.length}: search to narrow.</p>}</div>}
    </>
  )
}

// ---------- the question runner (all four answer modes)
export function Runner({ qs, mode, title, rate, onExit }: { qs: Question[]; mode: Mode; title: string; rate: number; onExit: () => void }) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [picked, setPicked] = useState<string[]>([]) // build mode: tiles chosen so far
  const [v, setV] = useState<Verdict | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState(0)
  const [err, setErr] = useState('')
  const [explain, setExplain] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const q = qs[i]
  const [pool, setPool] = useState(() => (q ? tiles(q.target) : []))
  useEffect(() => { input.current?.focus() }, [i])

  if (!q) return (
    <div className="card"><h1>{score} / {qs.length}</h1><p>{title}</p><p className="muted">Mistakes went to your error log and the Repair drills.</p>
      <button className="primary" onClick={onExit}>Done</button></div>
  )
  const czechAnswer = !q.id.startsWith('lex-en:')

  async function submit(response: string) {
    if (!response.trim() || v) return
    const verdict = check(response, q.target, q.tag === 'case' || q.tag === 'verb form' || q.tag === 'tense' ? 'conjugation' : q.id.startsWith('ladder') || q.target.includes(' ') ? 'sentence' : 'vocab')
    if (!verdict.correct && q.tag !== 'vocabulary' && verdict.tag !== 'spelling') verdict.tag = q.tag
    cue(verdict.correct)
    await db.attempts.add({ itemId: q.id, kind: 'drill', response, correct: verdict.correct, tag: verdict.tag, ts: Date.now() })
    if (!verdict.correct) await logError(verdict.tag!, q.pattern)
    else setScore((s) => s + 1)
    setAnswer(response); setV(verdict)
    if (audioAfter()) tts.speak(czechAnswer ? first(q.target) : q.prompt, rate)
  }
  function next() {
    setV(null); setAnswer(''); setPicked([]); setHeard(null); setErr(''); setExplain(false)
    if (qs[i + 1]) setPool(tiles(qs[i + 1].target))
    setI(i + 1)
  }
  async function speak() {
    setBusy(true); setErr('')
    try { const t = await stt.listen(); setHeard(t); if (t) await submit(t); else setErr('Nothing heard: try again a bit louder.') }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="card">
      <div className="row between"><span className="muted">{title} · {i + 1} / {qs.length}</span>
        <span><button className={'help small-help' + (explain ? ' on' : '')} aria-label="Explain" aria-expanded={explain} onClick={() => setExplain(!explain)}>?</button>
          <button className="link" aria-label="Close" onClick={onExit}>✕</button></span></div>
      <h2 className="prompt" lang={q.id.startsWith('verb') || q.id.startsWith('case') || q.id.startsWith('lex-en') ? 'cs' : undefined}>{q.prompt}</h2>
      {q.hint && <div className="muted small">{q.hint}</div>}
      {explain && <div className="board small">{q.rule}</div>}

      {mode === 'pick' && <div className="options">{q.options.map((o) => (
        <button key={o} lang={czechAnswer ? 'cs' : undefined} disabled={!!v} className={v ? (o === first(q.target) ? 'right' : o === answer ? 'wrong' : '') : ''} onClick={() => submit(o)}>{o}</button>
      ))}</div>}

      {mode === 'type' && <>
        <form onSubmit={(e) => { e.preventDefault(); if (v) next(); else submit(answer) }}>
          <input ref={input} lang={czechAnswer ? 'cs' : 'en'} autoComplete="off" autoCapitalize="off" spellCheck={false} value={answer} readOnly={!!v} onChange={(e) => setAnswer(e.target.value)} placeholder={czechAnswer ? 'Type in Czech…' : 'Type in English…'} aria-label="Your answer" />
          {!v && <button className="primary" type="submit">Check</button>}
        </form>
        {!v && czechAnswer && <CzechKeys input={input} value={answer} onChange={setAnswer} />}
      </>}

      {mode === 'speak' && !v && <div className="row">
        <button className="primary" disabled={busy} onClick={speak}>{busy ? '🎙 Listening…' : '🎙 Say it'}</button>
        {err && <span className="bad small">{err}</span>}
      </div>}
      {mode === 'speak' && heard && <p className="small">Heard: “{heard}”</p>}

      {mode === 'build' && <>
        <p className="built" lang="cs" aria-live="polite">{picked.length ? picked.map((k) => pool[+k]).join(' ') : <span className="muted">Tap the words in order…</span>}</p>
        {!v && <div className="options tiles">{pool.map((w, k) => (
          <button key={k} lang="cs" disabled={picked.includes(String(k))} onClick={() => {
            const p = [...picked, String(k)]; setPicked(p)
            if (p.length === pool.length) submit(p.map((x) => pool[+x]).join(' '))
          }}>{w}</button>
        ))}</div>}
        {!v && picked.length > 0 && <button className="link" onClick={() => setPicked(picked.slice(0, -1))}>↶ Undo</button>}
      </>}

      {v && <div className={v.correct ? 'ok' : 'bad'} role="status">
        {v.correct ? <strong>✓ Correct</strong> : <><strong>✗ {v.tag}</strong><p>{q.rule}</p>{v.tag === 'word order' ? <p lang="cs" className="small">You said: <s>{answer}</s></p> : <Diff parts={v.diff} />}</>}
        <p lang={czechAnswer ? 'cs' : undefined}><button className="link" onClick={() => tts.speak(czechAnswer ? first(q.target) : q.prompt, rate)}>▶</button> <b>{q.target}</b></p>
      </div>}
      {v && <button className="primary wide" onClick={next}>Next</button>}
    </div>
  )
}
