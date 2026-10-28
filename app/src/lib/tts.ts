// TTS behind a tiny interface. Recorded Piper clips (public/audio, made by scripts/make-audio.py) play when they exist,
// so every device hears the same neural voice; anything else falls back to the browser's speechSynthesis.
import { audioKey, speechText } from './audiokey'

export interface Tts { speak(text: string, rate?: number): Promise<void>; stop(): void; hasCzechVoice(): boolean }

const czVoice = () => speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('cs'))

export const browserTts: Tts = {
  speak(text, rate = 1) {
    return new Promise((resolve) => {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(speechText(text))
      u.lang = 'cs-CZ'
      const v = czVoice()
      if (v) u.voice = v
      u.rate = rate
      u.onend = u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  },
  stop: () => speechSynthesis.cancel(),
  hasCzechVoice: () => !!czVoice(),
}

let clips: Promise<Set<string>> | null = null
const loadClips = () => (clips ??= fetch('./audio/index.json').then((r) => (r.ok ? r.json() : [])).then((a: string[]) => new Set(a)).catch(() => new Set<string>()))
let current: { audio: HTMLAudioElement; done: () => void } | null = null

export const recordedTts: Tts = {
  async speak(text, rate = 1) {
    this.stop()
    const key = audioKey(speechText(text))
    if (!(await loadClips()).has(key)) return browserTts.speak(text, rate)
    return new Promise((resolve) => {
      const audio = new Audio(`./audio/${key}.mp3`)
      audio.playbackRate = rate
      current = { audio, done: resolve }
      audio.onended = () => { current = null; resolve() }
      audio.onerror = () => { current = null; browserTts.speak(text, rate).then(resolve) } // e.g. offline and not cached yet
      audio.play().catch(() => audio.onerror?.(new Event('error')))
    })
  },
  stop() {
    speechSynthesis.cancel()
    if (current) { current.audio.pause(); current.done(); current = null }
  },
  hasCzechVoice: () => true,
}

export const tts: Tts = recordedTts
