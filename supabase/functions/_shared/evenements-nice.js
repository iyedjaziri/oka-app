// Événements seniors de la Ville de Nice, lus dans l'API officielle du site nice.fr (WordPress).
// Module commun : fonction Edge « evenements » (Deno) et construction du fichier de démo (Node).
// Publics retenus : senior (100), carte MNCA senior (215), Pass senior 55+ (216).

const API = "https://www.nice.fr/wp-json/wp/v2";
const PUBLICS = "100,215,216";

// texte brut à partir du HTML de WordPress
export function texte(s) {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&rsquo;|&lsquo;/g, "’").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ").trim();
}

// dates « AAAAMMJJ » / « AAAA-MM-JJ », calculées en UTC pour éviter les décalages
const versIso = d => (d.length === 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6) : d);
const jourUtc = iso => new Date(iso + "T12:00:00Z");
const plusJours = (iso, n) => { const d = jourUtc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hm = t => (t ? String(t).slice(0, 5) : "");
export const aujourdhuiParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

// toutes les dates d'un événement entre debut et fin (dates simples + séances récurrentes hebdomadaires)
function dates(acf, debut, fin) {
  const out = [];
  for (const d of acf.event_dates || []) {
    if (!d || !d.start_date) continue;
    const j = versIso(d.start_date);
    if (j >= debut && j <= fin) out.push({ date: j, heure: hm(d.start_time), fin: hm(d.end_time), place: d.place });
  }
  const r = acf.recurring_enable && acf.recurring;
  if (r && r.start_date && Array.isArray(r.slots)) {
    const exc = new Set((r.exceptions || []).map(versIso));
    const a = versIso(r.start_date) > debut ? versIso(r.start_date) : debut;
    const b = r.end_date && versIso(r.end_date) < fin ? versIso(r.end_date) : fin;
    for (let j = a; j <= b; j = plusJours(j, 1)) {
      if (exc.has(j)) continue;
      const jour = jourUtc(j).getUTCDay(); // 0 = dimanche
      for (const s of r.slots) if (+s.weekday % 7 === jour) out.push({ date: j, heure: hm(s.start_time), fin: hm(s.end_time), place: s.place });
    }
  }
  return out;
}

async function json(fetchFn, url) {
  const r = await fetchFn(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("nice.fr : erreur " + r.status);
  return { data: await r.json(), pages: +(r.headers.get("x-wp-totalpages") || 1) };
}

/**
 * Prochains événements seniors (par défaut sur 45 jours), triés par date.
 * @returns {Promise<{maj: string, source: string, evenements: object[]}>}
 */
export async function evenementsNice({ jours = 45, fetchFn = fetch, max = 200 } = {}) {
  const debut = aujourdhuiParis(), fin = plusJours(debut, jours);
  const champs = "_fields=id,title,link,excerpt,event_types,acf";
  const bruts = [];
  for (let page = 1, total = 1; page <= total && page <= 5; page++) {
    const { data, pages } = await json(fetchFn, `${API}/events?audience=${PUBLICS}&per_page=100&page=${page}&orderby=modified&order=desc&${champs}`);
    bruts.push(...data); total = pages;
  }
  const types = new Map((await json(fetchFn, `${API}/event_types?per_page=100&_fields=id,name`)).data.map(t => [t.id, texte(t.name)]));

  const seances = [];
  for (const e of bruts) {
    const acf = e.acf || {};
    for (const d of dates(acf, debut, fin)) seances.push({ e, acf, d, place: +(d.place || acf.place) || 0 });
  }
  const ids = [...new Set(seances.map(s => s.place).filter(Boolean))];
  const lieux = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await json(fetchFn, `${API}/place?include=${ids.slice(i, i + 100).join(",")}&per_page=100&_fields=id,title,acf`);
    for (const p of data) {
      const a = (p.acf && p.acf.address) || {};
      lieux.set(p.id, { nom: texte(p.title && p.title.rendered), adresse: [a.street_address, a.postal_code, a.city].filter(Boolean).join(" ") });
    }
  }

  const evenements = seances.map(({ e, acf, d, place }) => {
    const l = lieux.get(place) || { nom: texte(acf.location) || "Nice", adresse: "" };
    return {
      id: `nice_${e.id}_${d.date.replace(/-/g, "")}${d.heure.replace(":", "")}`,
      titre: texte(e.title && e.title.rendered).slice(0, 140),
      date: d.date, heure: d.heure || "10:00", fin: d.fin,
      lieu: l.nom, adresse: l.adresse,
      types: (e.event_types || []).map(t => types.get(t)).filter(Boolean),
      gratuit: !!acf.free,
      inscription: texte(acf.registration).slice(0, 240),
      resume: texte(e.excerpt && e.excerpt.rendered).slice(0, 240),
      lien: e.link || "https://www.nice.fr/agenda-seniors/",
    };
  }).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)).slice(0, max);

  return { maj: new Date().toISOString(), source: "Ville de Nice", evenements };
}
