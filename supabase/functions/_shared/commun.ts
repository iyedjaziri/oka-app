// Outils communs aux fonctions OKA : CORS, réponses JSON, empreintes, accès base (service_role).
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const ORIGINES = (Deno.env.get("OKA_ORIGINES") ?? "*").split(",").map((o) => o.trim());

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.includes("*") ? "*" : ORIGINES.includes(o) ? o : ORIGINES[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-oka-appareil",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors(req), "content-type": "application/json; charset=utf-8" } });

export async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Jeton de tablette : 32 octets aléatoires en base64url.
export function nouveauJeton(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Client base avec la clé service_role (fournie automatiquement par Supabase aux fonctions).
export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Vérifie le jeton envoyé par la tablette ; renvoie ses droits ou null.
export async function appareil(req: Request): Promise<null | { appareil: string; structure: string; ville: string; ia: boolean }> {
  const jeton = req.headers.get("x-oka-appareil") ?? "";
  if (jeton.length < 20) return null;
  const { data, error } = await db.rpc("appareil_valide", { p_jeton_hash: await sha256(jeton) });
  if (error) throw error;
  return data;
}
