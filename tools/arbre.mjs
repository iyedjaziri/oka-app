// Génère le code et la documentation de l'arbre de décision à partir de la source unique arbre/arbre.json.
//   app/js/00-arbre.js                    tablette (script classique)
//   supabase/functions/_shared/arbre.js   serveur (module)
//   docs/07-arbre-decisionnel.md          tableaux entre les repères <!-- debut:arbre --> et <!-- fin:arbre -->
import fs from "fs";

const lire = f => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const ecrire = (f, t) => fs.writeFileSync(new URL("../" + f, import.meta.url), t);
const src = JSON.parse(lire("arbre/arbre.json"));
const moteur = lire("arbre/moteur.js");

/* ---- contrôles : un arbre incohérent n'est jamais généré ---- */
const erreurs = [], ids = new Set();
const id = (x, ou) => { if (!x.id) erreurs.push("identifiant manquant : " + ou); else if (ids.has(x.id)) erreurs.push("identifiant en double : " + x.id); else ids.add(x.id); };
const motifs = x => (x.motifs || []).forEach(m => { try{ new RegExp(m); }catch(e){ erreurs.push(`motif invalide (${x.id}) : ${m}`); } });
for (const b of src.barrieres){ id(b, "barrière"); motifs(b); for (const s of b.sous || []){ id(s, b.id); motifs(s); if (!s.reponse) erreurs.push("réponse manquante : " + s.id); } if (!b.sous && !b.reponse) erreurs.push("réponse manquante : " + b.id); }
for (const i of src.intentions){ id(i, "intention"); motifs(i); if (!["local", "ia"].includes(i.traitement)) erreurs.push("traitement inconnu : " + i.id); }
id(src.hors_arbre, "hors_arbre");
for (const v of src.verification){ motifs(v); if (v.remplacement && !ids.has(v.remplacement)) erreurs.push(`remplacement inconnu (${v.id}) : ${v.remplacement}`); if (!v.remplacement && !v.reponse) erreurs.push("réponse manquante : " + v.id); }
if (erreurs.length){ console.error("Arbre invalide :\n- " + erreurs.join("\n- ")); process.exit(1); }

/* ---- code ---- */
const { _lecture, ...arbre } = src;
const entete = "// FICHIER GÉNÉRÉ par tools/arbre.mjs depuis arbre/arbre.json et arbre/moteur.js : ne pas modifier à la main.\n";
const donnees = "const ARBRE = " + JSON.stringify(arbre, null, 1) + ";\n\n";
ecrire("app/js/00-arbre.js", '"use strict";\n\n' + entete.replace("// ", "/* ") .replace("\n", " */\n") + donnees + moteur);
ecrire("supabase/functions/_shared/arbre.js", entete + donnees + moteur +
  "\nexport { ARBRE, normArbre, parcourirArbre, noeudArbre, promptClassifieur, lireClassification, verifierReponse, reglesReponse, repondreAvecArbre };\n");

/* ---- documentation ---- */
const cell = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = l => (l || []).map(m => "`" + cell(m) + "`").join("<br>");
let md = "### Level 1 – Safety barriers (checked in this order)\n\n| # | Id | Barrier | Covers | Action | OKA says |\n|---|---|---|---|---|---|\n";
src.barrieres.forEach((b, k) => {
  if (b.sous) b.sous.forEach((s, j) => md += `| ${k + 1}.${j + 1} | \`${s.id}\` | ${cell(b.nom)} › ${cell(s.nom)} | ${cell(s.description)} | ${b.action} | ${cell(s.reponse)} |\n`);
  else md += `| ${k + 1} | \`${b.id}\` | ${cell(b.nom)} | ${cell(b.description)} | ${b.action}${b.proposition ? " + " + b.proposition : ""} | ${cell(b.reponse)} |\n`;
});
md += `| – | \`${src.hors_arbre.id}\` | ${cell(src.hors_arbre.nom)} | ${cell(src.hors_arbre.description)} | refuser_orienter | ${cell(src.hors_arbre.reponse)} |\n`;
md += "\n### Level 2 – Scope: intents and the feature that handles them\n\n| Id | Intent | Covers | Handled by | Feature |\n|---|---|---|---|---|\n";
for (const i of src.intentions) md += `| \`${i.id}\` | ${cell(i.nom)} | ${cell(i.description)} | ${i.traitement === "local" ? "local (offline, no AI)" : "AI (classifier + Claude + check)"} | ${cell(i.fonction)} |\n`;
md += "\n### Output check – rules applied to every model answer\n\n| Id | Rule | Detects | Replaced by |\n|---|---|---|---|\n";
for (const v of src.verification) md += `| \`${v.id}\` | ${cell(v.nom)} | ${cell(v.description)} | ${v.remplacement ? "answer of `" + v.remplacement + "`" : cell(v.reponse)} |\n`;
md += "\n### Actions that always need the person's consent\n\n| Tag | Action | Why |\n|---|---|---|\n";
for (const a of src.actions_avec_accord) md += `| \`[[${a.balise}]]\` | ${cell(a.nom)} | ${cell(a.raison)} |\n`;
md += "\n### Rules appended to every answer prompt\n\n" + src.regles_reponse.map(r => "- " + r).join("\n") + "\n";
md += "\n### Knowledge base – help numbers\n\n| Service | Number |\n|---|---|\n" + src.base_connaissances.numeros_aide.map(x => `| ${cell(x.nom)} | ${x.numero} |`).join("\n") + "\n";
md += "\n### Knowledge base – scams that target older people\n\n| Scam | Warning sign | Right reflex |\n|---|---|---|\n" + src.base_connaissances.arnaques.map(x => `| ${cell(x.nom)} | ${cell(x.signe)} | ${cell(x.reflexe)} |`).join("\n") + "\n";
md += "\n<details><summary>Local patterns (regular expressions on normalised text)</summary>\n\n| Id | Patterns |\n|---|---|\n";
for (const b of src.barrieres) for (const x of b.sous || [b]) md += `| \`${x.id}\` | ${code(x.motifs)} |\n`;
for (const i of src.intentions) md += `| \`${i.id}\` | ${code(i.motifs)} |\n`;
for (const v of src.verification) md += `| output \`${v.id}\` | ${code(v.motifs)} |\n`;
md += "\n</details>\n\n<details><summary>Classifier examples (few-shot, written to differ from the test scenarios)</summary>\n\n| Id | Examples |\n|---|---|\n";
for (const b of src.barrieres) for (const x of b.sous || [b]) if (x.exemples) md += `| \`${x.id}\` | ${x.exemples.map(cell).join("<br>")} |\n`;
for (const x of [...src.intentions, src.hors_arbre]) if (x.exemples) md += `| \`${x.id}\` | ${x.exemples.map(cell).join("<br>")} |\n`;
md += "\n</details>\n";
// le prompt du classifieur, tel qu'il est envoyé
globalThis.ARBRE = arbre;
const promptClassifieur = new Function(moteur + "\nreturn promptClassifieur;")();

/* ---- schéma de l'arbre avec les 20 scénarios officiels, placés par le vrai parcours ---- */
const { parcourirArbre } = new Function(moteur + "\nreturn {parcourirArbre};")();
const scenarios = JSON.parse(lire("arbre/scenarios.json")).scenarios.filter(x => x.groupe !== "complement");
const place = {};
for (const x of scenarios){ const d = parcourirArbre(x.phrase); (place[d.type === "inconnu" ? "inconnu" : d.id] ||= []).push(x); }
const lab = t => String(t).replace(/"/g, "#quot;");
const cas = ids => ids.flatMap(i => place[i] || []).map(x => "<br/>" + x.id + " · " + lab(x.phrase.length > 46 ? x.phrase.slice(0, 44) + "…" : x.phrase)).join("");
let mm = "flowchart TD\n  P([\"Phrase dite ou écrite\"]) --> B0\n";
src.barrieres.forEach((b, k) => {
  const ids = b.sous ? b.sous.map(x => x.id) : [b.id];
  const q = b.sous ? b.nom + " ?<br/>" + b.sous.map(x => x.nom).join(", ") : b.nom + " ?";
  const action = {alerte:"Alerte : proches puis secours", orienter_humain:"Orientation vers un humain (3114)", masquer_et_avertir:"Message effacé, avertissement",
    conseil:"Conseil anti-arnaque + appel d'un proche", refuser_orienter:b.id === "medical" ? "Aucun avis médical, proposer le médecin" : "Refus poli + orientation"}[b.action];
  mm += `  B${k}{"${lab(q)}"} -- oui --> F${k}["<b>${lab(action)}</b>${cas(ids)}"]:::secu\n`;
  mm += `  B${k} -- non --> ${k + 1 < src.barrieres.length ? "B" + (k + 1) : "I"}\n`;
});
mm += `  I{"Intention reconnue par l'arbre ?"}\n`;
const locales = src.intentions.filter(x => x.traitement === "local"), ias = src.intentions.filter(x => x.traitement === "ia");
for (const x of locales.filter(x => place[x.id])) mm += `  I -- locale --> L_${x.id}["<b>${lab(x.nom)}</b> · sans IA${cas([x.id])}"]:::local\n`;
const autres = locales.filter(x => !place[x.id]).map(x => x.nom).join(", ");
if (autres) mm += `  I -- locale --> L_autres["<b>Autres fonctions locales</b><br/>${lab(autres)}"]:::local\n`;
mm += `  I -- question libre --> Q["<b>${lab(ias.map(x => x.nom).join(" · "))}</b>${cas(ias.map(x => x.id))}"]:::ia\n`;
mm += `  I -- rien de reconnu --> N["<b>Non reconnu</b>${cas(["inconnu"])}"]:::ia\n`;
mm += `  Q --> C{"Classifieur IA<br/>Haiku ou petit modèle local<br/>(si conversation libre activée)"}\n  N --> C\n`;
mm += `  C -- catégorie de sécurité --> CS["Réponse fixe de la barrière"]:::secu\n  C -- fonction locale --> CL["Fonction locale${(place.inconnu || []).map(x => "<br/>" + x.id + " → " + lab((src.intentions.find(i => i.id === x.attendu) || {nom:x.attendu}).nom)).join("")}"]:::local\n`;
mm += `  C -- question libre --> G["Réponse du modèle"]:::ia\n  G --> V{"Vérification de la réponse<br/>dose, diagnostic, code, vote, lien exclusif"}\n`;
mm += `  V -- problème --> VR["Réponse remplacée par celle de l'arbre"]:::secu\n  V -- ok --> S(["OKA parle ; appel, inscription, agenda seulement après « oui »"])\n`;
mm += `  classDef secu fill:#fde7e4,stroke:#c92a1d,color:#3a120d\n  classDef local fill:#e6f2e1,stroke:#4f7a3a,color:#1f3317\n  classDef ia fill:#e3ecf7,stroke:#3d6296,color:#14243a\n`;
ecrire("docs/arbre-schema.mmd", mm);
md = "### Diagram – the tree and where each of the 20 official scenarios lands\n\nGenerated from `arbre/arbre.json` and `arbre/scenarios.json` by walking the real tree (also in `docs/arbre-schema.mmd`, " +
  "to paste into mermaid.live for a PNG/SVG). Red: safety · green: local, no AI · blue: AI, through the classifier and the output check.\n\n```mermaid\n" + mm + "```\n\n" + md;
md += "\n<details><summary>Classifier prompt (generated from the tree)</summary>\n\n```text\n" + promptClassifieur() + "\n```\n\n</details>\n";

const doc = lire("docs/07-arbre-decisionnel.md");
const a = "<!-- debut:arbre -->", b = "<!-- fin:arbre -->";
if (!doc.includes(a) || !doc.includes(b)) { console.error("repères absents dans docs/07-arbre-decisionnel.md"); process.exit(1); }
ecrire("docs/07-arbre-decisionnel.md", doc.slice(0, doc.indexOf(a) + a.length) + "\n" + md + doc.slice(doc.indexOf(b)));
console.log(`arbre ${src.version} : ${src.barrieres.length} barrières, ${src.intentions.length} intentions, ${src.verification.length} règles de vérification → code et doc générés`);
