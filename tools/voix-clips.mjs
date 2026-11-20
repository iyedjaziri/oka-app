// Phrases fixes d'OKA pré-générées une fois avec la voix IA (Pocket TTS) : aucune consommation à l'usage,
// disponibles hors ligne et dans le fichier de démo. Les phrases variables restent dites en direct.
//   npm run voix:clips              (voix estelle)      npm run voix:clips -- cosette
import fs from "fs";
import { spawnSync } from "child_process";

const VOIX = process.argv[2] || "estelle";
const racine = new URL("../", import.meta.url);
const arbre = JSON.parse(fs.readFileSync(new URL("arbre/arbre.json", racine), "utf8"));

// phrases fixes de l'application (hors arbre)
const APP = [
  "Je n'ai pas bien compris. Vous pouvez me demander l'heure, votre agenda, la météo, une sortie, ou d'appeler un proche.",
  "Très bien. Je reste là si vous avez besoin.", "Très bien, je ne fais rien.", "C'est fermé.",
  "Dites facile, moyen ou difficile.", "À quoi voulez-vous jouer ? Morpion, puissance 4, échecs, sudoku, scrabble ou mémo ?",
  "Je préfère ne pas répondre à cela. Parlons d'autre chose, si vous voulez.",
  "D'accord. Je suis soulagée. Je reste là si besoin.", "Oh ! Je m'étais assoupie. Je suis là !",
  "C'est envoyé à vos proches, dans les messages.", "C'est partagé avec vos proches.",
];
const phrases = [...APP, arbre.hors_arbre.reponse];
for (const b of arbre.barrieres) { if (b.reponse) phrases.push(b.reponse); for (const s of b.sous || []) phrases.push(s.reponse); }
for (const v of arbre.verification) if (v.reponse) phrases.push(v.reponse);

// même découpage et même clé que l'application (app/js/05-voix-ecoute.js, app/js/16-station.js)
function splitSentences(t) {
  const out = [];
  for (let p of (t.match(/[^.!?…;:]+[.!?…;:]*/g) || [t]).map(x => x.trim()).filter(Boolean)) {
    while (p.length > 180) { let k = p.lastIndexOf(",", 180); if (k < 60) k = p.lastIndexOf(" ", 180); if (k < 1) k = 180; out.push(p.slice(0, k + 1).trim()); p = p.slice(k + 1).trim(); }
    if (p) out.push(p);
  }
  return out;
}
const cleClip = s => { let h = 0x811c9dc5; for (const c of s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim()) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

// nombres en lettres, avec le même code que l'application (app/js/05-nombres.js)
const nombresEnLettres = new Function(fs.readFileSync(new URL("app/js/05-nombres.js", racine), "utf8") + "\nreturn nombresEnLettres;")();
const table = {};
for (const p of phrases) for (const s of splitSentences(p)) table[cleClip(s)] = nombresEnLettres(s);
const dossier = new URL("app/audio/voix/", racine);
fs.mkdirSync(dossier, { recursive: true });
fs.writeFileSync(new URL("phrases.json", dossier), JSON.stringify(table, null, 1));
console.log(Object.keys(table).length + " phrases distinctes → app/audio/voix/phrases.json");

const python = new URL(".venv-voix/bin/python", racine).pathname;
if (!fs.existsSync(python)) { console.error("Pocket TTS absent : voir docs/08-sobriete-local.md"); process.exit(1); }
const r = spawnSync(python, [new URL("tools/voix/clips.py", racine).pathname, VOIX], { stdio: "inherit" });
process.exit(r.status ?? 1);
