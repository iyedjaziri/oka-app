"use strict";

/* ================= STATION LOCALE : petit modèle d'IA et voix IA sur cette machine (sobriété) ================= */
// « npm run station » sert un petit modèle (Ollama) et la voix IA (Pocket TTS) sur http://localhost:8787,
// et mesure leur consommation. Si la station ne répond pas, Claude (questions libres) et la voix du navigateur
// prennent le relais. L'arbre de décision reste appliqué ici, quel que soit le modèle.
const stationUrl = () => (settings.station || "http://localhost:8787").replace(/\/$/, "");
let station = {en_ligne:false};
// on ne contacte la station que si elle sert (modèle ou voix locale choisis, adresse donnée, fichier de démo)
const stationUtile = () => settings.moteurIA === "local" || settings.moteurVoix === "locale" || !!settings.station || modeTest();
async function verifierStation(force){
  if (!force && !stationUtile()){ station = {en_ligne:false}; majStation(); return false; }
  try{ const r = await fetch(stationUrl() + "/etat", {signal:AbortSignal.timeout(2500)}); station = {en_ligne:true, ...(await r.json())}; }
  catch(e){ station = {en_ligne:false}; }
  majStation(); render();
  return station.en_ligne;
}
const iaLocaleDispo = () => !!(station.en_ligne && station.ia && station.ia.en_ligne && station.ia.installe);
const voixLocaleDispo = () => !!(station.en_ligne && station.voix && station.voix.en_ligne);
// modèle réellement utilisé pour une question libre : le local s'il est choisi et allumé, sinon Claude s'il est possible
function moteurIA(){
  if (settings.moteurIA === "local" && iaLocaleDispo()) return "local";
  return (serveurOk() ? appareil && appareil.ia : modeTest() && settings.cleTest) ? "claude" : null;
}
async function appelStationIA({system, messages, max_tokens, json}){
  const r = await fetch(stationUrl() + "/ia", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({system, messages, max_tokens:max_tokens || 120, json:!!json})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || "station " + r.status);
  noterConso(j.mesure);
  return {texte:j.texte, stop:j.stop};
}

// prompt court pour le petit modèle : un processeur lit lentement les longs prompts, et un petit modèle invente
// à partir d'un contexte trop riche (agenda, proches…) ; les fonctions locales s'occupent déjà de ces sujets
function promptCompact(){
  const p = profile || {};
  return `Tu es OKA, une panda roux, compagne de conversation de ${p.prenom || "la personne"}${p.age ? ", " + p.age + " ans" : ""}, qui vit à ${p.ville || "Nice"}. ` +
    "Tu vouvoies. Tu réponds en français, en deux phrases courtes au maximum, simplement et avec chaleur. " +
    "Tu n'inventes rien sur la personne ni sur les faits : si tu ne sais pas, dis-le. Termine par une seule question ouverte, ou aucune.";
}
// au plus trois phrases, quoi qu'écrive le modèle
const troisPhrases = t => (t.match(/[^.!?…]+[.!?…]+/g) || [t]).slice(0, 3).join(" ").trim();

/* ---- sobriété : qui a répondu, et combien d'énergie a coûté le calcul local ---- */
let sobriete = Object.assign({depuis:new Date().toISOString(), demandes:0, iaLocale:0, claude:0, wh:0, phrasesVoix:0}, store.get("sobriete", {}));
function compter(k){ sobriete[k]++; store.set("sobriete", sobriete); }
function noterConso(m, voix){ if (!m) return; sobriete.wh += m.wh || 0; if (voix) sobriete.phrasesVoix++; store.set("sobriete", sobriete); }
const mwh = wh => (wh * 1000).toLocaleString("fr-FR", {maximumFractionDigits:2}) + " mWh";
function texteSobriete(){
  const s = sobriete, sansIA = Math.max(0, s.demandes - s.iaLocale - s.claude), pc = s.demandes ? Math.round(sansIA * 100 / s.demandes) : 0;
  return `Depuis le ${new Date(s.depuis).toLocaleDateString("fr-FR")} : ${s.demandes} demandes, dont ${sansIA} traitées sans IA (${pc} %), ` +
    `${s.iaLocale} par le petit modèle local et ${s.claude} par Claude. Énergie estimée du calcul local (IA et ${s.phrasesVoix} phrases de voix) : ${mwh(s.wh)} ; ` +
    `${s.clips || 0} phrases lues depuis les enregistrements préparés, sans calcul. ` +
    `La consommation de Claude n'est pas mesurable depuis cette machine.`;
}
function majStation(){
  const el = document.getElementById("st_stationEtat"); if (!el) return;
  const c = station.consommation;
  el.innerHTML = (station.en_ligne
    ? `<b>Station en ligne</b> · ${esc(stationUrl())}<br>IA locale : ${station.ia.en_ligne ? (station.ia.installe ? esc(station.ia.modele) + " prêt" : esc(station.ia.modele) + " à installer (ollama pull)") : "Ollama arrêté"}` +
      ` · Voix IA : ${station.voix.en_ligne ? station.voix.voix.length + " voix" : "arrêtée"}<br>` +
      `Depuis le démarrage de la station : IA ${c.ia.appels} réponses, ${mwh(c.ia.wh)} · voix ${c.voix.phrases} phrases, ${mwh(c.voix.wh)} ` +
      `<span class="muted">(processeur ${station.machine.watts_cpu} W, ${station.machine.cpus} processeurs logiques)</span>`
    : `<b>Station hors ligne</b> · ${esc(stationUrl())}<br><span class="muted">Lancez « npm run station » sur la machine. En attendant : ${moteurIA() ? "Claude" : "réponses locales"} et voix du navigateur.</span>`) +
    `<p class="small" style="margin:8px 0 0">${esc(texteSobriete())}</p>`;
  const sel = document.getElementById("st_voixLocale");
  if (sel && station.en_ligne && station.voix.en_ligne){
    sel.innerHTML = station.voix.voix.map(v => `<option value="${esc(v.id)}">${esc(v.nom)}</option>`).join("");
    sel.value = settings.voixLocale || (station.voix.voix[0] || {}).id || "";
  } else if (sel) sel.innerHTML = `<option value="">Station hors ligne</option>`;
}

/* ---- phrases fixes pré-générées (npm run voix:clips) : aucune consommation à l'usage, disponibles hors ligne ---- */
// fichier de démo : embarquées (window.OKA_CLIPS) ; application : app/audio/voix/index.json
let clips = window.OKA_CLIPS || null;
if (!clips) fetch("audio/voix/index.json").then(r => r.ok ? r.json() : null).then(j => { clips = j; }).catch(() => {});
// même clé que tools/voix-clips.mjs
const cleClip = s => { let h = 0x811c9dc5; for (const c of s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim()){ h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
function clipVoix(s){
  if (!clips || settings.moteurVoix !== "locale" || (settings.voixLocale && settings.voixLocale !== clips.voix)) return null;
  const v = clips.phrases[cleClip(s)];
  return typeof v === "string" ? v : v ? "audio/voix/" + clips.voix + "/" + cleClip(s) + ".wav" : null;
}
async function jouerClip(url, s, token){
  try{
    const blob = await (await fetch(url)).blob();
    if (token !== speakToken) return;
    sobriete.clips = (sobriete.clips || 0) + 1; store.set("sobriete", sobriete);
    await jouerAudio(blob, s, token, Math.min(1.2, Math.max(.8, settings.rate / .85)));
  }catch(e){ console.warn("clip", e); speakQueue.unshift(s); nextSentence(token, true); }
}

/* ---- voix IA locale : chaque phrase est préparée par la station, la suivante pendant que celle-ci est dite ---- */
const voixPretes = new Map();
function audioLocal(s){
  if (!voixPretes.has(s)){
    voixPretes.set(s, fetch(stationUrl() + "/voix/tts", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({texte:s, voix:settings.voixLocale || ""})})
      .then(async r => { if (!r.ok) throw new Error("voix " + r.status); noterConso(JSON.parse(r.headers.get("x-oka-mesure") || "null"), true); return r.blob(); }));
    if (voixPretes.size > 40) voixPretes.delete(voixPretes.keys().next().value);
  }
  return voixPretes.get(s);
}
async function speakLocale(s, token){
  try{
    const p = audioLocal(s);
    if (speakQueue[0]) audioLocal(speakQueue[0]).catch(() => {});
    const blob = await p;
    if (token !== speakToken) return;
    await jouerAudio(blob, s, token, Math.min(1.2, Math.max(.8, settings.rate / .85)));
  }catch(e){
    voixPretes.delete(s); console.warn("voix locale", e);
    // son bloqué avant le premier geste : cette phrase seulement avec la voix du navigateur
    if (e.name !== "NotAllowedError"){ station.voix = {en_ligne:false, voix:[]}; toast("Voix IA locale indisponible : voix du navigateur."); }
    speakQueue.unshift(s); nextSentence(token, true);
  }
}

/* ---- réglages ---- */
document.getElementById("st_stationVerif").onclick = () => { settings.station = document.getElementById("st_station").value.trim(); verifierStation(true); };
document.getElementById("st_voixTest").onclick = async () => {
  const avant = [settings.moteurVoix, settings.voixLocale];
  settings.moteurVoix = document.getElementById("st_moteurVoix").value; settings.voixLocale = document.getElementById("st_voixLocale").value;
  say("Bonjour " + me() + ". Je suis OKA. Demain, il y a un atelier mémoire à la maison des seniors.", "heureux", () => { [settings.moteurVoix, settings.voixLocale] = avant; });
};
document.getElementById("st_sobrieteRaz").onclick = () => { sobriete = {depuis:new Date().toISOString(), demandes:0, iaLocale:0, claude:0, wh:0, phrasesVoix:0}; store.set("sobriete", sobriete); majStation(); };
// la station peut être allumée ou éteinte à tout moment : l'application suit
verifierStation(); setInterval(verifierStation, 30000);
