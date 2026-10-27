// Speech-to-text behind a small interface: Web Speech API now, Whisper (API or local) can be swapped in later.
export interface Stt { supported(): boolean; listen(lang?: string): Promise<string> }

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: (e: { error: string }) => void; onend: () => void }
const Ctor = () => (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

export const webSpeechStt: Stt = {
  supported: () => !!Ctor(),
  listen(lang = 'cs-CZ') {
    return new Promise((resolve, reject) => {
      const R = Ctor()
      if (!R) return reject(new Error('Speech recognition is not available in this browser.'))
      const r = new R()
      r.lang = lang; r.interimResults = false; r.maxAlternatives = 1
      let text = ''
      r.onresult = (e) => { text = e.results[0][0].transcript }
      r.onerror = (e) => reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied.' : `Speech recognition error: ${e.error}`))
      r.onend = () => resolve(text)
      r.start()
    })
  },
}

export const stt: Stt = webSpeechStt
