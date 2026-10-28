import { useEffect, useRef, useState } from 'react'
import { State, type Grade } from 'ts-fsrs'
import { check, RULE_FOR_TAG, type Verdict } from '../lib/check'
import { db, logError, type CardRow, type Profile } from '../lib/db'
import { dueQueue, grade, Rating } from '../lib/srs'
import { tts } from '../lib/tts'
import { audioAfter, cue } from '../lib/feedback'
import { CzechKeys } from '../components/CzechKeys'
import { Diff } from '../components/Diff'

/** FSRS review: answer first (type), then the diff, then grade. */
export function Review({ profile, onDone }: { profile: Profile; onDone?: () => void }) {
  const [queue, setQueue] = useState<CardRow[] | null>(null)
  const [answer, setAnswer] = useState('')
  const [v, setV] = useState<Verdict | null>(null)
  const [done, setDone] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const c = queue?.[0]

  useEffect(() => { dueQueue(profile.newPerDay).then(setQueue) }, [profile.newPerDay])
  useEffect(() => {
    input.current?.focus()
    if (c?.mode === 'listen') tts.speak(c.cz, profile.ttsRate * 0.75)
  }, [c, profile.ttsRate])

  if (!queue) return null
  if (!c) return (
    <div className="card"><h2>Review done ✓</h2><p>{done} cards reviewed. No more cards due.</p>{onDone && <button className="primary" onClick={onDone}>Back to today</button>}</div>
  )

  async function submit() {
    if (!answer.trim() || !c) return
    const verdict = check(answer, c.cz, c.cz.includes(' ') ? 'sentence' : 'vocab')
    await db.attempts.add({ itemId: c.id, kind: 'review', response: answer, correct: verdict.correct, tag: verdict.tag, wasNew: c.fsrs.state === State.New, ts: Date.now() })
    if (!verdict.correct) await logError(verdict.tag!, c.pattern)
    setV(verdict); cue(verdict.correct)
    if (audioAfter()) tts.speak(c.cz, profile.ttsRate)
  }
  async function rate(r: Grade) {
    await grade(c!, r)
    setV(null); setAnswer(''); setDone(done + 1)
    // Again: card is due again within minutes, keep it at the back of this session
    setQueue(r === Rating.Again ? [...queue!.slice(1), { ...c!, fsrs: { ...c!.fsrs, state: State.Learning } }] : queue!.slice(1))
  }
  const suggested = v ? (v.correct ? Rating.Good : Rating.Again) : null

  return (
    <div className="card">
      <div className="muted">Review · {queue.length} left · week {c.week}</div>
      <h2 className="prompt">{c.mode === 'type' ? c.en : 'Listen and type'}</h2>
      {c.mode === 'listen' && <div className="row"><button onClick={() => tts.speak(c.cz, profile.ttsRate * 0.75)}>▶ 0.75×</button><button onClick={() => tts.speak(c.cz, profile.ttsRate)}>▶ 1×</button></div>}
      <form onSubmit={(e) => { e.preventDefault(); if (!v) submit(); else rate(suggested!) }}>
        <input ref={input} lang="cs" autoComplete="off" spellCheck={false} value={answer} readOnly={!!v} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer in Czech first…" aria-label="Your answer" />
        {!v && <button className="primary" type="submit">Reveal</button>}
      </form>
      {!v && <CzechKeys input={input} value={answer} onChange={setAnswer} />}
      {v && <>
        <div className={v.correct ? 'ok' : 'bad'} role="status">
          {v.correct ? <strong>✓</strong> : <><strong>✗ {v.tag}</strong><p>{RULE_FOR_TAG[v.tag!]}</p><Diff parts={v.diff} /></>}
          <p lang="cs"><button className="link" onClick={() => tts.speak(c.cz, profile.ttsRate)}>▶</button> <b>{c.cz}</b>{c.en && c.mode === 'listen' ? ` — ${c.en}` : ''}</p>
        </div>
        <div className="grades">
          {([['Again', Rating.Again], ['Hard', Rating.Hard], ['Good', Rating.Good], ['Easy', Rating.Easy]] as const).map(([label, r]) => (
            <button key={label} className={r === suggested ? 'primary' : ''} onClick={() => rate(r)}>{label}</button>
          ))}
        </div>
      </>}
    </div>
  )
}
