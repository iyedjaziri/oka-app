// Événements seniors de la Ville de Nice (API officielle nice.fr), pour l'onglet Sorties.
// Données publiques : pas de jeton exigé. Cache de 15 min ; « ?rafraichir=1 » relit le site (au plus toutes les 2 min).
import { cors, json } from "../_shared/commun.ts";
import { evenementsNice } from "../_shared/evenements-nice.js";

let cache: { t: number; data: unknown } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  const forcer = new URL(req.url).searchParams.get("rafraichir") === "1";
  const age = cache ? Date.now() - cache.t : Infinity;
  if (cache && (age < 15 * 60e3 && !(forcer && age > 2 * 60e3))) return json(req, cache.data);
  try {
    cache = { t: Date.now(), data: await evenementsNice() };
    return json(req, cache.data);
  } catch (e) {
    console.error("evenements", e);
    if (cache) return json(req, cache.data); // site de la mairie indisponible : dernières données connues
    return json(req, { erreur: "Le site de la mairie ne répond pas." }, 502);
  }
});
