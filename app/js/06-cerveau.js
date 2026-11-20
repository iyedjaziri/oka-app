"use strict";

/* ================= CERVEAU ================= */
let convo = [];
let pending = null; // question en attente (quiz, confirmation…)
const DANGER = /(je suis tomb|je me suis tomb|chute|je ne peux (plus )?(me )?(relever|lever|bouger)|au secours|a l aide|aidez[- ]moi|j ai (tres )?mal (a la poitrine|au coeur)|douleur (a la )?poitrine|je fais un malaise|malaise|je n arrive (plus|pas) a respirer|je saigne)/;
let followT;
async function handleUser(text){
  wake(); clearTimeout(followT); setLive(""); addLog("you", text);
  const n = norm(text);
  // Sécurité d'abord, quel que soit le mode
  if (DANGER.test(n)){ convo.push({role:"user", content:text}); return triggerAlert(text); }
  if (pending && pending.type === "niveau"){
    const l = has(n, "facile", "simple", "debutant") ? "facile" : has(n, "difficile", "dur", "expert") ? "difficile" : has(n, "moyen", "normal", "intermediaire") ? "moyen" : null;
    if (l) return chooseLevel(l);
    if (!/(jouer|morpion|puissance|echec|sudoku|scrabble|memo)/.test(n)) return say("Dites facile, moyen ou difficile.", "rappel");
  }
  if (pending && pending.type === "conflit"){
    if (has(n, "report", "oui", "d accord", "volontiers", "deplace", "decale")) return resolveConflict("report");
    if (has(n, "les deux", "garde", "quand meme")) return resolveConflict("both");
    if (has(n, "non", "annul", "laisse tomber")) return resolveConflict("cancel");
  }
  if (pending && PENDING_SORTIE.has(pending.type) && repondreSortie(text, n)) return;
  if (modeLibre()){
    try{ return await claudeReply(text); }
    catch(e){ console.warn(e); toast("Pas de réponse en ligne (" + e.message + "). Je passe en mode démo."); }
  }
  demoReply(text, n);
}

/* ---- mode démo : réponses préparées ---- */
const BLAGUES = [
  ["Que dit un panda roux quand il se réveille ?", "Bambou-jour !"],
  ["Pourquoi les poissons détestent l'ordinateur ?", "À cause du net !"],
  ["Que fait une fraise sur un cheval ?", "Tagada, tagada !"],
  ["Quel est le comble pour un niçois ?", "Avoir la socca en travers de la gorge !"],
  ["Pourquoi les plongeurs plongent-ils en arrière ?", "Parce que sinon, ils tombent dans le bateau !"]
];
const QUIZ = [
  {q:"Quelle est la spécialité niçoise faite avec de la farine de pois chiches ?", a:["socca"], r:"La socca ! Bien chaude, sur le marché."},
  {q:"Comment s'appelle la grande avenue au bord de la mer, à Nice ?", a:["promenade des anglais","promenade"], r:"La Promenade des Anglais."},
  {q:"Combien font sept fois huit ?", a:["56","cinquante six","cinquante-six"], r:"Cinquante-six."},
  {q:"Quel chanteur a écrit « La mer » ?", a:["trenet","charles trenet"], r:"Charles Trenet, en 1946."},
  {q:"Quel est le fruit qui donne le pan bagnat son goût, avec l'huile d'olive : la tomate ou la banane ?", a:["tomate"], r:"La tomate, bien sûr !"}
];
let blagueI = 0, quizI = 0, souvI = 0;
const has = (n, ...ws) => ws.some(w => n.includes(w));

function demoReply(text, n){
  // réponses à une question en attente
  if (pending){
    const p = pending; pending = null;
    if (p.type === "quiz"){
      const ok = p.item.a.some(a => n.includes(norm(a)));
      return say(ok ? "Bravo, c'est exact ! " + p.item.r + " Voulez-vous une autre question ?" : "Presque ! La réponse était : " + p.item.r + " Voulez-vous une autre question ?", ok ? "bonne" : "mauvaise", () => { pending = {type:"quizMore"}; });
    }
    if (p.type === "quizMore" && has(n, "oui", "volontiers", "d accord", "encore", "vas-y", "allez")) return askQuiz();
    if (p.type === "inscrire" && has(n, "oui", "volontiers", "d accord", "avec plaisir", "inscri")) return inscrire(p.id, true);
    if (p.type === "appel" && has(n, "oui", "volontiers", "d accord", "appelle")) return callPerson(p.person);
    if (p.type === "souvenir"){ return say("Merci de me raconter cela, " + me() + ". C'est un beau souvenir. Voulez-vous que je le partage avec " + firstProche("votre famille") + " dans les messages ?", "heureux", () => { pending = {type:"partage", text}; }); }
    if (p.type === "partage" && has(n, "oui", "volontiers", "d accord")){ postMsg("proches", me(), "Souvenir raconté à OKA : « " + p.text + " »"); return say("C'est fait. Votre souvenir est dans les messages de la famille.", "bonne"); }
    if (p.type === "agendaAdd" && has(n, "oui", "d accord", "volontiers")) return tryAddEvent(p.ev, "C'est noté dans votre agenda : " + p.ev.titre + ", " + relDay(p.ev.date) + " à " + hourSpeech(p.ev.heure) + ".");
    if (has(n, "non", "pas maintenant", "plus tard", "merci")) return say("Très bien. Je reste là si vous avez besoin.", "compassion");
  }
  // santé : jamais de diagnostic ni de conseil de traitement
  if (has(n, "medicament", "doliprane", "paracetamol", "cachet", "pilule", "sirop", "antibiotique", "somnifere", "traitement", "comprime", "posologie", "ordonnance", "dose", "diagnostic", "est-ce grave", "maladie")){
    return say("Je ne peux pas donner de conseil sur un traitement ni faire de diagnostic. Le mieux est d'en parler au " + (findPerson("medecin")?.nom || "médecin") + ". Voulez-vous que je l'appelle ?", "compassion", () => { const p = findPerson("medecin"); if (p) pending = {type:"appel", person:p}; });
  }
  if (has(n, "bonjour", "salut", "coucou", "bonsoir")) return say(greeting(), "heureux");
  if (has(n, "quelle heure", "l heure")){ const d = new Date(); return say("Il est " + d.getHours() + " heure" + (d.getHours()>1?"s":"") + (d.getMinutes() ? " " + d.getMinutes() : "") + ".", "neutre"); }
  if (has(n, "quel jour", "la date", "on est quel", "quelle date")){ const d = new Date(); return say("Nous sommes " + JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear() + ".", "neutre"); }
  if (has(n, "rendez-vous", "rendez vous", "rdv") && has(n, "ajoute", "note", "prends", "prendre", "mets", "inscris")){ return agendaFromSpeech(text, n); }
  if (has(n, "ajoute", "note dans", "mets dans") && has(n, "agenda", "lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche","demain")) return agendaFromSpeech(text, n);
  if (has(n, "agenda", "programme", "rendez-vous", "rendez vous", "aujourd hui", "demain", "cette semaine", "qu est-ce que j ai", "qu est ce que j ai")){ showTab("agenda"); return say(agendaSpeech(has(n, "semaine") ? 7 : has(n,"demain") ? -1 : 2), "rappel"); }
  if (has(n, "meteo", "temps fait", "quel temps", "pleuvoir", "pluie", "chaud", "froid", "soleil", "parapluie", "canicule")){ showTab("today", "wxSec"); return say(weatherSpeech(), weatherAlert() ? "rappel" : "heureux"); }
  if (has(n, "seule", "seul ", "solitude", "triste", "ennuie", "cafard", "personne ne", "le moral")){
    const a = nextActivity();
    return say("Je comprends, " + me() + ". Ça arrive à tout le monde de se sentir seule. Je suis là. Voulez-vous que j'appelle " + firstProche("un proche") + (a ? ", ou préférez-vous sortir : " + a.titre + ", " + relDay(a.date) + " ?" : " ?"), "compassion", () => { const p = urgents()[0]; if (p) pending = {type:"appel", person:p}; });
  }
  if (has(n, "appelle", "appeler", "telephone", "contacte", "joindre", "parler a", "parler avec")){
    const p = matchPerson(n);
    if (p) return callPerson(p);
    showTab("proches"); return say("Qui voulez-vous appeler ? Vos proches sont : " + (profile?.people||[]).map(p => p.nom).join(", ") + ".", "sociable");
  }
  if (has(n, "message", "lis mes", "lire mes", "nouvelles", "ecrire a", "chat")){ showTab("chat"); return say(messagesSpeech(), "sociable"); }
  if (has(n, "inscri", "participer", "j aimerais aller", "je veux aller")){ const a = matchActivity(n) || nextActivity(); if (a) return inscrire(a.id, true); }
  if (has(n, "ccas", "association", "sortir", "sortie", "activite", "atelier", "marche", "repas", "foyer", "benevole", "petits freres", "monalisa", "faire quelque chose", "je peux faire", "quoi faire", "occuper")){
    sortiesView = has(n, "ccas", "association", "benevole", "petits freres", "monalisa") ? "ccas" : "act"; showTab("sorties"); const a = matchActivity(n) || nextActivity();
    if (!a) return say("Je peux vous mettre en relation avec le CCAS de " + (profile?.ville || "votre ville") + ". Tout est dans l'onglet Sorties.", "sociable");
    return say("Il y a " + a.titre + ", " + relDay(a.date) + " à " + hourSpeech(a.heure) + ". Voulez-vous que je vous inscrive ?", "sociable", () => { pending = {type:"inscrire", id:a.id}; });
  }
  if (has(n, "blague", "rigoler", "faire rire", "drole")){ const b = BLAGUES[blagueI++ % BLAGUES.length]; return say(b[0], "sociable", () => { followT = setTimeout(() => say(b[1], "heureux"), 1200); }); }
  { const gm = has(n, "morpion") ? "morpion" : has(n, "puissance") ? "p4" : has(n, "echec") ? "echecs" : has(n, "sudoku") ? "sudoku" : has(n, "scrabble") ? "scrabble" : has(n, "memo ") || /\bmemo\b/.test(n) ? "memo" : null;
    if (gm) return chooseGame(gm);
    if (/\b(jouer|joue|jeux|jeu)\b/.test(n)){ openGames(); return say("À quoi voulez-vous jouer ? Morpion, puissance 4, échecs, sudoku, scrabble ou mémo ?", "sociable"); } }
  if (has(n, "quiz", "question", "devinette")) return askQuiz();
  if (has(n, "souvenir", "autrefois", "jeunesse", "quand j etais", "raconte")){
    const qs = ["Racontez-moi " + (profile?.souvenir ? profile.souvenir.replace(/^son |^sa |^ses /, m => ({"son ":"votre ","sa ":"votre ","ses ":"vos "}[m])) : "un souvenir de votre jeunesse") + ". Comment c'était ?", "Quelle était votre chanson préférée quand vous aviez vingt ans ?", "Quel est votre plus beau souvenir de Nice ?"];
    return say(qs[souvI++ % qs.length], "compassion", () => { pending = {type:"souvenir"}; });
  }
  if (has(n, "faim", "manger", "dejeuner", "diner", "socca", "gateau", "recette")) return say("Miam ! Ça me donne faim aussi. Avez-vous pensé à boire un verre d'eau ? Et si vous voulez manger en compagnie, le foyer-restaurant du CCAS propose des repas conviviaux.", "affame");
  if (has(n, "fatigue", "dormir", "sommeil", "bonne nuit")) return say("Reposez-vous bien, " + me() + ". Je reste à côté. Appuyez sur le micro quand vous voulez me parler.", "compassion", () => setTimeout(sleep, 1500));
  if (has(n, "merci")) return say("Avec plaisir, " + me() + " !", "heureux");
  if (has(n, "au revoir", "a bientot", "a plus tard")) return say("À tout à l'heure, " + me() + ". Je suis là si besoin.", "heureux");
  if (has(n, "comment vas", "ca va", "comment allez")) return say("Je vais très bien, merci ! Et vous, comment vous sentez-vous aujourd'hui ?", "heureux");
  if (has(n, "pas bien", "pas en forme", "mal au", "mal a ", "j ai mal", "malade", "vertige", "fievre")){
    return say("Je suis désolée, " + me() + ". Si c'est fort ou si ça ne passe pas, dites-moi « aidez-moi » et je préviens vos proches. Voulez-vous que j'appelle " + (findPerson("medecin")?.nom || "votre médecin") + " ?", "compassion", () => { const p = findPerson("medecin") || urgents()[0]; if (p) pending = {type:"appel", person:p}; });
  }
  if (has(n, "bien", "tres bien", "en forme")) return say("Ça me fait plaisir ! Voulez-vous écouter une blague ou faire un petit quiz ?", "heureux");
  if (has(n, "qui es-tu", "qui es tu", "tu es qui", "ton nom", "oka")) return say("Je suis OKA, un panda roux. Je suis là pour discuter avec vous, vous rappeler vos rendez-vous et garder le lien avec vos proches.", "sociable");
  say("Je n'ai pas bien compris. Vous pouvez me demander l'heure, votre agenda, la météo, une sortie, ou d'appeler un proche.", "oublie");
}
function greeting(){
  const h = new Date().getHours();
  const w = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const today = agenda.filter(e => e.date === iso(new Date()) && e.heure >= hm()).sort(byTime)[0];
  const al = weatherAlert();
  return w + " " + me() + " ! Comment allez-vous aujourd'hui ?" + (today ? " Aujourd'hui, vous avez : " + today.titre + " à " + hourSpeech(today.heure) + "." : "") + (al ? " Attention : " + al.titre + "." : "");
}
function askQuiz(){ const item = QUIZ[quizI++ % QUIZ.length]; say(item.q, "sociable", () => { pending = {type:"quiz", item}; }); }

/* ---- mode conversation libre : Claude ---- */
function systemPrompt(){
  const p = profile || {};
  const ag = agenda.filter(e => e.date >= iso(new Date()) && e.date <= iso(addDays(new Date(),7))).sort(byTime).map(e => `- ${relDay(e.date)} ${e.heure} : ${e.titre}`).join("\n") || "rien de prévu";
  const acts = activities.concat(evAVenir().slice(0, 6).filter(e => !activities.some(a => a.id === e.id)))
    .map(a => `- [${a.id}] ${a.titre}, ${relDay(a.date)} ${a.heure}, ${a.lieu}${a.inscrit?" (inscrite)":""}`).join("\n");
  const ppl = (p.people||[]).map(x => `- ${x.nom} (${x.lien}, ${x.type}${x.urgence?", contact d'urgence":""})`).join("\n");
  return `Tu es OKA, une panda roux animée, compagne de conversation de ${p.prenom||"la personne"}, ${p.age||""} ans, qui vit ${p.seule==="oui"?"seule ":""}à ${p.ville||"Nice"}. Projet Diwaging : bien-vieillir (cognitif, physique, social, émotionnel).
Personnalité : chaleureuse et patiente. Tu vouvoies toujours. Phrases courtes et simples. UNE seule question à la fois. 2 à 3 phrases maximum : tes réponses sont lues à voix haute.
Règles de sécurité : jamais de diagnostic, jamais de conseil sur un médicament ou un traitement (renvoie vers le médecin). En cas de danger (chute, malaise, douleur forte), déclenche l'alerte.
Contexte :
Date : ${dayLabel(iso(new Date()))}, ${hm()}.
Météo : ${weatherSpeech()}
Agenda :
${ag}
Proches, soignants, aidants :
${ppl}
Activités proposées :
${acts}
Centres d'intérêt : ${p.gouts||"?"}. Souvenir à évoquer : ${p.souvenir||"?"}.
Actions : tu peux ajouter À LA FIN de ta réponse une ou plusieurs balises, que l'application exécute à l'écran :
[[ALERTE]] alerte les proches puis les secours
[[APPEL:Nom]] appelle une personne de la liste
[[INSCRIPTION:id]] inscrit à une activité (après accord explicite)
[[AGENDA:AAAA-MM-JJ|HH:MM|titre]] ajoute un rendez-vous (après accord explicite)
[[ONGLET:today|agenda|proches|sorties|chat|jeux|urgence]] affiche un onglet (jeux : morpion, puissance 4, échecs, sudoku, scrabble, mémo)
[[JEU:morpion|p4|echecs|sudoku|scrabble|memo]] lance un jeu (OKA demande ensuite le niveau)
[[EXPR:nom]] ton émotion pour cette réponse (toujours une) :
  heureux (bonne nouvelle, salutation, blague), compassion (tristesse, solitude, douleur, inquiétude, urgence),
  sociable (proches, sorties, activités, messages), affame (repas, cuisine), rappel (rendez-vous, agenda, météo, conseils),
  oublie (tu n'as pas compris, oubli, fatigue), bonne (bonne réponse au quiz, tâche réussie), mauvaise (mauvaise réponse au quiz), neutre (heure, date, information).`;
}
async function claudeReply(text){
  convo.push({role:"user", content:text});
  // filtres de sécurité sur la tablette, avant tout appel (santé, hors périmètre)
  const f = filtrerQuestion(text);
  if (f){ convo.push({role:"assistant", content:f}); return runActions(f); }
  setExpr("neutre"); setStateLbl("Je réfléchis…");
  // relais du serveur OKA (ou appel direct en mode test, sans serveur)
  let j;
  try{ j = await questionLibre(systemPrompt(), convo); }
  catch(e){ convo.pop(); throw e; }
  finally{ setStateLbl(null); }
  let raw = (j.content||[]).filter(c => c.type === "text").map(c => c.text).join(" ").trim();
  if (j.stop_reason === "max_tokens"){ const k = Math.max(raw.lastIndexOf("."), raw.lastIndexOf("!"), raw.lastIndexOf("?")); if (k > 0) raw = raw.slice(0, k+1); }
  convo.push({role:"assistant", content:raw});
  runActions(raw);
}
function runActions(raw){
  const tags = [...raw.matchAll(/\[\[([A-Z]+)(?::([^\]]*))?\]\]/g)];
  const clean = raw.replace(/\[\[[^\]]*\]\]/g, "").replace(/\s+/g, " ").trim();
  let expr = "heureux", after = [];
  for (const [, k, v] of tags){
    if (k === "EXPR") expr = (v||"").trim();
    else if (k === "ALERTE") after.push(() => triggerAlert("(signalé par OKA)", true));
    else if (k === "APPEL"){ const p = matchPerson(norm(v)); if (p) after.push(() => callPerson(p, true)); }
    else if (k === "INSCRIPTION") after.push(() => inscrireSortie((v||"").trim(), false));
    else if (k === "AGENDA"){ const [d, h, ...t] = (v||"").split("|"); if (/^\d{4}-\d\d-\d\d$/.test(d) && /^\d\d:\d\d$/.test(h)) after.push(() => tryAddEvent({date:d, heure:h, titre:t.join("|")||"Rendez-vous", type:"rdv"})); }
    else if (k === "ONGLET") showTab((v||"today").trim());
    else if (k === "JEU" && GAMES[(v||"").trim()]) after.push(() => chooseGame((v||"").trim()));
  }
  if (clean) say(clean, expr, () => after.forEach(f => f()));
  else { setExpr(expr); after.forEach(f => f()); }
}
