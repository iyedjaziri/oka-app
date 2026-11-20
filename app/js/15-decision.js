"use strict";

/* ================= ARBRE DE DÉCISION : application sur la tablette ================= */
// Le parcours est dans 00-arbre.js (généré depuis arbre/arbre.json). Ici : ce que fait OKA pour chaque barrière,
// l'effacement des données sensibles, l'accord avant les actions proposées par l'IA, et l'affichage du parcours.

const MESSAGE_MASQUE = "[Message effacé : il contenait un mot de passe, un code ou un numéro sensible]";

// une barrière de sécurité a répondu : alerte, ou réponse fixe puis proposition (appeler le médecin, un proche)
function appliquerBarriere(d, text){
  if (d.action === "alerte") return triggerAlert(text);
  if (text) convo.push({role:"user", content:text}, {role:"assistant", content:d.reponse});
  say(d.reponse, d.expr, () => proposerAppel(d.proposition));
}
function proposerAppel(p){
  const x = p === "appeler_medecin" ? findPerson("medecin") : p === "appeler_proche" ? (urgents()[0] || people().find(y => y.type === "proche")) : null;
  if (x) pending = {type:"confirmer", actions:[{question:"j'appelle " + x.nom, faire:() => callPerson(x)}]};
}

/* ---- aucune action sans la personne : appel, inscription, agenda proposés par l'IA ---- */
const ACCORD = ["oui", "d accord", "volontiers", "vas-y", "allez", "avec plaisir", "je veux bien", "ok", "bien sur"];
const accordDonne = () => { const u = convo.filter(m => m.role === "user").slice(-1)[0]; return !!u && has(norm(u.content), ...ACCORD); };
// appelée par runActions dès l'arrivée de la réponse : la demande d'accord est en attente avant même qu'OKA ait fini de parler.
// Renvoie ce qu'il faut faire une fois la réponse dite.
function preparerAccord(actions, texteDit){
  if (!actions.length) return () => {};
  if (accordDonne()) return () => actions.forEach(a => a.faire());
  pending = {type:"confirmer", actions};
  // si l'IA n'a pas déjà posé la question, OKA la pose
  return () => { if (!/\?\s*$/.test(texteDit || "")) say("Je confirme : " + actions.map(a => a.question).join(", puis ") + " ?", "sociable"); };
}
function repondreConfirmation(n){
  const p = pending; pending = null;
  if (has(n, ...ACCORD)){ p.actions.forEach(a => a.faire()); return true; }
  if (has(n, "non", "pas maintenant", "annule", "laisse", "plus tard")){ say("Très bien, je ne fais rien.", "neutre"); return true; }
  return false;
}

/* ---- le classifieur renvoie vers une fonction locale : elle répond, même sans mot-clé reconnu ---- */
function routeLocale(id, text){
  const n = norm(text);
  if (id === "agenda" && !has(n, "ajoute", "note", "mets", "rendez")){ showTab("agenda"); return say("Je vous ouvre votre agenda : touchez « Ajouter » pour y noter ce que vous m'avez dit.", "rappel"); }
  if (id === "meteo"){ showTab("today", "wxSec"); return say(weatherSpeech(), weatherAlert() ? "rappel" : "heureux"); }
  if (id === "proches" && !matchPerson(n)){ showTab("proches"); return say("Qui voulez-vous appeler ? Vos proches sont : " + people().map(p => p.nom).join(", ") + ".", "sociable"); }
  if (id === "sorties"){ sortiesView = "ville"; showTab("sorties"); const s = sortieAuHasard(); return s ? proposerSortie(s) : say("Toutes les sorties sont dans l'onglet Sorties.", "sociable"); }
  if (id === "jeux" && !/(morpion|puissance|echec|sudoku|scrabble|memo|quiz)/.test(n)){ openGames(); return say("À quoi voulez-vous jouer ? Morpion, puissance 4, échecs, sudoku, scrabble ou mémo ?", "sociable"); }
  if (id === "aide"){ showTab("urgence"); return say("Voici vos contacts et les numéros d'urgence. En cas de danger, dites « aidez-moi ».", "rappel"); }
  if (id === "interface"){ closeWin(); return say("C'est fermé.", "neutre"); }
  demoReply(text, n);
}

/* ---- parcours affiché dans l'historique (démonstration) ---- */
const montrerParcours = () => settings.trace === "1" || (!settings.trace && modeTest());
// complète le parcours du dernier message de la personne (classifieur, vérification de la réponse)
function tracer(chemin){
  const m = log.slice().reverse().find(x => x.who === "you");
  if (!m || !chemin) return;
  m.chemin = (m.chemin || []).concat(chemin); store.set("log", log); renderLog();
}
