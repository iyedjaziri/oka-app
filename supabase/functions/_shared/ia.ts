// Fournisseurs d'IA pour les questions libres.
// Par défaut : Claude Haiku 5.5 (cahier des charges). En option (décision D9) : un modèle local
// exposant une API compatible OpenAI (Ollama, LM Studio…), via IA_FOURNISSEUR=local.
import Anthropic from "npm:@anthropic-ai/sdk@1.5.0";

const MODELE_CLAUDE = "claude-haiku-5-5"; // imposé : pas de choix de modèle côté tablette
// ~150 dans le cahier des charges ; un peu de marge pour les balises d'action en fin de réponse.
const MAX_TOKENS = Number(Deno.env.get("IA_MAX_TOKENS") ?? 200);

export type Message = { role: "user" | "assistant"; content: string };
export type Reponse = { texte: string; stop: string };
export class IndisponibleError extends Error {}

const REFUS = "Je préfère ne pas répondre à cela. Parlons d'autre chose, si vous voulez. [[EXPR:neutre]]";

let claude: Anthropic | null = null;

async function viaClaude(system: string, messages: Message[]): Promise<Reponse> {
  claude ??= new Anthropic(); // clé lue dans ANTHROPIC_API_KEY (secret Supabase)
  try {
    const r = await claude.messages.create({
      model: MODELE_CLAUDE,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" }, // réponses courtes lues à voix haute : pas de réflexion
      system,
      messages,
    });
    if (r.stop_reason === "refusal") return { texte: REFUS, stop: "refusal" };
    const texte = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ").trim();
    return { texte, stop: r.stop_reason ?? "end_turn" };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new IndisponibleError("Claude indisponible : " + e.message);
    }
    throw e; // 400/401/403 : erreur de configuration, visible dans les journaux
  }
}

async function viaLocal(system: string, messages: Message[]): Promise<Reponse> {
  const url = (Deno.env.get("IA_URL") ?? "http://host.docker.internal:11434").replace(/\/$/, "");
  const cle = Deno.env.get("IA_CLE");
  let r: Response;
  try {
    r = await fetch(url + "/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cle ? { authorization: "Bearer " + cle } : {}) },
      body: JSON.stringify({
        model: Deno.env.get("IA_MODELE") ?? "qwen2.5:7b",
        max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
  } catch (e) {
    throw new IndisponibleError("Modèle local injoignable : " + (e as Error).message);
  }
  if (!r.ok) throw new IndisponibleError("Modèle local : erreur " + r.status);
  const j = await r.json();
  const c = j.choices?.[0];
  return { texte: String(c?.message?.content ?? "").trim(), stop: c?.finish_reason === "length" ? "max_tokens" : "end_turn" };
}

export function repondre(system: string, messages: Message[]): Promise<Reponse> {
  return (Deno.env.get("IA_FOURNISSEUR") ?? "anthropic") === "local" ? viaLocal(system, messages) : viaClaude(system, messages);
}
