// Shared by the app (tts.ts) and scripts/audio-texts.mjs: what is spoken for a text, and the file name of its recording.

/** "děkuju / děkuji" lists alternatives: say them with a pause, never "slash". */
export const speechText = (text: string) => text.replace(/\s*\/\s*/g, ', ').replace(/\s+/g, ' ').trim()

/** FNV-1a 32-bit hash of the spoken text, base 36: public/audio/<key>.mp3 */
export function audioKey(spoken: string) {
  let h = 0x811c9dc5
  for (const ch of spoken.normalize('NFC')) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
