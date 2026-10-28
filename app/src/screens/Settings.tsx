import { useState } from 'react'
import { db, saveProfile, type Profile } from '../lib/db'
import { exportAll, importAll } from '../lib/backup'
import { tts } from '../lib/tts'
import { Toggle } from '../components/GameBar'

export function Settings({ profile, refresh }: { profile: Profile; refresh: () => void }) {
  const set = async (p: Partial<Profile>) => { await saveProfile(p); refresh() }
  const [msg, setMsg] = useState('')
  return (
    <>
      <h1>Settings</h1>
      <div className="card form">
        <label>Exam date<input type="date" value={profile.examDate} onChange={(e) => set({ examDate: e.target.value })} /></label>
        <label>New cards per day<input type="number" min={0} max={50} value={profile.newPerDay} onChange={(e) => set({ newPerDay: +e.target.value })} /></label>
        <label>Speech speed ({profile.ttsRate.toFixed(2)}×)<input type="range" min={0.5} max={1.3} step={0.05} value={profile.ttsRate} onChange={(e) => set({ ttsRate: +e.target.value })} /></label>
        <label>Font size ({profile.fontSize}px)<input type="range" min={14} max={26} value={profile.fontSize} onChange={(e) => set({ fontSize: +e.target.value })} /></label>
        <Toggle label="Sound for right / wrong answers (quiet)" on={profile.sound} set={(v) => set({ sound: v })} />
        <Toggle label="Vibration for right / wrong answers" on={profile.haptics} set={(v) => set({ haptics: v })} />
        <Toggle label="Speak the right answer after I submit" on={profile.audioAfter} set={(v) => set({ audioAfter: v })} />
        <label>Claude API key (optional, stored only in this browser)<input type="password" autoComplete="off" value={profile.apiKey} onChange={(e) => set({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" /></label>
        <p className="muted small">{tts.hasCzechVoice() ? 'Czech voice found.' : 'No Czech (cs-CZ) voice found in this browser: install one in your OS speech settings for correct pronunciation.'}</p>
      </div>
      <div className="card form">
        <h2>Backup</h2>
        <p className="muted small">Your progress lives only in this browser. Save a backup file now and then (e.g. to Google Drive), and restore it on a new phone.</p>
        <div className="row">
          <button className="primary" onClick={exportAll}>Save backup file</button>
          <label className="button">Restore from file<input type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f || !confirm('Replace ALL progress in this browser with this backup?')) return
            try { await importAll(f); setMsg('Restored ✓'); refresh() } catch (err) { setMsg((err as Error).message) }
          }} /></label>
        </div>
        {msg && <p className="small">{msg}</p>}
      </div>
      <button className="danger" onClick={async () => {
        if (!confirm('Delete ALL progress, cards and settings in this browser? This cannot be undone.')) return
        await db.delete(); location.reload()
      }}>Reset everything</button>
    </>
  )
}
