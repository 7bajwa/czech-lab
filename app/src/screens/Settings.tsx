import { db, saveProfile, type Profile } from '../lib/db'
import { tts } from '../lib/tts'

export function Settings({ profile, refresh }: { profile: Profile; refresh: () => void }) {
  const set = async (p: Partial<Profile>) => { await saveProfile(p); refresh() }
  return (
    <>
      <h1>Settings</h1>
      <div className="card form">
        <label>Exam date<input type="date" value={profile.examDate} onChange={(e) => set({ examDate: e.target.value })} /></label>
        <label>New cards per day<input type="number" min={0} max={50} value={profile.newPerDay} onChange={(e) => set({ newPerDay: +e.target.value })} /></label>
        <label>Speech speed ({profile.ttsRate.toFixed(2)}×)<input type="range" min={0.5} max={1.3} step={0.05} value={profile.ttsRate} onChange={(e) => set({ ttsRate: +e.target.value })} /></label>
        <label>Font size ({profile.fontSize}px)<input type="range" min={14} max={26} value={profile.fontSize} onChange={(e) => set({ fontSize: +e.target.value })} /></label>
        <label>Claude API key (stored only in this browser)<input type="password" autoComplete="off" value={profile.apiKey} onChange={(e) => set({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" /></label>
        <p className="muted small">{tts.hasCzechVoice() ? 'Czech voice found.' : 'No Czech (cs-CZ) voice found in this browser: install one in your OS speech settings for correct pronunciation.'}</p>
      </div>
      <button className="danger" onClick={async () => {
        if (!confirm('Delete ALL progress, cards and settings in this browser? This cannot be undone.')) return
        await db.delete(); location.reload()
      }}>Reset everything</button>
    </>
  )
}
