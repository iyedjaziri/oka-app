"use strict";

/* ================= AMBIANCE : confettis et musique calme ================= */

/* ---- confettis : petite récompense à l'inscription (rien si l'appareil demande moins d'animations) ---- */
function confettis(){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "confettis"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv);
  const r = devicePixelRatio || 1, W = innerWidth, H = innerHeight, c = cv.getContext("2d");
  cv.width = W*r; cv.height = H*r; c.scale(r, r);
  const st = getComputedStyle(document.documentElement), cols = ["--c-acc", "--c-nav", "--c-btn"].map(v => st.getPropertyValue(v).trim()).concat("#7DB04B", "#6F8FB8", "#E9A21C");
  const P = Array.from({length:110}, () => ({x:W/2 + (Math.random()-.5)*W*.35, y:H*.38, vx:(Math.random()-.5)*10, vy:-Math.random()*10-4,
    a:Math.random()*Math.PI, va:(Math.random()-.5)*.3, w:6+Math.random()*6, h:9+Math.random()*8, col:pick(cols)}));
  const t0 = performance.now();
  (function tick(t){
    const e = (t - t0)/1000; c.clearRect(0, 0, W, H);
    c.globalAlpha = Math.max(0, 1 - Math.max(0, e - 1.6)/0.9);
    for (const p of P){ p.vy += .25; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.w/2, -p.h/2, p.w, p.h*Math.abs(Math.cos(p.a*2)) + 1); c.restore(); }
    if (e < 2.5) requestAnimationFrame(tick); else cv.remove();
  })(t0);
}

/* ---- musique calme : liste de morceaux, lecture / pause, morceau suivant ---- */
// ajouter un morceau : déposer le fichier dans app/audio/ et l'ajouter à cette liste
const PISTES = [
  {titre:"Tout est calme", fichier:"audio/tout-est-calme.mp3"}
];
const musique = {audio:null, ctx:null, gain:null, on:false, i:store.get("pisteI", 0) % PISTES.length, veille:null};
function musiqueAudio(){
  if (musique.audio) return musique.audio;
  const a = musique.audio = new Audio(); a.preload = "none";
  a.onended = () => musiqueSuivante(true);
  // volume par Web Audio (iPad : le volume d'un élément audio n'est pas réglable)
  try{ const C = musique.ctx = new (window.AudioContext || window.webkitAudioContext)();
    musique.gain = C.createGain(); musique.gain.gain.value = 0; C.createMediaElementSource(a).connect(musique.gain); musique.gain.connect(C.destination); }
  catch(e){ musique.ctx = null; }
  return a;
}
// la musique se tait quand OKA écoute (le micro ne doit pas l'entendre) et baisse quand elle parle
function musiqueVolume(){
  const cible = !musique.on || av.listening ? 0 : av.speaking ? .12 : .5;
  if (musique.gain) musique.gain.gain.setTargetAtTime(cible, musique.ctx.currentTime, .5);
  else if (musique.audio) musique.audio.volume = cible;
}
function musiquePiste(){
  const a = musiqueAudio();
  if (a.dataset.piste !== String(musique.i)){ a.src = PISTES[musique.i].fichier; a.dataset.piste = musique.i; }
  return a;
}
function musiqueJouer(){
  const a = musiquePiste();
  if (musique.ctx) musique.ctx.resume();
  musique.on = true; settings.musique = "1"; store.set("settings", settings);
  a.play().catch(e => { console.warn("musique", e); musique.on = false; majMusique(); });
  clearInterval(musique.veille); musique.veille = setInterval(musiqueVolume, 250); musiqueVolume();
  majMusique();
}
function musiqueArreter(){
  musique.on = false; settings.musique = "0"; store.set("settings", settings); musiqueVolume();
  setTimeout(() => { if (!musique.on && musique.audio) musique.audio.pause(); clearInterval(musique.veille); }, 1200);
  majMusique();
}
function musiqueSuivante(auto){
  musique.i = (musique.i + 1) % PISTES.length; store.set("pisteI", musique.i);
  musiquePiste().currentTime = 0;
  if (musique.on || !auto) musiqueJouer(); else majMusique();
}
function majMusique(){
  const b = document.getElementById("musicFloat"), t = document.getElementById("musicTitre"), pl = document.getElementById("musicPlay");
  b.classList.toggle("on", musique.on); b.setAttribute("aria-pressed", musique.on ? "true" : "false");
  b.title = musique.on ? "Couper la musique" : "Mettre une musique calme";
  t.textContent = PISTES[musique.i].titre;
  pl.innerHTML = ic(musique.on ? "pause" : "play") + (musique.on ? "Pause" : "Écouter");
  document.getElementById("musicNext").classList.toggle("hidden", PISTES.length < 2);
}
document.getElementById("musicFloat").onclick = e => { e.stopPropagation(); wake(); musique.on ? musiqueArreter() : musiqueJouer(); };
document.getElementById("musicPlay").onclick = () => musique.on ? musiqueArreter() : musiqueJouer();
document.getElementById("musicNext").onclick = () => musiqueSuivante(false);
// le navigateur interdit le son sans geste : si la musique était allumée, elle reprend au premier toucher
if (settings.musique === "1") document.addEventListener("pointerdown", function reprise(e){
  document.removeEventListener("pointerdown", reprise, true);
  if (!musique.on && !e.target.closest("#musicFloat, #musicPlay")) musiqueJouer();
}, true);
majMusique();
