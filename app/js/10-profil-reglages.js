"use strict";

/* ================= PROFIL (formulaire de départ) ================= */
const PM = document.getElementById("profileModal");
let draftPeople = [];
function openProfile(){
  const p = profile || {people:[]};
  document.getElementById("pf_pays").innerHTML = Object.entries(PAYS).map(([k,v]) => `<option value="${k}">${v.nom}</option>`).join("");
  fillProfile(p); PM.classList.remove("hidden");
}
function fillProfile(p){
  ["prenom","nom","age","ville"].forEach(k => document.getElementById("pf_"+k).value = p[k] ?? "");
  document.getElementById("pf_seule").value = p.seule || "oui";
  document.getElementById("pf_pays").value = p.pays || "FR";
  document.getElementById("pf_gouts").value = p.gouts || "";
  document.getElementById("pf_souv").value = p.souvenir || "";
  draftPeople = (p.people || []).map(x => Object.assign({}, x)); renderPeople();
}
function renderPeople(){
  document.getElementById("pf_people").innerHTML = draftPeople.map((x,i) => `<div class="pi">
    <input class="f" placeholder="Nom" value="${esc(x.nom)}" data-i="${i}" data-k="nom">
    <input class="f" placeholder="Lien (fille, voisin…)" value="${esc(x.lien)}" data-i="${i}" data-k="lien">
    <input class="f" placeholder="Téléphone" value="${esc(x.tel)}" data-i="${i}" data-k="tel">
    <select class="f" data-i="${i}" data-k="type">${["proche","soignant","aidant"].map(t => `<option ${x.type===t?"selected":""}>${t}</option>`).join("")}</select>
    <label style="margin:0;font-weight:500;white-space:nowrap"><input type="checkbox" data-i="${i}" data-k="urgence" ${x.urgence?"checked":""}> urgence <button type="button" class="btn sm ghost" data-rm="${i}" title="Retirer">${ic("x")}</button></label>
  </div>`).join("") || `<p class="muted small">Aucune personne.</p>`;
  document.querySelectorAll("#pf_people [data-rm]").forEach(b => b.onclick = e => { e.preventDefault(); draftPeople.splice(+b.dataset.rm, 1); renderPeople(); });
  document.querySelectorAll("#pf_people [data-k]").forEach(el => el.oninput = el.onchange = () => { const x = draftPeople[el.dataset.i]; x[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
}
document.getElementById("pf_add").onclick = () => { draftPeople.push({id:uid(), nom:"", lien:"", tel:"", type:"proche", urgence:false}); renderPeople(); requestAnimationFrame(fitModals); };
document.getElementById("pf_demo").onclick = () => fillProfile(DEMO_PROFILE());
document.getElementById("pf_cancel").onclick = () => { if (profile) PM.classList.add("hidden"); else fillProfile(DEMO_PROFILE()); };
document.getElementById("pf_save").onclick = () => {
  const g = k => document.getElementById("pf_"+k).value.trim();
  if (!g("prenom") || !g("ville")){ toast("Indiquez au moins le prénom et la ville."); return; }
  const first = !profile;
  profile = {prenom:g("prenom"), nom:g("nom"), age:+g("age")||"", seule:g("seule"), ville:g("ville"), pays:g("pays"), gouts:g("gouts"), souvenir:g("souv"),
    people:draftPeople.filter(x => x.nom && x.tel)};
  store.set("profile", profile); PM.classList.add("hidden");
  initRooms(); renderChips(); render(); loadWeather();
  if (first) setTimeout(() => say(greeting(), "heureux"), 400);
};
document.getElementById("btnProfile").onclick = openProfile;

/* ================= RÉGLAGES ================= */
const SM = document.getElementById("settingsModal");
document.getElementById("btnSettings").onclick = () => {
  for (const k of ["mode","rate","elkey","elvoice","wx","sim","fs","theme","dark","trace"]) document.getElementById("st_"+k).value = settings[k];
  document.getElementById("st_compte").textContent = compteTexte();
  document.getElementById("st_adresse").value = settings.adresse || ""; document.getElementById("st_adresseInfo").textContent = infoAdresse();
  document.getElementById("st_testWrap").classList.toggle("hidden", !modeTest()); document.getElementById("st_cleTest").value = settings.cleTest || "";
  const sa = document.getElementById("st_activer"); sa.classList.toggle("hidden", !serveurOk()); sa.textContent = appareil ? "Désactiver la tablette" : "Activer la tablette";
  loadVoices(); document.getElementById("st_voice").value = settings.voice || "";
  document.getElementById("st_rateV").textContent = settings.rate;
  SM.classList.remove("hidden");
};
document.getElementById("st_rate").oninput = e => document.getElementById("st_rateV").textContent = e.target.value;
document.getElementById("st_cancel").onclick = () => SM.classList.add("hidden");
document.getElementById("st_save").onclick = () => {
  const old = settings.wx;
  for (const k of ["mode","elkey","elvoice","wx","sim","voice","fs","theme","dark","trace"]) settings[k] = document.getElementById("st_"+k).value.trim();
  const adr = document.getElementById("st_adresse").value.trim();
  if (adr !== (settings.adresse || "")){ settings.adresse = adr; localiserAdresse(adr); }
  if (modeTest()) settings.cleTest = document.getElementById("st_cleTest").value.trim();
  applyDisplay();
  settings.rate = +document.getElementById("st_rate").value;
  store.set("settings", settings); SM.classList.add("hidden");
  if (settings.mode === "claude" && !iaDisponible()) toast(!modeTest() ? "La conversation libre demande une tablette activée, avec l'accord de la personne. En attendant, OKA reste en mode démo." : "Ajoutez une clé de test pour la conversation libre. En attendant, OKA reste en mode démo.");
  if (old !== settings.wx) loadWeather();
  render();
};
document.getElementById("st_reset").onclick = () => { try{ Object.keys(localStorage).filter(k => k.startsWith("oka_")).forEach(k => localStorage.removeItem(k)); }catch(e){} location.reload(); };


/* ---- démonstration des 8 émotions ---- */
const EMO_DEMO = {
  heureux:"Quelle belle journée ! Ça me fait très plaisir de vous voir.",
  compassion:"Je suis là, je vous écoute. Prenez votre temps.",
  sociable:"Et si on appelait un proche, ou si on sortait un peu ensemble ?",
  affame:"Miam ! Une bonne socca toute chaude, ça vous dit ?",
  rappel:"N'oubliez pas : demain, vous avez rendez-vous chez le médecin.",
  oublie:"Oh, j'ai oublié ce que je voulais dire… Vous pouvez répéter ?",
  bonne:"Bravo, c'est la bonne réponse !",
  mauvaise:"Ce n'est pas tout à fait ça… On réessaie ?"
};
document.getElementById("st_emos").innerHTML = Object.keys(EMO_DEMO).map(k => `<button type="button" class="btn sm alt" data-emo="${k}">${EXPR[k].label}</button>`).join("");
document.querySelectorAll("#st_emos [data-emo]").forEach(b => b.onclick = () => { SM.classList.add("hidden"); say(EMO_DEMO[b.dataset.emo], b.dataset.emo); });
