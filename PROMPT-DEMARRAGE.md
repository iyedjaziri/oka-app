# First prompt to paste into Claude Code

Before pasting: open a terminal in this folder and run
`git init && git add . && git commit -m "OKA v3 de référence + dossier de dev"`

---

Read CLAUDE.md, then every file in docs/ in numerical order. Then analyse OKA-avatar-parlant.html in full,
without modifying anything. Skip the huge base64 image lines (use grep and line ranges).

Write docs/ANALYSE.md containing:

1. Architecture map: main sections of the file, key functions with line numbers, global state, persistence
   (localStorage), and how UI, avatar, voice and listening connect.
2. The answer pipeline step by step, from microphone or keyboard to OKA's spoken reply, in demo mode AND
   Claude mode. Show exactly where safety (emergencies, health, scope) is checked and where it is NOT.
3. Feature inventory: what really works, what is only simulated, what is unfinished.
4. Check every gap G1–G19 in docs/00-EXECUTIVE-BRIEF.md against the file: confirmed / already fixed /
   partly done, with line numbers.
5. Integration points for the voice plan in docs/03-spec-voix-tts.md (clip layer, live in-browser engine,
   fallback), reusing the existing audio + analyser lip-sync path. Don't pick an engine.
6. Integration points for the profile model in docs/01 and the safety rules in docs/02.
7. Risks for the live jury demo: likely bugs, browser compatibility (Chrome, Firefox, Safari), offline
   behaviour, API key stored in the browser.
8. Which scenarios in docs/04-scenarios-test.md pass today (by reading the code), and which fail.
9. A prioritised plan, and your questions for the team (including open decisions D1–D8).

Write in English. Quote French code and strings as they are. Don't change any code yet.
