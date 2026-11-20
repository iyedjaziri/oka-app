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
async function appelStationIA({system, messages, max_tokens}){
  const r = await fetch(stationUrl() + "/ia", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({system, messages, max_tokens:max_tokens || 300})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || "station " + r.status);
  noterConso(j.mesure);
  return {texte:j.texte, stop:j.stop};
}

/* ---- sobriété : qui a répondu, et combien d'énergie a coûté le calcul local ---- */
let sobriete = Object.assign({depuis:new Date().toISOString(), demandes:0, iaLocale:0, claude:0, wh:0, phrasesVoix:0}, store.get("sobriete", {}));
function compter(k){ sobriete[k]++; store.set("sobriete", sobriete); }
function noterConso(m, voix){ if (!m) return; sobriete.wh += m.wh || 0; if (voix) sobriete.phrasesVoix++; store.set("sobriete", sobriete); }
const mwh = wh => (wh * 1000).toLocaleString("fr-FR", {maximumFractionDigits:2}) + " mWh";
function texteSobriete(){
  const s = sobriete, sansIA = Math.max(0, s.demandes - s.iaLocale - s.claude), pc = s.demandes ? Math.round(sansIA * 100 / s.demandes) : 0;
  return `Depuis le ${new Date(s.depuis).toLocaleDateString("fr-FR")} : ${s.demandes} demandes, dont ${sansIA} traitées sans IA (${pc} %), ` +
    `${s.iaLocale} par le petit modèle local et ${s.claude} par Claude. Énergie estimée du calcul local (IA et ${s.phrasesVoix} phrases de voix) : ${mwh(s.wh)}. ` +
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
