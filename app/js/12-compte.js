"use strict";

/* ================= COMPTE DE LA TABLETTE (serveur OKA) ================= */
// Activation par code, annonces de la structure, relais des questions libres.
// Sans serveur configuré (config.js vide), OKA fonctionne comme avant, en local.
const CFG = Object.assign({supabaseUrl:"", supabaseAnonKey:"", activationObligatoire:true}, window.OKA_CONFIG || {});
const serveurOk = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
let appareil = store.get("appareil", null); // {jeton, structure, ville, ia}
let annonces = store.get("annonces", []);
let annoncesLues = store.get("annoncesLues", []);
// la clé Claude n'est plus jamais gardée sur la tablette
if (settings.key || settings.model){ delete settings.key; delete settings.model; store.set("settings", settings); }

const iaDisponible = () => !!(serveurOk() && appareil && appareil.ia);
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
    fermerActivation(); render(); chargerAnnonces();
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

/* ---- réglages : état de la tablette ---- */
function compteTexte(){
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
