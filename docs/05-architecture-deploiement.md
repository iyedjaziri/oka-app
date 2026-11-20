# Architecture and deployment (MVP)

Status: implemented as an MVP on 20 Nov 2026 (see `docs/06-mise-en-route.md`). Hosting choice and AI provider still open
(see "Open decisions" below). Change from the plan: no Vite; the app stays build-free (see §3).

## 1. Goal
Turn the single-file demo `OKA-avatar-parlant.html` into a **deployable, distributable web application** with
normal application management, while keeping it **visually identical** to the original file.

MVP scope:
- An installable web app (PWA) that updates itself and works offline.
- An authenticated, controlled back office (Diwaging / CCAS staff) to onboard and manage users.
- Real information sent to users after installation (CCAS announcements, activities).
- Data protection by design. Not HDS yet, but **no personal data kept on the server** apart from what onboarding needs.

Out of MVP scope: HDS certification, real SMS/phone alerts, absence-based alert, matching between households,
Radio OKA live. The architecture must allow them later.

## 2. Why the single HTML file is not enough
Web technology is the right choice: any browser, old tablets, no app store. The problem is a single
936 KB file with no server:

| Product need | Why a lone HTML file can't do it |
|---|---|
| Account creation / revocation, onboarding | No server, no identity. |
| Real information pushed to users | Nothing to fetch it from. |
| API key | Today typed into each user's browser; must live server-side. |
| Safety rules on AI (model, tokens, filters) | Enforced in the browser, so they can be bypassed. |
| Updates | You cannot re-send an HTML file to every tablet. |
| Offline neural voice (doc 03) | Cache Storage needs http(s); `file://` is not enough. |
| Later: absence alert, SMS, matching, Radio OKA | All need a server that sees several devices. |

## 3. Target architecture

```
 User's tablet (PWA)                              Supabase (EU region, or self-hosted)
 ┌──────────────────────────────┐                ┌──────────────────────────────────────┐
 │ Current OKA interface        │ ─ activation ─▶│ Auth: staff accounts + devices       │
 │ (same look, same code)       │                │ Postgres + Row Level Security        │
 │ Profile, contacts, agenda,   │ ◀ announcements│ Edge Function "ai-relay"             │
 │ history stay ON THE DEVICE   │ ─ AI question ▶│   (key server-side, no content logs) │
 └──────────────────────────────┘                │ Studio dashboard (team)              │
                                                 └──────────────────────────────────────┘
                                                               ▲
                              Back office (staff login) ───────┘
                              create beneficiaries, activate / revoke devices,
                              publish announcements
```

- **Front end**: the existing vanilla JS, split by section into classic scripts (same global scope as v3, so no
  logic change), served as a PWA (manifest + service worker). No framework, no bundler: GitHub Pages serves `app/`
  as-is. `tools/build-single.mjs` still produces a single HTML file for an offline jury demo.
- **Back end**: Supabase. Auth, Postgres with Row Level Security, Edge Functions, and the Studio dashboard to
  manage accounts securely. No custom Node server needed for the MVP.
- **Back office**: one extra page, same visual style as OKA, for staff. Studio remains available to the
  technical team.

## 4. Data: what is stored where

| Data | Where | Why |
|---|---|---|
| Beneficiary account: pseudonymous id, structure (CCAS), referent, status, activation date | Server | Minimum needed for onboarding and revocation. |
| Staff accounts: email, hashed password, role | Server (Supabase Auth) | Access control. |
| Announcements: text, target structure, dates | Server | Real information for users. |
| Profile, contacts, agenda, history, memories, game state | **Device only** (`localStorage`) | Nothing personal leaves the tablet. |
| Free questions sent to the AI | Pass through the relay, **never stored** | The relay also enforces safety rules and limits. |
| Messages between the person and their structure (staff, event partners) | Server, **deleted after 30 days**, visible only to that structure | The only personal content kept on the server (added 20 Nov 2026 for staff ↔ user messaging). Codes and passwords refused. |
| Free questions sent to a **local model** (station) | Stay on the team machine, never stored | Sobriety option, see doc 08. |

Consequence to accept for the MVP: if a tablet is lost or wiped, its profile is lost (re-done at a visit).
An encrypted backup can come later.

No health data on the server. Use the word "beneficiary" in the back office, not "patient".

## 5. Onboarding flow
1. A staff member creates the beneficiary in the back office. The server generates a **one-time activation code**
   (e.g. `NICE-4827`) and a QR code.
2. At the person's home: open the URL, add to home screen, type or scan the code. The device gets a long-lived,
   revocable session.
3. The profile is filled in on site (existing form, then the doc 01 questionnaire). It stays on the device.
4. Lost tablet → staff revoke the device in one click.

The older person **never has a password**. Staff log in with email + password (2FA recommended for admins).
Implementation detail to settle when building: a Supabase Edge Function exchanges the code for a session of a
device user created with the admin API.

## 6. Information sent to users
- Staff publish an announcement (workshop, shared meal, heatwave, town hall closure), targeted by structure.
- The tablet fetches announcements at startup and periodically, and caches them for offline use.
- OKA reads them aloud through the existing `say()` flow ("Bonjour Giselle, le CCAS vous informe…") and they feed
  the Sorties tab. Real CCAS activities can replace `demoActivities()` the same way.
- Web Push (outside the app) can come later. On iPad it needs the app installed on the home screen (iOS 16.4+).

## 7. AI relay
- Edge Function `ai-relay`: holds the API key as a secret, checks the device session, rate-limits per device.
- Runs the **local safety pipeline** (emergency → health → scope) server-side too, as a second barrier;
  the front end still filters first (works offline).
- Locks model and limits: `claude-haiku-5-5`, ~150 output tokens, last 6 messages (G4).
- Does not log conversation content.
- **Provider abstraction**: `anthropic` today; an `openai-compatible` provider (e.g. Ollama running a small
  local model) can be plugged in later. See decision D9. Same safety filters regardless of provider.
- The settings field "clé API" disappears from the user's Réglages.

## 8. Hosting options

### Free, managed
| Part | Option | Notes |
|---|---|---|
| Front end (static PWA) | Cloudflare Pages, GitHub Pages, Netlify | Free HTTPS, free subdomain (`*.pages.dev`, `*.github.io`, `*.netlify.app`). |
| Back end | Supabase free plan, EU region (Paris / Frankfurt) | Auth + DB + Edge Functions + Studio. Free projects pause after a period of inactivity; check current limits. US company with EU hosting. |
| Domain | Free subdomain above; own `.fr` ≈ 10 €/year (OVH, Gandi) | An own domain looks more trustworthy for CCAS partners. |

### Self-hosted (team machine as host)
- Supabase is open source and **self-hostable with Docker Compose**: Studio, Auth, Postgres, Edge runtime, all local.
- Exposing it with HTTPS without opening router ports:
  - **Cloudflare Tunnel**: quick tunnels give a random `trycloudflare.com` URL with no account; a stable URL needs a domain on Cloudflare.
  - **Tailscale Funnel**: free, stable `https://<machine>.<tailnet>.ts.net` URL.
- Caveats: the machine must stay on and awake; home connection uptime; WSL2 networking needs Docker Desktop
  (or Docker in WSL) and care with ports. If the host is down, tablets keep working offline (local answers, agenda,
  games) but lose AI and new announcements.
- Good for development and the jury demo; not for real users at scale.

Recommended path: develop against **self-hosted Supabase** locally, then deploy the same schema to Supabase
cloud (EU) or keep self-hosting, without code changes.

## 9. Data protection (MVP level)
- EU hosting, HTTPS everywhere, revocable sessions, Row Level Security on every table.
- Admin action log (who created / revoked what), with no personal content.
- "Mes données et ma vie privée" page in easy-to-read French (FALC).
- **AI transparency**: free questions go to Anthropic (USA) when the Claude provider is used. Say so plainly,
  ask for consent at activation, and allow a mode without AI (local answer cards only).
- Legal notices + privacy policy before any real user.

## 10. Visual fidelity guarantee
Before any refactor, capture reference screenshots (Playwright) of every screen: home, each tab, each game,
dark mode, phone and tablet widths. Every step must reproduce them pixel for pixel. Only three intended visible
changes, all in the existing style: an "Activer OKA" screen, the API key field removed from Réglages, announcements
shown in existing views.

## 11. Phased plan
0. **Baseline**: `git init`, reference commit, reference screenshots.
1. **Split, no logic change**: CSS → `style.css`, base64 images → `.webp` files, JS → modules following the
   existing sections (`STOCKAGE`, `VOIX`, `CERVEAU`, `AGENDA`, `JEUX`…). No build step.
2. **PWA**: manifest + service worker, installable, offline. Unblocks the voice plan (doc 03).
3. **Answer engine as a pure module**: safety pipeline testable with the doc 04 scenarios (G2–G4).
4. **Supabase**: schema + RLS, staff auth, activation codes, `ai-relay`, announcements.
5. **Back office page**: beneficiaries, devices, announcements.
6. **Deploy**: hosting choice, HTTPS, automatic updates, legal pages.

## 12. Open decisions (in addition to D1–D8 in the executive brief)
| # | Question |
|---|---|
| D9 | AI provider — implemented as a choice (doc 08): Claude Haiku 5.5 or a small local model via the station, both through the decision tree. Remaining question: which one by default in production? Small models are weaker in French and at following safety rules; local filters must stay first either way. |
| D10 | Who creates accounts: Diwaging only, or each CCAS for its own beneficiaries (roles + announcement targeting)? |
| D11 | Hosting: Supabase cloud EU, self-hosted on a team machine, or both (dev local / demo cloud)? Own domain or free subdomain? |
| D12 | Jury date: decides whether phases 1–2 happen before or after the demo. |
