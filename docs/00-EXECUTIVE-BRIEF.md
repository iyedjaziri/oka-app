# OKA – Executive development brief

Compiled 20 Nov 2026 from: the project synthesis, the French pitch, the 19/11 team document
(questionnaire, avatar creation steps, ethics sheet, sobriety report, to-do list) and an analysis of
`OKA-avatar-parlant.html` v3. Only what matters for development is kept.

---

## 1. Product in one paragraph
OKA is a red-panda avatar on a screen at home. She talks and listens in French, and works on three pillars:
**social link** (interest-based matching with three-way calls, live neighbourhood quiz / "Radio OKA",
CCAS and association activities, shared meals, chat between activity participants), **safety**
(spoken-emergency alert, alert when the person stops answering, appointment reminders, preventive weather),
and **well-being** (games, memories, seasonal recipes, general tips, verified help numbers).
The persona for the demo is Giselle, 84, Nice.

## 2. Current state of the code (v3)
Single HTML file, vanilla JS, 2D canvas avatar built from 9 embedded WebP images (one per expression),
lip sync by estimated syllable timing. Data in `localStorage` (`oka_*` keys).

Works today:
- Voice: Web Speech API (`say()` → `nextSentence()`), rate 0.85, sentence splitting; optional ElevenLabs (`speakEleven()`).
- Listening: Web Speech recognition fr-FR, stops after 2 s of silence or 25 s max.
- Answering: spoken-emergency regex `DANGER` first; then pending context; then demo mode (~40 keyword
  branches in `demoReply()`) or Claude mode (`claudeReply()` with action tags `[[ALERTE]]`, `[[APPEL:…]]`,
  `[[INSCRIPTION:…]]`, `[[AGENDA:…]]`, `[[ONGLET:…]]`, `[[JEU:…]]`, `[[EXPR:…]]`).
- Agenda (clash detection, reminders), live weather (geocoding + forecast, weather alerts),
  contacts (proches / soignants / aidants), CCAS activities + sign-up, chat rooms per activity
  (BroadcastChannel between tabs), 6 games with computer opponent (morpion, puissance 4, échecs,
  sudoku, scrabble, mémo), quiz, jokes, memories, seasonal themes, dark mode, emergency numbers for 12 countries.
- Alert: spoken emergency → calls emergency contacts one by one with a 30 s countdown each (simulated).

## 3. Gaps: what the specs promise vs what v3 does
| # | Spec says | v3 does | Size |
|---|---|---|---|
| G1 | 110 answer cards, keyword scoring, best card wins | ~40 hard-coded branches; no card data | L |
| G2 | Fixed 10-step answer pipeline, local first, Claude last | Claude mode sends everything to Claude | M |
| G3 | Local health + scope filters before any AI call, every mode | Health filter only in demo mode; no scope filter | M |
| G4 | Haiku 5.5 locked, 150 tokens, last 6 messages | Model is free text; 1024 tokens; 16 messages | S |
| G5 | Live counter "free answers vs AI answers" (shown to the jury) | Absent | S |
| G6 | Alert when the person doesn't answer / misses Radio OKA (check-in → relative → doctor) | Absent: only spoken emergencies trigger alerts | M |
| G7 | Radio OKA: morning show, live collective quiz, neighbourhood scores | Absent (solo quiz only) | M |
| G8 | Interest-based matching + three-way call, double consent | Absent (contact list only) | M |
| G9 | Onboarding questionnaire / profile form (see doc 01) | Profile has ~9 fields | L |
| G10 | Tu/vous choice | Always "vous" | S |
| G11 | Verified help numbers: 15, 18, 17, 112, Solitud'écoute, 3977 | Only emergency numbers per country | S |
| G12 | "What can I do today?": 3 ideas by time of day, booked into agenda | Proposes 1 next activity | S |
| G13 | Pause / Vacances / Hôpital mode (one click, home screen) | Absent | S |
| G14 | "OKA, efface mes informations" + "Mes données" space | Only "Effacer l'historique" and a full reset in settings | S |
| G15 | Hydration advice reminds to follow the doctor's advice if fluid restriction | Not present | S |
| G16 | Neutral agenda labels for health appointments ("Rendez-vous santé") | Free titles | S |
| G17 | Écran d'ouverture (calming photos, nature, heritage), PassMemo, seasonal recipes ("Manger Bouger") | Absent | M |
| G18 | Open-source warm French female voice, any browser | Browser voices (mechanical) | M–L, see doc 03 |
| G19 | Avatar doc describes a WebGL mesh-warped face (mouth interior, tongue, ears, nose) | v3 is 2D canvas, image swap | ? — check whether a v4 exists |

## 4. Target answer pipeline (stop at first match)
1. Game in progress → check the answer locally.
2. Voice commands and simple maths.
3. **Emergency words** (fall, chest pain, distress, "aidez-moi") → alert.
4. **Health filter** → refuse, offer to pass the question to the doctor.
5. Context: reply to OKA's last question.
6. Time, date, agenda, identity → computed locally.
7. Answer cards → keyword scoring, longer phrases score more, best card wins.
8. **Scope filter** → polite refusal + redirection (bank / family / CCAS / notary / neighbour).
9. Claude Haiku 5.5 (only online and with a key), action tags allowed.
10. Honest fallback: "Je ne sais pas" + an activity idea.
Every answer increments the free / AI counter.

Scope table: in scope = company, emotions, memories, agenda, reminders, transport, reading back the
treatment list validated by professionals, general well-being tips (sleep, water, food, movement, breathing,
memory, fall prevention), activities, games, culture, Nice (places, events, food, services), CCAS, associations,
help numbers, matching, family calls, alerts. Out of scope = symptoms, diagnosis, diseases, test results,
doses / mixing / stopping medication, diets and weight loss, politics and news, money / banking / taxes,
law / wills, IT and repairs, religion, gambling, weapons, sex, drugs.

## 5. Open decisions (the team must settle these; the docs contradict each other)
| # | Question | Sources disagree |
|---|---|---|
| D1 | **Alert escalation order** | Synthesis: relative → doctor. Questionnaire 8.x: relative 1 → relative 2 → doctor → request a check visit. Ethics sheet: soft prompt → trusted contact → CCAS (only if chosen). Sobriety report: alert relatives and invite the person to call emergency services. |
| D2 | **Delays** | Demo: 12 s + 10 s (v3 uses 30 s per contact). Synthesis: ~1 h in real life. Ethics: user chooses 24/48/72 h inactivity, then 2–4 h grace. Questionnaire 8.5: 2 missed calls in the morning / 1 full day / custom. |
| D3 | **Safety watch on or off by default** | Ethics: opt-in, off by default. Synthesis/pitch: always on. Suggestion: off by default in the product, on in the demo profile. |
| D4 | **Abuse help line** | Synthesis cites both "3133" and "3977". The national line against abuse of older people is **3977**; use it unless the team says otherwise. |
| D5 | **Who is the target** | Team comment on the questionnaire: "isn't it not only isolated people?" — resolved in the doc, but keep the profile generic (living alone is one option among others). |
| D6 | **Isolation score** | Rule refers to questions 2.4–2.6, which are not in the questionnaire. Either add them or drop the score. |
| D7 | **Supported browsers** | Older docs say Chrome or Edge; current decision: any modern browser. |
| D8 | **Questions marked red ("à supprimer ?")** in the questionnaire | Colours were lost in export: the team must say which ones. |

## 6. Inputs still missing (ask the team)
- The **110-card spreadsheet** (questions, keywords, answers, status column). Not provided yet.
- The **latest HTML** if newer than v3 (the Piper README refers to `OKA-avatar-parlant-4.html`).
- The **system prompt** text (to-do item, not written yet) and Iyed's **decision tree / knowledge base**.
- Avatar PNGs and logo (only needed if we touch visuals).

## 7. Suggested backlog (priority order)
1. Safety in every mode: local health + scope filters before Claude; lock model and limits (G2–G4).
2. Answer-card engine with a JSON card file + free/AI counter (G1, G5) — needs the spreadsheet.
3. Voice (G18) — see doc 03.
4. Absence-based alert + pause mode, following the team's decision D1–D3 (G6, G13).
5. Profile / onboarding from the questionnaire, tu/vous (G9, G10).
6. Matching + Radio OKA demo flows (G7, G8).
7. Smaller items: help numbers, 3 ideas of the day, data deletion command, neutral labels, hydration caveat (G11–G16).
8. Nice-to-have: opening screen, PassMemo, seasonal recipes (G17).
Each step: commit, run the scenarios in doc 04, rehearse the jury demo offline.
