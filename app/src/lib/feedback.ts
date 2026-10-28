// Quiet right/wrong cues: a short soft tone (Web Audio, no files) and a tiny vibration. Settings come from the profile.
import type { Profile } from './db'

let opts = { sound: true, haptics: true, audioAfter: true }
export const setCueOptions = (p: Profile) => { opts = { sound: p.sound, haptics: p.haptics, audioAfter: p.audioAfter } }
export const audioAfter = () => opts.audioAfter

let ctx: AudioContext | null = null
function tone(freqs: number[], type: OscillatorType, step: number) {
  ctx ??= new AudioContext()
  const t0 = ctx.currentTime
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain()
    o.type = type; o.frequency.value = f
    const t = t0 + i * step
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step) // low volume
    o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + step + 0.02)
  })
}

export function cue(ok: boolean) {
  try { if (opts.sound) ok ? tone([660, 880], 'sine', 0.08) : tone([240, 180], 'triangle', 0.12) } catch { /* no audio: ignore */ }
  if (opts.haptics) navigator.vibrate?.(ok ? 12 : [25, 40, 25])
}
