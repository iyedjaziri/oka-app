// Fabrique dist/OKA-avatar-parlant.html : un seul fichier autonome, comme la v3, pour une démo hors ligne
// (double-clic, clé USB). Sans serveur : pas d'activation ; les questions libres marchent avec une clé de test
// saisie dans Réglages avancés (mode test, réservé à ce fichier).
import fs from "fs";
import { evenementsNice } from "../supabase/functions/_shared/evenements-nice.js";

const app = new URL("../app/", import.meta.url);
const lire = f => fs.readFileSync(new URL(f, app), "utf8");
let html = lire("index.html");

html = html.replace('<link rel="stylesheet" href="css/oka.css">', () => "<style>\n" + lire("css/oka.css") + "</style>");
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n/g, "");
// événements seniors de la Ville de Nice au jour de la construction (le bouton Rafraîchir passe ensuite par Claude)
let evts = null;
try { evts = await evenementsNice(); console.log("événements de la Ville de Nice :", evts.evenements.length); }
catch (e) { console.warn("événements non embarqués :", e.message); }
const json = v => JSON.stringify(v).replace(/</g, "\\u003c");
// phrases de voix pré-générées (npm run voix:clips), embarquées pour la démo hors ligne
let clips = null;
const idx = new URL("audio/voix/index.json", app);
if (fs.existsSync(idx)) {
  const j = JSON.parse(fs.readFileSync(idx, "utf8"));
  clips = { voix: j.voix, phrases: Object.fromEntries(Object.keys(j.phrases).map(k => [k, "data:audio/wav;base64," + fs.readFileSync(new URL(`audio/voix/${j.voix}/${k}.wav`, app)).toString("base64")])) };
  console.log("phrases de voix embarquées :", Object.keys(clips.phrases).length);
}
html = html.replace('<script src="config.js"></script>\n', () => "<script>window.OKA_CONFIG = {modeTest:true};" + (evts ? " window.OKA_EVENEMENTS = " + json(evts) + ";" : "") + (clips ? " window.OKA_CLIPS = " + json(clips) + ";" : "") + "</script>\n");
html = html.replace(/src="img\/(\w+)\.webp"/g, (_, k) => 'src="data:image/webp;base64,' + fs.readFileSync(new URL("img/" + k + ".webp", app)).toString("base64") + '"');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n/g)];
for (const [balise, src] of scripts) {
  let js = lire(src);
  if (src.endsWith("14-ambiance.js")) js = js.replace(/"(audio\/[\w-]+\.mp3)"/g, (_, f) => '"data:audio/mpeg;base64,' + fs.readFileSync(new URL(f, app)).toString("base64") + '"');
  if (src.endsWith("02-images.js")) js = js.replace(/"img\/(\w+)\.webp"/g, (_, k) => '"data:image/webp;base64,' + fs.readFileSync(new URL("img/" + k + ".webp", app)).toString("base64") + '"');
  html = html.replace(balise, () => (balise === scripts[0][0] ? "<script>\n" : "") + js + (balise === scripts.at(-1)[0] ? "</script>\n" : ""));
}
fs.mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../dist/OKA-avatar-parlant.html", import.meta.url), html);
console.log("dist/OKA-avatar-parlant.html :", Math.round(html.length / 1024), "Ko");
