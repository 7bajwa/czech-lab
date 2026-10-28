import { useEffect, useRef, useState } from 'react'
import { deckItems } from '../../lib/extra'
import { lexGrade, lexOrder, Rating, type LexItem } from '../../lib/lex'
import { cue } from '../../lib/feedback'
import { tts } from '../../lib/tts'
import { GameBar, Seg } from '../../components/GameBar'
import { useProfile } from '../../components/ProfileContext'
import { DeckPicker, firstDeck, type Deck } from './DeckPicker'

const NEW_CAP = 20
type Grade = typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy
// swipe direction → grade: ← Hard, → Easy, ↑ Good, ↓ Again
const SWIPE: Record<'left' | 'right' | 'up' | 'down', [Grade, string]> = { left: [Rating.Hard, 'Hard'], right: [Rating.Easy, 'Easy'], up: [Rating.Good, 'Good'], down: [Rating.Again, 'Again'] }

export function Flashcards({ onBack }: { onBack: () => void }) {
  const { profile } = useProfile()
  const [deck, setDeck] = useState<Deck>(firstDeck())
  const [dir, setDir] = useState<'cz-en' | 'en-cz'>('cz-en')
  const [session, setSession] = useState<LexItem[] | null>(null)
  const [info, setInfo] = useState<{ due: number; fresh: number } | null>(null)
  const items = deckItems(deck.source, deck.value)
  useEffect(() => { lexOrder(items).then((o) => setInfo({ due: o.due, fresh: o.fresh })) }, [deck, session]) // eslint-disable-line react-hooks/exhaustive-deps

  async function start(ahead: boolean) {
    const o = await lexOrder(items)
    setSession(ahead ? o.list.slice(0, 30) : o.list.slice(0, o.due + Math.min(o.fresh, NEW_CAP)))
  }
  if (session) return <DeckPlay cards={session} dir={dir} autoFlip={profile.autoFlip} rate={profile.ttsRate} onExit={() => setSession(null)} />
  const ready = info ? info.due + Math.min(info.fresh, NEW_CAP) : 0
  return (
    <>
      <GameBar title="Flashcards" onBack={onBack} disabled={!ready} onPlay={() => start(false)} />
      <div className="card form">
        <DeckPicker deck={deck} setDeck={setDeck} />
        <Seg value={dir} options={['cz-en', 'en-cz']} labels={{ 'cz-en': 'Czech → English', 'en-cz': 'English → Czech' }} onChange={(d) => setDir(d as 'cz-en' | 'en-cz')} />
        {info && <p className="small">{info.due} due · {info.fresh} new (max {NEW_CAP} new per session)</p>}
        {info && !ready && items.length > 0 && <p className="muted small">Nothing due here. <button className="link" onClick={() => start(true)}>Study ahead anyway</button></p>}
        <p className="muted small">Tap the card to flip it. Then swipe: ← Hard · → Easy · ↑ Good · ↓ Again (or use the buttons). Auto-flip timer: game settings ⚙.</p>
      </div>
    </>
  )
}

function DeckPlay({ cards, dir, autoFlip, rate, onExit }: { cards: LexItem[]; dir: 'cz-en' | 'en-cz'; autoFlip: number; rate: number; onExit: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [flipped, setFlipped] = useState(false)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [done, setDone] = useState(0)
  const [left, setLeft] = useState(autoFlip)
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const again = useRef(new Set<string>())
  const c = queue[0]

  useEffect(() => { if (c && dir === 'cz-en') tts.speak(c.cz, rate) }, [c, dir, rate])
  useEffect(() => {
    if (!c || flipped || !autoFlip) return
    const t0 = Date.now()
    const t = setInterval(() => { const l = autoFlip - (Date.now() - t0) / 1000; setLeft(l); if (l <= 0) flip() }, 100)
    return () => clearInterval(t)
  }, [c, flipped, autoFlip]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); flip() }
      const g = ({ '1': Rating.Again, '2': Rating.Hard, '3': Rating.Good, '4': Rating.Easy } as Record<string, Grade>)[e.key]
      if (g && flipped) grade(g)
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })

  if (!c) return <div className="card center"><h1>Deck done ✓</h1><p>{done} cards reviewed. They come back when they are due.</p><button className="primary" onClick={onExit}>Done</button></div>

  function flip() { if (flipped) return; setFlipped(true); if (dir === 'en-cz') tts.speak(c.cz, rate) }
  async function grade(g: Grade) {
    cue(g !== Rating.Again)
    await lexGrade(c.id, g)
    setFlipped(false); setDrag({ x: 0, y: 0 }); setDone((n) => n + 1); setLeft(autoFlip)
    // Again: see it once more at the end of this session
    const repeat = g === Rating.Again && !again.current.has(c.id)
    if (repeat) again.current.add(c.id)
    setQueue((q) => (repeat ? [...q.slice(1), c] : q.slice(1)))
  }
  const swipeOf = (x: number, y: number): keyof typeof SWIPE | null => Math.max(Math.abs(x), Math.abs(y)) < 70 ? null : Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down')
  const hint = flipped ? swipeOf(drag.x, drag.y) : null
  const front = dir === 'cz-en' ? c.cz : c.en, back = dir === 'cz-en' ? c.en : c.cz

  return (
    <div>
      <div className="row between"><span className="muted">{queue.length} left · {done} done</span><button className="link" onClick={onExit}>✕</button></div>
      <div className={'flash' + (flipped ? ' flipped' : '') + (start.current ? ' dragging' : '')}
        style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 25}deg)` }}
        onClick={() => { if (!moved.current) flip(); moved.current = false }}
        onPointerDown={(e) => { if (flipped) { start.current = { x: e.clientX, y: e.clientY }; moved.current = false; e.currentTarget.setPointerCapture(e.pointerId) } }}
        onPointerMove={(e) => { if (start.current) { const d = { x: e.clientX - start.current.x, y: e.clientY - start.current.y }; if (Math.abs(d.x) + Math.abs(d.y) > 8) moved.current = true; setDrag(d) } }}
        onPointerUp={() => { const s = swipeOf(drag.x, drag.y); start.current = null; if (s) grade(SWIPE[s][0]); else setDrag({ x: 0, y: 0 }) }}
        onKeyDown={(e) => e.key === 'Enter' && flip()}
        role="button" tabIndex={0} aria-label={flipped ? `Answer: ${back}` : 'Flip the card'}>
        <div className="face front" lang={dir === 'cz-en' ? 'cs' : undefined}><span>{front}</span>{!flipped && autoFlip > 0 && <i className="autoflip" style={{ width: `${(left / autoFlip) * 100}%` }} />}</div>
        <div className="face back" lang={dir === 'cz-en' ? undefined : 'cs'}><span>{back}</span>{c.note && <small className="muted">{c.note}</small>}
          <button className="link" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); tts.speak(c.cz, rate) }}>▶ {c.cz}</button></div>
        {hint && <div className={`swipe-hint ${hint}`}>{SWIPE[hint][1]}</div>}
      </div>
      {flipped ? <div className="grades">
        {([['Again', Rating.Again, '↓'], ['Hard', Rating.Hard, '←'], ['Good', Rating.Good, '↑'], ['Easy', Rating.Easy, '→']] as const).map(([l, g, a]) => <button key={l} onClick={() => grade(g)}>{a} {l}</button>)}
      </div> : <button className="primary wide" onClick={flip}>Flip</button>}
    </div>
  )
}
