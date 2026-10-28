import { useEffect, useRef, useState } from 'react'
import examData from '../data/exam.json'
import { check } from '../lib/check'
import { db, type ExamResult } from '../lib/db'
import { md } from '../lib/md'
import { canRecord, playUrl, startRecording, stopRecording } from '../lib/recorder'
import { tts } from '../lib/tts'
import { Toggle } from '../components/GameBar'
import { useProfile } from '../components/ProfileContext'

type Item = { num: string; text: string; question: string; opts: { key: string; text: string }[]; answer: string }
type Task = { n: number; type: 'choice' | 'match' | 'yesno' | 'gap' | 'write' | 'speak'; points: number; instruction: string; text: string[]; options: { key: string; text: string }[]; items: Item[]; checklist: { points: number; text: string }[] }
type Part = { name: 'Reading' | 'Listening' | 'Writing' | 'Speaking'; minutes: number; tasks: Task[] }
type Mock = { title: string; parts: Part[] }
const EXAM = examData as { format: string; mocks: Mock[] }
const CZ: Record<Part['name'], string> = { Reading: 'Čtení', Listening: 'Poslech', Writing: 'Psaní', Speaking: 'Mluvení' }
const MAX: Record<Part['name'], number> = { Reading: 25, Listening: 25, Writing: 20, Speaking: 40 }

/** Mock exams in the official A2 (permanent residence) layout: timed parts, tasks you can move between, scoring at the end of each part. */
export function Exam() {
  const [run, setRun] = useState<{ mock: Mock; parts: Part[] } | null>(null)
  const [results, setResults] = useState<ExamResult[]>([])
  const [showFormat, setShowFormat] = useState(false)
  useEffect(() => { db.examResults.orderBy('ts').reverse().toArray().then(setResults) }, [run])
  if (run) return <ExamRun mock={run.mock} parts={run.parts} onExit={() => setRun(null)} />
  if (!EXAM.mocks.length) return <><h1>Exam</h1><p className="muted">No mock exams yet (Doc/czech-exam.md).</p></>
  return (
    <>
      <h1>Exam simulator</h1>
      <p className="muted small">A2 for permanent residence. Pass: 42 / 70 in the written part (reading + listening + writing) and 24 / 40 in speaking. Your target: 80% reading and listening, 70% writing, 75% speaking. You can stop at any time and start again later. Unofficial mocks written by Claude in the official style: check Doc/czech-exam.md.</p>
      <button className="link" onClick={() => setShowFormat(!showFormat)}>{showFormat ? 'Hide' : 'How the real exam works'}</button>
      {showFormat && <div className="card md-body" dangerouslySetInnerHTML={{ __html: md(EXAM.format) }} />}
      {EXAM.mocks.map((m) => {
        const mine = results.filter((r) => r.mock === m.title)
        return (
          <div className="card" key={m.title}>
            <h2>{m.title}</h2>
            <button className="primary wide" onClick={() => setRun({ mock: m, parts: m.parts })}>Full exam ({m.parts.reduce((a, p) => a + p.minutes, 0)} min)</button>
            <div className="row">{m.parts.map((p) => <button key={p.name} onClick={() => setRun({ mock: m, parts: [p] })}>{CZ[p.name]} · {p.minutes} min</button>)}</div>
            {mine.length > 0 && <p className="muted small">Last scores: {m.parts.map((p) => { const r = mine.find((x) => x.part === p.name); return r ? `${p.name} ${r.score}/${r.max}` : null }).filter(Boolean).join(' · ')}</p>}
          </div>
        )
      })}
    </>
  )
}

function ExamRun({ mock, parts, onExit }: { mock: Mock; parts: Part[]; onExit: () => void }) {
  const [pi, setPi] = useState(0)
  const [scores, setScores] = useState<Record<string, number>>({})
  const part = parts[pi]
  if (!part) {
    const written = ['Reading', 'Listening', 'Writing'].reduce((a, k) => a + (scores[k] ?? 0), 0)
    const allWritten = ['Reading', 'Listening', 'Writing'].every((k) => k in scores)
    return (
      <div className="card">
        <h1>{mock.title}: results</h1>
        <ul>{Object.entries(scores).map(([k, v]) => <li key={k}>{k}: <b>{v}</b> / {MAX[k as Part['name']]} ({Math.round((v / MAX[k as Part['name']]) * 100)}%)</li>)}</ul>
        {allWritten && <p className={written >= 42 ? 'ok' : 'bad'}>Written part: {written} / 70 {written >= 42 ? '— pass' : '— below the pass mark (42)'}</p>}
        {'Speaking' in scores && <p className={scores.Speaking >= 24 ? 'ok' : 'bad'}>Speaking: {scores.Speaking} / 40 {scores.Speaking >= 24 ? '— pass' : '— below the pass mark (24)'}</p>}
        <button className="primary" onClick={onExit}>Done</button>
      </div>
    )
  }
  return <PartRun key={pi} mock={mock} part={part} last={pi === parts.length - 1} onExit={onExit}
    onDone={async (score) => { await db.examResults.add({ mock: mock.title, part: part.name, score, max: MAX[part.name], ts: Date.now() }); setScores((s) => ({ ...s, [part.name]: score })); setPi(pi + 1) }} />
}

const round1 = (x: number) => Math.round(x * 10) / 10
const correctItem = (t: Task, it: Item, a: string | undefined) => !!a && (t.type === 'gap' ? check(a, it.answer, 'vocab').correct : a.trim().toUpperCase() === it.answer.trim().toUpperCase())
const speakable = (line: string) => line.replace(/^[^:]{1,25}:\s*/, '') // "Muž: Dobrý den" → "Dobrý den"
/** "Žena: … Muž: …" on one line → one line per speaker, so the labels are never read aloud. */
const bySpeaker = (line: string) => line.split(/\s(?=\p{Lu}[\p{Ll}]{1,14}( \d)?: )/u).filter((x) => x && !/^ \d$/.test(x))

function PartRun({ mock, part, last, onExit, onDone }: { mock: Mock; part: Part; last: boolean; onExit: () => void; onDone: (score: number) => void }) {
  const { profile } = useProfile()
  const [ti, setTi] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [ended, setEnded] = useState(false)
  const [end] = useState(() => Date.now() + part.minutes * 60e3)
  const [, tick] = useState(0)
  const [practice, setPractice] = useState(false)
  const plays = useRef<Record<string, number>>({})
  useEffect(() => { if (ended) return; const t = setInterval(() => { tick((n) => n + 1); if (Date.now() >= end) setEnded(true) }, 1000); return () => clearInterval(t) }, [ended, end])
  const left = Math.max(0, Math.round((end - Date.now()) / 1000))
  const task = part.tasks[ti]
  const set = (k: string, v: string) => !ended && setAnswers((a) => ({ ...a, [k]: v }))
  const listening = part.name === 'Listening'

  function play(key: string, lines: string[]) {
    const n = plays.current[key] ?? 0
    if (!practice && n >= 2) return
    plays.current[key] = n + 1; tick((x) => x + 1)
    ;(async () => { for (const l of lines.flatMap(bySpeaker)) await tts.speak(speakable(l), profile.ttsRate * 0.95) })()
  }
  const PlayBtn = ({ k, lines }: { k: string; lines: string[] }) => {
    const n = plays.current[k] ?? 0
    return <button className="primary" disabled={!practice && n >= 2} onClick={() => play(k, lines)}>▶ Play {practice ? '' : `(${2 - n} left)`}</button>
  }

  const objective = (t: Task) => !['write', 'speak'].includes(t.type)
  const taskScore = (t: Task) => objective(t)
    ? t.items.filter((it) => correctItem(t, it, answers[`${t.n}:${it.num}`])).length * (t.points / Math.max(1, t.items.length))
    : t.checklist.reduce((a, c, k) => a + (ticks[`${t.n}:${k}`] ? c.points : 0), 0)
  const total = round1(part.tasks.reduce((a, t) => a + taskScore(t), 0))

  return (
    <div className="exam">
      <div className="exam-head">
        <div><b>{mock.title} · {CZ[part.name]}</b> <span className="muted small">{part.name}</span></div>
        <span className={'clock' + (left < 300 && !ended ? ' low' : '')}>{ended ? 'Time over' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
        <button className="link" onClick={() => confirm('Stop this test? Answers in this part are not saved.') && onExit()}>✕</button>
      </div>
      <div className="tabs exam-tasks">{part.tasks.map((t, k) => <button key={t.n} className={k === ti ? 'on' : ''} onClick={() => setTi(k)}>Úloha {t.n}{ended && ` · ${round1(taskScore(t))}/${t.points}`}</button>)}</div>
      {listening && !ended && <Toggle label="Practice mode: unlimited replays (the real exam plays everything twice)" on={practice} set={setPractice} />}

      <div className="card">
        <div className="muted small">Úloha {task.n} · {task.points} {task.points === 1 ? 'bod' : task.points < 5 ? 'body' : 'bodů'}</div>
        <p className="instr">{task.instruction}</p>
        {task.text.length > 0 && (listening ? <>
          <PlayBtn k={`${task.n}`} lines={task.text} />
          {ended && <details><summary>Transcript</summary>{task.text.map((l, k) => <p key={k} lang="cs" className="small">{l}</p>)}</details>}
        </> : <div className="exam-text" lang="cs">{task.text.map((l, k) => task.type === 'speak' && /^Examiner:/i.test(l)
          ? <p key={k}><button className="link" onClick={() => tts.speak(speakable(l), profile.ttsRate)}>▶</button> {l}</p> : <p key={k}>{l}</p>)}</div>)}
        {task.options.length > 0 && <ul className="exam-opts">{task.options.map((o) => <li key={o.key} lang="cs"><b>{o.key}</b> {o.text}</li>)}</ul>}

        {objective(task) && task.items.map((it) => {
          const k = `${task.n}:${it.num}`, a = answers[k]
          const mark = ended ? (correctItem(task, it, a) ? ' right' : ' wrong') : ''
          return (
            <div key={k} className={'exam-item' + mark}>
              <div className="row"><b>{it.num}.</b>
                {it.text && (listening ? <PlayBtn k={k} lines={[it.text]} /> : <span lang="cs">{it.text}</span>)}
                {it.question && <span lang="cs">{it.question}</span>}</div>
              {ended && listening && it.text && <p className="muted small" lang="cs">{it.text}</p>}
              {task.type === 'choice' && <div className="options">{it.opts.map((o) => <button key={o.key} lang="cs" className={a === o.key ? 'sel' : ''} onClick={() => set(k, o.key)}><b>{o.key}</b> {o.text}</button>)}</div>}
              {task.type === 'yesno' && <div className="options">{['ANO', 'NE'].map((o) => <button key={o} className={a === o ? 'sel' : ''} onClick={() => set(k, o)}>{o}</button>)}</div>}
              {task.type === 'match' && <div className="row">{task.options.map((o) => <button key={o.key} className={'chip' + (a === o.key ? ' sel' : '')} onClick={() => set(k, o.key)}>{o.key}</button>)}</div>}
              {task.type === 'gap' && <input lang="cs" autoComplete="off" value={a ?? ''} readOnly={ended} onChange={(e) => set(k, e.target.value)} aria-label={`Answer ${it.num}`} />}
              {ended && !correctItem(task, it, a) && <p className="small">Correct: <b lang="cs">{it.answer}</b></p>}
            </div>
          )
        })}

        {task.type === 'write' && <>
          <textarea lang="cs" rows={8} value={answers[`${task.n}:w`] ?? ''} readOnly={ended} onChange={(e) => set(`${task.n}:w`, e.target.value)} placeholder="Pište česky…" />
          <p className="muted small">{(answers[`${task.n}:w`] ?? '').trim().split(/\s+/).filter(Boolean).length} words</p>
        </>}
        {task.type === 'speak' && !ended && <SpeakRecorder />}
        {(task.type === 'write' || task.type === 'speak') && ended && <div className="ok"><div className="muted small">Score yourself honestly (or let a friend score you):</div>
          {task.checklist.map((c, k) => <label key={k} className="check point"><input type="checkbox" checked={!!ticks[`${task.n}:${k}`]} onChange={(e) => setTicks((t) => ({ ...t, [`${task.n}:${k}`]: e.target.checked }))} /> <span>({c.points}) {c.text}</span></label>)}</div>}
      </div>

      <div className="row between">
        <button disabled={ti === 0} onClick={() => setTi(ti - 1)}>← Úloha {ti}</button>
        {ti < part.tasks.length - 1 ? <button onClick={() => setTi(ti + 1)}>Úloha {ti + 2} →</button>
          : !ended ? <button className="primary" onClick={() => confirm('Hand in this part?') && setEnded(true)}>Hand in</button> : null}
      </div>
      {ended && <div className="card"><h2>{CZ[part.name]}: {total} / {MAX[part.name]}</h2>
        {!objective(task) && <p className="muted small">Tick the checklist in each writing/speaking task first.</p>}
        <button className="primary wide" onClick={() => onDone(total)}>{last ? 'Finish' : 'Save and go to the next part →'}</button></div>}
    </div>
  )
}

function SpeakRecorder() {
  const [rec, setRec] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  if (!canRecord()) return <p className="muted small">Answer aloud. (Recording is not available in this browser.)</p>
  return <div className="row">
    {rec ? <button className="danger" onClick={async () => { setUrl(await stopRecording()); setRec(false) }}>■ Stop recording</button>
      : <button onClick={async () => { try { await startRecording(); setRec(true) } catch { alert('Microphone permission was denied.') } }}>⏺ Record my answer</button>}
    {url && !rec && <button onClick={() => playUrl(url)}>▶ Listen to me</button>}
  </div>
}
