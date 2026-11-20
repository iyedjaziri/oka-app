"use strict";

/* ================= STOCKAGE ================= */
const mem = {};
const store = {
  get(k, d){ try{ const v = localStorage.getItem("oka_"+k); return v==null ? (k in mem ? mem[k] : d) : JSON.parse(v);}catch(e){ return k in mem ? mem[k] : d; } },
  set(k, v){ mem[k] = v; try{ localStorage.setItem("oka_"+k, JSON.stringify(v)); }catch(e){} }
};
let bc = null; try{ bc = new BroadcastChannel("oka"); }catch(e){}

/* ================= OUTILS DATES ================= */
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const dayLabel = s => { const d = new Date(s+"T12:00"); return JOURS[d.getDay()]+" "+d.getDate()+" "+MOIS[d.getMonth()]; };
const hourSpeech = h => { const [H,M] = h.split(":").map(Number); return H+" heure"+(H>1?"s":"")+(M? " "+M : ""); };
const relDay = s => { const t = iso(new Date()); if (s===t) return "aujourd'hui"; if (s===iso(addDays(new Date(),1))) return "demain"; return dayLabel(s); };
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g," ");
const esc = s => String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid = () => Math.random().toString(36).slice(2,9);

/* ================= DONNÉES ================= */
const PAYS = {
  FR:{nom:"France", secours:"15", general:"112", detail:"SAMU 15 · Pompiers 18 · Police 17 · Européen 112"},
  MC:{nom:"Monaco", secours:"112", general:"112", detail:"Urgences 112 · Pompiers 18 · Police 17"},
  BE:{nom:"Belgique", secours:"112", general:"112", detail:"Ambulance et pompiers 112 · Police 101"},
  CH:{nom:"Suisse", secours:"144", general:"112", detail:"Ambulance 144 · Pompiers 118 · Police 117"},
  LU:{nom:"Luxembourg", secours:"112", general:"112", detail:"Urgences 112 · Police 113"},
  IT:{nom:"Italie", secours:"112", general:"112", detail:"Numéro unique 112"},
  ES:{nom:"Espagne", secours:"112", general:"112", detail:"Numéro unique 112"},
  DE:{nom:"Allemagne", secours:"112", general:"112", detail:"Urgences 112 · Police 110"},
  PT:{nom:"Portugal", secours:"112", general:"112", detail:"Numéro unique 112"},
  CA:{nom:"Canada", secours:"911", general:"911", detail:"Urgences 911"},
  MA:{nom:"Maroc", secours:"15", general:"15", detail:"Ambulance et pompiers 15 · Police 19"},
  TN:{nom:"Tunisie", secours:"190", general:"190", detail:"SAMU 190 · Protection civile 198 · Police 197"}
};
const DEMO_PROFILE = () => ({
  prenom:"Giselle", nom:"Bernard", age:84, seule:"oui", ville:"Nice", pays:"FR",
  gouts:"le marché, les chansons de Charles Trenet, la belote",
  souvenir:"son atelier de couturière dans le Vieux-Nice",
  people:[
    {id:uid(), nom:"Sophie", lien:"fille", tel:"0600000001", type:"proche", urgence:true},
    {id:uid(), nom:"Luc", lien:"petit-fils", tel:"0600000002", type:"proche", urgence:true},
    {id:uid(), nom:"Mme Rossi", lien:"voisine", tel:"0600000003", type:"proche", urgence:true},
    {id:uid(), nom:"Dr Martin", lien:"médecin traitant", tel:"0400000004", type:"soignant", urgence:false},
    {id:uid(), nom:"Karima", lien:"aide à domicile", tel:"0600000005", type:"aidant", urgence:false}
  ]
});
function demoAgenda(){
  const t = new Date(), d = n => iso(addDays(t,n));
  return [
    {id:uid(), date:d(0), heure:"16:00", titre:"Appel vidéo avec Sophie", type:"proche"},
    {id:uid(), date:d(1), heure:"10:30", titre:"Rendez-vous chez le Dr Martin", type:"rdv", lieu:"cabinet, avenue Jean Médecin"},
    {id:uid(), date:d(2), heure:"09:00", titre:"Passage de Karima (aide à domicile)", type:"aidant"},
    {id:uid(), date:d(4), heure:"11:00", titre:"Séance de kiné", type:"rdv"},
    {id:uid(), date:d(6), heure:"12:30", titre:"Déjeuner chez Luc", type:"proche"}
  ];
}
function demoActivities(){
  const t = new Date(), d = n => iso(addDays(t,n));
  return [
    {id:"saleya", titre:"Balade au marché du cours Saleya", date:d(2), heure:"09:30", lieu:"Cours Saleya, Vieux-Nice", dims:["sociale","physique"], participants:["Odette","Marcel","Jeanne"]},
    {id:"foyer", titre:"Déjeuner partagé au foyer-restaurant", date:d(3), heure:"12:00", lieu:"Foyer-restaurant du CCAS", dims:["sociale"], participants:["Paul","Simone"]},
    {id:"memoire", titre:"Atelier mémoire et jeux de mots", date:d(4), heure:"14:30", lieu:"Salle municipale du quartier", dims:["cognitive"], participants:["Jeanne","Albert"]},
    {id:"gym", titre:"Gym douce sur la Promenade", date:d(1), heure:"10:00", lieu:"Promenade des Anglais", dims:["physique"], participants:["Marcel","Lucienne"]},
    {id:"cafe", titre:"Café-papote avec des bénévoles", date:d(5), heure:"15:00", lieu:"Café du quartier", dims:["emotionnelle","sociale"], participants:["Henriette","Bernadette"]}
  ];
}
const NICE_LIEUX = [
  {n:"Marché du cours Saleya", d:"Le marché en plein air du Vieux-Nice : fleurs, fruits et légumes. Une sortie agréable, seule ou accompagnée."},
  {n:"Office Municipal Niçois des Seniors", d:"Activités, ateliers et sorties pour les seniors niçois."},
  {n:"Foyers-restaurants du CCAS", d:"Des repas à petit prix dans une ambiance conviviale, sur inscription auprès du CCAS."},
  {n:"Petits Frères des Pauvres", d:"Des bénévoles qui rendent visite et téléphonent aux personnes âgées isolées."},
  {n:"Monalisa", d:"Mobilisation nationale contre l'isolement des âgés, avec des équipes citoyennes de voisinage."}
];

let profile = store.get("profile", null);
let agenda = (store.get("agenda", null) || demoAgenda()).filter(e => !/\(test\)/i.test(e.titre));
let activities = store.get("activities", null) || demoActivities();
let rooms = store.get("rooms", null);
let settings = Object.assign({mode:"demo", voice:"", rate:0.85, elkey:"", elvoice:"", wx:"reel", sim:"1", trace:"", moteurVoix:"navigateur", voixLocale:"", moteurIA:"claude", station:"", fs:"moyen", theme:"automne", dark:"0"}, store.get("settings", {}));
let reminded = store.get("reminded", {});
let weather = null, geo = null;
let unread = store.get("unread", {});

function initRooms(){
  if (rooms) return;
  rooms = {proches:{nom:"Famille et proches", membres:["Sophie","Luc","Mme Rossi"], msgs:[
    {from:"Sophie", text:"Bonjour Maman ! On s'appelle à 16 heures comme prévu ?", ts:Date.now()-3600e3}
  ]}};
  activities.filter(a=>a.inscrit).forEach(openActivityRoom);
}
const me = () => (profile && profile.prenom) || "Moi";
const saveAll = () => { store.set("agenda", agenda); store.set("activities", activities); store.set("rooms", rooms); store.set("unread", unread); bc && bc.postMessage({t:"sync"}); };
