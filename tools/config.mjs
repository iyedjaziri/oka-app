// Écrit app/config.js (adresse du serveur OKA). Aucun secret : la clé « anon » de Supabase est publique par nature.
//   node tools/config.mjs              -> depuis SUPABASE_URL / SUPABASE_ANON_KEY (déploiement GitHub Pages)
//   node tools/config.mjs --local      -> depuis le Supabase local (npx supabase status)
//   node tools/config.mjs --si-absent  -> crée un config.js vide (mode local) s'il n'existe pas
import { execSync } from "child_process";
import fs from "fs";

const cible = new URL("../app/config.js", import.meta.url);
const args = process.argv.slice(2);
if (args.includes("--si-absent") && fs.existsSync(cible)) process.exit(0);

let url = process.env.SUPABASE_URL || "", cle = process.env.SUPABASE_ANON_KEY || "";
if (args.includes("--local")) {
  const env = execSync("npx supabase status -o env", { encoding: "utf8" });
  const v = k => (env.match(new RegExp("^" + k + '="?([^"\\n]*)"?', "m")) || [])[1] || "";
  url = v("API_URL"); cle = v("ANON_KEY") || v("PUBLISHABLE_KEY");
  if (!url || !cle) { console.error("Supabase local introuvable : lancez d'abord « npm run db:start »."); process.exit(1); }
}
const obligatoire = (process.env.OKA_ACTIVATION_OBLIGATOIRE ?? (url ? "1" : "0")) === "1";
const cfg = { supabaseUrl: url, supabaseAnonKey: cle, activationObligatoire: obligatoire };
fs.writeFileSync(cible, "// Généré par tools/config.mjs : ne pas modifier à la main.\nwindow.OKA_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n");
console.log("app/config.js :", url ? url + (obligatoire ? " (activation obligatoire)" : " (activation facultative)") : "mode local, sans serveur");
