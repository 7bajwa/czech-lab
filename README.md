# Czech Lab

A phone-first app for learning Czech, from zero to the **A2 exam for permanent residence** in 26 weeks.
It works offline and can be installed on the phone's home screen.

**Open it:** https://7bajwa.github.io/czech-lab/

## Install on your phone

- **Android (Chrome):** open the link → ⋮ menu → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** open the link → Share → *Add to Home Screen*.

After the first visit the app works without internet. When a new version is out, the app shows *A new version is ready → Reload*.
Your progress is stored only in the phone's browser: use **Settings → Save backup file** now and then, and **Restore from file** on a new phone.

## What's inside

| Tab | What you do there |
|---|---|
| **Learn** | The 26-week plan. Pick any week (‹ 1 … 26 ›) and any day, Mon–Fri plus a weekend revision. Each day has timed blocks: Pattern Lab, listening, drills, exercises, and a weekly test on Friday. You can redo any day. |
| **Study** | 30 core grammar topics with explanations and practice, and 27 *Everyday Czech* lessons (words, phrases, a dialogue). |
| **Review** | Spaced-repetition cards (FSRS): type the answer first, then rate yourself. *Repair & weak spots* replays your mistakes and your 3 weakest topics. |
| **Games** | Verbs (all persons; present, past and future, mixed), Cases (with an endings board), Sentences (simple → complex, each one explained), Words (42 topic groups), Frequency dictionary (5,000 words), Match (against the clock, words per minute), Flashcards (swipe to grade), Falling words, Phrasebook, Wordbook. Answer by picking, typing, speaking or building the sentence. |
| **Speak** | Role-play (43 everyday dialogues: alone, the app speaks the other side and listens to you; or read them with a friend), shadowing, pronunciation lab (minimal pairs, ř and other tongue twisters). |
| **Exam** | Three mock exams in the official A2 format (Reading, Listening, Writing, Speaking) with real timings and the pass marks: 42/70 written, 24/40 speaking. |

Every word and sentence has a recorded Czech voice, so it sounds the same on every device. Speech recognition (Speak mode) works in Chrome and Edge, on Android and desktop.

## The content lives in `Doc/`

The app is built from plain Markdown tables, so anyone can read and fix them:

| File | Content |
|---|---|
| `czech-26-week-curriculum.md` | The 26-week plan: weekly patterns, tasks, tests |
| `czech-vocabulary.md` | Words and sentences for each week |
| `czech-exercises.md` | 15 exercises per week |
| `czech-practice.md`, `czech-verbs-more.md`, `czech-sentences.md` | Verbs (219, all forms), case tables, sentence ladders |
| `czech-wordgroups.md` | 1,092 words in 42 topic groups |
| `czech-frequency.md` | The 5,000 most frequent Czech words |
| `parts/phrasebook-*.md`, `czech-wordbook.md` | Phrasebook (1,933 phrases by place) and its wordbook |
| `czech-roleplay.md` | Role-play dialogues |
| `czech-everyday.md` | Everyday Czech lessons |
| `czech-grammar.md`, `czech-weekend.md` | Grammar topics, weekend key points |
| `czech-exam.md` | Mock exams and the exam format |

Rows marked `AI` were written or translated with an AI assistant and still need a native speaker's check.

## Developing

```bash
cd app
npm ci
npm run parse      # Doc/*.md → src/data/*.json
npm test           # self-checks
npm run dev        # local dev server
npm run phone      # dev server reachable from a phone on the same Wi-Fi
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`).

**Voice clips:** after editing the docs, run `npm run audio-texts`, then `python scripts/make-audio.py <path to cs_CZ-jirka-medium.onnx>` in a Python environment with `piper-tts` and `ffmpeg` installed. Only missing clips are made.

Built with React, Vite, TypeScript, Dexie (IndexedDB) and ts-fsrs.

## Credits

- Voice: [Piper](https://github.com/rhasspy/piper), Czech voice *cs_CZ-jirka-medium* from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
- The Everyday Czech lesson topics follow the course outline of [Mluvte česky / Czech Online](https://www.czechonline.org/en/learning/courses/detail/everyday-czech) (Masaryk University). The lesson content is original.
- Exam format: [cestina-pro-cizince.cz](https://cestina-pro-cizince.cz/trvaly-pobyt/a2/en/). The mock exams are unofficial.
