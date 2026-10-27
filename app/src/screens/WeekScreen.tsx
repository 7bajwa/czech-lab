import { useState } from 'react'
import { getWeek, PRONOUNS, weekItems } from '../lib/content'
import type { Profile } from '../lib/db'
import { buildDrills } from '../lib/drills'
import { claudeLlm, type RuleFeedback } from '../lib/llm'
import { tts } from '../lib/tts'
import { DrillRunner, inlineMd, type Result } from '../components/DrillRunner'
import { parseConjugations } from '../lib/conj'
import { Exercises } from './Exercises'

export type WeekView = 'lab' | 'bank' | 'drill' | 'exercises'

export function WeekScreen({ profile, view, setView }: { profile: Profile; view: WeekView; setView: (v: WeekView) => void }) {
  const [weekNo, setWeekNo] = useState(profile.currentWeek)
  const w = getWeek(weekNo)
  return (
    <>
      <div className="row between">
        <select value={weekNo} onChange={(e) => setWeekNo(+e.target.value)} aria-label="Week">
          {Array.from({ length: profile.maxWeek }, (_, i) => <option key={i} value={i + 1}>Week {i + 1}</option>)}
        </select>
        <div className="tabs" role="tablist">
          {(['lab', 'bank', 'drill', 'exercises'] as const).map((t) => <button key={t} role="tab" aria-selected={view === t} className={view === t ? 'on' : ''} onClick={() => setView(t)}>{{ lab: 'Pattern Lab', bank: 'Listen', drill: 'Drill', exercises: 'Exercises' }[t]}</button>)}
        </div>
      </div>
      <h1>{w.title}</h1>
      <p className="muted">{w.canDo}</p>
      {view === 'lab' && <PatternLab key={weekNo} weekNo={weekNo} profile={profile} onDrill={() => setView('drill')} />}
      {view === 'bank' && <Bank weekNo={weekNo} rate={profile.ttsRate} />}
      {view === 'drill' && <DrillSet key={weekNo} weekNo={weekNo} profile={profile} />}
      {view === 'exercises' && <Exercises key={weekNo} weekNo={weekNo} profile={profile} />}
    </>
  )
}

function PatternLab({ weekNo, profile, onDrill }: { weekNo: number; profile: Profile; onDrill: () => void }) {
  const w = getWeek(weekNo)
  const [i, setI] = useState(0)
  const [mine, setMine] = useState('')
  const [fb, setFb] = useState<RuleFeedback | string | null>(null)
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState(false)
  const [ticked, setTicked] = useState<number[]>([])
  if (!w.patternLab.length) return <p>This week has no new pattern: see the day plan on Today.</p>
  const bullet = w.patternLab[i]
  const tables = parseConjugations(weekNo, [bullet])

  const points = keyPoints(bullet)
  const reset = () => { setFb(null); setMine(''); setCompare(false); setTicked([]) }
  async function ask() {
    setBusy(true); setFb(null)
    try { setFb(await claudeLlm(profile.apiKey).checkRule([bullet], mine)) }
    catch (e) { setFb(`Could not get feedback: ${(e as Error).message}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="card">
      <div className="muted">Pattern {i + 1} / {w.patternLab.length}</div>
      <p className="pattern" dangerouslySetInnerHTML={{ __html: inlineMd(bullet) }} />
      {tables.map((t) => (
        <table key={t.id} className="conj"><caption>{t.lemma} {t.gloss && `(${t.gloss})`}</caption>
          <tbody>{t.forms.map((f, k) => <tr key={k}><td className="muted">{PRONOUNS[k]}</td><td lang="cs"><button className="link" onClick={() => tts.speak(f, profile.ttsRate)}>{f}</button></td></tr>)}</tbody>
        </table>
      ))}
      <label className="block">Say it in your words
        <textarea rows={3} value={mine} onChange={(e) => setMine(e.target.value)} placeholder="Explain this rule the way you'd tell a friend…" />
      </label>
      <div className="row">
        <button className="primary" disabled={!mine.trim()} onClick={() => setCompare(true)}>Compare with the rule</button>
        {profile.apiKey && <button disabled={!mine.trim() || busy} onClick={ask}>{busy ? 'Checking…' : 'Ask AI'}</button>}
      </div>
      {compare && (
        <div className="ok"><div className="muted small">Did your version say these? Tick what you covered.</div>
          {points.map((pt, k) => (
            <label key={k} className="check point"><input type="checkbox" checked={ticked.includes(k)} onChange={() => setTicked(ticked.includes(k) ? ticked.filter((x) => x !== k) : [...ticked, k])} />
              <span dangerouslySetInnerHTML={{ __html: inlineMd(pt) }} /></label>
          ))}
          <p className="small">{ticked.length === points.length ? '✓ You have the whole rule.' : `${ticked.length} / ${points.length} — add the missing point to your sentence and say it aloud once.`}</p>
        </div>
      )}
      {fb && (typeof fb === 'string' ? <p className="bad">{fb}</p> : (
        <div className="ok"><div className="muted small">AI feedback · unverified</div>
          <p>✓ {fb.right}</p>{fb.missing && <p>➜ {fb.missing}</p>}<p lang="cs"><em>{fb.example}</em></p></div>
      ))}
      <div className="row between">
        <button disabled={i === 0} onClick={() => { setI(i - 1); reset() }}>← Back</button>
        {i + 1 < w.patternLab.length
          ? <button className="primary" onClick={() => { setI(i + 1); reset() }}>Next pattern →</button>
          : <button className="primary" onClick={onDrill}>Start drills →</button>}
      </div>
    </div>
  )
}

/** Key points of a rule: its **bold** phrases plus the sentence each sits in; else its sentences. */
function keyPoints(bullet: string): string[] {
  const sentences = bullet.split(/(?<=[.;])\s+(?=[A-Z*\p{Lu}])/u).filter((x) => x.replace(/\*/g, '').trim().length > 3)
  return sentences.length ? sentences : [bullet]
}

function Bank({ weekNo, rate }: { weekNo: number; rate: number }) {
  const items = weekItems(getWeek(weekNo))
  const groups = [['Sentence bank', items.filter((i) => i.kind === 'sentence')], ['Vocabulary A', items.filter((i) => i.kind === 'vocabA')], ['Vocabulary B', items.filter((i) => i.kind === 'vocabB')]] as const
  return <>{groups.map(([title, list]) => list.length > 0 && (
    <div className="card" key={title}><h2>{title}</h2>
      <ul className="bank">{list.map((it) => (
        <li key={it.id}><button onClick={() => tts.speak(it.cz, rate * 0.75)} aria-label="Play slow">▶ .75</button><button onClick={() => tts.speak(it.cz, rate)} aria-label="Play">▶ 1</button>
          <span lang="cs"><b>{it.cz}</b>{it.chunk && <span title="chunk: learn whole, grammar later"> ★</span>}</span> <span className="muted">{it.en}</span></li>
      ))}</ul>
    </div>
  ))}</>
}

function DrillSet({ weekNo, profile }: { weekNo: number; profile: Profile }) {
  const day = weekNo < profile.currentWeek ? 4 : profile.currentDay
  const [results, setResults] = useState<Result[] | null>(null)
  const [drills, setDrills] = useState(() => buildDrills(getWeek(weekNo), day))
  const [round, setRound] = useState(0)
  if (results) {
    const right = results.filter((r) => r.verdict.correct).length
    return <div className="card"><h2>{right} / {results.length} correct</h2>
      <p className="muted">Mistakes were added to your review cards and error log.</p>
      <button className="primary" onClick={() => { setResults(null); setDrills(buildDrills(getWeek(weekNo), day)); setRound(round + 1) }}>Another round</button></div>
  }
  return <DrillRunner key={round} drills={drills} mode="drill" rate={profile.ttsRate} onDone={setResults} />
}
