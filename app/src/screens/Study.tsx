import { useState } from 'react'
import grammarData from '../data/grammar.json'
import everydayData from '../data/everyday.json'
import { RolePlayer, type RolePlay } from './Speak'
import { tts } from '../lib/tts'
import type { Question } from '../lib/games'
import { withOptions, first } from '../lib/games'
import { md } from '../lib/md'
import { useProfile } from '../components/ProfileContext'
import { GameBar, Seg } from '../components/GameBar'
import { Runner, lexQuestions } from './Games'

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

type Row = { cz: string; en: string; note: string }
export type Lesson = { level: number; n: number; title: string; week: number; words: Row[]; phrases: Row[]; dialogue: RolePlay['lines'] }
export const EVERYDAY = everydayData as Lesson[]

/** Study: core grammar topics in learning order, and the Everyday Czech lessons. */
export function Study() {
  const [open, setOpen] = useState<Topic | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [part, setPart] = useState<'grammar' | 'everyday'>('grammar')
  if (open) return <TopicView t={open} onBack={() => setOpen(null)} />
  if (lesson) return <LessonView l={lesson} onBack={() => setLesson(null)} />
  return (
    <>
      <h1>Study</h1>
      <Seg value={part} options={['grammar', 'everyday']} labels={{ grammar: 'Grammar', everyday: 'Everyday Czech' }} onChange={(p) => setPart(p as 'grammar' | 'everyday')} />
      {part === 'everyday' ? <>
        <p className="muted small">Lessons on the topics of Masaryk University's Everyday Czech course (czechonline.org): words, phrases and a dialogue for each. Written by Claude (Doc/czech-everyday.md).</p>
        {!EVERYDAY.length && <p className="muted">The lessons are being written.</p>}
        {[1, 2].map((lv) => EVERYDAY.some((l) => l.level === lv) && <div key={lv}><h2>Level {lv}</h2>
          <ol className="topics">{EVERYDAY.filter((l) => l.level === lv).map((l) => (
            <li key={l.title}><button className="card topic" onClick={() => setLesson(l)}><b>{l.title}</b><span className="muted small">{l.words.length} words · {l.phrases.length} phrases · dialogue{l.week ? ` · fits week ${l.week}` : ''}</span></button></li>
          ))}</ol></div>)}
      </> : <>
      <p className="muted small">The core grammar, one topic at a time. Explanations written by Claude (Doc/czech-grammar.md).</p>
      {!GRAMMAR.length && <p className="muted">Grammar topics are being written (Doc/czech-grammar.md).</p>}
      <ol className="topics">{GRAMMAR.map((t) => (
        <li key={t.title}><button className="card topic" onClick={() => setOpen(t)}><b>{t.title}</b><span className="muted small">{t.level}{t.weeks.length ? ` · week ${t.weeks.join(', ')}` : ''} · {t.practice.length} exercises</span></button></li>
      ))}</ol>
      </>}
      <div className="card"><h2>More to read</h2><ul>{LINKS.map(([l, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{l}</a></li>)}</ul></div>
    </>
  )
}

const toLex = (rows: Row[], k: string) => rows.map((r) => ({ id: `ed:${r.cz}`, cz: r.cz, en: r.en, note: r.note || undefined, k }))

function LessonView({ l, onBack }: { l: Lesson; onBack: () => void }) {
  const { profile } = useProfile()
  const [mode, setMode] = useState<'pick' | 'type' | 'speak'>('pick')
  const [play, setPlay] = useState<'words' | 'phrases' | 'dialogue' | null>(null)
  if (play === 'dialogue') return <RolePlayer rp={{ title: l.title, place: l.title, a: 'you', b: 'the other person', week: l.week, lines: l.dialogue }} rate={profile.ttsRate} onBack={() => setPlay(null)} />
  if (play) return <Runner qs={lexQuestions(toLex(l[play], play), 'en-cz', `everyday-${l.title}`)} mode={mode} title={`${l.title} · ${play}`} rate={profile.ttsRate} onExit={() => setPlay(null)} />
  const List = ({ rows }: { rows: Row[] }) => <ul className="bank">{rows.map((r) => <li key={r.cz}><button className="link say" onClick={() => tts.speak(r.cz, profile.ttsRate)}>▶</button><b lang="cs">{r.cz}</b> <span className="muted">{r.en}</span>{r.note && <span className="muted small"> · {r.note}</span>}</li>)}</ul>
  return (
    <>
      <GameBar title={l.title} onBack={onBack} backLabel="Lessons" onPlay={l.dialogue.length ? () => setPlay('dialogue') : undefined} playLabel="Dialogue" />
      <div className="card form"><div className="muted small">Practise as</div>
        <Seg value={mode} options={['pick', 'type', 'speak']} labels={{ pick: 'Pick', type: 'Type', speak: 'Speak' }} onChange={(m) => setMode(m as 'pick' | 'type' | 'speak')} />
        <div className="row"><button className="primary" onClick={() => setPlay('words')}>Practise words</button><button className="primary" onClick={() => setPlay('phrases')}>Practise phrases</button><button onClick={() => setPlay('dialogue')}>Dialogue</button></div></div>
      <div className="card"><h2>Words</h2><List rows={l.words} /></div>
      <div className="card"><h2>Phrases</h2><List rows={l.phrases} /></div>
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
