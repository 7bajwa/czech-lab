import { useEffect, useRef, useState } from 'react'
import { tts } from '../lib/tts'

/** Plays a list of Czech lines one after another (tap again to stop). */
export function PlayAll({ lines, rate, label = 'Play all' }: { lines: string[]; rate: number; label?: string }) {
  const [on, setOn] = useState(false)
  const stop = useRef(false)
  useEffect(() => () => { stop.current = true; tts.stop() }, [])
  async function run() {
    if (on) { stop.current = true; tts.stop(); setOn(false); return }
    stop.current = false; setOn(true)
    for (const l of lines) { if (stop.current) break; await tts.speak(l, rate); await new Promise((r) => setTimeout(r, 600)) }
    setOn(false)
  }
  return <button className={on ? 'danger' : ''} onClick={run} disabled={!lines.length}>{on ? '■ Stop' : `▶ ${label}`}</button>
}
