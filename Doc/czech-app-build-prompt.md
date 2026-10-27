# Prompt: build "Czech Lab" from the 26-week curriculum

Paste everything below the line into your AI builder (Claude Code, Cursor, etc.) together with the file `czech-26-week-curriculum.md`.

---

## ROLE AND GOAL

You are building a mobile-first, installable web app (PWA) called **Czech Lab** that takes one learner from zero Czech to the **A2 exam for permanent residence** in **26 weeks** (5 sessions a week, 90 minutes each). The curriculum is in the attached `czech-26-week-curriculum.md`. It is the single source of truth for content. **Do not invent curriculum content; read it from that file.**

The learner is an adult who learns by **repetition** and by **understanding the pattern in his own words**. Previous apps failed him because they showed random words and streaks. This app must teach **grammar as a system**, move from **words → phrases → sentences → conversations**, train **speaking from week 1**, and **measure real readiness for the exam**.

## EXAM FACTS (build the simulator on these)

- Reading 25 pts / 40 min · Writing 20 pts / 25 min · Listening 25 pts / ~40 min · Speaking 40 pts / 15 min.
- Pass: **42 of 70** on the written block (R+W+L) and **24 of 40** on speaking. Failing either = repeat everything.
- Our readiness gate (higher than the pass mark): Reading ≥ 80%, Listening ≥ 80%, Writing ≥ 70%, Speaking ≥ 75% on **two consecutive full mocks**.
- Since 11 April 2026 the Writing and Speaking tasks changed (more interaction, more topics, more initiative, scored everyday vocabulary). Do not hard-code task types. Provide an **admin importer** where the user can add task definitions from the official Sample Tests and the 2026 handbook.

## STEP 0: CONVERT THE CURRICULUM

1. Parse `czech-26-week-curriculum.md` into `/data/curriculum.json` with this schema. Keep all text verbatim, including diacritics. Do not translate or correct the Czech.
2. Report any week where a field was missing.

```json
{
  "weeks": [
    {
      "week": 1,
      "phase": "Sound and survival",
      "title": "Sounds, greetings, survival Czech",
      "canDo": "...",
      "patternLab": ["bullet 1", "bullet 2"],
      "vocabA": [{"cz": "ano", "en": "yes"}],
      "vocabB": [{"cz": "ahoj", "en": "hi / bye"}],
      "sentences": [{"cz": "Dobrý den. Jak se máte?", "en": "Hello. How are you?", "chunk": false}],
      "speaking": "text",
      "writing": "text",
      "input": "text",
      "realLife": "text",
      "examLink": "text",
      "weeklyTest": "text",
      "mock": null
    }
  ]
}
```
- `chunk: true` for sentences marked ★ (learn whole, grammar comes later).
- Weeks 11, 22, 25, 26 have a `plan` table by day and a `mock` object (targets and gate).
- Preserve the weekly rhythm table as `/data/rhythm.json` (Mon-Fri day types and minute splits).

## THE STRUCTURE OF THE APP

**Navigation:** Today · Week · Practice · Speak · Exam · Progress.

### 1. Today (the daily plan)
- Generates today's 90-minute session from the week and weekday (Mon Understand, Tue Drill, Wed Sentences, Thu Speak, Fri Prove it) using `rhythm.json`.
- Starts with **Review** (spaced-repetition cards due) every day.
- Shows blocks with timers, progress, and "mark done". Today's real-life task is shown on Friday.
- If the learner misses days, the plan **shifts forward**; it never skips content. Show days remaining to the chosen exam date and whether he is on track.

### 2. Pattern Lab (per week)
- One screen per pattern from `patternLab`: short explanation, colour-coded examples, the question-word hook, a mini table that only shows forms unlocked so far.
- **"Say it in your words" box:** the learner types or speaks the rule; the LLM checks it against the pattern bullets and replies with what is right, what is missing, and one example. It never gives a long lecture.
- Directly followed by Drill Mode.

### 3. Drill Mode (production first)
Types: fill the ending · transform (nominative → accusative, present → past) · choose the case from the question word · reorder the words · translate EN → CZ by typing · listen and type · speak the sentence (STT check).
- **Each wrong answer shows the exact rule broken** and one corrected example.
- Drills are generated from the week's **vocabulary and sentence bank only**. Generated items must be validated against the curriculum vocabulary + an allowed-grammar list for that week and cumulative previous weeks. Mark LLM-generated items as `unverified` until a known-good check passes. Add a "Report an error" button on every item.
- Sentence ladder for each theme: word → phrase → sentence → 2-line dialogue → 6-line scene. Unlock rung by rung.

### 4. Spaced repetition (FSRS)
- Use the `ts-fsrs` library. Cards = chunks and sentences (not single words only). Each card: Czech, English, audio, tags (week, pattern), type.
- **Answer before reveal:** type or speak the answer. For spoken answers, compare the STT transcript to the target and show a diff.
- Every error auto-creates or boosts a card linked to the pattern.
- Daily cap on new cards (default 12) so reviews never explode.

### 5. Speak (the most important module)
- **Shadowing:** play a sentence at 0.75× then 1×, record, show text diff and waveform overlay.
- **Pronunciation lab:** minimal pairs (dal/dál, byt/být, vina/víno), ř drill, difficult clusters; scored by STT + phoneme similarity where available.
- **Role-play with an AI partner**, per week, from the `speaking` field: the partner uses **only vocabulary and grammar from weeks ≤ current**, short sentences, never switches to English unless the learner taps "Help". The correction appears in a **side panel after each turn**, not in the middle of speech. At the end: a summary with 3 errors, 3 good chunks, and a score on a 5-item rubric (task completion, vocabulary, grammar, fluency, pronunciation).
- **Exam-style speaking** (from Week 11 on, weekly in Weeks 22-26): 15 min timed simulation with an AI examiner in the official style, using the imported task definitions.

### 6. Listening, Reading, Writing
- Listening: graded clips (TTS now, real recordings later), 3 speeds, exam-style questions, transcript after 2 attempts, dictation mode.
- Reading: weekly short texts and exam-style items.
- Writing: weekly Friday task and exam-style tasks. LLM feedback uses a rubric (task completion, vocabulary, grammar, cohesion). The learner **rewrites** the corrected text; it is saved.

### 7. Exam simulator
- Four parts with real timers (40 / 25 / ~40 / 15 min), an answer-sheet UI, scoring with the gates (42/70, 24/40) **and** our higher readiness gate.
- Per-skill breakdown, mistakes by pattern, and "what to fix this week".
- Mocks scheduled automatically: Week 11, 22, 25 (×2), 26. Mocks are separate items from practice (don't repeat the same one twice).
- Clearly label AI-generated mocks "unofficial".

### 8. Progress and unlock rules
- **Weekly test** (auto-built from the week's vocabulary, patterns, a listening item, a speaking recording, and the writing task) unlocks the next week at **≥ 80%**.
  - 60-79%: a 2-day repair loop from the error log is inserted before moving on.
  - < 60%: repeat Wed-Fri of the week.
- **Error log:** each error tagged (case, gender, verb form, tense, word order, spelling, pronunciation, vocabulary). A weekly **Weakness Radar** drives the repair loops. The weakest 3 patterns get most of the review time.
- **Dashboard:** days to exam · readiness per skill vs the gate (R/L/W/S) · last mock scores · cards retention (target 85-90%) · speaking minutes · words learned (recognised vs produced) · week completion. Streaks are secondary and not the focus.
- **Real-life tasks:** weekly check-in with one sentence in Czech.

### 9. Settings
Exam date · daily minutes · new cards per day · speech engine choice · TTS speed · export/import of all data (JSON) · reset a week.

## TECH

- PWA (installable on Android and iPhone), offline-first, **local-first data in IndexedDB** (Dexie), no account required. Optional sync later.
- Front end: React + Vite (or SvelteKit) with TypeScript. Large tap targets. Light/dark theme. Fast first load.
- Scheduler: `ts-fsrs`.
- TTS: browser `speechSynthesis` with `cs-CZ` voice first; design the interface so a neural Czech TTS can be swapped in.
- STT: provider interface supporting (1) Whisper API, (2) local Whisper later, (3) Web Speech API as fallback. Store transcripts for the diff.
- LLM: provider interface (Claude API first) for Pattern Lab feedback, drill explanations, writing feedback, and the role-play partner. Use **structured JSON outputs** for error tags and rubric scores. API keys stored locally; never hard-coded.
- Never ship an LLM answer as correct Czech without validation against the curriculum or flagging it as unverified.

## DATA MODEL (minimum)

- `weeks`, `patterns`, `items` (cz, en, audio, tags, week, type, chunk)
- `cards` (item_id, due, stability, difficulty, reps, lapses)
- `attempts` (item_id/drill_id, response, correct, error_tags, ts)
- `sessions` (date, week, day_type, blocks_done, minutes)
- `weeklyTests` (week, scores per section, passed)
- `mocks` (date, parts scores, gate_met)
- `errors` (tag, pattern_id, count, last_seen)
- `profile` (exam_date, daily_minutes, current_week, current_day)

## QUALITY RULES

1. Czech correctness beats cleverness. Keep the curriculum text verbatim. Generated Czech is flagged until verified.
2. Never reveal the answer before the learner tries (type or speak first).
3. Corrections explain the rule in one sentence plus one example.
4. No English in the role-play partner unless "Help" is tapped.
5. Keep the UI uncluttered: one main action per screen.
6. Accessibility: font size control, high contrast, keyboard friendly, haptics optional.

## BUILD IN SLICES (stop after each slice and wait for my feedback)

**Slice 1: working prototype (build this now):**
- Convert the curriculum to JSON (Step 0).
- Week 1 and Week 2 end-to-end: Today screen with the day plan, Pattern Lab, Drill Mode (typed + listen-and-type), FSRS review with answer-before-reveal, TTS, and the weekly test with the 80% unlock rule.
- A simple dashboard (week, days to exam, retention, errors by tag).
- Local storage only.

**Slice 2:** speaking: shadowing, pronunciation lab, one role-play (Week 2 introductions) with the correction panel.
**Slice 3:** weeks 3-10 content wired in; error log, weakness radar, repair loops.
**Slice 4:** exam simulator (importer for official tasks, timers, scoring, gates) and Mock 1.
**Slice 5:** listening/reading/writing modules and AI writing feedback.
**Slice 6:** weeks 11-26 content, mocks scheduling, the readiness gate, polish, PWA install, data export.

Start with Slice 1. Before writing code, list the files you'll create and the libraries you'll use, then build.
