import { useState, type ReactNode } from 'react'
import { useProfile } from './ProfileContext'

/** Game header: back to the games list on the left, settings and Play on the right. */
export function GameBar({ title, onBack, onPlay, playLabel = 'Play', disabled, backLabel = 'Games' }: { title: string; onBack: () => void; onPlay?: () => void; playLabel?: string; disabled?: boolean; backLabel?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="gamebar">
        <button className="back" onClick={onBack}>← {backLabel}</button>
        <h1>{title}</h1>
        <button className="icon" aria-label="Game settings" onClick={() => setOpen(true)}><Gear /></button>
        {onPlay && <button className="primary play" disabled={disabled} onClick={onPlay}>▶ {playLabel}</button>}
      </div>
      {open && <GameSettings onClose={() => setOpen(false)} />}
    </>
  )
}

export function GameSettings({ onClose }: { onClose: () => void }) {
  const { profile: p, save } = useProfile()
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet card form" role="dialog" aria-label="Game settings" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>Game settings</h2><button className="link" onClick={onClose}>✕</button></div>
        <Toggle label="Sound for right / wrong" on={p.sound} set={(v) => save({ sound: v })} />
        <Toggle label="Vibration for right / wrong" on={p.haptics} set={(v) => save({ haptics: v })} />
        <Toggle label="Speak the answer after I submit" on={p.audioAfter} set={(v) => save({ audioAfter: v })} />
        <label>Flashcards: flip by itself after
          <select value={p.autoFlip} onChange={(e) => save({ autoFlip: +e.target.value })}>
            {[0, 3, 5, 8, 12].map((s) => <option key={s} value={s}>{s ? `${s} seconds` : 'off (tap to flip)'}</option>)}
          </select></label>
        <label>Timed games: speed
          <select value={p.speed} onChange={(e) => save({ speed: e.target.value as 'gradual' | 'constant' })}>
            <option value="gradual">Gets faster with every word</option><option value="constant">Constant</option>
          </select></label>
        <label>Timed games: start speed
          <select value={p.level} onChange={(e) => save({ level: +e.target.value as 1 | 2 | 3 })}>
            <option value={1}>Easy (slow)</option><option value={2}>Medium</option><option value={3}>Hard (fast)</option>
          </select></label>
        <label>Speech speed ({p.ttsRate.toFixed(2)}×)<input type="range" min={0.5} max={1.3} step={0.05} value={p.ttsRate} onChange={(e) => save({ ttsRate: +e.target.value })} /></label>
      </div>
    </div>
  )
}

export const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
  <label className="check toggle"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {label}</label>
)

/** A select with ‹ › buttons either side, for stepping through verbs, ladders, categories. */
export function Stepper({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; label: string }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="stepper">
      <button aria-label={`Previous ${label}`} disabled={i === 0} onClick={() => onChange(options[i - 1].value)}>‹</button>
      <select aria-label={label} value={options[i]?.value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button aria-label={`Next ${label}`} disabled={i >= options.length - 1} onClick={() => onChange(options[i + 1].value)}>›</button>
    </div>
  )
}

/** The round "?" button that opens a study board and turns into ✕. */
export function HelpBoard({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="help-row"><button className={'help' + (open ? ' on' : '')} aria-expanded={open} aria-label={open ? 'Close' : `Show ${title}`} onClick={() => setOpen(!open)}>{open ? '✕' : '?'}</button>
        {!open && <span className="muted small">{title}</span>}</div>
      {open && <div className="board">{children}</div>}
    </>
  )
}

export function Seg({ value, options, labels, onChange }: { value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return <div className="tabs" role="radiogroup">{options.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{labels?.[o] ?? o}</button>)}</div>
}

/** Multi-select chips (e.g. present + past + future). Keeps at least one on. */
export function Chips({ value, options, labels, onChange }: { value: string[]; options: string[]; labels?: Record<string, string>; onChange: (v: string[]) => void }) {
  return <div className="tabs" role="group">{options.map((o) => {
    const on = value.includes(o)
    return <button key={o} aria-pressed={on} className={on ? 'on' : ''} onClick={() => { const v = on ? value.filter((x) => x !== o) : [...value, o]; if (v.length) onChange(v) }}>{on ? '✓ ' : ''}{labels?.[o] ?? o}</button>
  })}</div>
}

const Gear = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
