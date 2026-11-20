"use strict";

/* ================= CCAS ================= */
function ccasUrl(){
  const base = "https://www.pour-les-personnes-agees.gouv.fr/annuaire-ccas";
  if (!geo || geo.cc !== "FR" || !geo.admin2 || !geo.postcodes.length) return (profile?.pays||"FR")==="FR" && norm(profile?.ville).trim()==="nice" ? base + "/alpes-maritimes-06" : base;
  const pc = geo.postcodes[0];
  let dep = pc.slice(0,2);
  if (dep === "20") dep = +pc < 20200 ? "2a" : "2b";
  if (dep === "97") dep = pc.slice(0,3);
  const slug = norm(geo.admin2).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}/${slug}-${dep}`;
}

/* ================= PERSONNES / MISE EN RELATION ================= */
const people = () => (profile?.people || []);
const urgents = () => people().filter(p => p.urgence);
const findPerson = w => people().find(p => norm(p.lien+" "+p.nom).includes(w));
function firstProche(d){ const p = people().find(p => p.type === "proche"); return p ? p.nom : d; }
function matchPerson(n){
  return people().find(p => n.includes(norm(p.nom)) || norm(p.nom).split(" ").some(w => w.length > 2 && n.includes(w)) || (p.lien && n.includes(norm(p.lien)))) ||
    (n.includes("medecin") || n.includes("docteur") ? findPerson("medecin") : null) ||
    (n.includes("aide") ? people().find(p => p.type === "aidant") : null);
}
function callPerson(p, silent){
  showTab("proches");
  const go = () => {
    highlight(p.id);
    if (matchMedia("(pointer:coarse)").matches){ toast("Appel de " + p.nom + "…"); setTimeout(() => { location.href = "tel:" + p.tel.replace(/\s/g,""); }, 400); }
    else toast("Appel de " + p.nom + " (" + p.tel + ") — sur tablette ou téléphone, l'appel est lancé directement.", 6000);
  };
  if (silent) return go();
  say("J'appelle " + p.nom + " tout de suite.", "sociable", go);
}
function highlight(id){ const el = document.querySelector(`[data-pid="${id}"]`); if (el){ el.scrollIntoView({block:"center", behavior:"smooth"}); el.style.outline = "4px solid var(--panda)"; setTimeout(() => el.style.outline = "", 2500); } }

/* ================= URGENCE : proches puis secours ================= */
let alertRun = null;
function triggerAlert(origin, silent){
  const P = PAYS[profile?.pays || "FR"] || PAYS.FR;
  const list = urgents();
  setExpr("compassion");
  postMsg("proches", "OKA", `Alerte : ${me()} a signalé un problème à ${hm()}${origin && origin[0] !== "(" ? " (« " + origin + " »)" : ""}. OKA appelle les contacts d'urgence.`, "sys");
  alertRun = {i:0, list, P, timer:null};
  document.getElementById("alertBox").classList.remove("hidden");
  document.getElementById("al_title").textContent = "Alerte en cours";
  renderAlert();
  say(`Je suis là, ${me()}. Restez calme et ne bougez pas si vous avez mal. Je préviens ${list[0] ? list[0].nom : "les secours"} tout de suite.`, "compassion", () => {});
}
function renderAlert(){
  const a = alertRun; if (!a) return;
  const steps = a.list.map((p,i) => `<div class="step ${i<a.i?"fail":i===a.i?"cur":""}">${ic(i<a.i?"x":i===a.i?"phone":"clock")} ${esc(p.nom)} <span class="muted small">(${esc(p.lien)} · ${esc(p.tel)})</span></div>`).join("") +
    `<div class="step ${a.i>=a.list.length?"cur":""}">${ic("medic")} Secours : ${a.P.secours}${a.P.general!==a.P.secours?" ou "+a.P.general:""} <span class="muted small">(${a.P.nom})</span></div>`;
  document.getElementById("al_steps").innerHTML = steps;
  const act = document.getElementById("al_actions");
  clearTimeout(a.timer);
  if (a.i < a.list.length){
    const p = a.list[a.i];
    document.getElementById("al_msg").textContent = "J'appelle " + p.nom + "…";
    act.innerHTML = `<a class="btn callbig" href="tel:${esc(p.tel)}">${ic("phone")} Appeler ${esc(p.nom)}</a>
      <button class="btn" id="al_ok" style="background:var(--ok)">${esc(p.nom)} a répondu</button>
      <button class="btn ghost" id="al_no">Pas de réponse</button>
      <div class="muted small" style="width:100%" id="al_cd"></div>`;
    document.getElementById("al_ok").onclick = () => endAlert("J'ai bien prévenu " + p.nom + ". Restez où vous êtes, de l'aide arrive.");
    document.getElementById("al_no").onclick = () => { a.i++; renderAlert(); if (a.i < a.list.length) say("Pas de réponse. J'appelle " + a.list[a.i].nom + ".", "compassion"); else say("Personne ne répond. J'appelle les secours, le " + a.P.secours + ".", "compassion"); };
    let s = 30; const cd = () => { const el = document.getElementById("al_cd"); if (!el) return; el.textContent = "Sans réponse, je passe à la personne suivante dans " + s + " s."; if (s-- <= 0) document.getElementById("al_no").click(); else a.timer = setTimeout(cd, 1000); }; cd();
  } else {
    document.getElementById("al_msg").textContent = "Personne n'a répondu : j'appelle les secours.";
    act.innerHTML = `<a class="btn red callbig" href="tel:${a.P.secours}">${ic("medic")} Appeler le ${a.P.secours}</a>${a.P.general!==a.P.secours?`<a class="btn red callbig" href="tel:${a.P.general}">${a.P.general}</a>`:""}<div class="muted small" style="width:100%">${esc(a.P.detail)}</div>`;
    postMsg("proches", "OKA", `Aucun contact n'a répondu : OKA a appelé les secours (${a.P.secours}).`, "sys");
  }
}
function endAlert(msg){
  if (alertRun) clearTimeout(alertRun.timer);
  alertRun = null;
  document.getElementById("alertBox").classList.add("hidden");
  if (msg){ postMsg("proches", "OKA", msg, "sys"); say(msg, "compassion"); }
}
document.getElementById("al_cancel").onclick = () => { endAlert(); postMsg("proches", "OKA", `${me()} indique que tout va bien. Alerte annulée.`, "sys"); say("D'accord. Je suis soulagée. Je reste là si besoin.", "heureux"); };

/* ================= ACTIVITÉS / INSCRIPTION ================= */
const nextActivity = () => activities.filter(a => !a.inscrit && a.date >= iso(new Date())).sort(byTime)[0];
function matchActivity(n){ return activities.find(a => norm(a.titre).split(" ").some(w => w.length > 4 && n.includes(w))); }
function inscrire(id, speak, suite){
  const a = activities.find(x => x.id === id); if (!a) return;
  if (a.inscrit){ if (speak) say("Vous êtes déjà inscrite à " + a.titre + ".", "bonne"); return; }
  const aev = {id:"act_"+a.id, date:a.date, heure:a.heure, titre:a.titre, type:"activite", lieu:a.lieu};
  a.inscrit = true;
  if ((a.participants || []).length) openActivityRoom(a);
  if (conflictsOf(aev).length){ saveAll(); render(); tryAddEvent(aev); return; }
  agenda.push(aev); agenda.sort(byTime);
  saveAll(); render();
  confettis(); // petite récompense
  if (speak) say("C'est fait ! Vous êtes inscrite à " + a.titre + ", " + relDay(a.date) + " à " + hourSpeech(a.heure) + ". C'est noté dans votre agenda" +
    (rooms["act_" + a.id] ? ", et vous pouvez écrire aux autres participants dans les messages." : ".") + rappelInscription(a), "bonne", suite);
}
function desinscrire(id){
  const a = activities.find(x => x.id === id); if (!a) return;
  a.inscrit = false; agenda = agenda.filter(e => e.id !== "act_"+id); saveAll(); render();
}
function openActivityRoom(a){
  const rid = "act_" + a.id;
  if (rooms[rid]) return;
  rooms[rid] = {nom:a.titre, membres:a.participants.slice(), activite:a.id, msgs:[
    {from:"OKA", text:`Bienvenue dans le groupe « ${a.titre} » (${relDay(a.date)} à ${a.heure}, ${a.lieu}).`, ts:Date.now(), kind:"oka"},
    {from:a.participants[0], text:`Bonjour ${me()} ! Contente que vous veniez. On se retrouve sur place ?`, ts:Date.now()+1}
  ]};
  unread[rid] = (unread[rid]||0) + 1;
}

/* ================= CHAT ================= */
let curRoom = "proches";
const REPLIES = ["Avec plaisir !", "Très bonne idée !", "On en parle mercredi ?", "Merci pour votre message, à bientôt !", "Je serai là aussi.", "Prenez soin de vous.", "Je vous appelle ce soir.", "Ça me fait plaisir d'avoir de vos nouvelles !"];
function postMsg(rid, from, text, kind){
  if (!rooms[rid]) return;
  rooms[rid].msgs.push({from, text, ts:Date.now(), kind});
  if (from !== me() && !(tab === "chat" && curRoom === rid)) unread[rid] = (unread[rid]||0) + 1;
  saveAll(); render();
}
function sendChat(text){
  postMsg(curRoom, me(), text);
  if (settings.sim === "1"){
    const r = rooms[curRoom], who = r.membres[Math.floor(Math.random()*r.membres.length)];
    const rid = curRoom;
    setTimeout(() => {
      postMsg(rid, who, REPLIES[Math.floor(Math.random()*REPLIES.length)]);
      if (!av.listening) say("Nouveau message de " + who + ".", "sociable", null, {queue:true});
    }, 3000 + Math.random()*3000);
  }
}
function messagesSpeech(){
  const n = Object.values(unread).reduce((a,b) => a+b, 0);
  const last = rooms[curRoom]?.msgs.filter(m => m.from !== me()).slice(-1)[0];
  if (!n && !last) return "Vous n'avez pas de nouveau message.";
  return (n ? "Vous avez " + n + " message" + (n>1?"s":"") + " non lu" + (n>1?"s":"") + ". " : "") + (last ? "Le dernier, de " + last.from + " : " + last.text : "");
}
