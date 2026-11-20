"use strict";

/* ================= COMPTE DE LA TABLETTE (serveur OKA) ================= */
// Activation par code, annonces de la structure, relais des questions libres.
// Sans serveur configuré (config.js vide), OKA fonctionne comme avant, en local.
const CFG = Object.assign({supabaseUrl:"", supabaseAnonKey:"", activationObligatoire:true, modeTest:false}, window.OKA_CONFIG || {});
const serveurOk = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
// clé de test saisie dans le navigateur : seulement dans le fichier de démo (npm run build:single)
const modeTest = () => !serveurOk() && !!CFG.modeTest;
let appareil = store.get("appareil", null); // {jeton, structure, ville, ia}
let annonces = store.get("annonces", []);
let annoncesLues = store.get("annoncesLues", []);
// la clé Claude n'est plus jamais gardée sur la tablette
if (settings.key || settings.model){ delete settings.key; delete settings.model; store.set("settings", settings); }

// la clé de test n'est jamais gardée ailleurs que dans le fichier de démo
if (!modeTest() && settings.cleTest){ delete settings.cleTest; store.set("settings", settings); }
const iaDisponible = () => !!moteurIA(); // 16-station.js : petit modèle local ou Claude
const modeLibre = () => settings.mode === "claude" && iaDisponible();

async function appelServeur(fn, body){
  const r = await fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + fn, {
    method: body ? "POST" : "GET",
    headers: {"content-type":"application/json", apikey:CFG.supabaseAnonKey, authorization:"Bearer " + CFG.supabaseAnonKey, ...(appareil ? {"x-oka-appareil":appareil.jeton} : {})},
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && appareil) tabletteDesactivee();
  if (!r.ok){ const e = new Error(j.erreur || "erreur " + r.status); e.status = r.status; throw e; }
  return j;
}

/* ---- questions libres ---- */
// fichier de démo seulement : la clé saisie dans Réglages avancés part directement chez Anthropic
async function appelClaudeDirect(body){
  if (!modeTest() || !settings.cleTest) throw new Error("aucune clé de test");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"content-type":"application/json", "x-api-key":settings.cleTest, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "erreur " + r.status);
  return j;
}
async function questionLibre(system, messages){
  if (moteurIA() === "local"){
    // petit modèle sur la station : même parcours de l'arbre, consommation mesurée par la station
    compter("iaLocale"); const wh0 = sobriete.wh;
    const r = await repondreAvecArbre({system, messages, appeler:appelStationIA});
    const chemin = r.chemin.concat("Modèle local · ≈ " + mwh(sobriete.wh - wh0));
    return r.route ? {route:r.route, chemin} : {content:[{type:"text", text:r.texte}], stop_reason:r.stop, chemin};
  }
  compter("claude");
  if (serveurOk()) return appelServeur("ia", {system, messages});
  if (!modeTest()) throw new Error("aucun serveur configuré");
  // mode test : même parcours que le serveur (arbre : classifieur, réponse, vérification), appels directs à Claude Haiku 5.5
  const r = await repondreAvecArbre({system, messages, appeler:async ({system, messages, max_tokens}) => {
    const j = await appelClaudeDirect({model:"claude-haiku-5-5", max_tokens:max_tokens || 1024, thinking:{type:"disabled"}, system, messages});
    if (j.stop_reason === "refusal") return {texte:"Je préfère ne pas répondre à cela. Parlons d'autre chose, si vous voulez. [[EXPR:neutre]]", stop:"refusal"};
    return {texte:(j.content || []).filter(c => c.type === "text").map(c => c.text).join(" ").trim(), stop:j.stop_reason};
  }});
  return r.route ? {route:r.route, chemin:r.chemin} : {content:[{type:"text", text:r.texte}], stop_reason:r.stop, chemin:r.chemin};
}

/* ---- activation ---- */
const AC = document.getElementById("activationModal");
let apresActivation = null;
const activationRequise = () => serveurOk() && !appareil;
function ouvrirActivation(suite){
  apresActivation = suite || null;
  document.getElementById("ac_demo").classList.toggle("hidden", !!CFG.activationObligatoire);
  document.getElementById("ac_msg").textContent = "";
  AC.classList.remove("hidden"); requestAnimationFrame(fitModals);
  setTimeout(() => document.getElementById("ac_code").focus(), 100);
}
function fermerActivation(){ AC.classList.add("hidden"); const f = apresActivation; apresActivation = null; if (f) f(); }
async function activer(){
  const code = document.getElementById("ac_code").value, msg = document.getElementById("ac_msg"), btn = document.getElementById("ac_ok");
  if (code.replace(/[^a-z0-9]/gi, "").length !== 8){ msg.textContent = "Le code contient 8 caractères, par exemple ABCD-EFGH."; return; }
  btn.disabled = true; msg.textContent = "Vérification…";
  try{
    const j = await appelServeur("activer", {code});
    appareil = {jeton:j.jeton, structure:j.structure, ville:j.ville, ia:!!j.ia};
    store.set("appareil", appareil);
    if (appareil.ia) settings.mode = "claude";
    store.set("settings", settings);
    toast("OKA est activée avec " + j.structure + ".");
    fermerActivation(); render(); chargerAnnonces(); chargerMessages();
  }catch(e){
    msg.textContent = e.status === 404 ? "Ce code est inconnu, déjà utilisé ou expiré. Demandez un nouveau code à votre conseiller."
      : e.status ? e.message : "Pas de connexion internet. Réessayez quand la tablette est connectée.";
  }finally{ btn.disabled = false; }
}
document.getElementById("ac_ok").onclick = activer;
document.getElementById("ac_code").onkeydown = e => { if (e.key === "Enter") activer(); };
document.getElementById("ac_demo").onclick = fermerActivation;

function tabletteDesactivee(){
  appareil = null; store.set("appareil", null);
  if (rooms.equipe){ delete rooms.equipe; if (curRoom === "equipe") curRoom = "proches"; saveAll(); }
  if (settings.mode === "claude"){ settings.mode = "demo"; store.set("settings", settings); }
  toast("Cette tablette a été désactivée. Demandez un nouveau code à votre conseiller.", 9000);
  render();
  if (CFG.activationObligatoire) ouvrirActivation();
}

/* ---- annonces de la structure (CCAS, Diwaging) ---- */
async function chargerAnnonces(){
  if (!serveurOk() || !appareil) return;
  let j;
  try{ j = await appelServeur("annonces"); }catch(e){ return; } // hors ligne : on garde les dernières annonces
  if (appareil.ia !== !!j.ia){ appareil.ia = !!j.ia; if (!appareil.ia && settings.mode === "claude"){ settings.mode = "demo"; store.set("settings", settings); } }
  appareil.structure = j.structure; appareil.ville = j.ville; store.set("appareil", appareil);
  const liste = j.annonces || [];
  annonces = liste.filter(a => a.type !== "activite");
  // les activités publiées rejoignent l'onglet Sorties (l'inscription reste sur la tablette)
  const ids = new Set(liste.filter(a => a.type === "activite").map(a => "ann_" + a.id));
  activities = activities.filter(a => !String(a.id).startsWith("ann_") || ids.has(a.id) || a.inscrit);
  for (const a of liste.filter(a => a.type === "activite")){
    const id = "ann_" + a.id, x = activities.find(y => y.id === id);
    const v = {id, titre:a.titre, date:a.date, heure:a.heure, lieu:a.lieu || a.source, dims:["sociale"], participants:[], texte:a.texte};
    if (x) Object.assign(x, v); else activities.push(v);
  }
  store.set("annonces", annonces); saveAll(); render();
  lireNouvellesAnnonces();
}
// OKA lit une seule fois chaque nouvelle annonce (pas de sollicitations répétées).
function lireNouvellesAnnonces(){
  const nouv = annonces.filter(a => !annoncesLues.includes(a.id)).slice(0, 2);
  if (!nouv.length || av.listening) return;
  annoncesLues = annoncesLues.concat(nouv.map(a => a.id)).slice(-200); store.set("annoncesLues", annoncesLues);
  for (const a of nouv) say((a.type === "alerte" ? "Message important de " : "Une information de ") + a.source + " : " + a.titre + ". " + (a.texte || ""), "rappel", null, {queue:true});
}
function viewAnnonces(){
  if (!annonces.length) return "";
  return `<h3>Infos de ${esc(appareil?.structure || "votre CCAS")}</h3>` + annonces.map(a => `<div class="card ${a.type === "alerte" ? "red" : ""}"><div class="big" style="font-size:calc(22px*var(--fs))">${ic(a.type === "alerte" ? "alert" : "building")} ${esc(a.titre)}</div>${a.texte ? `<div>${esc(a.texte)}</div>` : ""}</div>`).join("");
}

/* ---- messagerie avec l'équipe de la structure (CCAS, partenaires d'événements) ---- */
// Un salon « équipe » dans l'onglet Messages ; les messages passent par le serveur (effacés après 30 jours).
let messagesVus = store.get("messagesVus", []);
async function chargerMessages(){
  if (!serveurOk() || !appareil) return;
  let j;
  try{ j = await appelServeur("messages"); }catch(e){ return; } // hors ligne : on réessaiera
  const r = rooms.equipe || (rooms.equipe = {nom:"", membres:[], serveur:true, msgs:[]});
  r.nom = j.structure; r.membres = ["Équipe " + j.structure];
  r.msgs = j.messages.map(m => ({from:m.auteur === "beneficiaire" ? me() : (m.nom || j.structure), text:m.texte, ts:Date.parse(m.date)}));
  const nouveaux = j.messages.filter(m => m.auteur === "equipe" && !messagesVus.includes(m.id));
  if (nouveaux.length){
    messagesVus = messagesVus.concat(nouveaux.map(m => m.id)).slice(-300); store.set("messagesVus", messagesVus);
    if (!(tab === "chat" && curRoom === "equipe")) unread.equipe = (unread.equipe || 0) + nouveaux.length;
    if (!av.listening) say("Nouveau message de " + (nouveaux[0].nom || j.structure) + ".", "sociable", null, {queue:true});
  }
  saveAll(); render();
}
async function envoyerMessageEquipe(texte){
  try{ await appelServeur("messages", {texte}); await chargerMessages(); }
  catch(e){ toast(e.status === 422 ? "Message non envoyé : il contenait un code ou un mot de passe." : "Message non envoyé : pas de connexion. Réessayez plus tard."); }
}

/* ---- réglages : état de la tablette ---- */
function compteTexte(){
  if (modeTest()) return settings.cleTest ? "Fichier de démo : les questions libres partent directement chez Claude (Haiku 5.5) avec votre clé." : "Fichier de démo : pour tester les questions libres, ajoutez une clé ci-dessous.";
  if (!serveurOk()) return "Version locale : aucun serveur configuré. Les questions libres ne sont pas disponibles.";
  if (!appareil) return "Tablette non activée.";
  return "Tablette activée avec " + appareil.structure + "." + (appareil.ia ? " Questions libres autorisées." : " Questions libres non autorisées.");
}
document.getElementById("st_activer").onclick = () => {
  if (appareil && !confirm("Désactiver OKA sur cette tablette ? Il faudra un nouveau code pour la réactiver.")) return;
  SM.classList.add("hidden");
  if (appareil){ appareil = null; store.set("appareil", null); settings.mode = "demo"; store.set("settings", settings); render(); }
  ouvrirActivation();
};

/* ---- application installable et hors ligne ---- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(e => console.warn("sw", e));
