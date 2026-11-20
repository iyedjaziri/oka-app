// Fabrique dist/OKA-avatar-parlant.html : un seul fichier autonome, comme la v3, pour une démo hors ligne
// (double-clic, clé USB). Sans serveur : pas d'activation ni de questions libres.
import fs from "fs";

const app = new URL("../app/", import.meta.url);
const lire = f => fs.readFileSync(new URL(f, app), "utf8");
let html = lire("index.html");

html = html.replace('<link rel="stylesheet" href="css/oka.css">', () => "<style>\n" + lire("css/oka.css") + "</style>");
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n/g, "");
html = html.replace('<script src="config.js"></script>\n', "");
html = html.replace(/src="img\/(\w+)\.webp"/g, (_, k) => 'src="data:image/webp;base64,' + fs.readFileSync(new URL("img/" + k + ".webp", app)).toString("base64") + '"');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n/g)];
for (const [balise, src] of scripts) {
  let js = lire(src);
  if (src.endsWith("02-images.js")) js = js.replace(/"img\/(\w+)\.webp"/g, (_, k) => '"data:image/webp;base64,' + fs.readFileSync(new URL("img/" + k + ".webp", app)).toString("base64") + '"');
  html = html.replace(balise, () => (balise === scripts[0][0] ? "<script>\n" : "") + js + (balise === scripts.at(-1)[0] ? "</script>\n" : ""));
}
fs.mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../dist/OKA-avatar-parlant.html", import.meta.url), html);
console.log("dist/OKA-avatar-parlant.html :", Math.round(html.length / 1024), "Ko");
