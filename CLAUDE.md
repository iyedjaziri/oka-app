# OKA – Diwaging (avathon + pitch congress)

## What this project is
OKA is a talking red-panda AI companion (female, realistic 3D image, animated face, soft French voice)
for isolated older people living alone at home. Persona: Giselle, 84, widow, Nice.
Deployed through the CCAS (municipal social services): a social worker + a Diwaging advisor install it at home
and fill in the profile with the person and a health professional.
Core promise: an AI that reconnects people (neighbours, local services, family) instead of replacing human contact.
Success = more real outings and contacts, NOT more screen time.

Read first, in this order:
1. `docs/00-EXECUTIVE-BRIEF.md` – what to build, current state, gaps, open decisions, backlog
2. `docs/01-spec-profil-questionnaire.md` – onboarding questionnaire → profile data model
3. `docs/02-spec-securite-ethique.md` – safety, alert protocol, ethics rules that constrain the code
4. `docs/03-spec-voix-tts.md` – voice decision (open-source French TTS)
5. `docs/04-scenarios-test.md` – 20 test scenarios (normal / limit / trap)
6. `docs/05-architecture-deploiement.md` – MVP architecture (PWA + Supabase), onboarding, hosting, phased plan
7. `docs/06-mise-en-route.md` – repository layout, local run, deployment (GitHub Pages + Supabase)

## Main deliverable
The web app in `app/` (PWA, published on GitHub Pages) + the Supabase back end in `supabase/`.
See `docs/06-mise-en-route.md` for layout, commands and deployment.
- Vanilla JS, no framework, no build step. Comments in French. `app/js/01…13-*.js` are classic scripts
  loaded in order and sharing global scope (the v3 script split by section): keep that model.
- `app/js/12-compte.js`: device activation, announcements, AI relay. The API key lives only in Supabase secrets.
- `legacy/OKA-avatar-parlant-v3.html` is the original single file (huge base64 lines: never read them in full).
  `npm run build:single` regenerates a single offline file in `dist/` from `app/`.
- If the team provides a newer version (v4 may exist, with Piper / WebGL face), port its changes into `app/`.

## Language rules
- Everything OKA says or displays is in **French**. Short sentences, one question at a time, adult and warm tone,
  never infantilising or guilt-inducing.
- Formal "vous" by default; the profile may switch to "tu" (questionnaire 1.4) — all generated text must respect it.
- OKA speaks of herself in the feminine ("je suis contente").
- Code comments in French (keep the existing style). Docs and conversation with the team: English.

## Hard constraints
- Works in **any modern browser** (Chrome, Firefox, Safari, Edge), laptop or tablet, including older/reconditioned tablets.
- Works **offline** for everything except free Claude answers (local answers, agenda, games, face, voice).
- **Safety first, in every mode** (demo AND Claude): emergency phrases trigger the alert; health questions
  (symptoms, diagnosis, medication, doses) are never answered — redirect to the doctor; out-of-scope topics
  (politics, money, law, religion, gambling, weapons, sex, drugs, IT repair) get a polite refusal + redirection.
  Local filters run BEFORE any AI call.
- AI: Claude Haiku 5.5 only (`claude-haiku-5-5`), last resort after local answers; max ~150 output tokens,
  last 6 messages. Never on health.
- OKA always says she is an AI when relevant; never claims feelings she doesn't have; never tries to become
  the person's only friend; does not prolong conversations or send repeated solicitations.
- Demo data is fictional; calls, alerts and bookings are simulated.
- **No secrets in the repo**: never write an API key into a file. The AI key lives in Supabase secrets
  (`supabase secrets set`) or the git-ignored `supabase/functions/.env`; the optional ElevenLabs key is typed in the app settings.

## Working rules
- Use git; commit before every significant change so the demo can always be rolled back.
- Never regenerate whole files: make targeted edits.
- After changes, load the page in a headless browser and check for JS errors; run the relevant scenarios in
  `docs/04-scenarios-test.md`. The team tests voice and microphone by hand.
- When a spec doc and the code disagree, or two spec docs disagree, do not guess: check
  "Open decisions" in the executive brief and ask the team.
