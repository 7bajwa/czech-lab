import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { getProfile, type Profile } from './lib/db'
import { setCueOptions } from './lib/feedback'
import { Learn, type Go } from './screens/Learn'
import { Review } from './screens/Review'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { ProfileContext } from './components/ProfileContext'

// Big content (phrasebook, frequency list, exams, grammar) loads only when its tab is opened
const Games = lazy(() => import('./screens/Games').then((m) => ({ default: m.Games })))
const Speak = lazy(() => import('./screens/Speak').then((m) => ({ default: m.Speak })))
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })))
const Exam = lazy(() => import('./screens/Exam').then((m) => ({ default: m.Exam })))
const Repair = lazy(() => import('./screens/Repair').then((m) => ({ default: m.Repair })))

// 24px stroke icons, drawn inline so the app has no icon dependency and works offline
const ICON: Record<string, string> = {
  learn: 'M4 6h16M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6M8 3v5M16 3v5M8 13h3v3H8z',
  study: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  practice: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
  games: 'M7 9h4M9 7v4M15 10h.01M18 12h.01M6 6h12a4 4 0 0 1 4 4v3a4 4 0 0 1-7 2.6L14 15h-4l-1 .6A4 4 0 0 1 2 13v-3a4 4 0 0 1 4-4z',
  speak: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  exam: 'M9 4h6l1 2h3v14H5V6h3zM9 12l2 2 4-4',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
}
const TABS = [['learn', 'Learn'], ['study', 'Study'], ['practice', 'Review'], ['games', 'Games'], ['speak', 'Speak'], ['exam', 'Exam']] as const
type Tab = (typeof TABS)[number][0] | 'progress' | 'settings'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('learn')
  const [practice, setPractice] = useState<'review' | 'repair'>('review')
  const [update, setUpdate] = useState(false)
  const refresh = () => getProfile().then((p) => { setCueOptions(p); setProfile(p) })
  useEffect(() => { refresh() }, [])
  useEffect(() => { const on = () => setUpdate(true); addEventListener('czechlab-update', on); return () => removeEventListener('czechlab-update', on) }, [])
  useEffect(() => { if (profile) document.documentElement.style.fontSize = `${profile.fontSize}px` }, [profile])

  const go: Go = (t, sub) => {
    if (t === 'practice') setPractice(sub === 'repair' ? 'repair' : 'review')
    setTab(t); scrollTo(0, 0)
  }
  if (!profile) return null

  return (
    <ProfileContext.Provider value={{ profile, refresh }}>
      <header className="top">
        <div className="brand"><span className="brand-mark" aria-hidden>CZ</span><span className="brand-name">Czech Lab</span></div>
        <span className="pill" title={`Week ${profile.currentWeek} of 26`}><span className="ring" style={{ '--p': Math.round(((profile.currentWeek - 1) * 5 + profile.currentDay) / 1.3) } as CSSProperties} />
          Week {Math.min(profile.currentWeek, 26)} · {DAYS[profile.currentDay]}</span>
        <button className="icon" aria-label="Progress" onClick={() => setTab('progress')}><Svg d={ICON.progress} /></button>
        <button className="icon" aria-label="Settings" onClick={() => setTab('settings')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>
      {update && <div className="update" role="status">A new version is ready. <button className="link" onClick={() => location.reload()}>Reload</button></div>}
      <main key={tab}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {tab === 'learn' && <Learn profile={profile} refresh={refresh} go={go} />}
          {tab === 'study' && <Study />}
          {tab === 'practice' && <>
            <div className="tabs" role="tablist">
              <button className={practice === 'review' ? 'on' : ''} onClick={() => setPractice('review')}>Review cards</button>
              <button className={practice === 'repair' ? 'on' : ''} onClick={() => setPractice('repair')}>Repair &amp; weak spots</button>
            </div>
            {practice === 'review' ? <Review profile={profile} onDone={() => setTab('learn')} /> : <Repair profile={profile} />}
          </>}
          {tab === 'games' && <Games profile={profile} />}
          {tab === 'speak' && <Speak />}
          {tab === 'exam' && <Exam />}
          {tab === 'progress' && <Progress profile={profile} go={go} />}
          {tab === 'settings' && <Settings profile={profile} refresh={refresh} />}
        </Suspense>
      </main>
      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); scrollTo(0, 0) }}>
            <Svg d={ICON[id]} />{label}
          </button>
        ))}
      </nav>
    </ProfileContext.Provider>
  )
}

const Svg = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
