# Energy sobriety: small local models, local voice, measured consumption

Status: v1, 20 Nov 2026. Goal: show that OKA can run most of its intelligence on a modest machine, with small models,
and measure what it costs in energy, instead of sending everything to a large cloud model.

## 1. The principle: the cheapest answer first
1. **No AI at all** for most requests: the decision tree (doc 07) answers locally: agenda, weather, games, outings,
   safety barriers. This is the biggest saving: these requests cost nothing beyond the tablet itself.
2. **Pre-recorded voice** for fixed sentences (safety answers, common phrases): generated once, played many times.
3. **A small local model** (1.5 billion parameters, on the machine's processor) for free questions, through the same
   decision tree (classifier, answer, output check).
4. **Claude Haiku 5.5** only when the local model is off or not chosen.

The app shows counters in Réglages avancés › Station locale et sobriété: requests handled without AI, by the local
model, by Claude, sentences read from recordings, and the estimated energy of local computation.

## 2. The local station
`npm run station` starts a small server on the machine (`tools/station.mjs`, port 8787):

| Endpoint | Role |
|---|---|
| `GET /etat` | Which services are up (local model, voice), cumulated consumption since start |
| `POST /ia` | Relays a request to Ollama (small model) and measures its processor time |
| `GET /voix`, `POST /voix/tts` | Voice list; text to speech with Pocket TTS (French model, int8), measured |

The app (online or the single demo file) checks the station every 30 s **only if it is used** (local model or local
voice chosen, address set, or demo file). Stop the station with Ctrl+C: the app switches to Claude (if allowed) and the
browser voice; start it again: the app uses it again. This is the "up and down" demonstration.

The decision tree always runs in the app, so a small model follows exactly the same safety rules as Claude.

## 3. How consumption is measured (and what is only estimated)
- **Measured:** processor time of the model processes (Ollama, Pocket TTS) for each request, read from Linux
  (`/proc/<pid>/stat`), plus wall-clock duration.
- **Estimated:** energy = processor power × processor time ÷ number of logical processors
  (`tools/energie.mjs`). Default power: 15 W (Intel i7-8565U nominal power); set `OKA_WATTS_CPU` to your machine's value.
- **Not measured:** the machine at rest, the screen, the network. Under WSL there is no access to the processor's
  energy counters (RAPL), so this is the *marginal* energy of the computation. For a jury demo, a plug-in wattmeter
  between the machine and the wall gives a real reading to compare with.
- **Claude:** its energy cannot be measured from here and Anthropic does not publish a per-request figure; the app only
  counts how many requests went to Claude.

## 4. Choices and why
| Need | Choice | Why |
|---|---|---|
| Local model | `qwen2.5:1.5b` via Ollama (~1 GB) | Fits in the 3.9 GB of memory available to WSL on the test laptop, runs on processor only. A 3–4 B model (e.g. `qwen2.5:3b`, `llama3.2:3b`) is better but needs ~3 GB free. |
| Voice | Pocket TTS (Kyutai), French model, int8 | Open source (MIT code), runs on processor, French voice Estelle plus about twenty other timbres usable with the French model, voice cloning with consent. |
| Voice on a weak machine | Pre-recorded fixed sentences (`npm run voix:clips`) | On the test laptop, live synthesis is slower than speech; recordings cost nothing at use time, work offline and in the demo file. |
| Small-model accuracy | Few-shot examples in the tree (doc 07) | Small models classify much better with a few examples per category. |

Voice cloning: Pocket TTS can clone a voice from a short recording. Only with the written consent of the person
recorded (team rule, and Kyutai's terms forbid cloning without consent). Not enabled by default.

## 5. Install and run (team machine)
```bash
# local model
ollama pull qwen2.5:1.5b
# local voice (CPU-only PyTorch, ~1.2 GB on disk)
python3 -m venv .venv-voix
.venv-voix/bin/pip install pocket-tts --extra-index-url https://download.pytorch.org/whl/cpu
# pre-record the fixed sentences once (a few minutes)
npm run voix:clips
# start the station
npm run station
```
In the app: Réglages avancés › Station locale et sobriété › "Petit modèle local", and Voix › "Voix IA locale".
Voice samples to listen to: `exemples-voix/*.wav` (generated locally, not in git).

WSL memory: by default WSL gets a fraction of the PC's memory. To run a 3 B model and the voice together, raise it in
`C:\Users\<you>\.wslconfig` (`[wsl2]` then `memory=8GB`) and restart WSL (`wsl --shutdown`).

## 6. Measurements on the test laptop
<!-- debut:mesures -->
<!-- fin:mesures -->
