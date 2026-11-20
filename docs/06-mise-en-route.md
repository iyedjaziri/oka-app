# Getting started: run, test and deploy OKA

Architecture and rationale: `docs/05-architecture-deploiement.md`. This file is the how-to.

## Repository layout
```
app/                    the web app (published as-is on GitHub Pages, no build step)
  index.html            same markup as v3, plus the activation dialog
  css/oka.css           v3 styles, unchanged
  img/*.webp            the 9 avatar images (were base64 in v3) + logo
  audio/*.mp3           calm music playlist (list in js/14-ambiance.js; not in the offline cache)
  js/01-…13-*.js        v3 script split by section, loaded in order (shared global scope)
  js/12-compte.js       NEW: device activation, announcements, AI relay calls
  config.js             generated (git-ignored): server URL + public anon key
  sw.js, manifest.webmanifest, icons/   installable app, offline cache
  admin/                staff back office (login, beneficiaries, devices, announcements)
supabase/
  migrations/           database schema + Row Level Security
  functions/activer     activation code -> device token
  functions/annonces    announcements for a device
  functions/ia          AI relay through the decision tree (Claude Haiku 5.5, or a local model), quota
  functions/messages    tablet ↔ staff messaging (deleted after 30 days, codes refused)
  functions/evenements  City of Nice senior events (official nice.fr WordPress API, 15-min cache)
tools/                  config generator, local server, single-file build
legacy/                 the original v3 file, untouched
```

## 1. Front end only (no server)
```bash
npm install
npm run dev            # http://localhost:8000  ·  back office: /admin/
```
With an empty `config.js` OKA behaves exactly like v3 in demo mode: no activation, no free questions.

Single offline file for a demo on a USB key: `npm run build:single` → `dist/OKA-avatar-parlant.html`.
In that file only, Réglages avancés shows a "Clé API Claude – mode test" field: free questions then go straight
from the browser to Claude Haiku 5.5 (local health/scope filters first, no message or length cap). The key stays in
that browser's storage: never use this file on a distributed tablet. The served app never shows this field.

## 2. Full stack locally (Supabase in Docker)
Prerequisite: Docker usable by your user. Under WSL2: enable Docker Desktop's WSL integration, or
`sudo usermod -aG docker $USER` then open a new terminal.
```bash
npm run db:start                        # first run downloads the Supabase images (a few GB)
cp supabase/functions/.env.example supabase/functions/.env   # add ANTHROPIC_API_KEY
npm run fonctions                       # serves activer / annonces / ia (keep it running)
npm run config:local                    # writes app/config.js for the local Supabase
npm run dev
```
Supabase Studio: http://localhost:54323.

### First administrator
1. Studio → Authentication → Users → Add user (email + password).
2. Studio → SQL editor:
   ```sql
   insert into public.equipe (user_id, role, nom)
   select id, 'admin', 'Admin Diwaging' from auth.users where email = 'you@example.org';
   ```
3. http://localhost:8000/admin/ → log in → Structures: create "CCAS de Nice".

Other staff: create the user in Studio, then attach them in the back office (Équipe tab) with a role:

| Role | Can do |
|---|---|
| `admin` (Diwaging) | everything, all structures |
| `referent` (CCAS agent) | beneficiaries, activation codes, tablets, announcements, messages of their structure |
| `partenaire` (event provider: association, maison des seniors) | announcements and messages of their structure; no access to tablets or beneficiary settings |

### Messaging
Staff and partners answer in the back office (Messages tab); the person sees a room named after their structure
in the tablet's Messages tab, and OKA announces new messages once. Tablets check for new messages once a minute.
Messages are stored on the server (the only personal content stored there), visible only to the person's structure,
and deleted after 30 days. Messages containing a code, a password or a card number are refused on both sides.
Public sign-up is disabled (`enable_signup = false`).

### Onboarding a beneficiary
Back office → Bénéficiaires → add a reference (no full name) → "Code d'activation" →
on the tablet open the app URL, "Add to home screen", type the code → fill the profile on site.

## 3. Deploy

### Back end: Supabase cloud (free plan, EU region)
Create a project on supabase.com (region Paris or Frankfurt), then:
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase secrets set ANTHROPIC_API_KEY=... OKA_ORIGINES=https://<user>.github.io
npx supabase functions deploy activer annonces ia evenements messages --no-verify-jwt
```
In the dashboard: Authentication → Sign In / Providers → disable "Allow new users to sign up";
Authentication → URL Configuration → Site URL `https://<user>.github.io/<repo>/admin/`.

### Front end: GitHub Pages
1. Push the repo to GitHub.
2. Settings → Pages → Source: "GitHub Actions".
3. Settings → Secrets and variables → Actions → **Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   (Project Settings → API; the anon key is public by design, RLS protects the data).
4. Every push to `main` publishes `app/` (workflow `.github/workflows/pages.yml`), with a new offline-cache version.

Free HTTPS on `https://<user>.github.io/<repo>/`. A custom domain can be added later in Settings → Pages.

### Alternative: self-hosted back end
Run the local stack on a machine that stays on and expose it with Cloudflare Tunnel or Tailscale Funnel
(see doc 05 §8). Point `SUPABASE_URL` to that HTTPS address.

## 3b. Local station (small model and voice on a machine)
See `docs/08-sobriete-local.md`. In short: `ollama pull qwen2.5:1.5b`, install Pocket TTS in `.venv-voix`,
`npm run voix:clips` once, then `npm run station`. For a hosted deployment, the relay can also use a small model served by Ollama on a team machine (exposed with a tunnel):
`npx supabase secrets set IA_FOURNISSEUR=local IA_URL=<Ollama address> IA_MODELE=qwen2.5:1.5b` (the decision tree runs in the relay either way).

## 4. Checks after a change
- Load the app and the back office, check the browser console (no errors).
- Run the scenarios in `docs/04-scenarios-test.md` (demo mode and free-question mode).
- Device flow: activate with a code, see announcements in "Aujourd'hui" / "Sorties", revoke from the
  back office → the tablet asks for a new code at the next sync.

## Known limits (MVP)
- Profile, agenda and history live on the tablet only: a wiped tablet means redoing the profile.
- Demo data (Giselle's agenda, sample activities, simulated chat) is still present on real tablets.
- Client-side health and scope filters before the AI call are not done yet (backlog G3); the server
  filters every free question, so nothing reaches the model unfiltered.
- The back office was tested up to the login screen only; the staff flows need a running Supabase.
