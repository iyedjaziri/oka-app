// Station locale OKA : IA et voix qui tournent sur cette machine, avec mesure de consommation.
//   npm run station            → http://localhost:8787 (Ctrl+C pour l'arrêter : l'application repasse sur Claude
//                                ou sur la voix du navigateur)
// L'application (en ligne ou fichier de démo) appelle la station ; l'arbre de décision reste appliqué par l'application.
//   GET  /etat       services en ligne, modèle, voix, consommation cumulée
//   POST /ia         {system, messages, max_tokens} → {texte, stop, mesure}       (Ollama, petit modèle)
//   GET  /voix       liste des voix
//   POST /voix/tts   {texte, voix} → audio WAV, en-tête x-oka-mesure              (Pocket TTS, modèle français)
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { mesurer, WATTS_CPU, CPUS } from "./energie.mjs";

const PORT = +(process.env.OKA_STATION_PORT || 8787);
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODELE = process.env.OKA_MODELE_LOCAL || "qwen2.5:1.5b";
const PORT_VOIX = PORT + 1;
const POCKET = new URL("../.venv-voix/bin/pocket-tts", import.meta.url).pathname;
// voix intégrées de Pocket TTS, disponibles avec le modèle français ; Estelle est la voix française d'origine
const VOIX = [["estelle", "Estelle (voix française d'origine)"],
  ...[["cosette", "Cosette"], ["fantine", "Fantine"], ["eponine", "Éponine"], ["azelma", "Azelma"], ["anna", "Anna"], ["vera", "Vera"], ["eve", "Eve"], ["mary", "Mary"], ["jane", "Jane"], ["alba", "Alba"], ["caro_davy", "Caro"]].map(([id, n]) => [id, n + " (féminine)"]),
  ...[["marius", "Marius"], ["javert", "Javert"], ["jean", "Jean"], ["charles", "Charles"], ["paul", "Paul"], ["george", "George"], ["michael", "Michael"]].map(([id, n]) => [id, n + " (masculine)"])]
  .map(([id, nom]) => ({ id, nom }));

const conso = { depuis: new Date().toISOString(), ia: { appels: 0, cpu: 0, wh: 0, duree: 0 }, voix: { phrases: 0, cpu: 0, wh: 0, duree: 0 } };
const ajouter = (k, m) => { const c = conso[k]; c.cpu += m.cpu; c.wh += m.wh; c.duree += m.duree; };

/* ---- voix : serveur officiel Pocket TTS (modèle français allégé), lancé et arrêté avec la station ---- */
let voix = null;
if (fs.existsSync(POCKET)) {
  voix = spawn(POCKET, ["serve", "--language", "french", "--quantize", "--port", String(PORT_VOIX)], { stdio: ["ignore", "ignore", "pipe"] });
  voix.stderr.on("data", d => { if (/error|Uvicorn running/i.test(d)) process.stdout.write("voix  " + d); });
  voix.on("exit", c => { console.log("voix : serveur arrêté (" + c + ")"); voix = null; });
} else console.log("voix : Pocket TTS non installé (voir docs/08-sobriete-local.md) – la voix du navigateur reste utilisée");
const arret = () => { if (voix) voix.kill(); process.exit(0); };
process.on("SIGINT", arret); process.on("SIGTERM", arret);

async function etatOllama() {
  try {
    const r = await fetch(OLLAMA + "/api/tags", { signal: AbortSignal.timeout(1500) });
    const modeles = (await r.json()).models.map(m => m.name);
    return { en_ligne: true, modele: MODELE, installe: modeles.includes(MODELE) || modeles.includes(MODELE + ":latest"), modeles };
  } catch { return { en_ligne: false, modele: MODELE }; }
}
async function etatVoix() {
  try { const r = await fetch(`http://localhost:${PORT_VOIX}/health`, { signal: AbortSignal.timeout(1500) }); return { en_ligne: r.ok, voix: r.ok ? VOIX : [] }; }
  catch { return { en_ligne: false, voix: [] }; }
}

/* ---- serveur ---- */
const ENTETES = {
  "access-control-allow-origin": "*", "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-expose-headers": "x-oka-mesure",
  "access-control-allow-private-network": "true", // page en ligne (https) qui appelle cette machine
};
const json = (res, data, status = 200) => { res.writeHead(status, { ...ENTETES, "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
const corps = req => new Promise((ok, ko) => { let d = ""; req.on("data", c => (d += c)); req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } }); });

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, ENTETES); return res.end(); }
  const chemin = new URL(req.url, "http://x").pathname;
  try {
    if (chemin === "/etat") return json(res, { station: true, ia: await etatOllama(), voix: await etatVoix(), consommation: conso, machine: { cpus: CPUS, watts_cpu: WATTS_CPU } });

    if (chemin === "/ia" && req.method === "POST") {
      const { system = "", messages = [], max_tokens = 300, json: enJson = false } = await corps(req);
      const { resultat: j, mesure } = await mesurer("ollama", async () => {
        const r = await fetch(OLLAMA + "/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: MODELE, max_tokens, temperature: 0.2, ...(enJson ? { response_format: { type: "json_object" } } : {}),
            messages: [{ role: "system", content: system }, ...messages] }) });
        if (!r.ok) throw new Error("Ollama " + r.status + " : " + (await r.text()).slice(0, 200));
        return r.json();
      });
      conso.ia.appels++; ajouter("ia", mesure);
      const c = j.choices[0];
      console.log(`ia    ${mesure.duree.toFixed(1)} s · ${mesure.cpu.toFixed(1)} s CPU · ${(mesure.wh * 1000).toFixed(2)} mWh`);
      return json(res, { texte: String(c.message.content || "").trim(), stop: c.finish_reason === "length" ? "max_tokens" : "end_turn", modele: MODELE, mesure });
    }

    if (chemin === "/voix") { const v = await etatVoix(); return json(res, v.voix, v.en_ligne ? 200 : 503); }

    if (chemin === "/voix/tts" && req.method === "POST") {
      const demande = await corps(req);
      const formulaire = new FormData();
      formulaire.set("text", String(demande.texte || "").slice(0, 400));
      formulaire.set("voice_url", VOIX.some(v => v.id === demande.voix) ? demande.voix : "estelle");
      const { resultat: audio, mesure } = await mesurer("pocket-tts", async () => {
        const r = await fetch(`http://localhost:${PORT_VOIX}/tts`, { method: "POST", body: formulaire });
        if (!r.ok) throw new Error("voix " + r.status);
        return Buffer.from(await r.arrayBuffer());
      });
      conso.voix.phrases++; ajouter("voix", mesure);
      console.log(`voix  ${mesure.duree.toFixed(1)} s · ${mesure.cpu.toFixed(1)} s CPU · ${(mesure.wh * 1000).toFixed(2)} mWh · « ${String(demande.texte).slice(0, 40)} »`);
      res.writeHead(200, { ...ENTETES, "content-type": "audio/wav", "x-oka-mesure": JSON.stringify(mesure) });
      return res.end(audio);
    }
    json(res, { erreur: "introuvable" }, 404);
  } catch (e) {
    console.warn(chemin, e.message);
    json(res, { erreur: e.message }, 502);
  }
}).listen(PORT, async () => {
  const ia = await etatOllama();
  console.log(`Station OKA : http://localhost:${PORT}  ·  processeur ${WATTS_CPU} W, ${CPUS} processeurs logiques`);
  console.log(`IA locale  : ${ia.en_ligne ? (ia.installe ? MODELE + " prêt" : MODELE + " absent → ollama pull " + MODELE) : "Ollama arrêté → ollama serve"}`);
});
