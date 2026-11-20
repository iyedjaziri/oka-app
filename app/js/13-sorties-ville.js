"use strict";

/* ================= SORTIES DE LA VILLE : maisons des seniors, CCAS ================= */
// Événements seniors de la Ville de Nice (serveur OKA, ou fichier de démo), maison des seniors la plus proche,
// sortie proposée au hasard après une partie, rappels enjoués et nouvelles après la sortie.
// Arbre de décision provisoire : choix au hasard (à compléter : préférences, jeux pratiqués, proximité).

// adresses nice.fr ; positions Base Adresse Nationale (Villa La Luna : position approchée de la rue)
const MAISONS_SENIORS = [
  {nom:"Maison des seniors Cimiez", adresse:"14 avenue du Monastère, Nice", tel:"", lat:43.72083, lon:7.27699},
  {nom:"Maison des seniors Le Ray", adresse:"4 rue Charles Baudelaire, Nice", tel:"", lat:43.7253, lon:7.25892},
  {nom:"Maison des seniors Pasteur", adresse:"2 avenue Antonia Augusta, Nice", tel:"04 97 13 45 48", lat:43.72244, lon:7.28683},
  {nom:"Maison des seniors Port-République", adresse:"12 rue Scaliero, Nice", tel:"04 97 13 53 84", lat:43.70315, lon:7.28306},
  {nom:"Maison des seniors Villa La Luna", adresse:"265 promenade des Anglais, Nice", tel:"", lat:43.68597, lon:7.24068},
  {nom:"Office Municipal Niçois des Seniors", adresse:"19 rue Gioffredo, Nice", tel:"04 89 04 65 03", lat:43.70143, lon:7.27612}
];
const distanceKm = (a, b) => { const R = 6371, r = x => x*Math.PI/180, dl = r(b.lat-a.lat), dn = r(b.lon-a.lon);
  return 2*R*Math.asin(Math.sqrt(Math.sin(dl/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2)); };
const km = d => d < 1 ? Math.round(d*1000/50)*50 + " m" : d.toFixed(1).replace(".", ",") + " km";
function maisonProche(){
  const p = settings.adressePos; if (!p) return null;
  return MAISONS_SENIORS.map(m => ({...m, d:distanceKm(p, m)})).sort((a,b) => a.d - b.d)[0];
}
// l'adresse reste sur la tablette ; elle est seulement envoyée à la Base Adresse Nationale (service public) pour la situer
async function localiserAdresse(adr){
  if (!adr){ delete settings.adressePos; store.set("settings", settings); render(); return; }
  try{
    const r = await fetch("https://api-adresse.data.gouv.fr/search/?limit=1&q=" + encodeURIComponent(adr + (/\bnice\b/i.test(adr) ? "" : " Nice")));
    const f = ((await r.json()).features || [])[0];
    if (f && f.properties.score > 0.4) settings.adressePos = {lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], label:f.properties.label};
    else delete settings.adressePos;
  }catch(e){ return; } // hors ligne : on réessaiera au prochain enregistrement
  store.set("settings", settings); render();
}
function infoAdresse(){
  const m = maisonProche();
  if (m) return "Maison la plus proche : " + m.nom + " (" + km(m.d) + "). L'adresse reste sur cette tablette.";
  return settings.adresse ? "Adresse introuvable : précisez la rue et le numéro." : "Facultatif. Sert à trouver la maison des seniors la plus proche. L'adresse reste sur cette tablette.";
}

/* ---- événements de la Ville de Nice ---- */
// fichier de démo : la liste est embarquée à la construction (window.OKA_EVENEMENTS)
let evtsVille = [store.get("evtsVille", null), window.OKA_EVENEMENTS || null].filter(Boolean).sort((a,b) => (b.maj||"").localeCompare(a.maj||""))[0] || null;
let evPage = 0, evChargement = false;
const evAVenir = () => { const t = iso(new Date()), h = hm(); return (evtsVille?.evenements || []).filter(e => e.date > t || (e.date === t && e.heure >= h)); };
const majTexte = s => { const d = new Date(s); return relDay(iso(d)) + " à " + pad(d.getHours()) + "h" + pad(d.getMinutes()); };

// contrôle de forme : la liste vient d'un serveur ou de Claude, rien n'est affiché sans vérification
function nettoyerEvt(e){
  if (!e || typeof e.titre !== "string" || !/^\d{4}-\d\d-\d\d$/.test(e.date || "")) return null;
  const t = (v, n) => String(v ?? "").slice(0, n);
  const heure = /^\d\d:\d\d$/.test(e.heure || "") ? e.heure : "10:00";
  return {id: /^nice_[\w-]+$/.test(e.id || "") ? e.id : "nice_" + (e.date + heure + e.titre).replace(/[^a-z0-9]/gi, "").slice(0, 40),
    titre:t(e.titre, 140), date:e.date, heure, fin:/^\d\d:\d\d$/.test(e.fin || "") ? e.fin : "", lieu:t(e.lieu, 120) || "Nice",
    adresse:t(e.adresse, 160), types:Array.isArray(e.types) ? e.types.slice(0, 4).map(x => t(x, 40)) : [], gratuit:!!e.gratuit,
    inscription:t(e.inscription, 240), lien:/^https:\/\/www\.nice\.fr\//.test(e.lien || "") ? e.lien : ""};
}
function majEvts(j){
  const evenements = (j.evenements || []).map(nettoyerEvt).filter(Boolean);
  evtsVille = {maj:j.maj || new Date().toISOString(), source:String(j.source || "Ville de Nice"), evenements};
  store.set("evtsVille", evtsVille);
}
async function chargerEvenements(forcer){
  if (evChargement) return;
  const viaServeur = serveurOk(), viaClaude = !viaServeur && forcer && modeTest() && settings.cleTest;
  if (!viaServeur && !viaClaude){ if (forcer) toast(modeTest() ? "Ajoutez une clé de test dans Réglages avancés pour rafraîchir." : "Le rafraîchissement demande le serveur OKA."); return; }
  evChargement = true; render();
  try{ majEvts(viaServeur ? await appelServeur("evenements" + (forcer ? "?rafraichir=1" : "")) : await evenementsViaClaude()); evPage = 0; }
  catch(e){ console.warn("evenements", e); if (forcer) toast("Impossible de rafraîchir les événements : " + e.message); }
  finally{ evChargement = false; render(); }
}
// fichier de démo : Claude lit la page de l'agenda seniors (outil web_fetch) et rend un tableau JSON
async function evenementsViaClaude(){
  const url = "https://www.nice.fr/agenda-seniors/";
  const consigne = `Lis la page ${url} avec l'outil web_fetch. Liste les événements à venir à partir du ${iso(new Date())}. ` +
    `Réponds uniquement par un tableau JSON, sans texte autour, de la forme : ` +
    `[{"titre":"…","date":"AAAA-MM-JJ","heure":"HH:MM","fin":"HH:MM ou vide","lieu":"…","adresse":"…","inscription":"conditions d'inscription, ou vide"}]. ` +
    `N'invente rien : seulement ce qui est écrit sur la page.`;
  let messages = [{role:"user", content:consigne}], j;
  for (let i = 0; i < 3; i++){
    j = await appelClaudeDirect({model:"claude-haiku-5-5", max_tokens:8000, thinking:{type:"disabled"},
      tools:[{type:"web_fetch_20250910", name:"web_fetch", max_uses:3, allowed_domains:["www.nice.fr"]}], messages});
    if (j.stop_reason !== "pause_turn") break;
    messages = messages.concat({role:"assistant", content:j.content});
  }
  const txt = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n"), m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("réponse illisible");
  return {maj:new Date().toISOString(), source:"Ville de Nice", evenements:JSON.parse(m[0]).map(e => ({...e, lien:url}))};
}

/* ---- inscription : notée dans l'agenda, la réservation reste à faire auprès du lieu ---- */
function inscrireSortie(id, speak, suite){
  const e = (evtsVille?.evenements || []).find(x => x.id === id);
  if (e && !activities.some(a => a.id === id)){
    activities.push({id, titre:e.titre, date:e.date, heure:e.heure, fin:e.fin, lieu:e.lieu, dims:["sociale"], participants:[], inscription:e.inscription, ville:true});
  }
  inscrire(id, speak, suite);
}
// phrase ajoutée après l'inscription à un événement de la ville
function rappelInscription(a){
  if (!a.ville) return "";
  const tel = (a.inscription || "").match(/0\d(?:[ .]?\d\d){4}/);
  if (tel) return " Pour réserver votre place, il faut aussi appeler le " + tel[0] + ".";
  return a.inscription ? " Pensez à réserver votre place : " + a.inscription.replace(/\.$/, "") + "." : "";
}

/* ---- combien de personnes y vont (jamais de nom) ---- */
function phraseMonde(n){
  if (!n) return "";
  if (n === 1) return pick(["J'ai entendu dire qu'une autre personne compte y aller.", "Il paraît qu'une autre personne a prévu d'y aller."]);
  if (n < 5) return pick(["J'ai entendu dire que " + n + " personnes comptent y aller.", "Il paraît que " + n + " personnes ont prévu d'y aller.", n + " personnes ont déjà dit qu'elles y allaient."]);
  return pick(["Ça a l'air d'avoir du succès : " + n + " personnes comptent déjà y aller.", "J'ai entendu dire que c'est très demandé : déjà " + n + " personnes inscrites."]);
}
const nbParticipants = s => (s.participants || []).length;
const cite = t => /[«"]/.test(t) ? t : "« " + t + " »"; // pas de guillemets en double

/* ---- une sortie au hasard, après une partie ---- */
let derniereReco = store.get("derniereReco", 0);
function sortieAuHasard(){
  const t = iso(new Date()), lim = iso(addDays(new Date(), 14)), inscrit = id => activities.some(a => a.id === id && a.inscrit);
  const pool = evAVenir().filter(e => e.date <= lim && !inscrit(e.id))
    .concat(activities.filter(a => !a.inscrit && !a.ville && a.date >= t && a.date <= lim));
  // un titre au hasard, puis sa prochaine date : les séances répétées ne prennent pas toute la place
  const titres = [...new Set(pool.map(x => x.titre))];
  if (!titres.length) return null;
  const titre = pick(titres);
  return pool.filter(x => x.titre === titre).sort(byTime)[0];
}
// appelée par gameEnd (11-jeux.js) : renvoie la proposition à dire après le résultat, ou null
function sortieApresJeu(){
  if (pending || Date.now() - derniereReco < 30*60e3 || resteAProposer() <= 0) return null;
  const s = sortieAuHasard();
  return s ? () => { compterProposition(); proposerSortie(s); } : null;
}

/* ---- propositions régulières : quelques sorties par jour, réparties entre 9 h 30 et 18 h 30 ---- */
// Nombre réglable (Réglages avancés, 0 = jamais) ; la proposition de fin de partie compte dans ce total.
let propositions = store.get("propositions", {jour:"", n:0});
const nbPropositions = () => Math.max(0, +(settings.suggestionsJour ?? 2));
function propositionsDuJour(){ const t = iso(new Date()); if (propositions.jour !== t) propositions = {jour:t, n:0}; return propositions; }
const resteAProposer = () => nbPropositions() - propositionsDuJour().n;
function compterProposition(){ propositionsDuJour().n++; store.set("propositions", propositions); }
function propositionReguliere(){
  const max = nbPropositions(), p = propositionsDuJour();
  if (p.n >= max || !profile || pending || av.speaking || av.listening || alertRun || Date.now() - derniereReco < 30*60e3) return;
  if (tab === "jeux" && winOpen && G.s && !G.s.over) return; // pas en pleine partie
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60, debut = 9.5, fin = 18.5;
  // la n-ième proposition du jour est due au milieu de sa part de la journée
  if (h < debut || h > fin || h < debut + (fin - debut) * (p.n + .5) / max) return;
  const s = sortieAuHasard();
  if (!s) return;
  compterProposition(); proposerSortie(s);
}
function proposerSortie(s){
  derniereReco = Date.now(); store.set("derniereReco", derniereReco);
  const monde = phraseMonde(nbParticipants(s));
  say(pick(["Au fait, si vous avez envie de sortir un peu :", "Et pour voir du monde, il y a quelque chose qui pourrait vous plaire :", "J'ai repéré une sortie :"]) +
    " " + s.titre + ", " + relDay(s.date) + " à " + hourSpeech(s.heure) + ", " + s.lieu + "." + (monde ? " " + monde : "") + " Ça vous tente ?",
    "sociable", () => { pending = {type:"reco", s}; });
}
// après l'inscription, s'il y a peu de monde : proposer la sortie à d'autres
function proposerAuxAutres(s){
  if (nbParticipants(s) > 1) return;
  say(pick(["Voulez-vous que je la propose aussi à vos proches, ou à d'autres personnes du quartier ?",
    "Vous voulez que je propose cette sortie à vos proches ? Je peux aussi la proposer à d'autres personnes, sans donner votre nom."]),
    "sociable", () => { pending = {type:"proposer", s}; });
}

/* ---- réponses aux questions de sortie (avant le mode démo ou Claude) ---- */
const OUI_SORTIE = ["oui", "volontiers", "d accord", "avec plaisir", "pourquoi pas", "ca me tente", "bonne idee", "allez", "ok"];
const NON_SORTIE = ["non", "pas maintenant", "plus tard", "pas envie", "une autre fois", "pas aujourd hui"];
const PENDING_SORTIE = new Set(["reco", "proposer", "debrief", "partageSortie"]);
function repondreSortie(text, n){
  const p = pending; pending = null;
  if (p.type === "reco"){
    if (has(n, ...NON_SORTIE)){ say(pick(["Très bien. Si l'envie vous prend, les sorties sont dans l'onglet Sorties.", "D'accord, une autre fois. Tout est dans l'onglet Sorties."]), "neutre"); return true; }
    if (has(n, ...OUI_SORTIE, "inscri")){ inscrireSortie(p.s.id, true, () => proposerAuxAutres(p.s)); return true; }
    return false;
  }
  if (p.type === "proposer"){
    const s = p.s, autres = has(n, "autre", "quartier", "gens", "personnes"), proches = has(n, "proche", "famille", "ami", "fille", "fils", "petit");
    if (proches || (!autres && has(n, ...OUI_SORTIE))){
      postMsg("proches", me(), "Je vais à " + cite(s.titre) + ", " + relDay(s.date) + " à " + s.heure.replace(":", "h") + " (" + s.lieu + "). Quelqu'un veut venir avec moi ?");
      say("C'est envoyé à vos proches, dans les messages.", "bonne"); return true;
    }
    // démonstration : la proposition à d'autres personnes du quartier est simulée
    if (autres){ say("D'accord. Je la proposerai à d'autres personnes du quartier qui aiment sortir, sans donner votre nom.", "sociable"); return true; }
    if (has(n, ...NON_SORTIE)){ say("Très bien.", "neutre"); return true; }
    return false;
  }
  if (p.type === "debrief"){
    if (has(n, "pas pu", "pas alle", "pas ete", "pas y aller", "annule")){ say("Pas de souci. Il y aura d'autres occasions, je vous en reparlerai.", "compassion"); return true; }
    if (has(n, "pas terrible", "nul", "ennuy", "decu", "pas bien", "pas aime", "pas trop")){ say("Ça arrive. Merci de m'avoir raconté. La prochaine sera peut-être plus à votre goût.", "compassion"); return true; }
    say(pick(["Merci de me raconter. Voulez-vous partager ce moment avec vos proches, dans les messages ?", "C'est bien de sortir comme ça. Vous voulez que je le raconte à vos proches ?"]),
      "heureux", () => { pending = {type:"partageSortie", a:p.a, text}; });
    return true;
  }
  if (p.type === "partageSortie"){
    if (has(n, ...OUI_SORTIE)){ postMsg("proches", me(), "Je suis allée à " + cite(p.a.titre) + " : " + p.text); say("C'est partagé avec vos proches.", "bonne"); return true; }
    if (has(n, ...NON_SORTIE)){ say("Très bien, ça reste entre nous.", "neutre"); return true; }
    return false;
  }
  return false;
}

/* ---- rappels enjoués et nouvelles après la sortie ---- */
function rappelSortie(e, quand, mins){
  const a = activities.find(x => "act_" + x.id === e.id) || {}, monde = phraseMonde(nbParticipants(a));
  if (quand === "veille") return "Demain, c'est " + e.titre + " à " + hourSpeech(e.heure) + ". " + pick(["Belle sortie en perspective !", "Ça s'annonce bien !"]) + (monde ? " " + monde : "");
  return pick(["Super, c'est bientôt : ", "Chouette, c'est tout à l'heure : "]) + e.titre + ", dans " + Math.round(mins) + " minutes" + (e.lieu ? ", " + e.lieu : "") + "." + (monde ? " " + monde : "") + " Bonne sortie !";
}
// une seule question, une seule fois, quand la personne est là et qu'OKA ne fait rien d'autre
let suivis = store.get("suivis", {});
function suiviSortie(){
  if (pending || av.speaking || av.listening || av.sleeping || Date.now() - av.lastAct > 120000) return;
  const now = new Date();
  for (const a of activities.filter(a => a.inscrit && !suivis[a.id])){
    const fin = new Date(a.date + "T" + (a.fin || a.heure)); if (!a.fin) fin.setHours(fin.getHours() + 2);
    const h = (now - fin) / 3600e3;
    if (h < 0.5 || h > 48) continue;
    suivis[a.id] = 1; store.set("suivis", suivis);
    const pr = firstProche(null);
    say(pick(["Alors, " + a.titre + ", comment ça s'est passé ? Vous avez rencontré du monde ?",
      "Vous avez pu aller à " + a.titre + " ? Vous avez rencontré des personnes intéressantes ?"]
      .concat(pr ? ["J'espère que " + a.titre + " vous a plu. Vous en avez parlé à " + pr + " ?"] : [])),
      "sociable", () => { pending = {type:"debrief", a}; });
    return;
  }
}

/* ---- vue « Maisons des seniors » de l'onglet Sorties ---- */
function viewVille(){
  const proche = maisonProche(), liste = evAVenir(), parPage = 4, nbp = Math.max(1, Math.ceil(liste.length / parPage));
  evPage = Math.min(evPage, nbp - 1);
  const page = liste.slice(evPage * parPage, evPage * parPage + parPage), inscrit = id => activities.some(a => a.id === id && a.inscrit);
  return (proche
      ? `<div class="card blue"><div class="big" style="font-size:calc(21px*var(--fs))">${ic("home")} Près de chez vous : ${esc(proche.nom)}</div><div class="small">${esc(proche.adresse)} · ${km(proche.d)}${proche.tel ? " · " + esc(proche.tel) : ""}</div></div>`
      : `<p class="muted small" style="margin:0 0 6px">Indiquez votre adresse dans Réglages avancés pour trouver la maison des seniors la plus proche.</p>`) +
    `<div class="row" style="justify-content:space-between;margin:8px 0 6px"><div class="muted small">Agenda seniors de la Ville de Nice${evtsVille ? " · mis à jour " + esc(majTexte(evtsVille.maj)) : ""}</div>
      <button class="btn sm alt" data-ev="maj" ${evChargement ? "disabled" : ""}>${ic("history")} ${evChargement ? "Mise à jour…" : "Rafraîchir"}</button></div>
    <div class="plist2">${page.map(e => `<div class="prow ${inscrit(e.id) ? "okrow" : ""}">
      <div class="pinfo"><div class="pn">${esc(e.titre)}</div><div class="small">${esc(relDay(e.date))} à ${e.heure.replace(":", "h")} · ${esc(e.lieu)}${e.gratuit ? " · gratuit" : ""}</div></div>
      <div class="pact">${inscrit(e.id) ? `<span class="small">${ic("check")} Noté</span>` : `<button class="btn sm" data-ev="sub" data-id="${esc(e.id)}">Ça m'intéresse</button>`}</div></div>`).join("")
      || `<div class="card">${evChargement ? "Chargement des événements…" : "Aucun événement à venir pour l'instant. Touchez « Rafraîchir »."}</div>`}</div>` +
    (nbp > 1 ? `<div class="row" style="justify-content:center;margin-top:6px"><button class="btn sm ghost" data-ev="prev" ${evPage ? "" : "disabled"}>‹ Précédents</button><span class="small">${evPage + 1} / ${nbp}</span><button class="btn sm ghost" data-ev="next" ${evPage < nbp - 1 ? "" : "disabled"}>Suivants ›</button></div>` : "");
}
function bindVille(P){
  P.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => {
    const k = b.dataset.ev;
    if (k === "maj") chargerEvenements(true);
    if (k === "prev"){ evPage--; render(); }
    if (k === "next"){ evPage++; render(); }
    if (k === "sub"){ wake(); const id = b.dataset.id, e = evAVenir().find(x => x.id === id); inscrireSortie(id, true, e ? () => proposerAuxAutres(e) : null); }
  });
}
