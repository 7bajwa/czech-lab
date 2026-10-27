import { useEffect, useState, type CSSProperties } from 'react'
import { getProfile, db, type Profile } from './lib/db'
import { buildRepair } from './lib/drills'
import { Today, type Go } from './screens/Today'
import { WeekScreen, type WeekView } from './screens/WeekScreen'
import { Review } from './screens/Review'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { DrillRunner } from './components/DrillRunner'
import { Games } from './screens/Games'

// 24px stroke icons, drawn inline so the app has no icon dependency and works offline
const ICON: Record<string, string> = {
  today: 'M4 6h16M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6M8 3v5M16 3v5M8 13h3v3H8z',
  week: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  practice: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
  games: 'M7 9h4M9 7v4M15 10h.01M18 12h.01M6 6h12a4 4 0 0 1 4 4v3a4 4 0 0 1-7 2.6L14 15h-4l-1 .6A4 4 0 0 1 2 13v-3a4 4 0 0 1 4-4z',
  exam: 'M9 4h6l1 2h3v14H5V6h3zM9 12l2 2 4-4',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
}
const TABS = [['today', 'Today'], ['week', 'Week'], ['practice', 'Review'], ['games', 'Games'], ['exam', 'Exam'], ['progress', 'Progress']] as const
type Tab = (typeof TABS)[number][0] | 'settings'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [weekView, setWeekView] = useState<WeekView>('lab')
  const [practice, setPractice] = useState<'review' | 'repair'>('review')
  const refresh = () => getProfile().then(setProfile)
  useEffect(() => { refresh() }, [])
  useEffect(() => { if (profile) document.documentElement.style.fontSize = `${profile.fontSize}px` }, [profile])

  const go: Go = (t, sub) => {
    if (t === 'week' && sub && sub !== 'repair') setWeekView(sub)
    if (t === 'practice') setPractice(sub === 'repair' ? 'repair' : 'review')
    setTab(t)
  }
  if (!profile) return null
  const done = profile.currentWeek > 26

  return (
    <>
      <header className="top">
        <div className="brand"><span className="brand-mark" aria-hidden>CZ</span>Czech Lab</div>
        <span className="pill" title={`Week ${profile.currentWeek} of 26`}><span className="ring" style={{ '--p': Math.round(((profile.currentWeek - 1) * 5 + profile.currentDay) / 1.3) } as CSSProperties} />
          Week {Math.min(profile.currentWeek, 26)} · {DAYS[profile.currentDay]}</span>
        <button className="icon" aria-label="Settings" onClick={() => setTab('settings')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>
      <main key={tab}>
        {tab === 'today' && (done ? <h1>All 26 weeks done. Book the exam!</h1> : <Today profile={profile} refresh={refresh} go={go} />)}
        {tab === 'week' && <WeekScreen profile={profile} view={weekView} setView={setWeekView} />}
        {tab === 'practice' && <>
          <div className="tabs" role="tablist">
            <button className={practice === 'review' ? 'on' : ''} onClick={() => setPractice('review')}>Review cards</button>
            <button className={practice === 'repair' ? 'on' : ''} onClick={() => setPractice('repair')}>Repair from errors</button>
          </div>
          {practice === 'review' ? <Review profile={profile} onDone={() => setTab('today')} /> : <Repair profile={profile} />}
        </>}
        {tab === 'games' && <Games profile={profile} />}
        {tab === 'exam' && <Soon what="The four-part exam simulator with timers, scoring and the readiness gate" />}
        {tab === 'progress' && <Progress profile={profile} />}
        {tab === 'settings' && <Settings profile={profile} refresh={refresh} />}
      </main>
      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON[id]} /></svg>{label}
          </button>
        ))}
      </nav>
    </>
  )
}

function Repair({ profile }: { profile: Profile }) {
  const [drills, setDrills] = useState<ReturnType<typeof buildRepair> | null>(null)
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    db.attempts.filter((a) => !a.correct).toArray().then((wrong) => {
      const counts = new Map<string, number>()
      for (const a of wrong) counts.set(a.itemId, (counts.get(a.itemId) ?? 0) + 1)
      setDrills(buildRepair(counts))
    })
  }, [finished])
  if (!drills) return null
  if (!drills.length) return <p className="muted">No errors logged yet. Mistakes from drills and tests appear here.</p>
  if (finished) return <div className="card"><h2>Repair round done</h2><button className="primary" onClick={() => setFinished(false)}>Another round</button></div>
  return <DrillRunner drills={drills} mode="drill" rate={profile.ttsRate} onDone={() => setFinished(true)} />
}

const Soon = ({ what }: { what: string }) => <div className="card"><h1>Coming next</h1><p>{what} are planned for a later build slice.</p></div>
