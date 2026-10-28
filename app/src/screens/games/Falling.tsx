import { useEffect, useRef, useState, type FormEvent } from 'react'
import { check } from '../../lib/check'
import { deckItems } from '../../lib/extra'
import { lexGrade, lexOrder, Rating, type LexItem } from '../../lib/lex'
import { cue } from '../../lib/feedback'
import { tts } from '../../lib/tts'
import { CzechKeys } from '../../components/CzechKeys'
import { GameBar, Seg } from '../../components/GameBar'
import { useProfile } from '../../components/ProfileContext'
import { DeckPicker, bestKey, firstDeck, readBest, saveBest, type Deck } from './DeckPicker'

const SPEED = { 1: 28, 2: 42, 3: 60 } // px per second at the start
const LIVES = 3

export function Falling({ onBack }: { onBack: () => void }) {
  const { profile } = useProfile()
  const [deck, setDeck] = useState<Deck>(firstDeck())
  const [show, setShow] = useState<'en' | 'cz'>('en')
  const [queue, setQueue] = useState<LexItem[] | null>(null)
  const items = deckItems(deck.source, deck.value).filter((i) => i.cz.length < 40)
  if (queue) return <FallPlay queue={queue} show={show} deck={deck} level={profile.level} gradual={profile.speed === 'gradual'} rate={profile.ttsRate} onExit={() => setQueue(null)} />
  return (
    <>
      <GameBar title="Falling words" onBack={onBack} disabled={items.length < 3} onPlay={async () => setQueue((await lexOrder(items)).list)} />
      <div className="card form">
        <DeckPicker deck={deck} setDeck={setDeck} sources={['words', 'freq', 'week', 'phrases']} />
        <div className="muted small">Falling words show</div>
        <Seg value={show} options={['en', 'cz']} labels={{ en: 'English (type the Czech)', cz: 'Czech (type it fast)' }} onChange={(s) => setShow(s as 'en' | 'cz')} />
        <p className="muted small">Type the word in Czech and press Enter: it vanishes. {LIVES} words may land, then the game ends. Speed and start level: game settings ⚙.</p>
        {readBest(bestKey('falling', deck)) > 0 && <p className="small">Best here: <b>{readBest(bestKey('falling', deck))}</b> words</p>}
      </div>
    </>
  )
}

type Drop = { key: number; it: LexItem; x: number; y: number; gone?: 'hit' | 'miss'; goneAt?: number }

function FallPlay({ queue, show, deck, level, gradual, rate, onExit }: { queue: LexItem[]; show: 'en' | 'cz'; deck: Deck; level: 1 | 2 | 3; gradual: boolean; rate: number; onExit: () => void }) {
  const area = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const drops = useRef<Drop[]>([])
  const next = useRef(0)
  const [, frame] = useState(0)
  const [answer, setAnswer] = useState('')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [shake, setShake] = useState(false)
  const t0 = useRef(Date.now())
  const over = lives <= 0
  const speed = SPEED[level] * (gradual ? Math.pow(1.05, score) : 1)

  useEffect(() => {
    if (over) return
    let last = performance.now(), sinceSpawn = 99
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      const h = area.current?.clientHeight ?? 400
      sinceSpawn += dt
      const live = drops.current.filter((d) => !d.gone)
      if (!live.length || (sinceSpawn > 120 / speed + 1 && live.length < 5)) {
        sinceSpawn = 0
        const it = queue[next.current++ % queue.length]
        if (!live.some((d) => d.it.id === it.id)) drops.current.push({ key: now + Math.random(), it, x: 4 + Math.random() * 58, y: -30 })
      }
      for (const d of drops.current) if (!d.gone) {
        d.y += speed * dt
        if (d.y > h - 34) { d.gone = 'miss'; d.goneAt = now; cue(false); lexGrade(d.it.id, Rating.Again); setLives((l) => l - 1) }
      }
      drops.current = drops.current.filter((d) => !d.goneAt || now - d.goneAt < 600) // faded words leave after their animation
      frame((n) => n + 1)
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [over, speed, queue])
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => { if (over) saveBest(bestKey('falling', deck), score) }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  function fire(e: FormEvent) {
    e.preventDefault()
    if (!answer.trim()) return
    const hit = drops.current.filter((d) => !d.gone).sort((a, b) => b.y - a.y).find((d) => check(answer, d.it.cz, 'vocab').correct)
    if (hit) { hit.gone = 'hit'; hit.goneAt = performance.now(); cue(true); lexGrade(hit.it.id, Rating.Good); setScore((s) => s + 1); setAnswer(''); if (show === 'en') tts.speak(hit.it.cz, rate) }
    else { cue(false); setShake(true); setTimeout(() => setShake(false), 300) }
  }
  const minutes = (Date.now() - t0.current) / 60000

  if (over) return (
    <div className="card center"><h1>{score} words</h1><p className="big"><b>{Math.round(score / Math.max(minutes, 0.25))}</b> words per minute</p>
      <p className="muted">Missed words were marked to come back soon.</p><button className="primary" onClick={onExit}>Done</button></div>
  )
  return (
    <div className="card">
      <div className="row between"><span className="muted">{score} hit · {'♥'.repeat(Math.max(0, lives))}{'♡'.repeat(LIVES - Math.max(0, lives))}</span><button className="link" onClick={onExit}>✕</button></div>
      <div className="fall" ref={area} onClick={() => input.current?.focus()}>
        {drops.current.map((d) => <span key={d.key} className={'drop' + (d.gone ? ` ${d.gone}` : '')} lang={show === 'cz' ? 'cs' : undefined} style={{ left: `${d.x}%`, top: d.y }}>{show === 'en' ? d.it.en : d.it.cz}</span>)}
      </div>
      <form onSubmit={fire} className={shake ? 'shake' : ''}>
        <input ref={input} lang="cs" autoComplete="off" autoCapitalize="off" spellCheck={false} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type in Czech, Enter to fire" aria-label="Your answer" />
        <button className="primary" type="submit">Fire</button>
      </form>
      <CzechKeys input={input} value={answer} onChange={setAnswer} />
    </div>
  )
}
