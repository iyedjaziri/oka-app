"use strict";

/* ================= NOMBRES EN LETTRES (pour la voix) ================= */
// Les voix lisent mal les chiffres : avant de parler, « 10h30 » devient « dix heures trente »,
// « 04 97 13 53 84 » est lu par groupes, « 2,5 » devient « deux virgule cinq ». L'écran garde les chiffres.
// Aussi utilisé par tools/voix-clips.mjs pour les phrases pré-enregistrées.
const UNITES = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
const DIZAINES = ["","","vingt","trente","quarante","cinquante","soixante"];
function moinsDeCent(n){
  if (n <= 16) return UNITES[n];
  if (n < 20) return "dix-" + UNITES[n - 10];
  if (n < 70){ const d = Math.floor(n / 10), u = n % 10; return DIZAINES[d] + (u === 0 ? "" : u === 1 ? " et un" : "-" + UNITES[u]); }
  if (n < 80) return "soixante" + (n === 71 ? " et onze" : "-" + moinsDeCent(n - 60));
  if (n === 80) return "quatre-vingts";
  return "quatre-vingt-" + moinsDeCent(n - 80);
}
function moinsDeMille(n){
  const c = Math.floor(n / 100), r = n % 100;
  const cent = c === 0 ? "" : c === 1 ? "cent" : UNITES[c] + (r === 0 ? " cents" : " cent");
  return [cent, r || !c ? moinsDeCent(r) : ""].filter(Boolean).join(" ");
}
function enLettres(n){
  if (n < 1000) return moinsDeMille(n);
  if (n < 1e6){ const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? "mille" : moinsDeMille(m).replace(/cents$/, "cent") + " mille") + (r ? " " + moinsDeMille(r) : ""); }
  if (n < 1e9){ const m = Math.floor(n / 1e6), r = n % 1e6; return (m === 1 ? "un million" : enLettres(m) + " millions") + (r ? " " + enLettres(r) : ""); }
  return String(n);
}
const groupe = g => g.length > 1 && g[0] === "0" ? "zéro " + (g.length === 2 ? UNITES[+g[1]] : enLettres(+g.slice(1))) : enLettres(+g);
function nombresEnLettres(t){
  return String(t)
    // numéros de téléphone : lus groupe par groupe
    .replace(/\b0\d?(?:[ .]\d{2,3}){2,4}\b|\b0\d(?:\d{2}){4}\b/g, m => (/[ .]/.test(m) ? m.split(/[ .]/) : m.match(/\d{2}/g)).map(groupe).join(", "))
    // numéros courts de services (3114, 3977) : par paires, comme on les annonce
    .replace(/\b3\d{3}\b/g, m => enLettres(+m.slice(0, 2)) + " " + enLettres(+m.slice(2)))
    // heures : 10h30, 10 h, 10:30
    .replace(/\b(\d{1,2})\s?(?:h|:)\s?(\d{2})?\b(?!\s?(?:mWh|Wh))/g, (_, h, m) => enLettres(+h) + (+h > 1 ? " heures" : " heure") + (m && +m ? " " + enLettres(+m) : ""))
    .replace(/\b1er\b/g, "premier").replace(/\b1re\b/g, "première")
    .replace(/(\d+),(\d+)/g, (_, a, b) => enLettres(+a) + " virgule " + (b[0] === "0" ? "zéro " : "") + enLettres(+b))
    .replace(/(\d)\s?°/g, "$1 degrés").replace(/(\d)\s?%/g, "$1 pour cent").replace(/(\d)\s?€/g, "$1 euros")
    .replace(/\d+/g, m => m.length > 1 && m[0] === "0" ? m.split("").map(c => UNITES[+c]).join(" ") : enLettres(+m));
}
