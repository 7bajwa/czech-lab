import { useEffect, useState } from 'react'
import { getWeek, itemsUpToDay, RHYTHM } from '../lib/content'
import { db, saveProfile, today, type Profile, type Session } from '../lib/db'
import { ensureCards } from '../lib/srs'
import { WeeklyTest } from './WeeklyTest'

export type Go = (tab: 'practice' | 'week' | 'progress' | 'games', sub?: 'lab' | 'bank' | 'drill' | 'repair') => void
type Block = { minutes: string; task: string }

const minutesOf = (label: string) => { const m = label.match(/(\d+)-(\d+)/); return m ? +m[2] - +m[1] : 0 }

/** Where a rhythm block's "Open" button goes, by its wording in the curriculum. */
function actionFor(task: string, go: Go, openTest: () => void): [string, () => void] | null {
  if (/Weekly test/.test(task)) return ['Start test', openTest]
  if (/^Review cards/.test(task)) return ['Review', () => go('practice')]
  if (/Repair|Error repair/.test(task)) return ['Repair drills', () => go('practice', 'repair')]
  if (/Pattern Lab/.test(task)) return ['Pattern Lab', () => go('week', 'lab')]
  if (/drills|Sentence ladder|recall/.test(task)) return ['Drill', () => go('week', 'drill')]
  if (/Input|Reading|listen|dictation/i.test(task)) return ['Listen', () => go('week', 'bank')]
  if (/Shadowing|role-play|Recording/i.test(task)) return ['Speak', () => go('games')]
  if (/Log/.test(task)) return ['Error log', () => go('progress')]
  return null
}

export function examStatus(p: Profile) {
  const days = Math.ceil((new Date(p.examDate).getTime() - new Date(today()).getTime()) / 864e5)
  let weekdays = 0
  for (let t = new Date(today()); t < new Date(p.examDate); t.setDate(t.getDate() + 1)) if (t.getDay() % 6) weekdays++
  const sessionsLeft = (26 - p.currentWeek) * 5 + (5 - p.currentDay)
  return { days, weekdays, sessionsLeft, onTrack: weekdays >= sessionsLeft }
}

export function Today({ profile, refresh, go }: { profile: Profile; refresh: () => void; go: Go }) {
  const w = getWeek(profile.currentWeek)
  const d = profile.currentDay
  const [session, setSession] = useState<Session | null>(null)
  const [testing, setTesting] = useState(false)
  const [timer, setTimer] = useState<{ i: number; end: number } | null>(null)
  const [, tick] = useState(0)

  const blocks: Block[] = w.plan ? [{ minutes: '', task: w.plan[d]?.plan ?? '' }] : [
    ...(profile.repairDays > 0 && d < 2 ? [{ minutes: '', task: 'Repair loop from your error log (this week’s Mon-Tue are shortened).' }] : []),
    ...RHYTHM[d].blocks,
  ]

  useEffect(() => {
    ensureCards(itemsUpToDay(w, d))
    db.sessions.where('[week+day]').equals([w.week, d]).first().then((s) => setSession(s ?? { date: today(), week: w.week, day: d, blocksDone: [], minutes: 0, finished: false }))
  }, [w, d])
  useEffect(() => { if (!timer) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [timer])

  if (testing) return <WeeklyTest week={w} profile={profile} onExit={() => { setTesting(false); refresh() }} />
  if (!session) return null

  async function toggle(i: number) {
    const done = session!.blocksDone.includes(i) ? session!.blocksDone.filter((x) => x !== i) : [...session!.blocksDone, i]
    const s = { ...session!, blocksDone: done, minutes: blocks.filter((_, k) => done.includes(k)).reduce((a, b) => a + minutesOf(b.minutes), 0) }
    s.id = await db.sessions.put(s); setSession(s)
  }
  async function finishDay() {
    await db.sessions.put({ ...session!, finished: true })
    const lastDay = d === 4
    await saveProfile(lastDay ? { currentWeek: w.week + 1, currentDay: 0, maxWeek: Math.max(profile.maxWeek, w.week + 1) }
      : { currentDay: d + 1, repairDays: d < 2 ? Math.max(0, profile.repairDays - 1) : profile.repairDays })
    refresh()
  }

  const st = examStatus(profile)
  const isTestDay = d === 4 && !w.plan
  const left = timer ? Math.max(0, Math.round((timer.end - Date.now()) / 1000)) : 0

  return (
    <>
      <section className="hero">
        <div className="sub small">Week {w.week} · {RHYTHM[d].day} · {RHYTHM[d].name}</div>
        <h1>{w.title}</h1>
        <div className="sub small">{st.days} days to exam · {st.onTrack ? 'on track' : `behind: ${st.sessionsLeft} sessions, ${st.weekdays} weekdays left`}</div>
        <div className="days" aria-label="This week">
          {RHYTHM.map((r, k) => <span key={r.day} className={k < d ? 'done' : k === d ? 'now' : ''}>{r.day}</span>)}
        </div>
      </section>
      <ol className="blocks">
        {blocks.map((b, i) => {
          const action = actionFor(b.task, go, () => setTesting(true))
          const done = session.blocksDone.includes(i)
          return (
            <li key={i} className={'card' + (done ? ' done' : '')}>
              <div className="row between"><span className="muted">{b.minutes}</span>
                {minutesOf(b.minutes) > 0 && (timer?.i === i
                  ? <button className="link" onClick={() => setTimer(null)}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</button>
                  : <button className="link" onClick={() => setTimer({ i, end: Date.now() + minutesOf(b.minutes) * 60e3 })}>⏱ {minutesOf(b.minutes)} min</button>)}
              </div>
              <p>{b.task}</p>
              <div className="row">
                {action && <button className="primary" onClick={action[1]}>{action[0]}</button>}
                <label className="check"><input type="checkbox" checked={done} onChange={() => toggle(i)} /> done</label>
              </div>
            </li>
          )
        })}
      </ol>
      {d === 4 && w.realLife && <RealLife week={w.week} task={w.realLife} profile={profile} refresh={refresh} />}
      {isTestDay
        ? <p className="muted">Friday ends with the weekly test: ≥ 80% unlocks next week.</p>
        : <button className="primary wide" disabled={session.blocksDone.length < blocks.length} onClick={finishDay}>Finish {RHYTHM[d].day} →</button>}
    </>
  )
}

function RealLife({ week, task, profile, refresh }: { week: number; task: string; profile: Profile; refresh: () => void }) {
  const [text, setText] = useState(profile.realLife[week] ?? '')
  return (
    <div className="card">
      <h2>Real-life task</h2><p>{task}</p>
      <label className="block">Check in with one sentence in Czech
        <input lang="cs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Dnes jsem řekl „Dobrý den“…" />
      </label>
      <button onClick={async () => { await saveProfile({ realLife: { ...profile.realLife, [week]: text } }); refresh() }} disabled={!text.trim()}>
        {profile.realLife[week] ? '✓ Saved' : 'Save check-in'}
      </button>
    </div>
  )
}
