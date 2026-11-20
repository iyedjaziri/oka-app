"use strict";

/* ================= VEILLE, HORLOGE, TOAST ================= */
function sleep(){ av.sleeping = true; setExpr("endormie"); document.getElementById("zzz").classList.remove("hidden"); }
function wake(){ av.lastAct = Date.now(); if (av.sleeping){ av.sleeping = false; document.getElementById("zzz").classList.add("hidden"); setExpr("neutre"); } }
document.getElementById("stage").onclick = () => { if (av.sleeping){ wake(); say("Oh ! Je m'étais assoupie. Je suis là !", "heureux"); } };
let toastT;
function toast(t, ms){ const el = document.getElementById("toast"); el.textContent = t; el.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add("hidden"), ms || 4500); }
function tickClock(){
  const d = new Date();
  document.getElementById("clockT").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
  document.getElementById("clockD").textContent = JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear();
  if (!av.sleeping && !av.speaking && !av.listening && Date.now() - av.lastAct > 180000) sleep();
}
setInterval(tickClock, 1000); tickClock();
setInterval(checkReminders, 30000);
setInterval(loadWeather, 30*60000);
if (bc) bc.onmessage = e => { if (e.data && e.data.t === "sync"){ agenda = store.get("agenda", agenda); activities = store.get("activities", activities); rooms = store.get("rooms", rooms); unread = store.get("unread", unread); render(); } };
window.addEventListener("storage", e => { if (e.key && e.key.startsWith("oka_")){ agenda = store.get("agenda", agenda); rooms = store.get("rooms", rooms); render(); } });
// mise à jour en direct de l'agenda (passage des heures)
setInterval(() => { if (tab === "agenda" || tab === "today") render(); }, 60000);

/* ================= DÉMARRAGE ================= */
applyDisplay();
initRooms(); renderChips(); render();
if (!log.length) addLog("oka", "Bonjour ! Appuyez sur « Parler », écrivez avec le crayon, ou touchez un onglet."); else renderLog();
if (!profile){ openProfile(); fillProfile(DEMO_PROFILE()); }
else { loadWeather(); setTimeout(() => checkReminders(), 3000); }
