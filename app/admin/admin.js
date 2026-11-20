// Espace pro OKA : connexion de l'équipe, bénéficiaires et tablettes, annonces, structures, journal.
// Les droits sont appliqués par la base (RLS) : cette page n'affiche que ce que le compte peut voir.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";

const CFG = window.OKA_CONFIG || {};
const $ = id => document.getElementById(id);
const main = $("main");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateFr = d => d ? new Date(d).toLocaleDateString("fr-FR", {day:"numeric", month:"short", year:"numeric"}) : "";
const URL_APP = new URL("../", location.href).href;
let toastT;
const toast = (t, ms) => { const el = $("toast"); el.textContent = t; el.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add("hidden"), ms || 4000); };

if (!CFG.supabaseUrl || !CFG.supabaseAnonKey){
  main.innerHTML = `<div class="card login"><h1>Serveur non configuré</h1><p>Générez <code>config.js</code> avec <code>npm run config:local</code> (développement) ou configurez le déploiement (voir docs/06-mise-en-route.md).</p></div>`;
}
const sb = CFG.supabaseUrl && CFG.supabaseAnonKey ? createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
let moi = null, structures = [], vue = "beneficiaires";

async function q(promesse){ const { data, error } = await promesse; if (error){ toast("Erreur : " + error.message, 7000); throw error; } return data; }

/* ---- connexion ---- */
function vueConnexion(msg){
  $("nav").classList.add("hidden"); $("deco").classList.add("hidden"); $("qui").textContent = "";
  main.innerHTML = `<form class="card login" id="login"><h1>Connexion</h1>
    <label for="em">E-mail</label><input class="f" id="em" type="email" autocomplete="username" required>
    <label for="pw" style="margin-top:10px">Mot de passe</label><input class="f" id="pw" type="password" autocomplete="current-password" required>
    <p class="err" id="lerr">${esc(msg || "")}</p><button class="btn" style="width:100%">Se connecter</button>
    <p class="muted small">Les comptes sont créés par un administrateur Diwaging.</p></form>`;
  $("login").onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $("em").value.trim(), password: $("pw").value });
    if (error) $("lerr").textContent = "E-mail ou mot de passe incorrect.";
  };
}
$("deco").onclick = () => sb.auth.signOut();

async function demarrer(session){
  if (!session){ moi = null; return vueConnexion(); }
  const { data } = await sb.from("equipe").select("*").eq("user_id", session.user.id).maybeSingle();
  if (!data){ await sb.auth.signOut(); return vueConnexion("Ce compte n'a pas accès à l'espace pro. Contactez un administrateur."); }
  moi = { ...data, email: session.user.email, admin: data.role === "admin", partenaire: data.role === "partenaire" };
  structures = await q(sb.from("structures").select("*").order("nom"));
  $("qui").textContent = moi.email + " · " + (moi.admin ? "administrateur" : (moi.partenaire ? "partenaire " : "référent ") + (structures.find(s => s.id === moi.structure_id)?.nom || ""));
  $("nav").classList.remove("hidden"); $("deco").classList.remove("hidden");
  document.querySelectorAll("#nav .admin").forEach(b => b.classList.toggle("hidden", !moi.admin));
  // partenaire (organisateur d'événements) : annonces et messages seulement
  document.querySelectorAll("#nav .gestion").forEach(b => b.classList.toggle("hidden", moi.partenaire));
  afficher(moi.partenaire && vue === "beneficiaires" ? "messages" : vue);
}
sb?.auth.onAuthStateChange((ev, session) => { if (ev === "INITIAL_SESSION" || ev === "SIGNED_IN" || ev === "SIGNED_OUT") setTimeout(() => demarrer(session)); });

$("nav").onclick = e => { const b = e.target.closest("button[data-v]"); if (b) afficher(b.dataset.v); };
let rafraichir = null;
function afficher(v){
  vue = v; clearInterval(rafraichir);
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  ({ beneficiaires: vueBeneficiaires, messages: vueMessages, annonces: vueAnnonces, structures: vueStructures, equipe: vueEquipe, journal: vueJournal }[v] || vueBeneficiaires)();
}
const choixStructure = (id, avecToutes) => moi.admin
  ? `<select class="f" id="${id}">${avecToutes ? `<option value="">Toutes les structures</option>` : ""}${structures.map(s => `<option value="${s.id}">${esc(s.nom)}</option>`).join("")}</select>`
  : `<select class="f" id="${id}" disabled><option value="${moi.structure_id}">${esc(structures.find(s => s.id === moi.structure_id)?.nom)}</option></select>`;

function dialogue(html){ $("dlgIn").innerHTML = html; $("dlg").showModal(); }
window.fermerDlg = () => $("dlg").close();

/* ---- bénéficiaires et tablettes ---- */
async function vueBeneficiaires(){
  const liste = await q(sb.from("beneficiaires").select("*, structures(nom), appareils(id, active_le, revoque_le, vu_le), codes_activation(expire_le, utilise_le)").order("created_at", { ascending: false }));
  main.innerHTML = `<h1>Bénéficiaires</h1>
  <form class="card" id="nb"><div class="row">
    <div><label for="nb_lib">Référence</label><input class="f" id="nb_lib" maxlength="60" required placeholder="ex. NICE-007 ou initiales"></div>
    <div><label for="nb_st">Structure</label>${choixStructure("nb_st")}</div>
    <div style="flex:0 1 auto"><label><input type="checkbox" id="nb_ia"> Questions libres (IA)</label></div>
    <div style="flex:0 0 auto"><button class="btn">Ajouter</button></div></div>
    <p class="muted small" style="margin:8px 0 0">Pas de nom complet ici : une référence interne suffit. Cochez « Questions libres » seulement avec l'accord de la personne.</p></form>
  ${structures.length ? "" : `<p class="err">Aucune structure : créez-en une dans l'onglet Structures.</p>`}
  <div class="tablewrap"><table><thead><tr><th>Référence</th><th>Statut</th><th>Tablette</th><th>Structure</th><th>IA</th><th></th></tr></thead><tbody>
  ${liste.map(b => {
    const app = b.appareils.find(a => !a.revoque_le);
    const code = b.codes_activation.find(c => !c.utilise_le && new Date(c.expire_le) > new Date());
    return `<tr><td><b>${esc(b.libelle)}</b></td><td><span class="pill ${b.statut}">${esc(b.statut.replace("_", " "))}</span></td>
      <td class="small">${app ? "Active depuis le " + dateFr(app.active_le) + (app.vu_le ? "<br><span class='muted'>vue le " + dateFr(app.vu_le) + "</span>" : "") : code ? "Code en attente (expire le " + dateFr(code.expire_le) + ")" : "<span class='muted'>Aucune</span>"}</td>
      <td class="small">${esc(b.structures?.nom)}</td><td>${b.ia_autorisee ? "Oui" : "Non"}</td>
      <td><div class="acts">
        <button class="btn sm" data-a="code" data-id="${b.id}" ${b.statut === "suspendu" ? "disabled" : ""}>Code d'activation</button>
        ${app ? `<button class="btn sm alt" data-a="revoquer" data-id="${app.id}">Révoquer la tablette</button>` : ""}
        <button class="btn sm ghost" data-a="ia" data-id="${b.id}" data-v="${!b.ia_autorisee}">${b.ia_autorisee ? "Retirer l'IA" : "Autoriser l'IA"}</button>
        <button class="btn sm ghost" data-a="statut" data-id="${b.id}" data-v="${b.statut === "suspendu" ? "actif" : "suspendu"}">${b.statut === "suspendu" ? "Réactiver" : "Suspendre"}</button>
        <button class="btn sm red" data-a="suppr" data-id="${b.id}" data-l="${esc(b.libelle)}">Supprimer</button></div></td></tr>`;
  }).join("") || `<tr><td colspan="6" class="muted">Aucun bénéficiaire.</td></tr>`}</tbody></table></div>`;

  $("nb").onsubmit = async e => {
    e.preventDefault();
    await q(sb.from("beneficiaires").insert({ libelle: $("nb_lib").value.trim(), structure_id: $("nb_st").value, ia_autorisee: $("nb_ia").checked, referent_id: moi.user_id }));
    toast("Bénéficiaire ajouté."); vueBeneficiaires();
  };
  main.querySelectorAll("button[data-a]").forEach(btn => btn.onclick = async () => {
    const { a, id, v, l } = btn.dataset;
    if (a === "code"){
      const code = await q(sb.rpc("creer_code_activation", { p_beneficiaire: id }));
      dialogue(`<h2 style="margin-top:0">Code d'activation</h2><p>À saisir sur la tablette, à l'ouverture d'OKA :</p><div class="code">${esc(code)}</div>
        <p class="small">Adresse de l'application : <b>${esc(URL_APP)}</b><br>Valable 7 jours, une seule fois. Une nouvelle activation désactive l'ancienne tablette.</p>
        <p class="muted small">Ce code ne sera plus affiché : notez-le ou activez la tablette maintenant.</p><div class="row" style="justify-content:flex-end"><button class="btn" onclick="fermerDlg()">Fermer</button></div>`);
      return vueBeneficiaires();
    }
    if (a === "revoquer"){ if (!confirm("Révoquer cette tablette ? OKA y repassera en mode local et demandera un nouveau code.")) return; await q(sb.from("appareils").update({ revoque_le: new Date().toISOString() }).eq("id", id)); toast("Tablette révoquée."); }
    if (a === "ia") await q(sb.from("beneficiaires").update({ ia_autorisee: v === "true" }).eq("id", id));
    if (a === "statut") await q(sb.from("beneficiaires").update({ statut: v }).eq("id", id));
    if (a === "suppr"){ if (!confirm("Supprimer « " + l + " » et ses tablettes ? Cette action est définitive.")) return; await q(sb.from("beneficiaires").delete().eq("id", id)); toast("Bénéficiaire supprimé."); }
    vueBeneficiaires();
  });
}

/* ---- messages avec les bénéficiaires (effacés après 30 jours) ---- */
let convOuverte = null;
async function vueMessages(){
  const [benefs, msgs] = await Promise.all([
    q(sb.from("beneficiaires").select("id, libelle, structure_id").order("libelle")),
    q(sb.from("messages").select("id, beneficiaire_id, auteur, auteur_nom, texte, lu_le, created_at").order("created_at"))]);
  const par = id => msgs.filter(m => m.beneficiaire_id === id), nonLus = id => par(id).filter(m => m.auteur === "beneficiaire" && !m.lu_le).length;
  const liste = benefs.slice().sort((a, b) => (par(b.id).at(-1)?.created_at || "").localeCompare(par(a.id).at(-1)?.created_at || ""));
  if (!convOuverte || !benefs.some(b => b.id === convOuverte)) convOuverte = liste[0]?.id || null;
  const fil = convOuverte ? par(convOuverte) : [];
  main.innerHTML = `<h1>Messages</h1><p class="muted small">Une conversation par bénéficiaire, visible par l'équipe de sa structure. Les messages sont effacés après 30 jours. Les codes et mots de passe sont refusés.</p>
  <div class="msgs-admin"><div class="convs">${liste.map(b => { const d = par(b.id).at(-1), n = nonLus(b.id);
    return `<button class="conv ${b.id === convOuverte ? "on" : ""}" data-conv="${b.id}"><b>${esc(b.libelle)}</b>${n ? ` <span class="pill actif">${n}</span>` : ""}<br><span class="small muted">${d ? esc(d.texte.slice(0, 50)) : "Aucun message"}</span></button>`; }).join("") || `<p class="muted">Aucun bénéficiaire.</p>`}</div>
  <div class="fil">${convOuverte ? `<div class="bulles" id="bulles">${fil.map(m => `<div class="bulle ${m.auteur}"><div class="small muted">${m.auteur === "equipe" ? esc(m.auteur_nom || "Équipe") : esc(benefs.find(b => b.id === convOuverte).libelle)} · ${new Date(m.created_at).toLocaleString("fr-FR", {dateStyle:"short", timeStyle:"short"})}${m.auteur === "equipe" ? (m.lu_le ? " · lu" : " · envoyé") : ""}</div>${esc(m.texte)}</div>`).join("") || `<p class="muted">Pas encore de message.</p>`}</div>
    <form class="row" id="rep" style="margin-top:10px"><div style="flex:1"><input class="f" id="rep_t" maxlength="1000" placeholder="Votre message (phrases courtes, il sera lu à voix haute)" autocomplete="off"></div><div style="flex:0 0 auto"><button class="btn">Envoyer</button></div></form>` : ""}</div></div>`;
  main.querySelectorAll("[data-conv]").forEach(b => b.onclick = () => { convOuverte = b.dataset.conv; vueMessages(); });
  const bl = $("bulles"); if (bl) bl.scrollTop = bl.scrollHeight;
  const aLire = fil.filter(m => m.auteur === "beneficiaire" && !m.lu_le).map(m => m.id);
  if (aLire.length) await sb.from("messages").update({ lu_le: new Date().toISOString() }).in("id", aLire);
  const f = $("rep");
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const t = $("rep_t").value.trim(); if (!t) return;
    if (/(\d[ -]?){13,19}|mot de passe|code (secret|pin|de (la |ma )?carte)/i.test(t)) return toast("N'envoyez jamais de code, de mot de passe ni de numéro de carte.");
    const signature = (moi.nom ? moi.nom + " – " : "") + (structures.find(s => s.id === moi.structure_id)?.nom || "OKA");
    await q(sb.from("messages").insert({ beneficiaire_id: convOuverte, auteur: "equipe", auteur_nom: signature.slice(0, 60), texte: t }));
    vueMessages();
  };
  clearInterval(rafraichir); rafraichir = setInterval(() => { if (vue === "messages" && !document.activeElement?.closest("#rep")) vueMessages(); }, 30000);
}

/* ---- annonces ---- */
async function vueAnnonces(){
  const liste = await q(sb.from("annonces").select("*, structures(nom)").order("created_at", { ascending: false }).limit(200));
  const auj = new Date().toISOString().slice(0, 10);
  main.innerHTML = `<h1>Annonces</h1>
  <p class="muted small">Les tablettes récupèrent les annonces à l'ouverture puis toutes les 30 minutes. OKA lit chaque nouvelle information une seule fois ; les activités rejoignent l'onglet Sorties.</p>
  <form class="card" id="na"><div class="row">
    <div style="flex:0 1 170px"><label for="na_type">Type</label><select class="f" id="na_type"><option value="info">Information</option><option value="alerte">Alerte (canicule…)</option><option value="activite">Activité</option></select></div>
    <div><label for="na_st">Pour</label>${choixStructure("na_st", true)}</div>
    <div style="flex:2 1 260px"><label for="na_titre">Titre</label><input class="f" id="na_titre" maxlength="120" required></div></div>
    <div style="margin-top:8px"><label for="na_texte">Texte (lu à voix haute : phrases courtes)</label><textarea class="f" id="na_texte" maxlength="600"></textarea></div>
    <div class="row" style="margin-top:8px">
      <div class="act"><label for="na_date">Date de l'activité</label><input class="f" type="date" id="na_date" min="${auj}"></div>
      <div class="act"><label for="na_heure">Heure</label><input class="f" type="time" id="na_heure"></div>
      <div class="act"><label for="na_lieu">Lieu</label><input class="f" id="na_lieu" maxlength="120"></div>
      <div><label for="na_du">Visible du</label><input class="f" type="date" id="na_du" value="${auj}"></div>
      <div><label for="na_au">au (facultatif)</label><input class="f" type="date" id="na_au"></div>
      <div style="flex:0 0 auto"><button class="btn">Publier</button></div></div></form>
  <div class="tablewrap"><table><thead><tr><th>Annonce</th><th>Type</th><th>Visible</th><th>Pour</th><th></th></tr></thead><tbody>
  ${liste.map(n => `<tr><td><b>${esc(n.titre)}</b>${n.texte ? `<br><span class="small">${esc(n.texte)}</span>` : ""}${n.type === "activite" ? `<br><span class="small muted">${dateFr(n.date_evenement)} à ${esc(String(n.heure).slice(0, 5))}${n.lieu ? " · " + esc(n.lieu) : ""}</span>` : ""}</td>
    <td>${{ info: "Info", alerte: "Alerte", activite: "Activité" }[n.type]}</td><td class="small">${dateFr(n.visible_du)}${n.visible_au ? " → " + dateFr(n.visible_au) : ""}</td>
    <td class="small">${esc(n.structures?.nom || "Toutes")}</td><td><button class="btn sm red" data-suppr="${n.id}">Retirer</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Aucune annonce.</td></tr>`}</tbody></table></div>`;

  const majType = () => main.querySelectorAll(".act").forEach(d => d.classList.toggle("hidden", $("na_type").value !== "activite"));
  $("na_type").onchange = majType; majType();
  $("na").onsubmit = async e => {
    e.preventDefault();
    const act = $("na_type").value === "activite";
    if (act && (!$("na_date").value || !$("na_heure").value)) return toast("Une activité a besoin d'une date et d'une heure.");
    await q(sb.from("annonces").insert({
      type: $("na_type").value, structure_id: $("na_st").value || null, titre: $("na_titre").value.trim(), texte: $("na_texte").value.trim(),
      date_evenement: act ? $("na_date").value : null, heure: act ? $("na_heure").value : null, lieu: act ? $("na_lieu").value.trim() || null : null,
      visible_du: $("na_du").value || auj, visible_au: $("na_au").value || null
    }));
    toast("Annonce publiée."); vueAnnonces();
  };
  main.querySelectorAll("[data-suppr]").forEach(b => b.onclick = async () => {
    if (!confirm("Retirer cette annonce des tablettes ?")) return;
    await q(sb.from("annonces").delete().eq("id", b.dataset.suppr)); vueAnnonces();
  });
}

/* ---- structures (admin) ---- */
async function vueStructures(){
  structures = await q(sb.from("structures").select("*").order("nom"));
  main.innerHTML = `<h1>Structures</h1>
  <form class="card" id="ns"><div class="row"><div><label for="ns_nom">Nom</label><input class="f" id="ns_nom" required placeholder="ex. CCAS de Nice"></div>
    <div><label for="ns_ville">Ville</label><input class="f" id="ns_ville" value="Nice" required></div><div style="flex:0 0 auto"><button class="btn">Ajouter</button></div></div></form>
  <div class="tablewrap"><table><thead><tr><th>Nom</th><th>Ville</th><th>Créée le</th></tr></thead><tbody>
  ${structures.map(s => `<tr><td><b>${esc(s.nom)}</b></td><td>${esc(s.ville)}</td><td class="small">${dateFr(s.created_at)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Aucune structure.</td></tr>`}</tbody></table></div>`;
  $("ns").onsubmit = async e => { e.preventDefault(); await q(sb.from("structures").insert({ nom: $("ns_nom").value.trim(), ville: $("ns_ville").value.trim() })); toast("Structure ajoutée."); vueStructures(); };
}

/* ---- équipe (admin) ---- */
async function vueEquipe(){
  const membres = await q(sb.rpc("liste_equipe"));
  main.innerHTML = `<h1>Équipe</h1>
  <div class="card small">1. Créez le compte dans Supabase : <b>Authentication → Users → Add user</b> (e-mail + mot de passe, ou invitation).<br>2. Rattachez-le ici à une structure.</div>
  <form class="card" id="ne"><div class="row"><div><label for="ne_em">E-mail du compte</label><input class="f" id="ne_em" type="email" required></div>
    <div><label for="ne_nom">Nom</label><input class="f" id="ne_nom"></div>
    <div style="flex:0 1 160px"><label for="ne_role">Rôle</label><select class="f" id="ne_role"><option value="referent">Référent</option><option value="partenaire">Partenaire (événements)</option><option value="admin">Administrateur</option></select></div>
    <div><label for="ne_st">Structure</label>${choixStructure("ne_st")}</div><div style="flex:0 0 auto"><button class="btn">Rattacher</button></div></div></form>
  <div class="tablewrap"><table><thead><tr><th>Membre</th><th>Rôle</th><th>Structure</th><th></th></tr></thead><tbody>
  ${membres.map(m => `<tr><td><b>${esc(m.nom || m.email)}</b><br><span class="small muted">${esc(m.email)}</span></td><td>${{admin:"Administrateur", referent:"Référent", partenaire:"Partenaire"}[m.role]}</td>
    <td class="small">${esc(structures.find(s => s.id === m.structure_id)?.nom || "—")}</td>
    <td>${m.user_id === moi.user_id ? "" : `<button class="btn sm red" data-retirer="${m.user_id}">Retirer l'accès</button>`}</td></tr>`).join("")}</tbody></table></div>`;
  $("ne").onsubmit = async e => {
    e.preventDefault();
    await q(sb.rpc("ajouter_membre", { p_email: $("ne_em").value, p_structure: $("ne_st").value || null, p_role: $("ne_role").value, p_nom: $("ne_nom").value.trim() }));
    toast("Membre rattaché."); vueEquipe();
  };
  main.querySelectorAll("[data-retirer]").forEach(b => b.onclick = async () => {
    if (!confirm("Retirer l'accès à l'espace pro pour ce compte ?")) return;
    await q(sb.from("equipe").delete().eq("user_id", b.dataset.retirer)); vueEquipe();
  });
}

/* ---- journal (admin) ---- */
async function vueJournal(){
  const [lignes, membres] = await Promise.all([q(sb.from("journal").select("*").order("id", { ascending: false }).limit(150)), q(sb.rpc("liste_equipe"))]);
  const qui = id => id ? (membres.find(m => m.user_id === id)?.email || "compte supprimé") : "tablette / système";
  main.innerHTML = `<h1>Journal</h1><p class="muted small">150 dernières actions. Aucun contenu personnel n'est enregistré.</p>
  <div class="tablewrap"><table><thead><tr><th>Date</th><th>Action</th><th>Par</th></tr></thead><tbody>
  ${lignes.map(l => `<tr><td class="small">${new Date(l.at).toLocaleString("fr-FR")}</td><td>${esc(l.action)}</td><td class="small">${esc(qui(l.acteur))}</td></tr>`).join("")}</tbody></table></div>`;
}
