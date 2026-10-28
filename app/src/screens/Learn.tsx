import { useEffect, useRef, useState } from 'react'
import exerciseData from '../data/exercises.json'
import weekendData from '../data/weekend.json'
import practiceData from '../data/practice.json'
import { WEEKS, getWeek, itemsUpToDay, RHYTHM, typeable, weekItems, type Week } from '../lib/content'
import { db, saveProfile, today, type Profile, type Session } from '../lib/db'
import { ensureCards } from '../lib/srs'
import { exerciseQuestions, shuffle, verbQuestions, wordQuestions, type Exercise, type Practice, type Question } from '../lib/games'
import { inlineMd } from '../components/DrillRunner'
import { PlayAll } from '../components/PlayAll'
import { Bank, DrillSet, PatternLab } from './WeekScreen'
import { Exercises } from './Exercises'
import { WeeklyTest } from './WeeklyTest'
import { Runner } from './Games'
import { TopicView, topicsForWeek, type Topic } from './Study'

export type Go = (tab: 'practice' | 'games' | 'speak' | 'exam' | 'progress' | 'study', sub?: 'repair') => void
type Panel = 'lab' | 'bank' | 'drill' | 'exercises' | 'test' | 'play' | null
const EX = exerciseData as Exercise[]
const P = practiceData as Practice
const WEEKEND = weekendData as Record<string, string[]>
const DAY_NAMES = [...RHYTHM.map((r) => r.day), 'Weekend']
const WEEKEND_DAY = 5

const minutesOf = (label: string) => { const m = label.match(/(\d+)-(\d+)/); return m ? +m[2] - +m[1] : 0 }

export function examStatus(p: Profile) {
  const days = Math.ceil((new Date(p.examDate).getTime() - new Date(today()).getTime()) / 864e5)
  let weekdays = 0
  for (let t = new Date(today()); t < new Date(p.examDate); t.setDate(t.getDate() + 1)) if (t.getDay() % 6) weekdays++
  const sessionsLeft = (26 - p.currentWeek) * 5 + (5 - p.currentDay)
  return { days, weekdays, sessionsLeft, onTrack: weekdays >= sessionsLeft }
}

/** A mixed round of a day's content: words and sentences so far, the week's verbs and (from Wednesday) its exercises. */
export function dayQuestions(w: Week, day: number, n = 20): Question[] {
  const items = itemsUpToDay(w, Math.min(day, 4)).filter((i) => typeable(i) && i.en)
  const verbs = P.verbs.filter((v) => v.week === w.week).flatMap((v) => shuffle(verbQuestions(v, 'present')).slice(0, 2))
  const ex = day >= 2 ? exerciseQuestions(EX.filter((e) => e.week === w.week && e.type !== 'scene')) : []
  return shuffle([...wordQuestions(items), ...verbs, ...ex]).slice(0, n)
}

/** Learn = the week (‹ 1 … 26 ›) + its days (Mon–Fri + weekend). Any week and day can be opened and redone. */
export function Learn({ profile, refresh, go }: { profile: Profile; refresh: () => void; go: Go }) {
  const [weekNo, setWeekNo] = useState(Math.min(profile.currentWeek, 26))
  const [day, setDay] = useState(profile.currentWeek > 26 ? 0 : profile.currentDay)
  const [panel, setPanel] = useState<Panel>(null)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [finished, setFinished] = useState<Set<number>>(new Set())
  const w = getWeek(weekNo)
  useEffect(() => { db.sessions.filter((s) => s.week === weekNo).toArray().then((ss) => setFinished(new Set(ss.filter((s) => s.finished).map((s) => s.day)))) }, [weekNo, day, panel])
  const pickWeek = (n: number) => { setWeekNo(n); setDay(n === profile.currentWeek ? profile.currentDay : 0); setPanel(null) }

  const back = <button className="back" onClick={() => setPanel(null)}>← {DAY_NAMES[day]}</button>
  if (topic) return <TopicView t={topic} onBack={() => setTopic(null)} backLabel={DAY_NAMES[day]} />
  if (panel === 'test') return <WeeklyTest week={w} profile={profile} onExit={() => { setPanel(null); refresh() }} />
  if (panel === 'play') return <Runner qs={day === WEEKEND_DAY ? dayQuestions(w, 4, 30) : dayQuestions(w, day)} mode="type" title={`Week ${weekNo} · ${DAY_NAMES[day]}`} rate={profile.ttsRate} onExit={() => setPanel(null)} />
  if (panel) return (
    <>
      <div className="gamebar">{back}<h1>{{ lab: 'Pattern Lab', bank: 'Listen', drill: 'Drill', exercises: 'Exercises' }[panel]}</h1></div>
      {panel === 'lab' && <PatternLab weekNo={weekNo} profile={profile} onDrill={() => setPanel('drill')} />}
      {panel === 'bank' && <Bank weekNo={weekNo} rate={profile.ttsRate} />}
      {panel === 'drill' && <DrillSet weekNo={weekNo} profile={profile} />}
      {panel === 'exercises' && <Exercises weekNo={weekNo} profile={profile} />}
    </>
  )

  const topics = topicsForWeek(weekNo)
  return (
    <>
      <WeekBar week={weekNo} current={profile.currentWeek} maxWeek={profile.maxWeek} onPick={pickWeek} />
      <div className="daybar" role="tablist">{DAY_NAMES.map((d, k) => (
        <button key={d} role="tab" aria-selected={k === day} className={(k === day ? 'on ' : '') + (finished.has(k) ? 'done ' : '') + (weekNo === profile.currentWeek && k === profile.currentDay ? 'now' : '')} onClick={() => { setDay(k); setPanel(null) }}>
          {finished.has(k) ? '✓ ' : ''}{d}</button>))}</div>

      {day === WEEKEND_DAY ? <Weekend w={w} profile={profile} topics={topics} openTopic={setTopic} play={() => setPanel('play')} go={go} />
        : <Day key={`${weekNo}-${day}`} w={w} day={day} profile={profile} refresh={refresh} go={go} open={setPanel} onFinished={() => setFinished(new Set([...finished, day]))} />}

      <div className="card">
        <h2>This week</h2>
        <p className="muted small">{w.canDo}</p>
        <div className="row">
          {w.patternLab.length > 0 && <button onClick={() => setPanel('lab')}>Pattern Lab</button>}
          {weekItems(w).length > 0 && <button onClick={() => setPanel('bank')}>Listen</button>}
          {weekItems(w).length > 0 && <button onClick={() => setPanel('drill')}>Drill</button>}
          {EX.some((e) => e.week === weekNo) && <button onClick={() => setPanel('exercises')}>Exercises</button>}
          {!w.plan && <button onClick={() => setPanel('test')}>Weekly test</button>}
        </div>
        {topics.length > 0 && <><div className="muted small">Grammar of the week</div>
          <div className="row">{topics.map((t) => <button key={t.title} className="link" onClick={() => setTopic(t)}>📘 {t.title}</button>)}</div></>}
      </div>
      {day !== WEEKEND_DAY && weekItems(w).length > 0 && <button className="primary wide" onClick={() => setPanel('play')}>▶ Play the whole day ({DAY_NAMES[day]}: words, verbs{day >= 2 ? ', exercises' : ''})</button>}
    </>
  )
}

function WeekBar({ week, current, maxWeek, onPick }: { week: number; current: number; maxWeek: number; onPick: (n: number) => void }) {
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => { strip.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }, [week])
  return (
    <div className="weekbar">
      <button aria-label="Previous week" disabled={week <= 1} onClick={() => onPick(week - 1)}>‹</button>
      <div className="weeks" ref={strip}>{WEEKS.map((x) => (
        <button key={x.week} className={(x.week === week ? 'on ' : '') + (x.week === current ? 'now ' : '') + (x.week > maxWeek ? 'ahead' : '')} title={x.title} onClick={() => onPick(x.week)}>{x.week}</button>))}</div>
      <button aria-label="Next week" disabled={week >= 26} onClick={() => onPick(week + 1)}>›</button>
    </div>
  )
}

function Day({ w, day, profile, refresh, go, open, onFinished }: { w: Week; day: number; profile: Profile; refresh: () => void; go: Go; open: (p: Panel) => void; onFinished: () => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [timer, setTimer] = useState<{ i: number; end: number } | null>(null)
  const [, tick] = useState(0)
  const isCurrent = w.week === profile.currentWeek && day === profile.currentDay
  const blocks = w.plan ? [{ minutes: '', task: w.plan[day]?.plan ?? '' }] : [
    ...(isCurrent && profile.repairDays > 0 && day < 2 ? [{ minutes: '', task: 'Repair loop from your error log (this week’s Mon-Tue are shortened).' }] : []),
    ...RHYTHM[day].blocks,
  ]

  useEffect(() => {
    ensureCards(itemsUpToDay(w, day))
    db.sessions.where('[week+day]').equals([w.week, day]).first().then((s) => setSession(s ?? { date: today(), week: w.week, day, blocksDone: [], minutes: 0, finished: false }))
  }, [w, day])
  useEffect(() => { if (!timer) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [timer])
  if (!session) return null

  function actionFor(task: string): [string, () => void] | null {
    if (/Mock|exam simulation|timed/i.test(task) && w.plan) return ['Exam', () => go('exam')]
    if (/Weekly test/.test(task)) return ['Start test', () => open('test')]
    if (/^Review cards/.test(task)) return ['Review', () => go('practice')]
    if (/Repair|Error repair/.test(task)) return ['Repair', () => go('practice', 'repair')]
    if (/Pattern Lab/.test(task)) return ['Pattern Lab', () => open('lab')]
    if (/drills|Sentence ladder|recall/.test(task)) return ['Drill', () => open('drill')]
    if (/Input|Reading|listen|dictation/i.test(task)) return ['Listen', () => open('bank')]
    if (/Shadowing|role-play|Recording|Speaking/i.test(task)) return ['Speak', () => go('speak')]
    if (/Writing/i.test(task)) return ['Exercises', () => open('exercises')]
    if (/Log/.test(task)) return ['Error log', () => go('progress')]
    return null
  }
  async function toggle(i: number) {
    const done = session!.blocksDone.includes(i) ? session!.blocksDone.filter((x) => x !== i) : [...session!.blocksDone, i]
    const s = { ...session!, blocksDone: done, minutes: blocks.filter((_, k) => done.includes(k)).reduce((a, b) => a + minutesOf(b.minutes), 0) }
    s.id = await db.sessions.put(s); setSession(s)
  }
  async function finishDay() {
    const s = { ...session!, finished: true }
    s.id = await db.sessions.put(s); setSession(s); onFinished()
    if (isCurrent) { // only the plan's current day moves the plan forward; redoing an old day doesn't
      await saveProfile(day === 4 ? { currentWeek: w.week + 1, currentDay: 0, maxWeek: Math.max(profile.maxWeek, w.week + 1) }
        : { currentDay: day + 1, repairDays: day < 2 ? Math.max(0, profile.repairDays - 1) : profile.repairDays })
      refresh()
    }
  }

  const st = examStatus(profile)
  const isTestDay = day === 4 && !w.plan
  const left = timer ? Math.max(0, Math.round((timer.end - Date.now()) / 1000)) : 0

  return (
    <>
      <section className="hero">
        <div className="sub small">Week {w.week} · {RHYTHM[day].day} · {w.plan ? 'Exam sprint' : RHYTHM[day].name}{w.week > profile.maxWeek ? ' · ahead of your plan' : ''}</div>
        <h1>{w.title}</h1>
        <div className="sub small">{st.days} days to exam · {st.onTrack ? 'on track' : `behind: ${st.sessionsLeft} sessions, ${st.weekdays} weekdays left`}</div>
      </section>
      <ol className="blocks">
        {blocks.map((b, i) => {
          const action = actionFor(b.task)
          const done = session.blocksDone.includes(i)
          return (
            <li key={i} className={'card' + (done ? ' done' : '')}>
              <div className="row between"><span className="muted">{b.minutes}</span>
                {minutesOf(b.minutes) > 0 && (timer?.i === i
                  ? <button className="link" onClick={() => setTimer(null)}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</button>
                  : <button className="link" onClick={() => setTimer({ i, end: Date.now() + minutesOf(b.minutes) * 60e3 })}>⏱ {minutesOf(b.minutes)} min</button>)}
              </div>
              <p dangerouslySetInnerHTML={{ __html: inlineMd(b.task) }} />
              <div className="row">
                {action && <button className="primary" onClick={action[1]}>{action[0]}</button>}
                <label className="check"><input type="checkbox" checked={done} onChange={() => toggle(i)} /> done</label>
              </div>
            </li>
          )
        })}
      </ol>
      {day === 4 && w.realLife && <RealLife week={w.week} task={w.realLife} profile={profile} refresh={refresh} />}
      {session.finished ? <p className="ok">✓ {RHYTHM[day].day} done. You can redo anything here at any time.</p>
        : isTestDay && isCurrent ? <p className="muted">Friday ends with the weekly test: ≥ 80% unlocks next week. <button className="link" onClick={finishDay}>Skip the test and move on</button></p>
        : <button className={isCurrent ? 'primary wide' : 'wide'} disabled={isCurrent && session.blocksDone.length < blocks.length} onClick={finishDay}>{isCurrent ? `Finish ${RHYTHM[day].day} →` : `Mark ${RHYTHM[day].day} as done`}</button>}
    </>
  )
}

function Weekend({ w, profile, topics, openTopic, play, go }: { w: Week; profile: Profile; topics: Topic[]; openTopic: (t: Topic) => void; play: () => void; go: Go }) {
  const points = WEEKEND[w.week] ?? []
  const sentences = weekItems(w).filter((i) => i.kind === 'sentence' && !i.cz.includes('…')).map((i) => i.cz)
  return (
    <>
      <section className="hero weekend">
        <div className="sub small">Week {w.week} · Weekend revision</div>
        <h1>{w.title}</h1>
        <div className="sub small">Go over the whole week: key points, a mixed round, the sentences, and the week's grammar.</div>
      </section>
      <div className="card">
        <h2>Key points</h2>
        {points.length ? <ul className="points">{points.map((p, k) => <li key={k} dangerouslySetInnerHTML={{ __html: inlineMd(p) }} />)}</ul>
          : w.patternLab.length ? <ul className="points">{w.patternLab.map((p, k) => <li key={k} dangerouslySetInnerHTML={{ __html: inlineMd(p) }} />)}</ul>
          : <p className="muted">{w.canDo}</p>}
      </div>
      <div className="card">
        <h2>Practise the whole week</h2>
        <div className="row">
          {weekItems(w).length > 0 && <button className="primary" onClick={play}>▶ Mixed round (30)</button>}
          <PlayAll lines={sentences} rate={profile.ttsRate} label="Listen to the week's sentences" />
          <button onClick={() => go('practice')}>Review cards</button>
          <button onClick={() => go('speak')}>Role-plays</button>
        </div>
        {topics.length > 0 && <><div className="muted small">Grammar of the week</div>
          <div className="row">{topics.map((t) => <button key={t.title} className="link" onClick={() => openTopic(t)}>📘 {t.title}</button>)}</div></>}
      </div>
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
