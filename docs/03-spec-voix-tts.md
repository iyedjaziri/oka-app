# Voice: open-source, warm, female, French

## Requirement
A warm female French voice, open source, working in **any modern browser** and **offline**.
Today: Web Speech API voices → mechanical, and the voice depends on the browser and OS
(Edge "Natural" voices are not an option: Edge-only and online-only).

## Current code (v3)
- `say(text, expr, done, opts)` → `splitSentences()` → `nextSentence(token)` per sentence.
- Web Speech path: `SpeechSynthesisUtterance`, rate `settings.rate` (0.85), lip sync via `lipStart()` /
  `onboundary` → `lipBoundary()`, Chrome keep-alive pause/resume, watchdog.
- ElevenLabs path: `speakEleven()` fetches MP3, plays through an `AnalyserNode`, sets `lip.vol` from RMS
  volume → lips follow the real audio. **Any new engine producing audio should reuse this audio + analyser path.**
- `stopSpeaking()` / `finishSpeaking()` handle cancellation and queued phrases (`sayQueue`).

## Candidates
| Engine | Where it runs | French female | License | Role |
|---|---|---|---|---|
| Kyutai Pocket TTS | Browser (WASM / ONNX, community ports), CPU | Estelle and others; voice cloning | Code MIT, weights CC-BY 4.0, per-voice licences | **Live voice, first choice** (to validate by ear and speed on a tablet) |
| Kokoro (kokoro-js) | Browser (Transformers.js, WebGPU/WASM) | `ff_siwis` only | Apache 2.0 | Live backup |
| Piper (`fr_FR-siwis-medium`, `upmc`) | Browser (WASM) | Siwis, Jessica | MIT | Live backup, most synthetic |
| Chatterbox Multilingual (Resemble AI) | Python + GPU (e.g. Colab) | Voice cloning from ~10 s, emotion control | MIT | **Pre-generated clips** for fixed lines |
| Kyutai TTS 1.6B | Python + GPU | Cloning from 10 s sample | CC-BY 4.0 | Alternative for clips |
| Voxtral TTS (Mistral) | GPU | Yes | CC BY-NC 4.0 → non-commercial only | Testing only |

## Target architecture (pending the team's listening test)
1. **Clip layer**: fixed sentences (answer cards, scenarios, quiz, jokes, refusals, Giselle greetings) pre-generated
   once with a warm cloned voice (Chatterbox), stored as audio files and indexed by a hash of the normalised text.
   If `say()` gets a sentence with a clip → play it (any browser, offline, best quality).
2. **Live layer**: dynamic sentences (times, names, Claude answers) → in-browser engine (Pocket TTS),
   cloned from the **same** consented reference recording, so OKA keeps one voice.
3. **Fallback**: Web Speech API (current code), then text + animation only.
Lips: driven by audio volume for layers 1–2 (existing analyser code), syllable timing for layer 3.

## Constraints and risks
- In-browser models are tens to hundreds of MB: download once, keep in Cache Storage. Caching requires the page
  to be served over http(s) (localhost or hosting, e.g. GitHub Pages) — **file:// is not enough**.
  The single-HTML deliverable then becomes "a page + model/clip files", or the page downloads the model on first run.
- Generation speed on a weak tablet must be measured; pre-generate frequent phrases at startup (as the Piper README did).
- Voice cloning only with the written consent of the voice owner (team rule).
- Respect each model's and each voice's licence; credit Kyutai / Resemble AI where required.
- `docs/README-piper-example.md` is an example only (download progress pill, cache name, "Tester la voix" button,
  engine selector in Réglages → Voix) — reusable UI ideas, not the chosen engine.
