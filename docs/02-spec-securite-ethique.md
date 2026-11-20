# Safety and ethics rules that constrain the code

Sources: ethics sheet ("Fiche éthique, cadre de conformité et gouvernance"), sobriety report, avatar
justification, synthesis. Only rules that change what the code must do are listed.
Regulatory status: a prevention / social-link tool, **not a medical device**, not a certified telecare service.

## Safety
- **Spoken emergencies** (fall, can't get up, chest pain, "au secours", "aidez-moi") → immediate alert, in every mode.
- **No medical decisions**: no diagnosis, no medication / dose advice. Offer to pass the question to the doctor.
  Emergencies → 15 (or the profile country's number).
- **No financial advice**; redirect to family, bank, CCAS.
- **Absence-based alert** (not implemented in v3), graduated:
  1. Soft check-in on screen, sound + visual ("Bonjour, tout va bien aujourd'hui ?"), answer by voice or one button.
  2. No answer after the grace delay → notify the first trusted contact, asking them to call or visit.
  3. Still nothing → next level (doctor and/or CCAS referent, depending on decision D1 and the person's consents).
  A human always checks an alert before any action. Exact order and delays: open decisions D1–D2.
- **Opt-in**: the watch is off by default; the person turns it on, chooses the delay and the contacts (D3).
- **Pause / Vacances / Hôpital** button on the home screen, one click, no justification asked → no false alerts.
- Missed-appointment alerts off by default; gentle wording ("Avez-vous pu vous rendre à votre rendez-vous ?").
- OKA regularly reminds people she is a computer program that relays to humans, not a person and not an
  emergency service.
- No permanent geolocation, no camera, no passive tracking.

## Help numbers OKA may give
15 (SAMU), 18 (pompiers), 17 (police), 112, Solitud'écoute (Petits Frères des Pauvres, free listening line),
3977 (abuse of older people). Emergency numbers already adapt to the profile country in v3 (`PAYS`).

## Conversation rules
- Adult, warm, never infantilising, never guilt-inducing: "Il fait chaud aujourd'hui, pensez à garder un verre
  d'eau fraîche à portée de main et à fermer les volets" — not "Vous n'avez pas assez bu !".
- Hydration advice always adds a reminder to follow the GP's advice in case of prescribed fluid restriction.
- Weather alerts only at relevant thresholds (yellow / orange / red vigilance, heat peaks); no over-notification.
- OKA does not simulate deep emotions, does not prolong conversations, sends no repeated solicitations,
  and steers toward real contacts (a neighbour, a relative, a workshop). She must never become "the only friend".
- Respect `sujetsEvites` from the profile (grief, politics, religion, health…).
- Distress → orient to a human (relative, Solitud'écoute, 15 if urgent).

## Matching and chat
- Double consent at every match; only first name + interests are shared (3.11).
- Profiles are pseudonymised: never show full surname, address or phone number.
- First meetings suggested in public / association places (CCAS premises, senior cafés, libraries).
- **Report / block** button on every match and chat; reports go to a local referent (simulated in the demo).
- Matching criteria are simple and declared by the user (transparent, no hidden scoring).

## Agenda and data
- Agenda is private by default; health appointments use neutral labels ("Rendez-vous santé").
- Reminders can be confirmed or cancelled in one gesture.
- Data minimisation: collect only what each feature needs. No photo or video required.
- Activity logs purged after 30 days (v3 keeps the last 150 log lines with no date limit).
- "OKA, efface mes informations" deletes all or part of the data; a "Mes données et ma vie privée" screen
  in plain, easy-to-read French (FALC).
- Transparency: the profile is stored on the device; free conversations are processed by Claude remotely.
  Production: EU/France HDS hosting, encryption, relay server holding the API key.

## Accessibility (RGAA AA target)
High contrast, large sans-serif text with a text-size control, large touch targets with spacing, no complex
gestures (no drag-and-drop, no fast double-click), subtitles for everything OKA says, max 2 navigation levels,
icons always paired with text. No infinite scroll, no autoplay chains. Light enough for old / reconditioned tablets.
