import { useState, type RefObject } from 'react'

const LETTERS = 'á č ď é ě í ň ó ř š ť ú ů ý ž'.split(' ')

/** On-screen Czech letters for keyboards without them; inserts at the cursor. */
export function CzechKeys({ input, value, onChange }: { input: RefObject<HTMLInputElement | null>; value: string; onChange: (v: string) => void }) {
  const [upper, setUpper] = useState(false)
  function insert(ch: string) {
    const el = input.current
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + ch + value.slice(end))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + 1, start + 1) })
  }
  return (
    <div className="keys" role="group" aria-label="Czech letters">
      <button type="button" className={upper ? 'on' : ''} aria-pressed={upper} onMouseDown={(e) => e.preventDefault()} onClick={() => setUpper(!upper)}>⇧</button>
      {LETTERS.map((l) => {
        const ch = upper ? l.toUpperCase() : l
        // mousedown preventDefault keeps focus (and the cursor) in the input
        return <button type="button" key={l} lang="cs" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}>{ch}</button>
      })}
    </div>
  )
}
