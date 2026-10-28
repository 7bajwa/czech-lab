import { useEffect, useRef, useState } from 'react'
import { deckItems } from '../../lib/extra'
import { lexGrade, lexOrder, Rating, type LexItem } from '../../lib/lex'
import { audioAfter, cue } from '../../lib/feedback'
import { shuffle } from '../../lib/games'
import { tts } from '../../lib/tts'
import { GameBar } from '../../components/GameBar'
import { useProfile } from '../../components/ProfileContext'
import { DeckPicker, bestKey, firstDeck, readBest, saveBest, type Deck } from './DeckPicker'

const PAIRS = 5
const START = { 1: 30, 2: 20, 3: 12 } // seconds in the time bank
const BONUS = 3, PENALTY = 2

/** Match Czech ↔ English against a draining time bank; each match refills it, and the drain speeds up (unless set to constant). */
export function Match({ onBack }: { onBack: () => void }) {
  const { profile } = useProfile()
  const [deck, setDeck] = useState<Deck>(firstDeck())
  const [game, setGame] = useState<{ queue: LexItem[] } | null>(null)
  const items = deckItems(deck.source, deck.value)
  if (game) return <MatchPlay key={String(game.queue[0]?.id)} queue={game.queue} deck={deck} level={profile.level} gradual={profile.speed === 'gradual'} rate={profile.ttsRate} onExit={() => setGame(null)} />
  return (
    <>
      <GameBar title="Match" onBack={onBack} disabled={items.length < PAIRS} onPlay={async () => setGame({ queue: (await lexOrder(items)).list })} />
      <div className="card form">
        <DeckPicker deck={deck} setDeck={setDeck} sources={['words', 'freq', 'week', 'phrases']} />
        <p className="muted small">Tap a Czech word, then its English meaning. Every match adds {BONUS} s, every miss costs {PENALTY} s. Words you miss come back sooner; words you always know wait longer.</p>
        {readBest(bestKey('match', deck)) > 0 && <p className="small">Best here: <b>{readBest(bestKey('match', deck))}</b> words per minute</p>}
      </div>
    </>
  )
}

function MatchPlay({ queue, deck, level, gradual, rate, onExit }: { queue: LexItem[]; deck: Deck; level: 1 | 2 | 3; gradual: boolean; rate: number; onExit: () => void }) {
  const q = useRef([...queue])
  const take = () => { const it = q.current.shift()!; q.current.push(it); return it } // cycle the deck so the game never runs dry
  const [left, setLeft] = useState<LexItem[]>(() => Array.from({ length: PAIRS }, take))
  const [right, setRight] = useState<LexItem[]>(() => shuffle(left))
  const [sel, setSel] = useState<{ side: 'l' | 'r'; id: string } | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [bank, setBank] = useState<number>(START[level])
  const [matches, setMatches] = useState(0)
  const missed = useRef(new Set<string>())
  const t0 = useRef(Date.now())
  const over = bank <= 0

  useEffect(() => {
    if (over) return
    let last = Date.now()
    const t = setInterval(() => {
      const now = Date.now(), drain = gradual ? Math.pow(1.04, matches) : 1
      setBank((b) => b - ((now - last) / 1000) * drain); last = now
    }, 100)
    return () => clearInterval(t)
  }, [over, matches, gradual])

  const elapsed = (Date.now() - t0.current) / 60000
  const wpm = Math.round(matches / Math.max(elapsed, 0.25))
  useEffect(() => { if (over) saveBest(bestKey('match', deck), wpm) }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  if (over) return (
    <div className="card center">
      <h1>{matches} matches</h1>
      <p className="big"><b>{wpm}</b> words per minute</p>
      <p className="muted">Best on this deck: {Math.max(readBest(bestKey('match', deck)), wpm)} wpm</p>
      <div className="row"><button onClick={onExit}>Done</button><button className="primary" onClick={onExit}>Play again</button></div>
    </div>
  )

  function tap(side: 'l' | 'r', it: LexItem) {
    if (!sel || sel.side === side) { setSel({ side, id: it.id }); if (side === 'l') tts.speak(it.cz, rate); return }
    const czId = side === 'l' ? it.id : sel.id
    const enId = side === 'r' ? it.id : sel.id
    setSel(null)
    if (czId === enId) {
      cue(true)
      lexGrade(czId, missed.current.has(czId) ? Rating.Hard : Rating.Good)
      if (audioAfter() && side === 'r') tts.speak(left.find((x) => x.id === czId)!.cz, rate)
      const fresh = (() => { for (let k = 0; k < q.current.length; k++) { const n = take(); if (!left.some((x) => x.id === n.id)) return n } return take() })()
      setLeft((l) => l.map((x) => (x.id === czId ? fresh : x)))
      setRight((r) => { const free = r.findIndex((x) => x.id === czId); const n = [...r]; n[free] = fresh; return n })
      setMatches((m) => m + 1)
      setBank((b) => Math.min(START[level] + 10, b + BONUS))
    } else {
      cue(false)
      missed.current.add(czId); lexGrade(czId, Rating.Again)
      setWrong(czId + enId); setTimeout(() => setWrong(null), 350)
      setBank((b) => b - PENALTY)
    }
  }
  const pct = Math.max(0, Math.min(100, (bank / (START[level] + 10)) * 100))

  return (
    <div className="card">
      <div className="row between"><span className="muted">{matches} matched · {wpm} wpm</span><button className="link" onClick={onExit}>✕</button></div>
      <div className={'timebar' + (pct < 25 ? ' low' : '')}><i style={{ width: `${pct}%` }} /></div>
      <div className="match">
        <div>{left.map((it) => <button key={it.id} lang="cs" className={(sel?.id === it.id && sel.side === 'l' ? 'sel ' : '') + (wrong?.startsWith(it.id) ? 'wrong' : '')} onClick={() => tap('l', it)}>{it.cz}</button>)}</div>
        <div>{right.map((it) => <button key={it.id} className={(sel?.id === it.id && sel.side === 'r' ? 'sel ' : '') + (wrong?.endsWith(it.id) ? 'wrong' : '')} onClick={() => tap('r', it)}>{it.en}</button>)}</div>
      </div>
    </div>
  )
}
