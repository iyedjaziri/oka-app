"use strict";

/* ================= AGENDA ================= */
const byTime = (a,b) => (a.date+a.heure).localeCompare(b.date+b.heure);
const hm = () => { const d = new Date(); return pad(d.getHours())+":"+pad(d.getMinutes()); };
function addEvent(ev){ agendaForm = false; ev.id = ev.id || uid(); agenda.push(ev); agenda.sort(byTime); saveAll(); render(); toast("Ajouté à l'agenda : " + ev.titre); }
function delEvent(id){ agenda = agenda.filter(e => e.id !== id); saveAll(); render(); }
function agendaSpeech(days){
  const t = iso(new Date());
  let list;
  if (days === -1) list = agenda.filter(e => e.date === iso(addDays(new Date(),1)));
  else list = agenda.filter(e => e.date >= t && e.date < iso(addDays(new Date(), days)) && !(e.date===t && e.heure < hm()));
  if (!list.length) return days === -1 ? "Demain, vous n'avez rien de prévu." : "Vous n'avez rien de prévu pour le moment. Voulez-vous que je vous propose une sortie ?";
  return list.sort(byTime).map(e => relDay(e.date).replace(/^./, c => c.toUpperCase()) + " à " + hourSpeech(e.heure) + " : " + e.titre + ".").join(" ");
}
function agendaFromSpeech(text, n){
  const today = new Date(); let date = null;
  if (n.includes("apres-demain") || n.includes("apres demain")) date = iso(addDays(today,2));
  else if (n.includes("demain")) date = iso(addDays(today,1));
  else if (n.includes("aujourd hui")) date = iso(today);
  else { const j = JOURS.findIndex(j => n.includes(j)); if (j >= 0){ let diff = (j - today.getDay() + 7) % 7 || 7; date = iso(addDays(today, diff)); } }
  const mh = n.match(/(\d{1,2})\s*(?:h|heures?)\s*(\d{1,2})?/);
  const heure = mh ? pad(Math.min(23, +mh[1])) + ":" + pad(mh[2] ? +mh[2] : 0) : null;
  let titre = text.replace(/^(oka,?\s*)?(peux-tu |pouvez-vous |tu peux )?(ajoute|ajouter|note|noter|mets|mettre|prends|prendre|inscris)( moi)?( dans l'agenda| dans mon agenda)?( un| une)?\s*/i, "")
                  .replace(/\b(demain|après-demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b.*$/i, "").replace(/\bà\s*$/,"").trim();
  if (!titre) titre = "Rendez-vous";
  titre = titre.charAt(0).toUpperCase() + titre.slice(1);
  if (!date || !heure) return say("D'accord. Pour quel jour et à quelle heure ? Par exemple : jeudi à 10 heures.", "rappel");
  const ev = {date, heure, titre, type:"rdv"};
  say("Je note : " + titre + ", " + relDay(date) + " à " + hourSpeech(heure) + ". C'est bien ça ?", "rappel", () => { pending = {type:"agendaAdd", ev}; });
}


/* ---- rendez-vous trop proches : OKA prévient, ne décide rien ---- */
// Deux rendez-vous le même jour à moins de 30 minutes d'écart : le second n'est pas ajouté ;
// OKA le dit simplement, la personne choisit elle-même un autre horaire.
const ECART_MIN = 30;
const toMin = h => (+h.slice(0,2))*60 + (+h.slice(3,5));
const clash = (a, b) => a.date === b.date && a.id !== b.id && Math.abs(toMin(a.heure) - toMin(b.heure)) < ECART_MIN;
const conflictsOf = ev => agenda.filter(e => clash(e, ev));
// ajoute un rendez-vous s'il ne tombe pas dans la même demi-heure qu'un autre ; renvoie vrai s'il est ajouté
function tryAddEvent(ev, okMsg){
  ev.id = ev.id || uid();
  const c = conflictsOf(ev)[0];
  if (!c){ addEvent(ev); if (okMsg) say(okMsg, "bonne"); return true; }
  const txt = `Attention : ${relDay(ev.date)} à ${hourSpeech(c.heure)}, vous avez déjà « ${c.titre} ». ` +
    `Je n'ajoute pas « ${ev.titre} » à ${hourSpeech(ev.heure)}, c'est trop proche. Choisissez un autre horaire, au moins une demi-heure avant ou après.`;
  toast(txt, 9000); say(txt, "rappel");
  return false;
}
function agendaClashes(){
  const out = [];
  agenda.forEach((a, i) => agenda.slice(i+1).forEach(b => { if (clash(a, b) && a.date >= iso(new Date())) out.push([a, b]); }));
  return out;
}

/* ---- supprimer un rendez-vous à la voix, puis prévenir les personnes concernées ---- */
// « Annule mon rendez-vous chez le coiffeur », « supprime le rendez-vous de jeudi » : OKA retrouve le rendez-vous,
// demande confirmation, le retire, puis propose de prévenir les personnes concernées (jamais sans accord).
function rdvVises(n){
  const t = iso(new Date()), futurs = agenda.filter(e => e.date >= t).sort(byTime);
  let l = futurs;
  if (n.includes("apres-demain") || n.includes("apres demain")) l = l.filter(e => e.date === iso(addDays(new Date(), 2)));
  else if (n.includes("demain")) l = l.filter(e => e.date === iso(addDays(new Date(), 1)));
  else if (n.includes("aujourd hui")) l = l.filter(e => e.date === t);
  else { const j = JOURS.findIndex(j => n.includes(j)); if (j >= 0) l = l.filter(e => new Date(e.date + "T12:00").getDay() === j); }
  const mh = n.match(/(\d{1,2})\s*(?:h|heures?)\s*(\d{1,2})?/);
  if (mh) l = l.filter(e => Math.abs(toMin(e.heure) - (+mh[1]*60 + (+mh[2] || 0))) < ECART_MIN);
  // mots du titre (« coiffeur », « Sophie », « kiné »…)
  const mots = e => norm(e.titre).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !["avec","chez","rendez","vous"].includes(w));
  const parMot = l.filter(e => mots(e).some(w => n.includes(w)));
  return parMot.length ? parMot : l === futurs ? [] : l;
}
function concernes(e){
  const t = norm(e.titre + " " + (e.lieu || ""));
  return people().filter(p => { const w = norm(p.nom).replace(/^(dr|mme|m) /, "").split(" ")[0]; return w.length > 2 && t.includes(w); });
}
function agendaSuppression(text, n){
  const l = rdvVises(n);
  if (!l.length) return say("Je ne trouve pas ce rendez-vous dans votre agenda. Dites par exemple : annule le rendez-vous de jeudi.", "oublie");
  if (l.length > 1){
    const choix = l.slice(0, 3);
    return say("Vous avez " + choix.map(e => "« " + e.titre + " », " + relDay(e.date) + " à " + hourSpeech(e.heure)).join(", et ") + ". Lequel voulez-vous supprimer ?",
      "rappel", () => { pending = {type:"choixSuppr", choix}; });
  }
  confirmerSuppression(l[0]);
}
function confirmerSuppression(e){
  say("Je supprime « " + e.titre + " », " + relDay(e.date) + " à " + hourSpeech(e.heure) + " ?", "rappel",
    () => { pending = {type:"confirmer", actions:[{question:"je supprime « " + e.titre + " »", faire:() => supprimerRdv(e)}]}; });
}
function supprimerRdv(e){
  if (e.id.startsWith("act_")) desinscrire(e.id.slice(4)); else delEvent(e.id);
  const qui = concernes(e), act = activities.find(a => "act_" + a.id === e.id);
  if (qui.length){
    return say("C'est supprimé. Voulez-vous que je prévienne " + qui.map(p => p.nom).join(" et ") + " ?", "rappel",
      () => { pending = {type:"confirmer", actions:[{question:"je préviens " + qui.map(p => p.nom).join(" et "), faire:() => prevenirAnnulation(e, qui)}]}; });
  }
  const tel = act && (act.inscription || "").match(/0\d(?:[ .]?\d\d){4}/);
  say("C'est supprimé." + (tel ? " Pensez à prévenir l'organisateur au " + tel[0] + "." : act ? " Pensez à prévenir l'organisateur de votre absence." : ""), "neutre");
}
// démonstration : les proches reçoivent un message ; les soignants et aidants, un SMS simulé
function prevenirAnnulation(e, qui){
  const mot = "Je dois annuler « " + e.titre + " », " + relDay(e.date) + " à " + e.heure.replace(":", "h") + ". Désolée !";
  if (qui.some(p => p.type === "proche")) postMsg("proches", me(), mot);
  qui.filter(p => p.type !== "proche").forEach(p => toast("SMS envoyé à " + p.nom + " (simulé) : " + mot, 7000));
  say("C'est fait, j'ai prévenu " + qui.map(p => p.nom).join(" et ") + ".", "bonne");
}

/* ---- rappel de rendez-vous ---- */
function checkReminders(force){
  const now = new Date();
  for (const e of agenda){
    const t = new Date(e.date + "T" + e.heure);
    const mins = (t - now)/60000;
    const k1 = e.id + "_veille", k2 = e.id + "_1h";
    const sortie = e.type === "activite";
    if (e.date === iso(addDays(now,1)) && now.getHours() >= 17 && !reminded[k1] && (e.type === "rdv" || sortie)){ reminded[k1] = 1;
      if (sortie) remind(e, rappelSortie(e, "veille"), "heureux"); else remind(e, "Petit rappel pour demain : " + e.titre + " à " + hourSpeech(e.heure) + "."); }
    if (mins > 0 && mins <= 60 && !reminded[k2]){ reminded[k2] = 1;
      if (sortie) remind(e, rappelSortie(e, "bientot", mins), "heureux"); else remind(e, "Rappel : " + e.titre + " dans " + Math.round(mins) + " minutes, à " + hourSpeech(e.heure) + "." + (e.lieu ? " C'est " + e.lieu + "." : "")); }
  }
  store.set("reminded", reminded);
  suiviSortie();
}
function remind(e, txt, expr){ toast(txt, 9000); if (!av.listening) say(txt, expr || "rappel", null, {queue:true}); }

/* ================= MÉTÉO PRÉVENTIVE (open-meteo) ================= */
const WMO = c => c===0?["sun","ensoleillé"]: c<=2?["cloudsun","peu nuageux"]: c===3?["cloud","couvert"]: c<=48?["fog","brouillard"]: c<=57?["rain","bruine"]: c<=67?["rain","pluie"]: c<=77?["snow","neige"]: c<=82?["rain","averses"]: c<=86?["snow","averses de neige"]: ["storm","orages"];
// pictogrammes météo en couleur : soleil doré, nuage bleu-gris, pluie bleue
const WX_NUAGE = (d, fond, trait) => `<path d="${d}" fill="${fond || "#E3EBF3"}" stroke="${trait || "#7D93AB"}"/>`;
const NUAGE = "M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z", NUAGE_HAUT = "M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15z";
const WX_SVG = {
  sun: '<circle cx="12" cy="12" r="4.2" fill="#F6B73C" stroke="#E08A1E"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="#E08A1E"/>',
  cloudsun: '<circle cx="8" cy="8" r="3" fill="#F6B73C" stroke="#E08A1E"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1" stroke="#E08A1E"/>' + WX_NUAGE("M9 20h8a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 9 20z"),
  cloud: WX_NUAGE(NUAGE),
  fog: '<path d="M4 8h16M2 12h18M5 16h14M8 20h8" stroke="#8FA0B3"/>',
  rain: WX_NUAGE(NUAGE_HAUT) + '<path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#2F7FC1"/>',
  snow: WX_NUAGE(NUAGE_HAUT) + '<path d="M8 19v.01M12 21v.01M16 19v.01" stroke="#6FA8DC" stroke-width="3"/>',
  storm: WX_NUAGE(NUAGE_HAUT, "#C9D3DE", "#647892") + '<path d="M13 15l-3 4h4l-3 4" stroke="#E9A21C"/>'
};
const wxIc = c => `<svg class="ic wxc" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WX_SVG[WMO(c)[0]] || WX_SVG.cloud}</svg>`;
async function geocode(){
  const p = profile || {};
  const key = (p.ville||"") + "|" + (p.pays||"");
  const cached = store.get("geo", null);
  if (cached && cached.key === key) return geo = cached;
  try{
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(p.ville||"Nice")}&count=1&language=fr&countryCode=${p.pays||"FR"}`);
    const j = await r.json(); const g = j.results && j.results[0];
    if (!g) throw new Error("ville introuvable");
    geo = {key, lat:g.latitude, lon:g.longitude, nom:g.name, admin1:g.admin1, admin2:g.admin2, postcodes:g.postcodes||[], cc:g.country_code};
    store.set("geo", geo);
  }catch(e){ console.warn("géocodage", e); geo = null; }
  return geo;
}
async function loadWeather(){
  if (settings.wx !== "reel"){ weather = fakeWeather(settings.wx); render(); return; }
  await geocode();
  try{
    if (!geo) throw new Error("pas de coordonnées");
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&timezone=auto&forecast_days=3`);
    const j = await r.json();
    weather = {src:"open-meteo", now:Math.round(j.current.temperature_2m), code:j.current.weather_code,
      days:j.daily.time.map((d,i) => ({date:d, max:Math.round(j.daily.temperature_2m_max[i]), min:Math.round(j.daily.temperature_2m_min[i]), pluie:j.daily.precipitation_sum[i], code:j.daily.weather_code[i], rafales:j.daily.wind_gusts_10m_max[i]}))};
  }catch(e){ console.warn("météo", e); weather = fakeWeather("hors-ligne"); }
  render();
}
function fakeWeather(kind){
  const t = new Date(), d = n => iso(addDays(t,n));
  const base = {canicule:[[36,25,0,0],[37,26,0,0],[35,24,0,1]], froid:[[9,0,0,1],[8,-2,0,0],[10,1,0,1]], medit:[[16,13,85,95],[15,12,140,65],[17,12,12,3]], "hors-ligne":[[17,10,0,1],[18,11,0,2],[16,10,2,3]]}[kind] || [[17,10,0,1],[18,11,0,2],[16,10,2,3]];
  return {src: kind==="hors-ligne" ? "démo (hors ligne)" : "scénario de démo", now:base[0][0]-3, code:base[0][3], days:base.map((b,i) => ({date:d(i), max:b[0], min:b[1], pluie:b[2], code:b[3], rafales:30}))};
}
function weatherAlert(){
  if (!weather) return null;
  const d = weather.days.slice(0,2);
  if (d.some(x => x.max >= 33 || x.min >= 24)) return {k:"canicule", titre:"forte chaleur annoncée", conseils:["Buvez un verre d'eau toutes les heures, même sans soif.","Fermez volets et fenêtres en journée, aérez la nuit.","Restez au frais entre 11 h et 17 h.","Mouillez-vous le visage et les bras."]};
  if (d.some(x => x.min <= 2)) return {k:"froid", titre:"nuit froide annoncée", conseils:["Chauffez votre logement autour de 19 degrés.","Couvrez-vous bien, avec plusieurs couches.","Gardez une boisson chaude à portée de main.","Évitez de sortir tôt le matin, attention au verglas."]};
  if (d.some(x => x.pluie >= 40 || x.code >= 95)) return {k:"medit", titre:"épisode méditerranéen : fortes pluies et orages", conseils:["Restez chez vous et reportez vos sorties.","Ne descendez pas dans une cave ou un parking souterrain.","Ne prenez pas la voiture, ne traversez pas une rue inondée.","Gardez votre téléphone chargé et une lampe de poche."]};
  return null;
}
// jour : 0 = aujourd'hui, 1 = demain, 2 = après-demain
function weatherSpeech(jour){
  if (!weather) return "Je n'ai pas encore la météo.";
  const j = Math.min(jour || 0, weather.days.length - 1), d = weather.days[j], al = j === 0 ? weatherAlert() : null;
  let s = `${["Aujourd'hui", "Demain", "Après-demain"][j]} à ${geo?.nom || profile?.ville || "Nice"} : ${WMO(d.code)[1]}, de ${d.min} à ${d.max} degrés.`;
  if (al) s += " Attention, " + al.titre + ". " + al.conseils.slice(0,2).join(" ");
  else if (d.max >= 26) s += " Pensez à bien vous hydrater.";
  else if (d.max <= 13) s += " Couvrez-vous bien si vous sortez.";
  return s;
}
