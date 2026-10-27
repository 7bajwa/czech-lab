import { useState } from 'react'
import type { Week } from '../lib/content'
import { db, saveProfile, type Profile, type WeeklyTest as TestRow } from '../lib/db'
import { buildWeeklyTest } from '../lib/drills'
import { DrillRunner, Feedback, type Result } from '../components/DrillRunner'

/** ≥ 80% unlocks the next week · 60-79% = next week starts with a 2-day repair loop · < 60% = repeat Wed-Fri. */
export function outcomeFor(pct: number): TestRow['outcome'] {
  return pct >= 80 ? 'unlock' : pct >= 60 ? 'repair' : 'repeat'
}

const MESSAGE = {
  unlock: 'Passed! The next week is unlocked.',
  repair: 'Almost: the next week starts with a 2-day repair loop from your error log.',
  repeat: 'Not yet: repeat Wednesday to Friday of this week, then retake the test.',
}

export function WeeklyTest({ week: w, profile, onExit }: { week: Week; profile: Profile; onExit: () => void }) {
  const [drills] = useState(() => buildWeeklyTest(w))
  const [results, setResults] = useState<Result[] | null>(null)
  const [started, setStarted] = useState(false)

  async function finish(rs: Result[]) {
    const score = rs.filter((r) => r.verdict.correct).length
    const pct = Math.round((score / rs.length) * 100)
    const outcome = outcomeFor(pct)
    await db.weeklyTests.add({ week: w.week, score, total: rs.length, passed: outcome === 'unlock', outcome, ts: Date.now() })
    const next = w.week + 1
    await saveProfile(outcome === 'repeat' ? { currentDay: 2 }
      : { currentWeek: next, currentDay: 0, maxWeek: Math.max(profile.maxWeek, next), repairDays: outcome === 'repair' ? 2 : 0 })
    setResults(rs)
  }

  if (!started) return (
    <div className="card">
      <h1>Week {w.week} test</h1>
      <p>{drills.length} auto-scored items: verb forms, English → Czech, and dictation. No hints until the end.</p>
      <p className="muted small">Curriculum test: {w.weeklyTest} (Speaking recording arrives with the Speak module.)</p>
      <div className="row"><button onClick={onExit}>Back</button><button className="primary" onClick={() => setStarted(true)}>Start</button></div>
    </div>
  )
  if (!results) return <DrillRunner drills={drills} mode="test" rate={profile.ttsRate} onDone={finish} />

  const score = results.filter((r) => r.verdict.correct).length
  const pct = Math.round((score / results.length) * 100)
  const wrong = results.filter((r) => !r.verdict.correct)
  return (
    <>
      <div className="card">
        <h1>{pct}%</h1><p>{score} / {results.length} correct. {MESSAGE[outcomeFor(pct)]}</p>
        <button className="primary" onClick={onExit}>Continue</button>
      </div>
      {wrong.map((r, i) => (
        <div className="card" key={i}><div className="muted">{r.drill.prompt} · you wrote “{r.response}”</div><Feedback r={r} rate={profile.ttsRate} /></div>
      ))}
    </>
  )
}
