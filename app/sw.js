// Service worker OKA : l'application fonctionne hors ligne et se met à jour seule.
// Stratégie : réseau d'abord (4 s max), puis la copie en cache. Les appels externes (météo, serveur OKA) ne passent pas ici.
const VERSION = "__VERSION__"; // remplacé par le numéro de commit au déploiement
const CACHE = "oka-app-" + VERSION;
const COQUILLE = [
  "./", "index.html", "config.js", "manifest.webmanifest", "css/oka.css",
  "js/01-pictogrammes.js", "js/02-images.js", "js/03-donnees.js", "js/04-avatar.js", "js/05-voix-ecoute.js",
  "js/06-cerveau.js", "js/07-agenda-meteo.js", "js/08-liens-urgence.js", "js/09-interface.js",
  "js/10-profil-reglages.js", "js/11-jeux.js", "js/12-compte.js", "js/13-sorties-ville.js", "js/14-ambiance.js", "js/15-demarrage.js",
  "img/logo.webp", "img/neutre.webp", "img/tendre.webp", "img/joie.webp", "img/gourmand.webp", "img/accueil.webp",
  "img/pensive.webp", "img/bravo.webp", "img/inquiete.webp", "img/rire.webp",
  "icons/oka-180.png", "icons/oka-192.png", "icons/oka-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("oka-app-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // la musique est lue par morceaux (requêtes partielles) : laissée au navigateur
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/admin/") || url.pathname.includes("/audio/")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try{
      const r = await Promise.race([fetch(e.request), new Promise((_, ko) => setTimeout(() => ko(new Error("lent")), 4000))]);
      if (r.status === 200) cache.put(e.request, r.clone());
      return r;
    }catch(err){
      return (await cache.match(e.request, {ignoreSearch:true})) || (e.request.mode === "navigate" ? cache.match("index.html") : Response.error());
    }
  })());
});
