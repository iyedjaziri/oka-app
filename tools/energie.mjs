// Estimation de l'énergie consommée par les modèles locaux (IA, voix) sur la machine qui les fait tourner.
// Mesure réelle : temps processeur des processus (Linux, /proc). Estimation : énergie = puissance du processeur
// × temps processeur / nombre de processeurs logiques. Pas de capteur d'énergie sous WSL : c'est une estimation
// de l'énergie marginale (sans le repos de la machine ni l'écran), à calibrer si besoin avec un wattmètre.
import fs from "fs";
import os from "os";

// puissance nominale du processeur (TDP) ; i7-8565U : 15 W. À ajuster : OKA_WATTS_CPU=25 npm run station
export const WATTS_CPU = +(process.env.OKA_WATTS_CPU || 15);
export const CPUS = os.cpus().length;
const TICKS = 100; // getconf CLK_TCK sous Linux

/** Temps processeur cumulé (secondes) des processus dont la ligne de commande contient « motif ». */
export function cpuSecondes(motif) {
  let t = 0;
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      if (!fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").includes(motif)) continue;
      const st = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      const f = st.slice(st.lastIndexOf(")") + 2).split(" ");
      t += (+f[11] + +f[12]) / TICKS; // utime + stime
    } catch { /* processus terminé entre-temps */ }
  }
  return t;
}
export const whDepuisCpu = s => (WATTS_CPU * s) / CPUS / 3600;

/** Mesure une opération : durée, temps processeur des processus « motif », énergie estimée. */
export async function mesurer(motif, operation) {
  const c0 = cpuSecondes(motif), t0 = performance.now();
  const resultat = await operation();
  const cpu = Math.max(0, cpuSecondes(motif) - c0), duree = (performance.now() - t0) / 1000;
  return { resultat, mesure: { duree, cpu, wh: whDepuisCpu(cpu) } };
}
