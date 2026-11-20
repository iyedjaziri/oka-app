// Messagerie de la tablette avec l'équipe de sa structure (CCAS, partenaires d'événements).
//   GET  → {structure, messages}     (50 derniers ; ceux de l'équipe sont marqués lus)
//   POST {texte} → {id, date}       (refusé s'il contient un code ou un mot de passe : arbre de décision)
// Les messages sont effacés après 30 jours (purger_messages).
import { cors, db, json, sha256 } from "../_shared/commun.ts";
import { parcourirArbre } from "../_shared/arbre.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  try {
    const jeton = req.headers.get("x-oka-appareil") ?? "";
    if (jeton.length < 20) return json(req, { erreur: "Tablette non activée" }, 401);
    const h = await sha256(jeton);
    if (req.method === "GET") {
      const { data, error } = await db.rpc("messages_appareil", { p_jeton_hash: h });
      if (error) throw error;
      return data ? json(req, data) : json(req, { erreur: "Tablette désactivée" }, 401);
    }
    if (req.method === "POST") {
      const { texte } = await req.json().catch(() => ({}));
      const t = String(texte ?? "").trim().slice(0, 1000);
      if (!t) return json(req, { erreur: "Message vide" }, 400);
      const d = parcourirArbre(t) as { id: string; reponse?: string };
      if (d.id === "donnees_sensibles") return json(req, { erreur: "Message non envoyé : il contient une donnée sensible", reponse: d.reponse }, 422);
      const { data, error } = await db.rpc("ecrire_message_appareil", { p_jeton_hash: h, p_texte: t });
      if (error) throw error;
      return data ? json(req, data) : json(req, { erreur: "Tablette désactivée" }, 401);
    }
    return json(req, { erreur: "Méthode non autorisée" }, 405);
  } catch (e) {
    console.error("messages", e);
    return json(req, { erreur: "Erreur du serveur" }, 500);
  }
});
