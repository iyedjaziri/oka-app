// Activation d'une tablette : code à usage unique -> jeton d'appareil.
import { cors, db, json, nouveauJeton, sha256 } from "../_shared/commun.ts";

// « abcd efgh », « ABCD-EFGH » -> « ABCD-EFGH »
const normaliserCode = (s: string) => {
  const c = (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erreur: "Méthode non autorisée" }, 405);
  try {
    const { code } = await req.json().catch(() => ({}));
    const c = normaliserCode(code);
    if (!c) return json(req, { erreur: "Le code doit contenir 8 caractères." }, 400);
    const jeton = nouveauJeton();
    const { data, error } = await db.rpc("activer_appareil", { p_code_hash: await sha256(c), p_jeton_hash: await sha256(jeton) });
    if (error) throw error;
    if (!data) return json(req, { erreur: "Code inconnu, déjà utilisé ou expiré." }, 404);
    return json(req, { jeton, structure: data.structure, ville: data.ville, ia: data.ia });
  } catch (e) {
    console.error("activer", e);
    return json(req, { erreur: "Erreur du serveur" }, 500);
  }
});
