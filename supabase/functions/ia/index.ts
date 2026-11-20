// Relais des questions libres : la clé d'API reste sur le serveur, rien n'est enregistré.
// Vérifie la tablette, parcourt l'arbre de décision (barrières, classifieur, réponse, vérification),
// limite le nombre de questions par jour.
import { appareil, cors, db, json } from "../_shared/commun.ts";
import { parcourirArbre, repondreAvecArbre } from "../_shared/arbre.js";
import { IndisponibleError, type Message, repondre } from "../_shared/ia.ts";

const QUOTA_JOUR = Number(Deno.env.get("IA_QUOTA_JOUR") ?? 150);
const NB_MESSAGES = 6; // derniers messages transmis (cahier des charges)

const reponse = (req: Request, texte: string, stop = "end_turn", chemin?: string[]) =>
  json(req, { content: [{ type: "text", text: texte }], stop_reason: stop, chemin });

function messagesValides(m: unknown): Message[] | null {
  if (!Array.isArray(m)) return null;
  let l = m
    .filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim())
    .map((x) => ({ role: x.role, content: x.content.slice(0, 1500) }) as Message)
    .slice(-NB_MESSAGES);
  while (l.length && l[0].role !== "user") l = l.slice(1);
  return l.length && l[l.length - 1].role === "user" ? l : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erreur: "Méthode non autorisée" }, 405);
  try {
    const a = await appareil(req);
    if (!a) return json(req, { erreur: "Tablette désactivée" }, 401);
    if (!a.ia) return json(req, { erreur: "Questions libres non autorisées pour cette tablette" }, 403);

    const body = await req.json().catch(() => ({}));
    const messages = messagesValides(body.messages);
    if (!messages) return json(req, { erreur: "Messages invalides" }, 400);

    // barrières de sécurité locales : réponse fixe, sans appel au modèle ni quota
    const local = parcourirArbre(messages[messages.length - 1].content) as { type: string; reponse?: string; expr?: string; chemin: string[] };
    if (local.type === "barriere") return reponse(req, local.reponse + " [[EXPR:" + local.expr + "]]", "end_turn", local.chemin);

    const { data: ok, error } = await db.rpc("consommer_quota_ia", { p_appareil: a.appareil, p_max: QUOTA_JOUR });
    if (error) throw error;
    if (!ok) return json(req, { erreur: "Nombre de questions du jour atteint" }, 429);

    const r = await repondreAvecArbre({
      system: String(body.system ?? "").slice(0, 8000), messages,
      appeler: ({ system, messages, max_tokens }: { system: string; messages: Message[]; max_tokens?: number }) => repondre(system, messages, max_tokens),
    });
    if (r.route) return json(req, { route: r.route, chemin: r.chemin });
    return reponse(req, r.texte, r.stop, r.chemin);
  } catch (e) {
    if (e instanceof IndisponibleError) return json(req, { erreur: e.message }, 503);
    console.error("ia", e);
    return json(req, { erreur: "Erreur du serveur" }, 500);
  }
});
