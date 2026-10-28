import { useEffect, useRef, useState } from 'react'
import roleplayData from '../data/roleplay.json'
import { check, type Verdict } from '../lib/check'
import { WEEKS, weekItems } from '../lib/content'
import { db, logError } from '../lib/db'
import { cue } from '../lib/feedback'
import { first, shuffle } from '../lib/games'
import { P } from '../lib/extra'
import { PAIRS, TWISTERS } from '../lib/pron'
import { canRecord, playUrl, startRecording, stopRecording } from '../lib/recorder'
import { stt } from '../lib/stt'
import { tts } from '../lib/tts'
import { Diff } from '../components/Diff'
import { GameBar, Seg, Stepper, Toggle } from '../components/GameBar'
import { useProfile } from '../components/ProfileContext'

export type RolePlay = { title: string; place: string; a: string; b: string; week: number; lines: { who: 'A' | 'B'; cz: string; en: string }[] }
const ROLEPLAYS = roleplayData as RolePlay[]
type View = 'roleplay' | 'shadow' | 'pron'

export function Speak() {
  const [view, setView] = useState<View>('roleplay')
  return (
    <>
      <h1>Speak</h1>
      <Seg value={view} options={['roleplay', 'shadow', 'pron']} labels={{ roleplay: 'Role-play', shadow: 'Shadowing', pron: 'Pronunciation' }} onChange={(v) => setView(v as View)} />
      {!stt.supported() && <p className="muted small">No speech recognition in this browser (try Chrome or Edge, or your phone): you can still listen, record yourself and compare.</p>}
      {view === 'roleplay' && <RolePlays />}
      {view === 'shadow' && <Shadowing />}
      {view === 'pron' && <Pronunciation />}
    </>
  )
}

// ---------- mic helpers shared by the three parts
/** Say a line: speech recognition checks it against the target; also returns your words. */
function useSayCheck(target: string, pattern: string) {
  const [busy, setBusy] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [v, setV] = useState<Verdict | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setHeard(null); setV(null); setErr('') }, [target])
  async function listen() {
    setBusy(true); setErr('')
    try {
      const t = await stt.listen()
      setHeard(t)
      if (!t) { setErr('Nothing heard: try again a bit louder.'); return }
      const verdict = check(t, target, 'sentence')
      if (!verdict.correct && verdict.tag !== 'word order') verdict.tag = 'pronunciation'
      setV(verdict); cue(verdict.correct)
      await db.attempts.add({ itemId: `say:${first(target)}`, kind: 'drill', response: t, correct: verdict.correct, tag: verdict.tag, ts: Date.now() })
      if (!verdict.correct) await logError(verdict.tag!, pattern)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return { busy, heard, v, err, listen }
}

function SayResult({ heard, v, err }: { heard: string | null; v: Verdict | null; err: string }) {
  return <>
    {err && <p className="bad small">{err}</p>}
    {heard && v && <div className={v.correct ? 'ok' : 'bad'} role="status">
      {v.correct ? <strong>✓ Matches</strong> : <><strong>Heard: “{heard}”</strong><Diff parts={v.diff} /></>}
    </div>}
  </>
}

function RecordButtons() {
  const [state, setState] = useState<'idle' | 'rec'>('idle')
  const [url, setUrl] = useState<string | null>(null)
  if (!canRecord()) return null
  return <>
    {state === 'idle'
      ? <button onClick={async () => { try { await startRecording(); setState('rec') } catch { alert('Microphone permission was denied.') } }}>⏺ Record me</button>
      : <button className="danger" onClick={async () => { setUrl(await stopRecording()); setState('idle') }}>■ Stop</button>}
    {url && state === 'idle' && <button onClick={() => playUrl(url)}>▶ Me</button>}
  </>
}

// ---------- role-play
function RolePlays() {
  const [open, setOpen] = useState<RolePlay | null>(null)
  const { profile } = useProfile()
  if (open) return <RolePlayer rp={open} rate={profile.ttsRate} onBack={() => setOpen(null)} />
  if (!ROLEPLAYS.length) return <p className="muted">No role-plays yet (Doc/czech-roleplay.md).</p>
  return (
    <>
      <p className="muted small">With a friend: each reads one side, aloud or over a call. Alone: the app speaks the other person and listens to your lines. Written by Claude from your notes with Eliška: check Doc/czech-roleplay.md.</p>
      <div className="game-grid">
        {[...ROLEPLAYS].sort((a, b) => a.week - b.week).map((r) => (
          <button key={r.title} className="card game" onClick={() => setOpen(r)}><b>{r.title}</b>
            <span className="muted small">{r.place} · you: {r.a} · {r.lines.length} lines · week {r.week}</span></button>
        ))}
      </div>
    </>
  )
}

export function RolePlayer({ rp, rate, onBack }: { rp: RolePlay; rate: number; onBack: () => void }) {
  const [mode, setMode] = useState<'solo' | 'friend'>('solo')
  const [me, setMe] = useState<'A' | 'B'>('A')
  const [i, setI] = useState(0)
  const [showOther, setShowOther] = useState(true)
  const [showMine, setShowMine] = useState(false)
  const [hits, setHits] = useState(0)
  const line = rp.lines[i]
  const mine = line?.who === me
  const say = useSayCheck(line?.cz ?? '', `roleplay-${rp.title}`)
  const spoken = useRef(-1)

  // Solo: the app says the other person's line, then waits for yours
  useEffect(() => {
    if (mode !== 'solo' || !line || mine || spoken.current === i) return
    spoken.current = i
    tts.speak(line.cz, rate).then(() => setI((n) => (n === i ? n + 1 : n)))
  }, [mode, i, line, mine, rate])
  useEffect(() => { if (say.v?.correct) setHits((h) => h + 1) }, [say.v])
  const restart = () => { spoken.current = -1; setI(0); setHits(0) }

  return (
    <>
      <GameBar title={rp.title} onBack={onBack} backLabel="Role-plays" />
      <div className="card form">
        <p className="muted small">{rp.place} · A: {rp.a} · B: {rp.b} · week {rp.week}</p>
        <Seg value={mode} options={['solo', 'friend']} labels={{ solo: 'Alone (app speaks the other side)', friend: 'With a friend' }} onChange={(m) => { setMode(m as 'solo' | 'friend'); restart() }} />
        <Seg value={me} options={['A', 'B']} labels={{ A: `I am A (${rp.a})`, B: `I am B (${rp.b})` }} onChange={(m) => { setMe(m as 'A' | 'B'); restart() }} />
        <div className="row"><Toggle label="Show the other side's Czech" on={showOther} set={setShowOther} /><Toggle label="Show my Czech" on={showMine} set={setShowMine} /></div>
      </div>

      {mode === 'friend' ? (
        <div className="card">
          <ol className="script">{rp.lines.map((l, k) => (
            <li key={k} className={(l.who === me ? 'me' : 'other') + (k === i ? ' now' : '')} onClick={() => setI(k)}>
              <span className="who">{l.who}</span>
              <div>{(l.who === me ? showMine : showOther) || k < i ? <b lang="cs">{l.cz}</b> : <span className="muted">(tap ▶ or say it from the English)</span>}
                <div className="muted small">{l.en}</div></div>
              <button className="link" onClick={(e) => { e.stopPropagation(); tts.speak(l.cz, rate) }}>▶</button>
            </li>))}</ol>
          <div className="row between"><button disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button><button className="primary" disabled={i >= rp.lines.length - 1} onClick={() => setI(i + 1)}>Next line →</button></div>
        </div>
      ) : !line ? (
        <div className="card center"><h2>Dialogue done ✓</h2><p>{hits} of your lines matched.</p><div className="row"><button onClick={onBack}>Done</button><button className="primary" onClick={restart}>Again</button></div></div>
      ) : (
        <div className="card">
          <div className="muted">Line {i + 1} / {rp.lines.length}</div>
          <ol className="script">{rp.lines.slice(Math.max(0, i - 2), i).map((l, k) => <li key={k} className={l.who === me ? 'me' : 'other'}><span className="who">{l.who}</span><div><b lang="cs">{l.cz}</b></div></li>)}</ol>
          {mine ? <>
            <h2 className="prompt">{line.en}</h2>
            {showMine ? <p lang="cs"><b>{line.cz}</b></p> : <button className="link" onClick={() => setShowMine(true)}>Show the Czech</button>}
            <div className="row">
              {stt.supported() && <button className="primary" disabled={say.busy} onClick={say.listen}>{say.busy ? '🎙 Listening…' : '🎙 Say it'}</button>}
              <button onClick={() => tts.speak(line.cz, rate)}>▶ Model</button>
              <RecordButtons />
            </div>
            <SayResult {...say} />
            <button className={say.v?.correct || !stt.supported() ? 'primary wide' : 'wide'} onClick={() => setI(i + 1)}>{say.v ? 'Next →' : 'I said it → next'}</button>
          </> : <>
            <p className="muted">{rp.lines[i].who === 'A' ? rp.a : rp.b} says…</p>
            <h2 className="prompt" lang="cs">{showOther ? line.cz : '🔊 …'}</h2>
            <div className="muted small">{line.en}</div>
            <div className="row"><button onClick={() => tts.speak(line.cz, rate)}>▶ Again</button><button onClick={() => setI(i + 1)}>Skip →</button></div>
          </>}
        </div>
      )}
    </>
  )
}

// ---------- shadowing
function Shadowing() {
  const { profile } = useProfile()
  const [src, setSrc] = useState(String(Math.min(profile.currentWeek, 21)))
  const [i, setI] = useState(0)
  const weeks = WEEKS.filter((w) => w.sentences.length)
  const opts = [...weeks.map((w) => ({ value: String(w.week), label: `Week ${w.week} sentences` })), ...P.ladders.map((l, k) => ({ value: `l${k}`, label: `Ladder: ${l.title}` }))]
  const list = src.startsWith('l') ? P.ladders[+src.slice(1)].steps.map((s) => ({ cz: s.cz, en: s.en }))
    : weekItems(WEEKS[+src - 1]).filter((it) => it.kind === 'sentence' && !it.cz.includes('…'))
  const s = list[Math.min(i, list.length - 1)]
  const say = useSayCheck(s?.cz ?? '', 'shadowing')
  if (!s) return null
  return (
    <div className="card form">
      <Stepper label="sentences" value={src} options={opts} onChange={(v) => { setSrc(v); setI(0) }} />
      <p className="muted small">Listen slow, then normal, and speak along with the voice. Then say it alone and compare.</p>
      <div className="muted">Sentence {i + 1} / {list.length}</div>
      <h2 className="prompt" lang="cs">{first(s.cz)}</h2>
      <div className="muted">{s.en}</div>
      <div className="row">
        <button onClick={() => tts.speak(first(s.cz), profile.ttsRate * 0.75)}>▶ 0.75×</button>
        <button onClick={() => tts.speak(first(s.cz), profile.ttsRate)}>▶ 1×</button>
        {stt.supported() && <button className="primary" disabled={say.busy} onClick={say.listen}>{say.busy ? '🎙 Listening…' : '🎙 Say it'}</button>}
        <RecordButtons key={s.cz} />
      </div>
      <SayResult {...say} />
      <div className="row between"><button disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button><button className="primary" disabled={i >= list.length - 1} onClick={() => setI(i + 1)}>Next →</button></div>
    </div>
  )
}

// ---------- pronunciation lab
function Pronunciation() {
  const { profile } = useProfile()
  const [part, setPart] = useState<'pairs' | 'twisters'>('pairs')
  return <>
    <Seg value={part} options={['pairs', 'twisters']} labels={{ pairs: 'Hear the difference', twisters: 'Say it (ř, č, ě…)' }} onChange={(p) => setPart(p as 'pairs' | 'twisters')} />
    {part === 'pairs' ? <PairQuiz rate={profile.ttsRate} /> : <Twisters rate={profile.ttsRate} />}
  </>
}

function PairQuiz({ rate }: { rate: number }) {
  const [order] = useState(() => shuffle(PAIRS))
  const [i, setI] = useState(0)
  const [which, setWhich] = useState<'a' | 'b'>(() => (Math.random() < 0.5 ? 'a' : 'b'))
  const [picked, setPicked] = useState<'a' | 'b' | null>(null)
  const [score, setScore] = useState(0)
  const p = order[i % order.length]
  const play = () => tts.speak(which === 'a' ? p.a : p.b, rate * 0.9)
  useEffect(() => { play() }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  function pick(x: 'a' | 'b') { if (picked) return; setPicked(x); cue(x === which); if (x === which) setScore(score + 1) }
  function next() { setPicked(null); setWhich(Math.random() < 0.5 ? 'a' : 'b'); setI(i + 1) }
  return (
    <div className="card">
      <div className="muted">{score} / {i + (picked ? 1 : 0)} right · {p.point}</div>
      <h2>Which word did you hear?</h2>
      <button onClick={play}>▶ Play again</button>
      <div className="options">{(['a', 'b'] as const).map((x) => (
        <button key={x} lang="cs" disabled={!!picked} className={picked ? (x === which ? 'right' : x === picked ? 'wrong' : '') : ''} onClick={() => pick(x)}>
          {x === 'a' ? p.a : p.b}<br /><span className="muted small">{x === 'a' ? p.aEn : p.bEn}</span></button>))}</div>
      {picked && <div className="row"><button onClick={() => tts.speak(p.a, rate * 0.8)}>▶ {p.a}</button><button onClick={() => tts.speak(p.b, rate * 0.8)}>▶ {p.b}</button><button className="primary" onClick={next}>Next →</button></div>}
      <p className="muted small">Browser voices may not mark every length difference clearly; the recorded voice (when available) is better.</p>
    </div>
  )
}

function Twisters({ rate }: { rate: number }) {
  const [i, setI] = useState(0)
  const t = TWISTERS[i]
  const say = useSayCheck(t.cz, 'pronunciation')
  return (
    <div className="card">
      <div className="muted">{i + 1} / {TWISTERS.length} · {t.point}</div>
      <h2 className="prompt" lang="cs">{t.cz}</h2>
      <div className="muted">{t.en}</div>
      <div className="row">
        <button onClick={() => tts.speak(t.cz, rate * 0.7)}>▶ Slow</button><button onClick={() => tts.speak(t.cz, rate)}>▶ 1×</button>
        {stt.supported() && <button className="primary" disabled={say.busy} onClick={say.listen}>{say.busy ? '🎙 Listening…' : '🎙 Say it'}</button>}
        <RecordButtons key={t.cz} />
      </div>
      <SayResult {...say} />
      <div className="row between"><button disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button><button className="primary" disabled={i >= TWISTERS.length - 1} onClick={() => setI(i + 1)}>Next →</button></div>
    </div>
  )
}
