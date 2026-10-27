import { useState } from 'react'
import exerciseData from '../data/exercises.json'
import type { Profile } from '../lib/db'
import { exerciseQuestions, type Exercise } from '../lib/games'
import { Runner } from './Games'

const EX = exerciseData as Exercise[]

/** The week's exercises from Doc/czech-exercises.md: gaps, transforms, a dialogue line, then a 6-line scene. */
export function Exercises({ weekNo, profile }: { weekNo: number; profile: Profile }) {
  const [mode, setMode] = useState<'pick' | 'type'>('type')
  const [round, setRound] = useState(0) // > 0 while playing; bumps to restart
  const list = EX.filter((e) => e.week === weekNo)
  if (!list.length) return <p>This week has no exercises: it is a review or test week.</p>
  if (round) return <Runner key={round} qs={exerciseQuestions(list)} mode={mode} title={`Exercises · week ${weekNo}`} rate={profile.ttsRate} onExit={() => setRound(0)} />
  const count = (t: Exercise['type']) => list.filter((e) => e.type === t).length
  return (
    <div className="card form">
      <h2>Exercises</h2>
      <p className="muted">{count('gap')} gaps · {count('transform')} transforms · {count('dialogue')} dialogue · a {count('scene')}-line scene. Written by Claude: check it in Doc/czech-exercises.md.</p>
      <div className="muted small">How to answer</div>
      <div className="tabs" role="radiogroup">{(['type', 'pick'] as const).map((m) => (
        <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'type' ? 'Type' : 'Pick'}</button>
      ))}</div>
      <button className="primary" onClick={() => setRound(Date.now())}>Start</button>
    </div>
  )
}
