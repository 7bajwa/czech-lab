// TTS behind a tiny interface so a neural Czech voice can replace speechSynthesis later.
export interface Tts { speak(text: string, rate?: number): Promise<void>; hasCzechVoice(): boolean }

const czVoice = () => speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('cs'))

export const browserTts: Tts = {
  speak(text, rate = 1) {
    return new Promise((resolve) => {
      speechSynthesis.cancel()
      // "děkuju / děkuji" lists alternatives: say them with a pause, never "slash"
      const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ', '))
      u.lang = 'cs-CZ'
      const v = czVoice()
      if (v) u.voice = v
      u.rate = rate
      u.onend = u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  },
  hasCzechVoice: () => !!czVoice(),
}

export const tts: Tts = browserTts
