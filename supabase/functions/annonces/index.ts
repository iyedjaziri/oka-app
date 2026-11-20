// Annonces visibles par une tablette (et état de la tablette : structure, IA autorisée).
import { cors, db, json, sha256 } from "../_shared/commun.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  try {
    const jeton = req.headers.get("x-oka-appareil") ?? "";
    if (jeton.length < 20) return json(req, { erreur: "Tablette non activée" }, 401);
    const { data, error } = await db.rpc("annonces_appareil", { p_jeton_hash: await sha256(jeton) });
    if (error) throw error;
    if (!data) return json(req, { erreur: "Tablette désactivée" }, 401);
    return json(req, { structure: data.structure, ville: data.ville, ia: data.ia, annonces: data.annonces });
  } catch (e) {
    console.error("annonces", e);
    return json(req, { erreur: "Erreur du serveur" }, 500);
  }
});
