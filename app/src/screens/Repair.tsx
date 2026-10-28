import { useEffect, useState } from 'react'
import { WEEKS, weekItems } from '../lib/content'
import { db, type ErrorRow, type Profile } from '../lib/db'
import { CASES, caseQuestion, exerciseQuestions, ladderQuestions, shuffle, verbQuestions, wordQuestions, type Exercise, type Question, type Tense } from '../lib/games'
import { P } from '../lib/extra'
import exerciseData from '../data/exercises.json'
import { patternName, weakest } from '../lib/weak'
import { topicQuestions, GRAMMAR } from './Study'
import { Runner } from './Games'

let INDEX: Map<string, Question> | null = null
/** Every replayable question by id (built once): verbs, cases, ladders, exercises, grammar, curriculum words. */
function index() {
  if (INDEX) return INDEX
  const all: Question[] = [
    ...P.verbs.flatMap((v) => (['present', 'past', 'future'] as Tense[]).flatMap((t) => verbQuestions(v, t))),
    ...P.cases.flatMap((c) => CASES.map((k) => caseQuestion(c, k.key))), ...P.pluralCases.flatMap((c) => CASES.map((k) => caseQuestion(c, k.key, true))),
    ...P.ladders.flatMap(ladderQuestions),
    ...WEEKS.flatMap((w) => exerciseQuestions((exerciseData as Exercise[]).filter((e) => e.week === w.week))),
    ...GRAMMAR.flatMap(topicQuestions),
    ...WEEKS.flatMap((w) => { const items = weekItems(w).filter((i) => i.en && !i.cz.includes('…')); return wordQuestions(items).map((q, k) => ({ ...q, id: items[k].id })) }),
  ]
  INDEX = new Map(all.map((q) => [q.id, q]))
  return INDEX
}

/** Repair: replay what you got wrong (most errors first), or work on one of your three weakest patterns. */
export function Repair({ profile }: { profile: Profile }) {
  const [qs, setQs] = useState<Question[] | null>(null)
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [wrongIds, setWrongIds] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    db.errors.toArray().then(setErrors)
    db.attempts.filter((a) => !a.correct).toArray().then((ws) => { const m = new Map<string, number>(); for (const a of ws) m.set(a.itemId, (m.get(a.itemId) ?? 0) + 1); setWrongIds(m) })
  }, [qs])
  if (qs) return <Runner qs={qs} mode="type" title={title} rate={profile.ttsRate} onExit={() => setQs(null)} />

  const idx = index()
  const mistakes = [...wrongIds.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => idx.get(id)).filter((q): q is Question => !!q)
  const weak = weakest(errors)
  function fix(pattern: string) {
    const mine = mistakes.filter((q) => q.pattern === pattern)
    const more = shuffle([...idx.values()].filter((q) => q.pattern === pattern && !mine.includes(q)))
    setTitle(`Repair · ${patternName(pattern)}`); setQs([...mine, ...more].slice(0, 12))
  }
  return (
    <>
      <div className="card">
        <h2>Weakness radar</h2>
        {weak.length ? weak.map((w, k) => (
          <div key={w.pattern} className="row between radar"><span><b>{k + 1}. {patternName(w.pattern)}</b><br /><span className="muted small">{w.count} errors · {[...w.tags].join(', ')}</span></span>
            <button className="primary" onClick={() => fix(w.pattern)}>Repair</button></div>
        )) : <p className="muted">No errors logged yet. Mistakes from drills, games and tests appear here.</p>}
      </div>
      {mistakes.length > 0 && <div className="card"><h2>Your mistakes</h2><p className="muted small">{mistakes.length} items you got wrong, most-missed first.</p>
        <button className="primary wide" onClick={() => { setTitle('Repair · mistakes'); setQs(mistakes.slice(0, 15)) }}>Replay 15 mistakes</button></div>}
    </>
  )
}
