// Record your own voice (MediaRecorder) so you can play it back next to the model sentence. Kept in memory only.
let rec: MediaRecorder | null = null
let chunks: Blob[] = []

export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  rec = new MediaRecorder(stream)
  rec.ondataavailable = (e) => chunks.push(e.data)
  rec.start()
}

/** Stops and returns an object URL of the recording (null if nothing was recording). */
export function stopRecording(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!rec || rec.state === 'inactive') return resolve(null)
    const r = rec
    r.onstop = () => { r.stream.getTracks().forEach((t) => t.stop()); resolve(URL.createObjectURL(new Blob(chunks, { type: r.mimeType }))) }
    r.stop(); rec = null
  })
}

export const playUrl = (url: string) => new Audio(url).play()
