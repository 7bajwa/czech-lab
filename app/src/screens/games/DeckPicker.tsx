import { SOURCES, deckOptions, type Source } from '../../lib/extra'
import { Seg, Stepper } from '../../components/GameBar'

export type Deck = { source: Source; value: string }
export const firstDeck = (source: Source = 'words'): Deck => ({ source, value: deckOptions(source)[0]?.value ?? '' })

/** Pick what to play with: a source (word groups, frequency, phrasebook…) and one of its categories. */
export function DeckPicker({ deck, setDeck, sources = SOURCES.map((s) => s.id) }: { deck: Deck; setDeck: (d: Deck) => void; sources?: Source[] }) {
  const opts = deckOptions(deck.source)
  return <>
    <div className="muted small">Play with</div>
    <Seg value={deck.source} options={sources} labels={Object.fromEntries(SOURCES.map((s) => [s.id, s.label]))} onChange={(s) => setDeck(firstDeck(s as Source))} />
    {opts.length ? <Stepper label="deck" value={deck.value} options={opts} onChange={(value) => setDeck({ ...deck, value })} /> : <p className="muted small">Nothing here yet.</p>}
  </>
}

export const bestKey = (game: string, d: Deck) => `best:${game}:${d.source}:${d.value}`
export function readBest(key: string) { try { return +(localStorage.getItem(key) ?? 0) } catch { return 0 } }
export function saveBest(key: string, v: number) { try { if (v > readBest(key)) localStorage.setItem(key, String(v)) } catch { /* private mode */ } }
