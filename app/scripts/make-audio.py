# Speaks scripts/audio-texts.json with the Piper voice cs_CZ-jirka-medium into public/audio/<h>.mp3 (+ index.json).
# Only missing files are made, so it can be re-run after editing the docs.
# Usage: <venv with piper-tts>/python make-audio.py <voice.onnx> [--limit N]
import json, subprocess, sys, wave, io, os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from piper import PiperVoice

here = Path(__file__).resolve().parent
out = here.parent / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
items = json.loads((here / 'audio-texts.json').read_text(encoding='utf8'))
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
voice = PiperVoice.load(sys.argv[1])

def encode(wav: bytes, dest: Path):
    # mono 22 kHz MP3 at 24 kbps: small, and plays on every phone
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-ac', '1', '-b:a', '24k', str(dest)], input=wav, check=True)

todo = [it for it in items if not (out / f"{it['h']}.mp3").exists()][:limit]
print(f'{len(items)} texts, {len(todo)} to make', flush=True)
with ThreadPoolExecutor(6) as pool:
    for n, it in enumerate(todo, 1):
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            voice.synthesize_wav(it['text'], wf)
        pool.submit(encode, buf.getvalue(), out / f"{it['h']}.mp3")
        if n % 500 == 0: print(n, flush=True)

have = sorted(p.stem for p in out.glob('*.mp3'))
(out / 'index.json').write_text(json.dumps(have), encoding='utf8')
print('done:', len(have), 'files', flush=True)
