# Profile and onboarding questionnaire → data model

Source: "OKA – Questionnaire d'accueil et de configuration" (team doc, 19/11).
Asked aloud by OKA (or filled with a relative / carer / advisor) at first contact. 10–12 min, possibly in
2–3 sessions (OKA resumes where she stopped). Any question can be skipped ("je préfère ne pas répondre").
Only sections 8 (alert) and 9 (consents) are required to activate safety features.
OKA re-asks key questions every 3 months (interests, contacts, mobility, appointments).
Questions must stay short, with simple answers (yes/no, a choice, a word).

Existing v3 profile keys: `prenom, nom, age, seule, ville, pays, gouts, souvenir, people[{nom, lien, tel, type: proche|soignant|aidant, urgence}]`.
Below: proposed keys (keep existing ones, extend). French option labels are kept as they will be spoken.

## 1. Faire connaissance → personalisation
| Key | Question | Answers |
|---|---|---|
| `appel` | 1.1 Comment souhaitez-vous que je vous appelle ? | prénom / Madame / Monsieur / surnom |
| `naissance` | 1.2 Date de naissance | free (derive `age`) |
| `ville` | 1.3 Ville | free (drives weather, CCAS, emergency numbers) |
| `tutoiement` | 1.4 « tu » ou « vous » ? | tu / vous (default vous) |
| `foyer` | 1.5 Vivez-vous seul(e) ou avec quelqu'un ? | seul(e) / en couple / chez un proche / autre / avec animal(aux) |

## 2. Quotidien et liens
| Key | Question | Answers |
|---|---|---|
| `aQuiAppeler` | 2.7 Avez-vous quelqu'un à appeler en cas de besoin ? | plusieurs / une / non → name, first name, number into `people` |
| `attentes` | 2.8 Qu'aimeriez-vous le plus avec OKA ? | discuter / rencontrer des gens / infos du quartier / sécurité / ne pas oublier mes rendez-vous / autre |
Note: an isolation score is defined on questions 2.4–2.6, which don't exist yet (open decision D6).

## 3. Centres d'intérêt et mise en relation → matching
| Key | Question | Answers |
|---|---|---|
| `journee` | 3.1 Qu'aimez-vous faire de vos journées ? | free text → keywords |
| `interets[]` | 3.2 Activités qui plaisent | jardinage, cuisine, lecture, musique et chant, cinéma et séries, jeux de société et cartes, mots croisés et jeux de lettres, histoire et patrimoine, voyages, sport doux et marche, bricolage, couture et tricot, animaux, religion ou spiritualité, actualité, autre |
| `metier` | 3.3 Métier ou passion à raconter | free (feeds `souvenir`) |
| `origine` | 3.4 D'où venez-vous, où avez-vous vécu ? | free |
| `langues[]` | 3.5 Langues parlées | free |
| `matchOk` | 3.6 Mise en contact avec quelqu'un qui partage vos goûts ? | oui / au cas par cas / non |
| `matchPref` | 3.7 Avec qui ? | sexe (homme/femme/peu importe), zone (quartier/ville/peu importe), âge (mon âge/plus jeune: bénévole, étudiant/peu importe), autre |
| `matchFormat` | 3.8 Comment parler ? | à deux / à trois avec OKA qui anime / petit groupe |
| `matchDispo` | 3.9 Disponibilités pour un appel à plusieurs | free slots |
| `sujetsEvites[]` | 3.10 Sujets à éviter | deuil, politique, religion, santé… (OKA must avoid them) |
| `partageProfil` | 3.11 Partager seulement prénom + centres d'intérêt ? | oui / non (double consent required at every match) |

## 4. Quiz en direct → Radio OKA
`quizOk` (oui / j'essaie / non), `quizThemes[]` (culture générale, chansons d'autrefois, cinéma, histoire,
géographie, nature et jardin, cuisine, proverbes et expressions, sport, mémoire du quartier, blind test),
`quizNiveau` (facile/moyen/difficile), `quizRythme` (1×/sem, 2×/sem, de temps en temps), `quizCreneau`,
`quizAnnonce` (prénom + score / score du quartier seulement / non), `quizStyle` (gagner / participer / les deux).

## 5. Infos du quartier et mairie
`ccas` (5.1 which town hall / CCAS), `infos[]` (marchés, animations mairie, club senior, spectacles et sorties,
travaux et circulation, permanences utiles, fermetures exceptionnelles, numéros utiles), `infosFrequence`
(chaque jour / 1–2×/sem / seulement ce qui change), `courses` (seul / accompagné / livré / non),
`recettes` (oui/non), `alimentsEvites` (optional free), `cuisine` (tous les jours / parfois / presque plus),
`clubInteret` (oui/peut-être/non + what would help: transport, accompagnement, horaires, prix),
`deplacement` (à pied / voiture / transports en commun / taxi ou transport adapté / je ne sors plus).
CCAS directory by city: https://www.pour-les-personnes-agees.gouv.fr/annuaire-ccas/alpes-maritimes-06

## 6. Météo et vigilance
`meteoQuotidienne` (oui + heure / seulement si important), `sensibilite` (chaleur/froid/les deux/non),
`protections[]` (ventilateur ou clim, volets ou rideaux, chauffage, couvertures), `appelCanicule` (oui/non;
offer registration to the town's heatwave register, with consent), `logementDifficultes` (free),
`reserves` (oui/non), `messagePrudence` (oui/non). Weather source: https://open-meteo.com/ by city.

## 7. Rendez-vous et rappels
`rdvMedicaux[]` (médecin traitant, spécialiste, infirmier, kiné, dentiste, analyses, autre),
`rdvAutres[]` (coiffeur, club, famille, aide à domicile, démarches, activité religieuse, autre),
`rappelQuand` (la veille / le matin / les deux / 1 h avant), `rappelHeure`, `rdvSource` (je les dis à OKA /
un proche les ajoute / agenda du téléphone relié), `rdvAide` (non / transport / accompagnateur) +
`rdvPrevenirProche` (oui/non), `rappelMedicament` (optional: oui + heure / non — nothing medical stored
without explicit consent), `rdvDebrief` (ask afterwards how it went: oui/non).

## 8. Sécurité et alerte (required for safety features)
`veille` (8.1 OKA may worry if something is wrong: oui/non), `contact1` (8.2 name, relation, number, reachable hours),
`contact2` (8.3), `medecin` (8.4 name + number; or social worker / nurse), `seuilAlerte` (8.5: 2 missed calls in
the morning / 1 full day / custom), `alerteMedecin` (8.6 oui/non), `visiteControle` (8.7 neighbour, caretaker,
town hall, emergency services: oui/non), `cleSecours` (8.8 where), `teleassistance` (8.9 oui/non/ne sait pas),
`absences[]` (8.10 holidays, hospital, stay with relative → no false alert), `signeVie` (8.11 je décroche /
je dis « tout va bien » / je tape une touche).

## 9. Consentements (required before activation; each one separate and revocable)
`consent.enregistrement` (9.1), `consent.alerteProches` (9.2), `consent.medecin` (9.3), `consent.miseEnRelation` (9.4),
`consent.mairie` (9.5 first name + address to the town for heatwave register / activities),
`consent.audio` (9.6 recordings to improve OKA; otherwise no audio kept), `personneConfiance` (9.7 name, relation, number),
`comprisEffacement` (9.8 understands "OKA, efface mes informations").

## 10. Retour sur l'accueil
`retour` (faciles / trop longues / compliquées), `ajout` (free), `rappelDemain` (oui + heure / non).

## Feature mapping
| Feature | Sections |
|---|---|
| Matching (three-way call) | 2, 3, 9.4 |
| Live quiz / Radio OKA | 4 |
| Neighbourhood info, town hall | 5, 9.5 |
| Seasonal recipes | 5.5–5.7 |
| Weather, heatwave, cold | 6 |
| Appointment reminders | 7 |
| No-answer alert (relative, then doctor) | 8, 9.2, 9.3 |
| Personalisation and tone | 1 |

Demo profile (Giselle Bernard, 84, Nice, lives alone; likes the market, Charles Trenet, belote; memory: her
dressmaking workshop in Vieux-Nice; contacts: Sophie (daughter), Luc (grandson), Mme Rossi (neighbour),
Dr Martin (GP), Karima (home help)) should be extended with plausible answers to these fields.
