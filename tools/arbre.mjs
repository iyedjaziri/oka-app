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
md += "\n</details>\n";
// le prompt du classifieur, tel qu'il est envoyé
globalThis.ARBRE = arbre;
const promptClassifieur = new Function(moteur + "\nreturn promptClassifieur;")();
md += "\n<details><summary>Classifier prompt (generated from the tree)</summary>\n\n```text\n" + promptClassifieur() + "\n```\n\n</details>\n";

const doc = lire("docs/07-arbre-decisionnel.md");
const a = "<!-- debut:arbre -->", b = "<!-- fin:arbre -->";
if (!doc.includes(a) || !doc.includes(b)) { console.error("repères absents dans docs/07-arbre-decisionnel.md"); process.exit(1); }
ecrire("docs/07-arbre-decisionnel.md", doc.slice(0, doc.indexOf(a) + a.length) + "\n" + md + doc.slice(doc.indexOf(b)));
console.log(`arbre ${src.version} : ${src.barrieres.length} barrières, ${src.intentions.length} intentions, ${src.verification.length} règles de vérification → code et doc générés`);
