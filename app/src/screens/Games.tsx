import { useEffect, useRef, useState } from 'react'
import practiceData from '../data/practice.json'
import { check, type Verdict } from '../lib/check'
import { WEEKS, weekItems, typeable } from '../lib/content'
import { db, logError, type Profile } from '../lib/db'
import { CASES, caseQuestion, first, ladderQuestions, shuffle, tiles, verbQuestions, wordQuestions, type CaseKey, type Practice, type Question, type Tense } from '../lib/games'
import { stt } from '../lib/stt'
import { tts } from '../lib/tts'
import { CzechKeys } from '../components/CzechKeys'
import { Diff } from '../components/Diff'

const P = practiceData as Practice
type Game = 'verbs' | 'words' | 'cases' | 'ladders'
type Mode = 'pick' | 'type' | 'speak' | 'build'

const GAMES: { id: Game; title: string; text: string }[] = [
  { id: 'verbs', title: 'Verbs', text: 'One verb, all persons: já, ty, on, my, vy, oni. Present, past and future. Most common verbs first.' },
  { id: 'words', title: 'Words', text: 'The vocabulary of any week, in curriculum order.' },
  { id: 'cases', title: 'Cases', text: 'Adjective + noun in all six cases: Vidím…, bez…, k…, o…, s… Singular or plural.' },
  { id: 'ladders', title: 'Sentences', text: 'Ladders from simple to complex: To je míč → To je jeho malý modrý míč → …' },
]

export function Games({ profile }: { profile: Profile }) {
  const [game, setGame] = useState<Game | null>(null)
  const [round, setRound] = useState<{ qs: Question[]; mode: Mode; title: string } | null>(null)
  if (round) return <Runner key={round.title + round.qs[0]?.id} {...round} rate={profile.ttsRate} onExit={() => setRound(null)} />
  if (!game) return (
    <>
      <h1>Games</h1>
      <p className="muted">Content written by Claude: check it in Doc/czech-practice.md.</p>
      <div className="game-grid">
        {GAMES.map((g) => <button key={g.id} className="card game" onClick={() => setGame(g.id)}><b>{g.title}</b><span className="muted small">{g.text}</span></button>)}
      </div>
    </>
  )
  return <Setup game={game} profile={profile} onBack={() => setGame(null)} onStart={(qs, mode, title) => setRound({ qs, mode, title })} />
}

function Setup({ game, profile, onBack, onStart }: { game: Game; profile: Profile; onBack: () => void; onStart: (qs: Question[], mode: Mode, title: string) => void }) {
  const [mode, setMode] = useState<Mode>(game === 'ladders' ? 'build' : 'pick')
  const [verb, setVerb] = useState(P.verbs[0].verb)
  const [tense, setTense] = useState<Tense>('present')
  const [week, setWeek] = useState(Math.min(profile.currentWeek, 21))
  const [caseKey, setCaseKey] = useState<CaseKey | 'mix'>('acc')
  const [number, setNumber] = useState<'singular' | 'plural'>('singular')
  const [ladder, setLadder] = useState(0)
  const modes: Mode[] = game === 'ladders' ? ['build', 'pick', 'type', 'speak'] : ['pick', 'type', 'speak']

  function start() {
    if (game === 'verbs') {
      const v = verb === 'top10' || verb === 'top20' ? null : P.verbs.find((x) => x.verb === verb)!
      const qs = v ? verbQuestions(v, tense) : shuffle(P.verbs.slice(0, verb === 'top10' ? 10 : 20).flatMap((x) => verbQuestions(x, tense))).slice(0, 12)
      onStart(qs, mode, `Verbs · ${v?.verb ?? verb} · ${tense}`)
    } else if (game === 'words') {
      const items = weekItems(WEEKS[week - 1]).filter((i) => i.kind !== 'sentence' && typeable(i))
      onStart(shuffle(wordQuestions(items)).slice(0, 12), mode, `Words · week ${week}`)
    } else if (game === 'cases') {
      const plural = number === 'plural'
      const qs = (plural ? P.pluralCases : P.cases).map((c) => caseQuestion(c, caseKey === 'mix' ? CASES[1 + Math.floor(Math.random() * 5)].key : caseKey, plural))
      onStart(shuffle(qs).slice(0, 12), mode, `Cases · ${plural ? 'plural · ' : ''}${caseKey}`)
    } else onStart(ladderQuestions(P.ladders[ladder]), mode, `Sentences · ${P.ladders[ladder].title}`)
  }
  const perfectiveFuture = game === 'verbs' && tense === 'future' && P.verbs.find((x) => x.verb === verb)?.future === '-'

  return (
    <div className="card form">
      <h1>{GAMES.find((g) => g.id === game)!.title}</h1>
      {game === 'verbs' && <>
        <label>Verb (most common first)
          <select value={verb} onChange={(e) => setVerb(e.target.value)}>
            <option value="top10">Mix: top 10 verbs</option><option value="top20">Mix: top 20 verbs</option>
            {P.verbs.map((v, i) => <option key={v.verb} value={v.verb}>{i + 1}. {v.verb} — {v.en} (week {v.week})</option>)}
          </select></label>
        <Seg value={tense} options={['present', 'past', 'future']} onChange={(t) => setTense(t as Tense)} />
        {perfectiveFuture && <p className="muted small">This verb is perfective: its present forms already mean the future (dám = I will give).</p>}
      </>}
      {game === 'words' && <label>Week
        <select value={week} onChange={(e) => setWeek(+e.target.value)}>
          {WEEKS.filter((w) => w.vocabA.length).map((w) => <option key={w.week} value={w.week}>Week {w.week}: {w.title}</option>)}
        </select></label>}
      {game === 'cases' && <Seg value={number} options={['singular', 'plural']} labels={{ singular: 'Singular', plural: 'Plural' }} onChange={(n) => setNumber(n as 'singular' | 'plural')} />}
      {game === 'cases' && <Seg value={caseKey} options={['acc', 'gen', 'dat', 'loc', 'ins', 'mix']} labels={{ acc: 'Vidím…', gen: 'bez…', dat: 'k…', loc: 'o…', ins: 's…', mix: 'Mix' }} onChange={(c) => setCaseKey(c as CaseKey | 'mix')} />}
      {game === 'ladders' && <label>Ladder
        <select value={ladder} onChange={(e) => setLadder(+e.target.value)}>
          {P.ladders.map((l, i) => <option key={l.title} value={i}>{l.title} ({l.steps.length} steps)</option>)}
        </select></label>}
      <div className="muted small">How to answer</div>
      <Seg value={mode} options={modes} labels={{ pick: 'Pick', type: 'Type', speak: 'Speak', build: 'Build' }} onChange={(m) => setMode(m as Mode)} />
      {mode === 'speak' && !stt.supported() && <p className="bad">This browser has no speech recognition. Try Chrome or Edge, or your phone.</p>}
      <div className="row between"><button onClick={onBack}>← Games</button><button className="primary" disabled={perfectiveFuture} onClick={start}>Play</button></div>
    </div>
  )
}

function Seg({ value, options, labels, onChange }: { value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return <div className="tabs" role="radiogroup">{options.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{labels?.[o] ?? o}</button>)}</div>
}

export function Runner({ qs, mode, title, rate, onExit }: { qs: Question[]; mode: Mode; title: string; rate: number; onExit: () => void }) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [picked, setPicked] = useState<string[]>([]) // build mode: tiles chosen so far
  const [v, setV] = useState<Verdict | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState(0)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const q = qs[i]
  const [pool, setPool] = useState(() => (q ? tiles(q.target) : []))
  useEffect(() => { input.current?.focus() }, [i])

  if (!q) return (
    <div className="card"><h1>{score} / {qs.length}</h1><p>{title}</p><p className="muted">Mistakes went to your error log and the Repair drills.</p>
      <button className="primary" onClick={onExit}>Done</button></div>
  )

  async function submit(response: string) {
    if (!response.trim() || v) return
    const verdict = check(response, q.target, q.tag === 'case' || q.tag === 'verb form' || q.tag === 'tense' ? 'conjugation' : q.id.startsWith('ladder') ? 'sentence' : 'vocab')
    if (!verdict.correct && q.tag !== 'vocabulary' && verdict.tag !== 'spelling') verdict.tag = q.tag
    await db.attempts.add({ itemId: q.id, kind: 'drill', response, correct: verdict.correct, tag: verdict.tag, ts: Date.now() })
    if (!verdict.correct) await logError(verdict.tag!, q.pattern)
    else setScore((s) => s + 1)
    setAnswer(response); setV(verdict)
    tts.speak(first(q.target), rate)
  }
  function next() {
    setV(null); setAnswer(''); setPicked([]); setHeard(null); setErr('')
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
      <div className="row between"><span className="muted">{title} · {i + 1} / {qs.length}</span><button className="link" onClick={onExit}>✕</button></div>
      <h2 className="prompt" lang={q.id.startsWith('verb') || q.id.startsWith('case') ? 'cs' : undefined}>{q.prompt}</h2>
      {q.hint && <div className="muted small">{q.hint}</div>}

      {mode === 'pick' && <div className="options">{q.options.map((o) => (
        <button key={o} lang="cs" disabled={!!v} className={v ? (o === first(q.target) ? 'right' : o === answer ? 'wrong' : '') : ''} onClick={() => submit(o)}>{o}</button>
      ))}</div>}

      {mode === 'type' && <>
        <form onSubmit={(e) => { e.preventDefault(); if (v) next(); else submit(answer) }}>
          <input ref={input} lang="cs" autoComplete="off" spellCheck={false} value={answer} readOnly={!!v} onChange={(e) => setAnswer(e.target.value)} placeholder="Type in Czech…" aria-label="Your answer" />
          {!v && <button className="primary" type="submit">Check</button>}
        </form>
        {!v && <CzechKeys input={input} value={answer} onChange={setAnswer} />}
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
        <p lang="cs"><button className="link" onClick={() => tts.speak(first(q.target), rate)}>▶</button> <b>{q.target}</b></p>
      </div>}
      {v && <button className="primary wide" onClick={next}>Next</button>}
    </div>
  )
}
