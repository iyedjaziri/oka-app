"use strict";

/* ================= INTERFACE ================= */
let tab = "today";
const TAB_TITLES = {today:"Aujourd'hui", agenda:"Mon agenda", proches:"Mes proches", sorties:"Sorties", chat:"Messages", urgence:"Urgence", log:"Historique de la conversation", jeux:"Jeux avec OKA"};
let winOpen = false;
// ouvre la fenêtre d'un onglet (clic sur la barre latérale, ou demande à OKA)
function showTab(t, focusId){
  tab = t; if (t === "chat"){ unread[curRoom] = 0; store.set("unread", unread); }
  openWin();
  render();
  if (focusId === "wxSec") document.getElementById("sheetTitle").textContent = "Météo";
  if (focusId) setTimeout(() => { const el = document.getElementById(focusId); el && el.scrollIntoView({block:"start", behavior:"smooth"}); }, 60);
}
function openWin(){
  winOpen = true;
  document.getElementById("sheetTitle").textContent = TAB_TITLES[tab] || "";
  document.body.classList.add("win-open");
  document.body.classList.toggle("tab-log", tab === "log");
  layoutSimple();
  document.getElementById("panel").scrollTop = 0;
  if (tab === "log") renderLog();
  requestAnimationFrame(fitAll);
}
function closeWin(){ winOpen = false; document.body.classList.remove("win-open", "tab-log"); render(); requestAnimationFrame(fitAll); }
document.getElementById("sheetClose").onclick = closeWin;
// l'historique s'ouvre sur les derniers messages ; on remonte pour voir les précédents
function ouvrirHistorique(){ wake(); if (winOpen && tab === "log") return closeWin(); showTab("log"); requestAnimationFrame(() => { const l = document.getElementById("log"); l.scrollTop = l.scrollHeight; }); }
document.getElementById("btnHist").onclick = ouvrirHistorique;
// l'encadré sous l'avatar ne montre que la dernière phrase : le toucher ouvre tout l'historique
document.getElementById("simpleSub").onclick = ouvrirHistorique;

/* ================= COULEURS DE SAISON + MODE SOMBRE ================= */
// Palettes adoucies : fonds crème, cartes chaudes, contrastes forts pour la lecture.
const THEMES = {
  printemps:{light:{bg:"#FBF6EA", card:"#FFFDF6", btn:"#3E5B36", nav:"#8A9A3B", acc:"#E9B43C", text:"#2A2717", alert:"#D2453F"},
             dark: {bg:"#18150E", card:"#231F15", btn:"#5B7A47", nav:"#B3C062", acc:"#E9B43C", text:"#F4EEDB", alert:"#EC655C"}},
  ete:      {light:{bg:"#FDF4E6", card:"#FFFBF3", btn:"#2E5659", nav:"#D3623B", acc:"#F0B03C", text:"#2B1E15", alert:"#DC472D"},
             dark: {bg:"#1A130D", card:"#261C14", btn:"#3E7477", nav:"#EA845C", acc:"#F0B03C", text:"#F8EDDF", alert:"#F0694D"}},
  automne:  {light:{bg:"#FBF3E6", card:"#FFFBF4", btn:"#4A2C18", nav:"#C85A17", acc:"#F2A93B", text:"#2A180E", alert:"#C92A1D"},
             dark: {bg:"#19110C", card:"#251912", btn:"#8A5532", nav:"#E57E35", acc:"#F2A93B", text:"#F6EBDD", alert:"#E5483A"}},
  hiver:    {light:{bg:"#F7F0E7", card:"#FFFCF7", btn:"#3A3F58", nav:"#8C5B3B", acc:"#D9A057", text:"#241F1C", alert:"#C2412D"},
             dark: {bg:"#17130F", card:"#221C17", btn:"#58617F", nav:"#C08C67", acc:"#D9A057", text:"#F3ECE3", alert:"#E36452"}}
};
const ICO = {
  printemps:{light:["#5F8A34","#C9567A","#B98A1F"], dark:["#A9C462","#EE93AA","#E9B43C"]},
  ete:      {light:["#C85A33","#2B7378","#C48A1E"], dark:["#EA845C","#5FB0B5","#F0B03C"]},
  automne:  {light:["#C85A17","#8A4B22","#C27F14"], dark:["#E57E35","#C98A5A","#F2A93B"]},
  hiver:    {light:["#3F5A78","#8C5B3B","#A8742F"], dark:["#8FA9C8","#C08C67","#D9A057"]}
};
const SEASON_EMOJI = {printemps:"🌸", ete:"☀️", automne:"🍂", hiver:"❄️"};
const SEASON_NAME = {printemps:"Printemps", ete:"Été", automne:"Automne", hiver:"Hiver"};
const SEASONS = ["printemps","ete","automne","hiver"];
function seasonOf(d){ const m = d.getMonth()+1, j = d.getDate(), x = m*100+j; return x >= 321 && x < 621 ? "printemps" : x >= 621 && x < 923 ? "ete" : x >= 923 && x < 1221 ? "automne" : "hiver"; }
function lum(hex){ const c = hex.match(/\w\w/g).map(h => { const v = parseInt(h,16)/255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };

/* ---- particules de saison : peu nombreuses, lentes, discrètes ---- */
const fx = {cv:document.getElementById("seasonFx"), parts:[], season:"", dark:false, raf:0};
fx.ctx = fx.cv.getContext("2d");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function fxResize(){ const r = devicePixelRatio || 1; fx.cv.width = innerWidth*r; fx.cv.height = innerHeight*r; fx.ctx.setTransform(r,0,0,r,0,0); }
function fxNew(top){
  const W = innerWidth, H = innerHeight, sz = fx.season === "ete" ? 2 + Math.random()*3 : fx.season === "hiver" ? 2 + Math.random()*3.5 : 6 + Math.random()*6;
  return {x:Math.random()*W, y: top ? -20 : Math.random()*H, s:sz, vy:(fx.season === "ete" ? -.15 - Math.random()*.25 : .25 + Math.random()*.45), vx:(Math.random()-.5)*.3,
          a:Math.random()*Math.PI*2, va:(Math.random()-.5)*.02, ph:Math.random()*6, k:Math.floor(Math.random()*3)};
}
function fxStart(season, dark){
  if (fx.season === season && fx.dark === dark) return;
  fx.season = season; fx.dark = dark; fxResize();
  const n = Math.round(Math.min(26, innerWidth/55));
  fx.parts = Array.from({length:n}, () => fxNew(false));
  cancelAnimationFrame(fx.raf);
  if (!reduceMotion) fx.raf = requestAnimationFrame(fxTick); else fxDraw();
}
const FX_COL = {
  hiver:    {light:["#9fb3c8","#b8c7d6","#8aa1b9"], dark:["#ffffff","#dfe8f1","#c9d6e4"]},
  printemps:{light:["#f2a6ba","#f7c6d3","#e98fa8"], dark:["#f2a6ba","#f7c6d3","#e98fa8"]},
  automne:  {light:["#d9772b","#e8a23a","#b5541f"], dark:["#e8893a","#f2b04a","#c9652a"]},
  ete:      {light:["#f0b03c","#f6c95c","#e8a030"], dark:["#f6c95c","#ffe08a","#f0b03c"]}
};
function fxDraw(){
  const c = fx.ctx, W = innerWidth, H = innerHeight, col = FX_COL[fx.season][fx.dark ? "dark" : "light"];
  c.clearRect(0, 0, W, H);
  for (const p of fx.parts){
    c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = col[p.k];
    if (fx.season === "hiver"){ c.globalAlpha = .75; c.beginPath(); c.arc(0, 0, p.s, 0, Math.PI*2); c.fill(); }
    else if (fx.season === "ete"){ c.globalAlpha = .35 + .3*Math.sin(p.ph); c.beginPath(); c.arc(0, 0, p.s, 0, Math.PI*2); c.fill(); }
    else if (fx.season === "printemps"){ c.globalAlpha = .7; c.beginPath(); c.ellipse(0, 0, p.s*.55, p.s*.3, 0, 0, Math.PI*2); c.fill(); }
    else { c.globalAlpha = .7; c.beginPath(); c.moveTo(0, -p.s*.6); c.quadraticCurveTo(p.s*.5, 0, 0, p.s*.6); c.quadraticCurveTo(-p.s*.5, 0, 0, -p.s*.6); c.fill(); }
    c.restore();
  }
}
function fxTick(){
  const W = innerWidth, H = innerHeight;
  for (let i = 0; i < fx.parts.length; i++){
    const p = fx.parts[i];
    p.ph += .015; p.y += p.vy; p.x += p.vx + Math.sin(p.ph)*.35; p.a += p.va;
    if (p.y > H + 20 || p.y < -30 || p.x < -30 || p.x > W + 30){ const q = fxNew(true); if (fx.season === "ete") q.y = H + 10; fx.parts[i] = q; }
  }
  fxDraw();
  fx.raf = requestAnimationFrame(fxTick);
}
window.addEventListener("resize", () => { fxResize(); if (reduceMotion) fxDraw(); });
document.addEventListener("visibilitychange", () => { cancelAnimationFrame(fx.raf); if (!document.hidden && !reduceMotion) fx.raf = requestAnimationFrame(fxTick); });

function applyTheme(){
  const season = settings.theme === "auto" || !THEMES[settings.theme] ? seasonOf(new Date()) : settings.theme;
  const dark = settings.dark === "1";
  const t = THEMES[season][dark ? "dark" : "light"], R = document.documentElement.style;
  for (const k in t) R.setProperty("--c-" + k, t[k]);
  // texte sur la couleur de navigation : blanc ou foncé, selon le meilleur contraste
  const dk = dark ? t.bg : t.text;
  R.setProperty("--on-nav", contrast("#FFFFFF", t.nav) >= contrast(dk, t.nav) ? "#FFFFFF" : dk);
  document.body.classList.toggle("dark", dark);
  ICO[season][dark ? "dark" : "light"].forEach((c, i) => R.setProperty("--ico" + (i+1), c));
  document.body.dataset.season = season;
  fxStart(season, dark);
  const sb = document.getElementById("seasonBtn");
  sb.textContent = SEASON_EMOJI[season]; sb.title = "Couleurs : " + SEASON_NAME[season] + " (toucher pour changer)"; sb.setAttribute("aria-label", sb.title);
  document.getElementById("seasonName").textContent = SEASON_NAME[season];
  document.getElementById("seasonFloat").textContent = SEASON_EMOJI[season];
  currentSeason = season;
  document.getElementById("darkIc").innerHTML = ic(dark ? "sun" : "moon");
  document.getElementById("darkTxt").textContent = dark ? "Mode clair" : "Mode sombre";
  document.getElementById("btnDark").setAttribute("aria-pressed", dark ? "true" : "false");
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.card;
}
let currentSeason = "automne";
document.getElementById("seasonBtn").onclick = () => {
  settings.theme = SEASONS[(SEASONS.indexOf(currentSeason) + 1) % 4];
  store.set("settings", settings); applyTheme();
};
document.getElementById("btnDark").onclick = () => { settings.dark = settings.dark === "1" ? "0" : "1"; store.set("settings", settings); applyTheme(); };
const FS = {petit:.85, moyen:1, grand:1.3};
function applyDisplay(){
  applyTheme();
  document.documentElement.style.setProperty("--fs", FS[settings.fs] || 1);
  layoutSimple();
}
// la barre micro + écriture reste en bas ; les fenêtres s'arrêtent juste au-dessus
function layoutSimple(){
  const nav = document.getElementById("tabs");
  document.documentElement.style.setProperty("--ctrlH", document.querySelector(".controls").offsetHeight + "px");
  document.documentElement.style.setProperty("--hdrH", document.querySelector("header").offsetHeight + "px");
  document.documentElement.style.setProperty("--navH", (getComputedStyle(nav).position === "fixed" ? nav.offsetHeight : 0) + "px");
  alignSide(true);
}
// barre latérale alignée sur la scène de l'avatar : même haut, même hauteur (ordinateur et tablette)
function alignSide(largeur){
  const nav = document.getElementById("tabs"), h = document.getElementById("stage").offsetHeight, R = document.documentElement.style;
  const ok = getComputedStyle(nav).position !== "fixed" && h > 200;
  nav.classList.toggle("aligned", ok);
  if (!ok) return;
  R.setProperty("--sideH", h + "px");
  // largeur : suit la hauteur, et assez large pour les libellés en grands caractères
  if (largeur) R.setProperty("--sideW", Math.round(Math.max(118 * (FS[settings.fs] || 1), Math.min(150, (h - 30) / 3.85))) + "px");
}
if (window.ResizeObserver) new ResizeObserver(() => alignSide(false)).observe(document.getElementById("stage"));
window.addEventListener("resize", layoutSimple);
/* ---- menu des réglages rapides (roue en haut à droite) ---- */
const QM = document.getElementById("quickMenu"), QB = document.getElementById("btnMenu"), SF = document.getElementById("seasonFloat");
const calme = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const menuOuvert = () => !QM.classList.contains("hidden") && !QM.classList.contains("closing");
[...QM.children].forEach((el, i) => el.style.setProperty("--i", i)); // ordre d'apparition, un à un
function quickMenu(open){
  if (open === menuOuvert()) return;
  QB.classList.toggle("on", open); QB.setAttribute("aria-expanded", open ? "true" : "false");
  SF.classList.toggle("away", open); // l'icône de saison est dans le menu tant qu'il est ouvert
  if (open){ QM.classList.remove("closing", "hidden"); majQuickMenu(); return; }
  if (calme()){ QM.classList.add("hidden"); return; }
  QM.classList.add("closing");
  setTimeout(() => { if (QM.classList.contains("closing")){ QM.classList.remove("closing"); QM.classList.add("hidden"); } }, 180);
}
// l'icône de saison glisse jusqu'à sa place dans le menu
SF.onclick = e => {
  e.stopPropagation(); wake();
  const a = SF.getBoundingClientRect(), t = document.getElementById("seasonBtn");
  quickMenu(true);
  if (calme() || !SF.animate) return;
  // position finale (sans les animations d'apparition en cours)
  const bx = QM.offsetLeft + QM.clientLeft + t.offsetLeft + t.offsetWidth/2, by = QM.offsetTop + QM.clientTop + t.offsetTop + t.offsetHeight/2;
  t.style.visibility = "hidden"; SF.classList.add("flying");
  const fin = () => { t.style.visibility = ""; SF.classList.remove("flying"); SF.getAnimations().forEach(x => x.cancel()); };
  SF.animate([{transform:"none"}, {transform:`translate(${bx - a.left - a.width/2}px, ${by - a.top - a.height/2}px) scale(${t.offsetWidth / a.width})`}],
    {duration:650, easing:"cubic-bezier(.45,0,.2,1)", fill:"forwards"}).onfinish = fin;
};
function majQuickMenu(){ QM.querySelectorAll("[data-fs]").forEach(b => { const on = b.dataset.fs === settings.fs; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); }
QB.onclick = e => { e.stopPropagation(); quickMenu(!menuOuvert()); };
document.addEventListener("click", e => { if (menuOuvert() && !QM.contains(e.target)) quickMenu(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && menuOuvert()){ quickMenu(false); QB.focus(); } });
// la taille change, le menu et la roue restent en place
QM.querySelectorAll("[data-fs]").forEach(b => b.onclick = () => { settings.fs = b.dataset.fs; store.set("settings", settings); applyDisplay(); majQuickMenu(); });
["btnProfile", "btnHist", "btnSettings"].forEach(id => document.getElementById(id).addEventListener("click", () => quickMenu(false)));
// un clic ouvre la fenêtre ; un second clic sur le même onglet la referme
document.getElementById("tabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; wake(); if (winOpen && tab === b.dataset.tab) closeWin(); else showTab(b.dataset.tab); };
const COLORS = ["var(--c-nav)","var(--c-btn)","#8a5a3b","#5b7f6a","#5b7fa3","#a0522d"];
const initials = n => n.replace(/^(Dr|Mme|M\.)\s+/,"").slice(0,1).toUpperCase();

function render(){
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", winOpen && b.dataset.tab === tab));
  document.getElementById("btnHist").classList.toggle("on", winOpen && tab === "log");
  const n = Object.values(unread).reduce((a,b) => a+b, 0), dot = document.getElementById("chatDot");
  dot.textContent = n; dot.classList.toggle("hidden", !n);
  const P = document.getElementById("panel");
  P.innerHTML = `<div id="panelIn" class="${tab === "chat" ? "fill" : tab === "sorties" ? "defile" : ""}">` + ({today:viewToday, agenda:viewAgenda, proches:viewProches, sorties:viewSorties, chat:viewChat, urgence:viewUrgence, log:() => "", jeux:viewJeux}[tab] || viewToday)() + `</div>`;
  bindPanel();
  fitPanel();
}

/* ---- rien ne défile : le contenu d'une fenêtre est ajusté pour tenir dans l'écran ---- */
function fitBox(box, avail){
  // plus grand zoom (entre 0,45 et 1) pour lequel le contenu tient sans défiler
  const fits = z => { box.style.zoom = z; return box.getBoundingClientRect().height <= avail + 1; };
  if (fits(1)) return;
  let lo = .45, hi = 1;
  if (!fits(lo)) return;
  for (let k = 0; k < 7; k++){ const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  fits(lo);
}
function fitPanel(){
  const P = document.getElementById("panel"), inn = document.getElementById("panelIn");
  // Sorties : taille fixe et défilement (les sous-onglets ne changent plus de taille d'un clic à l'autre)
  if (!inn || !winOpen || tab === "log" || inn.classList.contains("fill") || inn.classList.contains("defile")) { if (inn) inn.style.zoom = 1; return; }
  const cs = getComputedStyle(P);
  document.documentElement.style.setProperty("--panH", P.clientHeight + "px");
  fitBox(inn, P.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
}
function fitModals(){
  // les réglages défilent (barre de défilement) au lieu d'être rétrécis : tout reste lisible
  document.querySelectorAll(".modal:not(.hidden):not(#settingsModal) .box, .alert:not(.hidden) .box").forEach(b => fitBox(b, innerHeight - 40));
}
function fitCaption(){
  const el = document.getElementById("simpleSub"); if (!el) return;
  el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollHeight > el.clientHeight + 1 && fs > 15){ fs -= 1; el.style.fontSize = fs + "px"; }
}
function fitAll(){ layoutSimple(); fitPanel(); fitModals(); fitCaption(); }
window.addEventListener("resize", () => requestAnimationFrame(fitAll));
new MutationObserver(() => requestAnimationFrame(fitModals)).observe(document.body, {subtree:true, attributes:true, attributeFilter:["class"], childList:false});

function viewToday(){
  const t = iso(new Date());
  const next = agenda.filter(e => e.date > t || (e.date === t && e.heure >= hm())).sort(byTime)[0];
  const al = weatherAlert();
  const wx = weather ? `<div class="wx">${weather.days.map((d,i) => `<div class="card"><div class="small muted">${i===0?"Aujourd'hui":i===1?"Demain":JOURS[new Date(d.date+"T12:00").getDay()]}</div><div class="e">${wxIc(d.code)}</div><div class="big">${d.max}°</div><div class="muted">min ${d.min}°${d.pluie>=1?` · ${Math.round(d.pluie)} mm`:""}</div></div>`).join("")}</div>` : `<p class="muted">Chargement de la météo…</p>`;
  const ins = activities.filter(a => a.inscrit).length;
  const cl = agendaClashes();
  return `<h2>Bonjour ${esc(me())}</h2>
  ${cl.map(([a,b]) => `<div class="card warn"><div class="big" style="font-size:calc(22px*var(--fs))">${ic("alert")} Deux rendez-vous à moins d'une demi-heure</div><div style="font-size:calc(20px*var(--fs))">${esc(relDay(a.date))} : ${esc(a.titre)} (${a.heure.replace(":","h")}) et ${esc(b.titre)} (${b.heure.replace(":","h")}). Vous pouvez en supprimer un dans l'agenda.</div></div>`).join("")}
  ${al ? `<div class="card ${al.k==="froid"?"blue":"red"}"><div class="big">${ic("alert")} Météo préventive : ${esc(al.titre)}</div><ul class="adv">${al.conseils.map(c => `<li>${esc(c)}</li>`).join("")}</ul><button class="btn sm" style="margin-top:8px" data-say="wx">${ic("speaker")} Écouter les conseils</button></div>` : ""}
  ${viewAnnonces()}
  <h3>Prochain rendez-vous</h3>
  ${next ? `<div class="card blue"><div class="big">${esc(next.titre)}</div><div style="font-size:calc(22px*var(--fs))">${esc(relDay(next.date))} à ${next.heure.replace(":","h")}${next.lieu?" · "+esc(next.lieu):""}</div></div>` : `<div class="card">Rien de prévu.</div>`}
  <h3 id="wxSec">Météo</h3>${wx}
  `;
}
let agendaForm = false;
function viewAgenda(){
  const start = new Date(); const days = [...Array(7)].map((_,i) => iso(addDays(start,i)));
  const t = iso(start), now = hm();
  return `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Ma semaine</h2><div class="row"><button class="btn" data-say="agenda">${ic("speaker")} Lire</button><button class="btn ${agendaForm ? "ghost" : "orange"}" data-a="agf">${agendaForm ? ic("x") + " Fermer" : ic("calendar") + " Ajouter"}</button></div></div>
  ${agendaForm ? `<form id="addEv" class="card warn row" style="margin-top:10px"><input class="f" style="flex:2;min-width:180px" name="titre" placeholder="Ex. Dentiste" required><input class="f" style="flex:1;min-width:140px" type="date" name="date" value="${t}" required><input class="f" style="flex:1;min-width:100px" type="time" name="heure" value="10:00" required><button class="btn">Ajouter</button></form>` : ""}
  <div class="week">${days.map(d => { const ev = agenda.filter(e => e.date === d).sort(byTime);
    return `<div class="day ${d===t?"today":""}"><div class="dn">${d===t?"Aujourd'hui":esc(dayLabel(d))}</div><div class="evs">${ev.length ? ev.map(e => `<div class="ev ${d===t&&e.heure<now?"past":""}${conflictsOf(e).length?" clash":""}"><span class="h">${e.heure.replace(":","h")}</span><span>${ic({rdv:"health",activite:"star",proche:"heart",aidant:"home"}[e.type]||"calendar")} ${esc(e.titre)}</span><button class="x" data-del="${e.id}" title="Supprimer">${ic("x")}</button></div>`).join("") : `<div class="empty">Rien de prévu</div>`}</div></div>`; }).join("")}</div>`;
}
function viewProches(){
  const list = people(), lab = {proche:"Proche", soignant:"Soignant", aidant:"Aidant"};
  if (!list.length) return `<h2>Mise en relation</h2><p>Aucune personne dans le profil.</p><button class="btn" data-open="profile">Compléter le profil</button>`;
  const order = ["proche","soignant","aidant"], sorted = list.slice().sort((a,b) => order.indexOf(a.type) - order.indexOf(b.type));
  return `<h2>Mise en relation</h2><div class="plist2">${sorted.map(p => `<div class="prow" data-pid="${p.id}">
    <div class="av" style="background:${COLORS[list.indexOf(p)%COLORS.length]}">${esc(initials(p.nom))}</div>
    <div class="pinfo"><div class="pn">${esc(p.nom)}</div><div class="muted small">${esc(p.lien)} · ${lab[p.type]||""}${p.urgence?" · urgence":""}</div></div>
    <div class="pact"><a class="btn sm" href="tel:${esc(p.tel)}" aria-label="Appeler ${esc(p.nom)}">${ic("phone")}<span>Appeler</span></a><a class="btn sm alt" href="sms:${esc(p.tel)}" aria-label="SMS à ${esc(p.nom)}">${ic("mail")}<span>SMS</span></a></div></div>`).join("")}</div>`;
}
let sortiesView = "act";
function viewSorties(){
  const url = ccasUrl(), ville = profile?.ville || "Nice", isNice = norm(ville).trim() === "nice";
  const fr = (profile?.pays || "FR") === "FR";
  const seg = `<div class="seg"><button class="${sortiesView === "act" ? "on" : ""}" data-a="sv" data-i="act">${ic("star")} Activités</button><button class="${sortiesView === "ville" ? "on" : ""}" data-a="sv" data-i="ville">${ic("home")} Maisons des seniors</button><button class="${sortiesView === "ccas" ? "on" : ""}" data-a="sv" data-i="ccas">${ic("building")} CCAS et associations</button></div>`;
  if (sortiesView === "ville") return seg + viewVille();
  if (sortiesView === "act") return seg + `<div class="plist2">${activities.slice().sort(byTime).map(a => `<div class="prow ${a.inscrit?"okrow":""}">
    <div class="pinfo"><div class="pn">${esc(a.titre)}</div><div class="small">${esc(relDay(a.date))} à ${a.heure.replace(":","h")} · ${esc(a.lieu)}</div></div>
    <div class="pact">${a.inscrit ? `<button class="btn sm alt" data-room="act_${a.id}">${ic("chat")}<span>Groupe</span></button><button class="btn sm ghost" data-unsub="${a.id}" aria-label="Se désinscrire">${ic("x")}</button>` : `<button class="btn sm" data-sub="${a.id}">S'inscrire</button>`}</div></div>`).join("")}</div>`;
  return seg + `
  <div class="card blue"><div class="big">${ic("building")} CCAS de ${esc(ville)}</div>
  ${fr ? `<p style="margin:6px 0">Le Centre Communal d'Action Sociale accompagne les seniors : aides, repas, activités, visites.</p><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir l'annuaire des CCAS ${geo?.admin2 ? "· "+esc(geo.admin2) : ""}</a><div class="muted small" style="margin-top:6px">${esc(url)}</div>`
       : `<p>L'annuaire des CCAS couvre la France. Ailleurs, adressez-vous à la mairie de ${esc(ville)}.</p>`}</div>
  ${isNice ? `<h3>À Nice</h3><div class="grid2">${NICE_LIEUX.map(l => `<div class="card"><div class="big" style="font-size:calc(21px*var(--fs))">${esc(l.n)}</div><div class="small">${esc(l.d)}</div></div>`).join("")}</div>`
           : `<h3>Partout en France</h3><div class="grid2">${NICE_LIEUX.slice(3).map(l => `<div class="card"><div class="big" style="font-size:calc(21px*var(--fs))">${esc(l.n)}</div><div class="small">${esc(l.d)}</div></div>`).join("")}</div>`}`;
}
function viewChat(){
  const r = rooms[curRoom] || rooms.proches;
  return `<h2>Messages</h2><div class="chatwrap"><div class="rooms">${Object.entries(rooms).map(([id, x]) => `<button class="room ${id===curRoom?"active":""}" data-room="${id}"><div class="n">${ic(id==="proches"?"people":"star")} ${esc(x.nom)}</div><div class="muted small mem">${esc(x.membres.join(", "))}</div>${unread[id]?`<span class="dot">${unread[id]}</span>`:""}</button>`).join("")}</div>
  <div class="chatmain"><div class="msgs" id="msgs">${r.msgs.map(m => `<div class="msg ${m.from===me()?"me":m.kind==="sys"?"sys":m.from==="OKA"?"oka":""}"><div class="w">${esc(m.from)} · ${new Date(m.ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>${esc(m.text)}</div>`).join("")}</div>
  <form class="chatin" id="chatForm"><input id="chatIn" placeholder="Écrire un message…" autocomplete="off"><button class="btn">Envoyer</button><button type="button" class="btn alt" data-say="lastmsg" title="Lire" aria-label="Lire">${ic("speaker")}</button></form></div></div>`;
}
function viewUrgence(){
  const P = PAYS[profile?.pays || "FR"] || PAYS.FR, l = urgents();
  return `<h2>Contact d'urgence</h2>
  <div class="card red"><p style="margin:0 0 10px;font-size:calc(21px*var(--fs))">OKA appelle d'abord vos proches, dans l'ordre. Si personne ne répond, OKA appelle les secours.</p>
  <button class="btn red callbig" id="sosBtn">${ic("siren")} J'ai besoin d'aide</button>
  <p class="small muted" style="margin:10px 0 0">OKA déclenche aussi l'alerte si vous dites par exemple « je suis tombée » ou « aidez-moi ».</p></div>
  <h3>Ordre d'appel</h3>
  <div class="steps">${l.map((p,i) => `<div class="step">${i+1}. ${esc(p.nom)} <span class="muted small">(${esc(p.lien)} · ${esc(p.tel)})</span></div>`).join("") || `<div class="step">Aucun contact d'urgence : complétez le profil.</div>`}<div class="step">${l.length+1}. Secours (${esc(P.nom)}) : <b>${P.secours}</b>${P.general!==P.secours?" ou <b>"+P.general+"</b>":""}</div></div>
  <p class="muted small">Numéros pour ${esc(P.nom)} : ${esc(P.detail)}. Le pays se règle dans le profil.</p>`;
}
function bindPanel(){
  const P = document.getElementById("panel");
  P.onclick = tab === "jeux" ? gameClick : null;
  P.querySelectorAll("[data-del]").forEach(b => b.onclick = () => delEvent(b.dataset.del));
  P.querySelectorAll("[data-a=sv]").forEach(b => b.onclick = () => { sortiesView = b.dataset.i; render(); });
  P.querySelectorAll("[data-a=agf]").forEach(b => b.onclick = () => { agendaForm = !agendaForm; render(); });
  P.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => inscrire(b.dataset.sub, true));
  bindVille(P);
  P.querySelectorAll("[data-unsub]").forEach(b => b.onclick = () => desinscrire(b.dataset.unsub));
  P.querySelectorAll("[data-room]").forEach(b => b.onclick = () => { curRoom = b.dataset.room; unread[curRoom] = 0; store.set("unread", unread); tab = "chat"; render(); });
  P.querySelectorAll("[data-chatwith]").forEach(b => b.onclick = () => { curRoom = "proches"; showTab("chat"); });
  P.querySelectorAll("[data-open=profile]").forEach(b => b.onclick = openProfile);
  P.querySelectorAll("[data-say]").forEach(b => b.onclick = () => { const k = b.dataset.say;
    if (k === "agenda") say(agendaSpeech(7), "rappel");
    if (k === "wx"){ const a = weatherAlert(); say("Attention, " + a.titre + ". " + a.conseils.join(" "), "rappel"); }
    if (k === "lastmsg"){ const m = rooms[curRoom].msgs.filter(m => m.from !== me()).slice(-1)[0]; say(m ? m.from + " a écrit : " + m.text : "Pas encore de message.", "sociable"); } });
  const f = document.getElementById("addEv");
  if (f) f.onsubmit = e => { e.preventDefault(); const d = new FormData(f); tryAddEvent({date:d.get("date"), heure:d.get("heure"), titre:d.get("titre"), type:"rdv"}); };
  const cf = document.getElementById("chatForm");
  if (cf){ cf.onsubmit = e => { e.preventDefault(); const i = document.getElementById("chatIn"); if (i.value.trim()){ sendChat(i.value.trim()); } }; const m = document.getElementById("msgs"); m.scrollTop = m.scrollHeight; }
  const sos = document.getElementById("sosBtn"); if (sos) sos.onclick = () => triggerAlert("bouton d'aide");
}

/* ---- puces de suggestions ---- */
function renderChips(){
  const p = urgents()[0];
  const c = ["Bonjour OKA", "Quelle heure est-il ?", "Qu'est-ce que j'ai cette semaine ?", "Quel temps fait-il ?", "Je me sens seule", "Raconte-moi une blague", "On fait un quiz ?", "Qu'est-ce que je peux faire ?", p ? "Appelle " + p.nom : null, "Lis mes messages"].filter(Boolean);
  document.getElementById("chips").innerHTML = c.map(t => `<button class="chip">${esc(t)}</button>`).join("");
  document.querySelectorAll("#chips .chip").forEach(b => b.onclick = () => handleUser(b.textContent));
}
