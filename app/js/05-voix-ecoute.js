"use strict";

/* ================= VOIX (synthèse) ================= */
const synth = window.speechSynthesis;
let voices = [];
const FEM = /(natural|denise|eloise|vivienne|brigitte|amelie|amélie|audrey|marie|julie|hortense|celine|céline|charline|josephine|ariane|sylvie|coralie|yvette|jacqueline|google français|virginie|aurelie|léa|lea)/i;
const MASC = /(henri|paul|thomas|claude|remy|rémy|antoine|jerome|jérôme|alain|fabrice|guillaume|maurice|yves|jean|gerard|daniel|nicolas|sebastien)/i;
function loadVoices(){
  if (!synth) return;
  voices = synth.getVoices().filter(v => /^fr/i.test(v.lang));
  const sel = document.getElementById("st_voice");
  sel.innerHTML = '<option value="">Automatique (voix féminine)</option>' + voices.map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${v.lang})</option>`).join("");
  sel.value = settings.voice || "";
}
function pickVoice(){
  if (settings.voice){ const v = voices.find(v => v.name === settings.voice); if (v) return v; }
  const score = v => (/natural/i.test(v.name)?4:0) + (FEM.test(v.name)?2:0) - (MASC.test(v.name)?5:0) + (/fr-FR/i.test(v.lang)?1:0);
  return voices.slice().sort((a,b) => score(b)-score(a))[0] || null;
}
if (synth){ loadVoices(); synth.onvoiceschanged = loadVoices; }

let speakQueue = [], speakToken = 0, onSpeakDone = null;
// Découpe en phrases ; les phrases trop longues sont recoupées aux virgules
// (Chrome coupe parfois les énoncés de plus de ~15 secondes).
function splitSentences(t){
  const out = [];
  for (let p of (t.match(/[^.!?…;:]+[.!?…;:]*/g) || [t]).map(x => x.trim()).filter(Boolean)){
    while (p.length > 180){
      let k = p.lastIndexOf(",", 180); if (k < 60) k = p.lastIndexOf(" ", 180); if (k < 1) k = 180;
      out.push(p.slice(0, k+1).trim()); p = p.slice(k+1).trim();
    }
    if (p) out.push(p);
  }
  return out;
}
let sayQueue = [];
// opts.queue : si OKA parle déjà, la phrase attend son tour au lieu de couper la parole
function say(text, expr, done, opts){
  if (!text) return;
  wake();
  if (opts && opts.queue && av.speaking){ sayQueue.push([text, expr, done]); return; }
  stopSpeaking();
  if (expr) setExpr(expr);
  addLog("oka", text);
  const token = ++speakToken;
  speakQueue = splitSentences(text);
  onSpeakDone = done || null;
  av.speaking = true; setStateLbl("Je parle…");
  // la pose (ex. bravo, rire) s'affiche un instant puis OKA parle avec l'image bouche fermée
  const pose = EXPR[av.expr];
  const delay = pose.idle !== pose.talk ? 1100 : 0;
  // petit délai minimum : Chrome perd parfois la première phrase si on parle juste après cancel()
  setTimeout(() => { if (token !== speakToken) return; setImg(pose.talk); nextSentence(token); }, Math.max(delay, 250));
}
// sansLocale : la voix IA locale vient d'échouer pour cette phrase
function nextSentence(token, sansLocale){
  if (token !== speakToken) return;
  const s = speakQueue.shift();
  if (!s){ finishSpeaking(); return; }
  if (!sansLocale && settings.moteurVoix === "locale" && voixLocaleDispo()) return speakLocale(s, token);
  if (settings.elkey && settings.elvoice) return speakEleven(s, token);
  if (!synth){ // pas de synthèse : animation seule
    lipStart(s, 1); setTimeout(() => { lipStop(); setTimeout(() => nextSentence(token), 250); }, s.length/13*1000); return;
  }
  const u = new SpeechSynthesisUtterance(s);
  u.lang = "fr-FR"; u.rate = settings.rate; u.pitch = 1.05;
  const v = pickVoice(); if (v) u.voice = v;
  u.onstart = () => lipStart(s, settings.rate);
  u.onboundary = e => { if (e.charIndex != null) lipBoundary(e.charIndex); };
  let ended = false, started = false, tries = 0;
  const end = () => { if (ended) return; ended = true; clearInterval(keep); lipStop(); setTimeout(() => nextSentence(token), 260); };
  u.onend = end;
  u.onerror = e => { if (e.error === "interrupted" || e.error === "canceled") { if (token !== speakToken) { ended = true; clearInterval(keep); return; } } end(); };
  const onst = u.onstart; u.onstart = () => { started = true; onst(); };
  // Chrome : un pause/resume régulier évite que les voix en ligne s'arrêtent en cours de phrase
  const keep = setInterval(() => { if (ended || token !== speakToken){ clearInterval(keep); return; } if (synth.speaking && !synth.paused && v && !v.localService){ synth.pause(); synth.resume(); } }, 9000);
  // garde-fou : si la phrase n'a jamais démarré, on la relance une fois ; sinon on attend la fin réelle
  const watch = () => {
    if (ended || token !== speakToken) return;
    if (!started && !synth.speaking && !synth.pending && tries < 1){ tries++; synth.cancel(); setTimeout(() => synth.speak(u), 150); setTimeout(watch, 4000); return; }
    if (!synth.speaking && !synth.pending) return end();
    setTimeout(watch, 1000);
  };
  setTimeout(watch, s.length/10*1000/settings.rate + 2500);
  window._okaU = u; // garde une référence (sinon Chrome peut « oublier » l'énoncé et ses événements)
  synth.speak(u);
}
let elAudio = null, actx = null;
// lit un fichier audio de voix (IA locale, ElevenLabs) : les lèvres suivent le volume réel
async function jouerAudio(blob, s, token, vitesse){
  const url = URL.createObjectURL(blob);
  elAudio = new Audio(url); elAudio.playbackRate = vitesse || 1; elAudio.preservesPitch = true;
  actx = actx || new (window.AudioContext||window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  const srcN = actx.createMediaElementSource(elAudio), an = actx.createAnalyser(); an.fftSize = 512;
  srcN.connect(an); an.connect(actx.destination);
  const buf = new Uint8Array(an.fftSize);
  lipStart(s, 1);
  const tick = () => { if (!lip.active) return; an.getByteTimeDomainData(buf); let sum = 0; for (const x of buf){ const v = (x-128)/128; sum += v*v; } lip.vol = Math.sqrt(sum/buf.length); requestAnimationFrame(tick); };
  elAudio.onplay = tick;
  elAudio.onended = () => { URL.revokeObjectURL(url); lipStop(); setTimeout(() => nextSentence(token), 200); };
  await elAudio.play();
}
async function speakEleven(s, token){
  try{
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.elvoice)}`, {
      method:"POST", headers:{"xi-api-key":settings.elkey, "Content-Type":"application/json", "Accept":"audio/mpeg"},
      body:JSON.stringify({text:s, model_id:"eleven_multilingual_v2", voice_settings:{stability:.6, similarity_boost:.8}})
    });
    if (!r.ok) throw new Error("ElevenLabs "+r.status);
    const blob = await r.blob();
    if (token !== speakToken) return;
    await jouerAudio(blob, s, token, 1);
  }catch(e){
    console.warn(e); toast("Voix ElevenLabs indisponible, retour à la voix du navigateur.");
    settings.elkey = ""; speakQueue.unshift(s); nextSentence(token);
  }
}
function stopSpeaking(){
  speakToken++; speakQueue = [];
  try{ synth && (synth.speaking || synth.pending) && synth.cancel(); }catch(e){}
  if (elAudio){ try{ elAudio.pause(); }catch(e){} elAudio = null; }
  lipStop(); av.speaking = false;
}
let idleT;
function finishSpeaking(){
  clearTimeout(idleT); idleT = setTimeout(() => { if (!av.speaking && !av.listening && !av.sleeping && !alertRun) setExpr("neutre"); }, 12000);
  av.speaking = false; lipStop(); setImg(EXPR[av.expr].idle); setStateLbl(null);
  const d = onSpeakDone; onSpeakDone = null; d && d();
  if (!av.speaking && sayQueue.length){ const [t, e, dn] = sayQueue.shift(); setTimeout(() => say(t, e, dn), 400); }
}
function setStateLbl(txt, listen){
  const el = document.getElementById("stateLbl");
  if (!txt){ el.classList.add("hidden"); return; }
  el.textContent = txt; el.classList.remove("hidden"); el.classList.toggle("listen", !!listen);
}


/* ================= HISTORIQUE DE LA CONVERSATION ================= */
let log = store.get("log", []), liveText = "";
function addLog(who, text, chemin){ log.push(chemin ? {who, text, ts:Date.now(), chemin} : {who, text, ts:Date.now()}); log = log.slice(-150); store.set("log", log); renderLog(); if (who === "oka") setSimpleSub(text); }
function setLive(t){ liveText = t || ""; renderLog(); if (liveText) setSimpleSub(liveText, true); }
function setSimpleSub(t, you){
  const el = document.getElementById("simpleSub");
  el.innerHTML = `<span class="who ${you?"you":""}">${you ? esc(me()) : "OKA"} :</span> ${esc(t)}`;
  document.getElementById("sheetSub").textContent = you ? "" : t;
  requestAnimationFrame(fitCaption);
}
function bubble(m, i, arr){
  const t = new Date(m.ts||Date.now()).toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
  const last = arr && i === arr.length-1 && m.who === "oka" ? " last" : "";
  return m.who === "oka"
    ? `<div class="b oka${last}"><div class="w"><img src="${IMG_SRC.neutre}" alt="">OKA · ${t}</div>${esc(m.text)}</div>`
    : `<div class="b you${m.live?" live":""}"><div class="w">${esc(me())} · ${m.live ? "en train de parler…" : t}</div>${esc(m.text)}${m.chemin && montrerParcours() ? `<div class="trace">Arbre : ${esc(m.chemin.join(" › "))}</div>` : ""}</div>`;
}
function renderLog(){
  const el = document.getElementById("log"); if (!el) return;
  el.innerHTML = log.map(bubble).join("") + (liveText ? bubble({who:"you", text:liveText, live:true}) : "");
  el.scrollTop = el.scrollHeight;
}
document.getElementById("clearLog").onclick = () => { log = []; store.set("log", log); renderLog(); };

/* ================= ÉCOUTE (reconnaissance vocale) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recText = "", silenceT = null, maxT = null;
function startListening(){
  wake();
  if (!SR){ toast("La reconnaissance vocale n'est pas disponible ici. Utilisez Chrome ou Edge, ou écrivez votre message."); document.getElementById("typeIn").focus(); return; }
  stopSpeaking(); setImg(EXPR.ecoute.idle);
  rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true;
  recText = "";
  rec.onresult = e => {
    let fin = "", tmp = "";
    for (let i = 0; i < e.results.length; i++){ const r = e.results[i]; (r.isFinal ? (fin += r[0].transcript) : (tmp += r[0].transcript)); }
    recText = (fin + " " + tmp).trim();
    setLive(recText);
    clearTimeout(silenceT); silenceT = setTimeout(stopListening, 2000); // 2 secondes de silence
  };
  rec.onerror = e => { if (e.error === "not-allowed") toast("Autorisez le micro pour parler à OKA."); stopListening(); };
  rec.onend = () => { if (av.listening) stopListening(); };
  rec.start();
  av.listening = true; setExpr("ecoute"); setStateLbl("Je vous écoute…", true);
  document.getElementById("mic").classList.add("on"); document.getElementById("micTxt").textContent = "J'écoute…";
  setLive("");
  maxT = setTimeout(stopListening, 25000); // jusqu'à 25 secondes
}
function stopListening(){
  if (!av.listening) return;
  av.listening = false; clearTimeout(silenceT); clearTimeout(maxT);
  try{ rec && rec.stop(); }catch(e){}
  document.getElementById("mic").classList.remove("on"); document.getElementById("micTxt").textContent = "Parler";
  setStateLbl(null);
  const t = recText.trim();
  if (t) handleUser(t); else { setLive(""); setExpr("neutre"); }
}
document.getElementById("mic").onclick = () => av.listening ? stopListening() : startListening();
document.getElementById("typeForm").onsubmit = e => { e.preventDefault(); const i = document.getElementById("typeIn"); const t = i.value.trim(); if (!t) return; i.value = ""; handleUser(t); };
