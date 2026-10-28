import { useState } from 'react'
import grammarData from '../data/grammar.json'
import type { Question } from '../lib/games'
import { withOptions, first } from '../lib/games'
import { md } from '../lib/md'
import { useProfile } from '../components/ProfileContext'
import { GameBar, Seg } from '../components/GameBar'
import { Runner } from './Games'

export type Topic = { title: string; level: string; weeks: number[]; body: string; practice: { prompt: string; cz: string; en: string }[] }
export const GRAMMAR = grammarData as Topic[]
export const topicsForWeek = (w: number) => GRAMMAR.filter((t) => t.weeks.includes(w))

export const topicQuestions = (t: Topic): Question[] => t.practice.map((p) => ({
  id: `gr:${t.title}:${p.cz}`, prompt: p.prompt, hint: p.en, target: p.cz, options: withOptions(p.cz, t.practice.map((x) => x.cz)),
  rule: `${p.prompt.replace(/\s*\([^)]*\)\s*$/, '').replace('___', first(p.cz))} — ${p.en}`, tag: 'case', pattern: `grammar-${t.title}`,
}))

const LINKS = [
  ['iLearnCzech grammar', 'https://grammar.ilearnczech.com/'],
  ['Czech Online grammar', 'https://www.czechonline.org/en/grammar'],
  ['Czech Online: Everyday Czech course', 'https://www.czechonline.org/en/learning/courses/detail/everyday-czech'],
]

/** Core grammar topics in learning order, each with a short explanation and a practice round. */
export function Study() {
  const [open, setOpen] = useState<Topic | null>(null)
  if (open) return <TopicView t={open} onBack={() => setOpen(null)} />
  return (
    <>
      <h1>Study</h1>
      <p className="muted small">The core grammar, one topic at a time. Explanations written by Claude (Doc/czech-grammar.md).</p>
      {!GRAMMAR.length && <p className="muted">Grammar topics are being written (Doc/czech-grammar.md).</p>}
      <ol className="topics">{GRAMMAR.map((t) => (
        <li key={t.title}><button className="card topic" onClick={() => setOpen(t)}><b>{t.title}</b><span className="muted small">{t.level}{t.weeks.length ? ` · week ${t.weeks.join(', ')}` : ''} · {t.practice.length} exercises</span></button></li>
      ))}</ol>
      <div className="card"><h2>More to read</h2><ul>{LINKS.map(([l, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{l}</a></li>)}</ul></div>
    </>
  )
}

export function TopicView({ t, onBack, backLabel = 'Study' }: { t: Topic; onBack: () => void; backLabel?: string }) {
  const { profile } = useProfile()
  const [mode, setMode] = useState<'type' | 'pick'>('type')
  const [play, setPlay] = useState(0)
  if (play) return <Runner key={play} qs={topicQuestions(t)} mode={mode} title={t.title} rate={profile.ttsRate} onExit={() => setPlay(0)} />
  return (
    <>
      <GameBar title={t.title} onBack={onBack} backLabel={backLabel} onPlay={t.practice.length ? () => setPlay(Date.now()) : undefined} playLabel="Practise" />
      <div className="card md-body" dangerouslySetInnerHTML={{ __html: md(t.body) }} />
      {t.practice.length > 0 && <div className="card form"><h2>Practice ({t.practice.length})</h2>
        <Seg value={mode} options={['type', 'pick']} labels={{ type: 'Type', pick: 'Pick' }} onChange={(m) => setMode(m as 'type' | 'pick')} />
        <button className="primary wide" onClick={() => setPlay(Date.now())}>Practise</button></div>}
    </>
  )
}
