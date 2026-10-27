import { useEffect, useState } from 'react'
import { State } from 'ts-fsrs'
import { db, type ErrorRow, type Profile, type WeeklyTest } from '../lib/db'
import { examStatus } from './Today'

type Stats = { retention: number | null; reviews: number; cards: number; produced: number; recognised: number; errors: ErrorRow[]; tests: WeeklyTest[]; sessions: number; reports: number }

export function Progress({ profile }: { profile: Profile }) {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => {
    (async () => {
      const since = Date.now() - 30 * 864e5
      const reviews = await db.attempts.where('ts').above(since).filter((a) => a.kind === 'review').toArray()
      const cards = await db.cards.toArray()
      setS({
        retention: reviews.length ? Math.round((reviews.filter((r) => r.correct).length / reviews.length) * 100) : null,
        reviews: reviews.length, cards: cards.length,
        produced: cards.filter((c) => c.mode === 'type' && c.fsrs.state === State.Review).length,
        recognised: cards.filter((c) => c.fsrs.state !== State.New).length,
        errors: await db.errors.toArray(),
        tests: await db.weeklyTests.orderBy('id').reverse().limit(6).toArray(),
        sessions: await db.sessions.filter((x) => x.finished).count(),
        reports: await db.reports.count(),
      })
    })()
  }, [])
  if (!s) return null
  const st = examStatus(profile)
  const byTag = Object.entries(s.errors.reduce<Record<string, number>>((m, e) => ({ ...m, [e.tag]: (m[e.tag] ?? 0) + e.count }), {})).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...byTag.map(([, n]) => n))

  return (
    <>
      <h1>Progress</h1>
      <div className="stats">
        <Stat label="Week" value={`${profile.currentWeek} / 26`} />
        <Stat label="Days to exam" value={st.days} note={st.onTrack ? 'on track' : 'behind'} />
        <Stat label="Card retention (30 d)" value={s.retention == null ? '–' : `${s.retention}%`} note="target 85-90%" />
        <Stat label="Cards" value={s.cards} note={`${s.recognised} seen · ${s.produced} produced`} />
        <Stat label="Sessions done" value={s.sessions} />
        <Stat label="Reviews (30 d)" value={s.reviews} />
      </div>
      <div className="card">
        <h2>Errors by tag</h2>
        {byTag.length ? byTag.map(([tag, n]) => (
          <div key={tag} className="bar"><span>{tag}</span><div><i style={{ width: `${(n / max) * 100}%` }} /></div><b>{n}</b></div>
        )) : <p className="muted">No errors logged yet.</p>}
      </div>
      <div className="card">
        <h2>Weekly tests</h2>
        {s.tests.length ? <ul>{s.tests.map((t) => <li key={t.id}>Week {t.week}: {Math.round((t.score / t.total) * 100)}% · {t.outcome}</li>)}</ul> : <p className="muted">No tests yet.</p>}
      </div>
      {s.reports > 0 && <p className="muted">{s.reports} item(s) reported for review.</p>}
    </>
  )
}

const Stat = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
  <div className="card stat"><div className="muted small">{label}</div><b>{value}</b>{note && <div className="muted small">{note}</div>}</div>
)
