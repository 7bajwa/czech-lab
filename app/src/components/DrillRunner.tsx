import { useEffect, useRef, useState } from 'react'
import { check, RULE_FOR_TAG, type Verdict } from '../lib/check'
import { db, logError } from '../lib/db'
import type { Drill } from '../lib/drills'
import { boost } from '../lib/srs'
import { tts } from '../lib/tts'
import { audioAfter, cue } from '../lib/feedback'
import { CzechKeys } from './CzechKeys'
import { Diff } from './Diff'

export type Result = { drill: Drill; response: string; verdict: Verdict }

/** One item at a time, answer before reveal. In test mode feedback waits until the end. */
export function DrillRunner({ drills, mode, rate, onDone }: { drills: Drill[]; mode: 'drill' | 'test'; rate: number; onDone: (r: Result[]) => void }) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const input = useRef<HTMLInputElement>(null)
  const d = drills[i]

  useEffect(() => {
    input.current?.focus()
    if (d?.type === 'listen') tts.speak(d.target, rate * 0.75)
  }, [d, rate])

  if (!d) return <p>No items yet for this week.</p>

  async function submit() {
    if (!answer.trim()) return
    const v = check(answer, d.target, d.check)
    await db.attempts.add({ itemId: d.itemId, kind: mode, response: answer, correct: v.correct, tag: v.tag, ts: Date.now() })
    if (!v.correct) {
      await logError(v.tag!, d.pattern)
      if (d.item) await boost(d.item)
    }
    if (mode !== 'test') { cue(v.correct); if (audioAfter()) tts.speak(v.expected, rate) }
    const next = [...results, { drill: d, response: answer, verdict: v }]
    setResults(next)
    if (mode === 'test') advance(next)
    else setVerdict(v)
  }

  function advance(rs = results) {
    setVerdict(null); setAnswer('')
    if (i + 1 >= drills.length) onDone(rs)
    else setI(i + 1)
  }

  return (
    <div className="card">
      <div className="muted">{i + 1} / {drills.length} · {d.type === 'translate' ? 'Translate into Czech' : d.type === 'listen' ? 'Dictation' : 'Fill the verb form'}</div>
      <h2 className="prompt">{d.prompt}</h2>
      {d.type === 'listen' && (
        <div className="row">
          <button onClick={() => tts.speak(d.target, rate * 0.75)}>▶ 0.75×</button>
          <button onClick={() => tts.speak(d.target, rate)}>▶ 1×</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (verdict) advance(); else submit() }}>
        <input ref={input} lang="cs" autoComplete="off" autoCapitalize="off" spellCheck={false} value={answer} readOnly={!!verdict}
          onChange={(e) => setAnswer(e.target.value)} placeholder="Type in Czech…" aria-label="Your answer" />
        <button className="primary" type="submit">{verdict ? 'Next' : 'Check'}</button>
      </form>
      {!verdict && <CzechKeys input={input} value={answer} onChange={setAnswer} />}
      {verdict && <Feedback r={{ drill: d, response: answer, verdict }} rate={rate} />}
    </div>
  )
}

export function Feedback({ r, rate }: { r: Result; rate: number }) {
  const { verdict: v, drill: d } = r
  const [reported, setReported] = useState(false)
  return (
    <div className={v.correct ? 'ok' : 'bad'} role="status">
      {v.correct ? <strong>✓ Correct</strong> : <>
        <strong>✗ {v.tag}</strong>
        <p>{d.rule ? <span dangerouslySetInnerHTML={{ __html: inlineMd(d.rule) }} /> : RULE_FOR_TAG[v.tag!]}</p>
        <Diff parts={v.diff} />
      </>}
      <p lang="cs"><button className="link" onClick={() => tts.speak(v.expected, rate)}>▶</button> <b>{v.expected}</b>{d.item?.en && d.type !== 'translate' ? ` — ${d.item.en}` : ''}</p>
      <button className="link small" disabled={reported} onClick={async () => {
        const note = prompt('What is wrong with this item?') ?? ''
        if (!note) return
        await db.reports.add({ itemId: d.itemId, note, ts: Date.now() }); setReported(true)
      }}>{reported ? 'Reported — thanks' : 'Report an error'}</button>
    </div>
  )
}

/** Curriculum markdown: **bold** = the rule, *italic* = a Czech example. Text is ours (curriculum), escaped first. */
export const inlineMd = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em lang="cs">$1</em>')
