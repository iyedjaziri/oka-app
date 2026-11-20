"use strict";

/* ================= JEUX CONTRE OKA ================= */
const GAMES = {
  morpion:{nom:"Morpion", art:"au morpion", intro:"Vous avez les croix. À vous de commencer !"},
  p4:{nom:"Puissance 4", art:"au puissance 4", intro:"Vous avez les jetons de couleur, moi les blancs. Alignez-en quatre !"},
  echecs:{nom:"Échecs", art:"aux échecs", intro:"Vous avez les blancs. À vous de jouer !"},
  sudoku:{nom:"Sudoku", art:"au sudoku", intro:"Remplissez la grille. Si vous bloquez, demandez-moi un indice."},
  scrabble:{nom:"Scrabble", art:"au scrabble", intro:"Cinq manches. Formez le mot qui rapporte le plus avec vos sept lettres."},
  memo:{nom:"Mémo", art:"au mémo", intro:"Retrouvez les paires. Vous commencez !"}
};
const LEVELS = {facile:"Facile", moyen:"Moyen", difficile:"Difficile"};
let G = {game:null, level:null, s:null, msg:""};
const rnd = n => Math.floor(Math.random()*n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { for (let i = a.length-1; i > 0; i--){ const j = rnd(i+1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function openGames(){ G = {game:null, level:null, s:null, msg:""}; showTab("jeux"); }
// à chaque partie, OKA demande le niveau
function chooseGame(g){
  G = {game:g, level:null, s:null, msg:""};
  pending = {type:"niveau"};
  showTab("jeux");
  say(`On joue ${GAMES[g].art} ! Quel niveau voulez-vous : facile, moyen ou difficile ?`, "sociable");
}
function chooseLevel(l){ if (!G.game) return; G.level = l; pending = null; startGame(); }
function startGame(){
  G.s = GINIT[G.game](G.level); G.msg = "";
  render();
  say(LEVELS[G.level] + ". " + GAMES[G.game].intro, "heureux");
}
function gameEnd(res, extra){
  if (!G.s) return;
  G.s.over = true;
  const reco = sortieApresJeu(); // une seule question à la fois : la sortie remplace la relance
  const t = (extra ? extra + " " : "") + (res === "win" ? "Bravo, vous avez gagné !" + (reco ? "" : " On en refait une ?") : res === "lose" ? "J'ai gagné cette fois !" + (reco ? "" : " Vous prenez votre revanche ?") : "Match nul ! C'était bien joué.");
  G.msg = t; render();
  say(t, res === "win" ? "bonne" : res === "lose" ? "sociable" : "heureux", reco);
}
const later = (f, ms) => setTimeout(() => { if (G.s && !G.s.over) f(); }, ms);

/* ---------- MORPION ---------- */
const TTT_L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const tttWin = (b, p) => TTT_L.some(l => l.every(i => b[i] === p));
function tttMinimax(b, p){
  if (tttWin(b, "O")) return {v:1}; if (tttWin(b, "X")) return {v:-1};
  const free = b.map((x,i) => x ? -1 : i).filter(i => i >= 0); if (!free.length) return {v:0};
  let best = {v: p === "O" ? -2 : 2, i: free[0]};
  for (const i of free){ b[i] = p; const r = tttMinimax(b, p === "O" ? "X" : "O"); b[i] = "";
    if ((p === "O" && r.v > best.v) || (p === "X" && r.v < best.v)) best = {v:r.v, i}; }
  return best;
}
function tttAI(b, level){
  const free = b.map((x,i) => x ? -1 : i).filter(i => i >= 0);
  const find = p => free.find(i => { b[i] = p; const w = tttWin(b, p); b[i] = ""; return w; });
  if (level === "facile") return Math.random() < .5 && find("O") != null ? find("O") : pick(free);
  if (level === "moyen"){ const w = find("O"); if (w != null) return w; const bl = find("X"); if (bl != null && Math.random() < .85) return bl; if (!b[4]) return 4; return pick(free); }
  return tttMinimax(b, "O").i;
}
function tttEnd(b){
  if (tttWin(b, "X")) return gameEnd("win"), true;
  if (tttWin(b, "O")) return gameEnd("lose"), true;
  if (b.every(x => x)) return gameEnd("draw"), true;
  return false;
}
function tttClick(i){
  const s = G.s; if (s.over || s.busy || s.b[i]) return;
  s.b[i] = "X"; render(); if (tttEnd(s.b)) return;
  s.busy = true; G.msg = "OKA réfléchit…"; render();
  later(() => { s.b[tttAI(s.b, G.level)] = "O"; s.busy = false; G.msg = "À vous !"; render(); tttEnd(s.b); }, 650);
}
const viewTTT = s => `<div class="board ttt">${s.b.map((x,i) => `<button data-a="ttt" data-i="${i}" class="${x}" aria-label="case ${i+1}">${x === "X" ? "✕" : x === "O" ? "◯" : ""}</button>`).join("")}</div>`;

/* ---------- PUISSANCE 4 ---------- */
const P4_ORDER = [3,2,4,1,5,0,6];
const p4Valid = g => P4_ORDER.filter(c => !g[c]);
function p4Drop(g, c, p){ for (let r = 5; r >= 0; r--) if (!g[r*7+c]){ g[r*7+c] = p; return r; } return -1; }
function p4Undo(g, c){ for (let r = 0; r < 6; r++) if (g[r*7+c]){ g[r*7+c] = 0; return; } }
function p4Win(g, p){
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++){
    if (g[r*7+c] !== p) continue;
    if (c <= 3 && g[r*7+c+1] === p && g[r*7+c+2] === p && g[r*7+c+3] === p) return true;
    if (r <= 2 && g[(r+1)*7+c] === p && g[(r+2)*7+c] === p && g[(r+3)*7+c] === p) return true;
    if (r <= 2 && c <= 3 && g[(r+1)*7+c+1] === p && g[(r+2)*7+c+2] === p && g[(r+3)*7+c+3] === p) return true;
    if (r <= 2 && c >= 3 && g[(r+1)*7+c-1] === p && g[(r+2)*7+c-2] === p && g[(r+3)*7+c-3] === p) return true;
  }
  return false;
}
function p4Score(g){
  let s = 0;
  for (let r = 0; r < 6; r++) s += (g[r*7+3] === 2 ? 3 : g[r*7+3] === 1 ? -3 : 0);
  const win = (cells) => { let a = 0, b = 0, e = 0; for (const v of cells){ if (v === 2) a++; else if (v === 1) b++; else e++; }
    if (a === 3 && e === 1) s += 5; else if (a === 2 && e === 2) s += 2; if (b === 3 && e === 1) s -= 4; else if (b === 2 && e === 2) s -= 1; };
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++){
    if (c <= 3) win([g[r*7+c], g[r*7+c+1], g[r*7+c+2], g[r*7+c+3]]);
    if (r <= 2) win([g[r*7+c], g[(r+1)*7+c], g[(r+2)*7+c], g[(r+3)*7+c]]);
    if (r <= 2 && c <= 3) win([g[r*7+c], g[(r+1)*7+c+1], g[(r+2)*7+c+2], g[(r+3)*7+c+3]]);
    if (r <= 2 && c >= 3) win([g[r*7+c], g[(r+1)*7+c-1], g[(r+2)*7+c-2], g[(r+3)*7+c-3]]);
  }
  return s;
}
function p4Mini(g, d, al, be, maxi){
  if (p4Win(g, 2)) return 100000 + d; if (p4Win(g, 1)) return -100000 - d;
  const v = p4Valid(g); if (!v.length) return 0; if (d === 0) return p4Score(g);
  let best = maxi ? -Infinity : Infinity;
  for (const c of v){ p4Drop(g, c, maxi ? 2 : 1); const x = p4Mini(g, d-1, al, be, !maxi); p4Undo(g, c);
    if (maxi){ best = Math.max(best, x); al = Math.max(al, x); } else { best = Math.min(best, x); be = Math.min(be, x); } if (be <= al) break; }
  return best;
}
function p4AI(g, level){
  const v = p4Valid(g);
  const wins = p => v.find(c => { p4Drop(g, c, p); const w = p4Win(g, p); p4Undo(g, c); return w; });
  const w = wins(2); if (w != null && level !== "facile") return w;
  if (level === "facile") return Math.random() < .4 && wins(1) != null ? wins(1) : pick(v);
  const bl = wins(1); if (bl != null) return bl;
  if (level === "moyen") return Math.random() < .6 ? v[0] : pick(v);
  let best = v[0], bv = -Infinity;
  for (const c of v){ p4Drop(g, c, 2); const x = p4Mini(g, 5, -Infinity, Infinity, false); p4Undo(g, c); if (x > bv){ bv = x; best = c; } }
  return best;
}
function p4End(g){
  if (p4Win(g, 1)) return gameEnd("win"), true;
  if (p4Win(g, 2)) return gameEnd("lose"), true;
  if (!p4Valid(g).length) return gameEnd("draw"), true;
  return false;
}
function p4Click(c){
  const s = G.s; if (s.over || s.busy || s.g[c]) return;
  p4Drop(s.g, c, 1); render(); if (p4End(s.g)) return;
  s.busy = true; G.msg = "OKA réfléchit…"; render();
  later(() => { p4Drop(s.g, p4AI(s.g, G.level), 2); s.busy = false; G.msg = "À vous ! Touchez une colonne."; render(); p4End(s.g); }, 650);
}
const viewP4 = s => `<div class="board p4">${s.g.map((v,i) => `<button data-a="p4" data-i="${i%7}" class="j${v}" aria-label="colonne ${i%7+1}"></button>`).join("")}</div>`;

/* ---------- ÉCHECS ---------- */
const N8 = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]], K8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]], ORTH = [[-1,0],[1,0],[0,-1],[0,1]];
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function chInit(){
  const b = Array(64).fill(null), back = "RNBQKBNR";
  for (let c = 0; c < 8; c++){ b[c] = "b"+back[c]; b[8+c] = "bP"; b[48+c] = "wP"; b[56+c] = "w"+back[c]; }
  return {b, turn:"w", cs:{wK:1, wQ:1, bK:1, bQ:1}, ep:-1, sel:-1, mv:[], last:null};
}
function chAttacked(b, sq, by){
  const r = sq >> 3, c = sq & 7, pr = by === "w" ? r+1 : r-1;
  for (const dc of [-1,1]) if (inB(pr, c+dc) && b[pr*8+c+dc] === by+"P") return true;
  for (const [dr,dc] of N8) if (inB(r+dr, c+dc) && b[(r+dr)*8+c+dc] === by+"N") return true;
  for (const [dr,dc] of K8) if (inB(r+dr, c+dc) && b[(r+dr)*8+c+dc] === by+"K") return true;
  for (const [dirs, a, q] of [[DIAG, "B", "Q"], [ORTH, "R", "Q"]])
    for (const [dr,dc] of dirs){ let rr = r+dr, cc = c+dc;
      while (inB(rr, cc)){ const p = b[rr*8+cc]; if (p){ if (p === by+a || p === by+q) return true; break; } rr += dr; cc += dc; } }
  return false;
}
function chPseudo(st, col){
  const b = st.b, out = [], opp = col === "w" ? "b" : "w";
  for (let sq = 0; sq < 64; sq++){
    const p = b[sq]; if (!p || p[0] !== col) continue;
    const t = p[1], r = sq >> 3, c = sq & 7, add = (to, x) => out.push(Object.assign({f:sq, t:to}, x || {}));
    if (t === "P"){
      const d = col === "w" ? -1 : 1, start = col === "w" ? 6 : 1, last = col === "w" ? 0 : 7, r1 = r+d;
      if (inB(r1, c) && !b[r1*8+c]){ add(r1*8+c, r1 === last ? {pr:1} : null); if (r === start && !b[(r+2*d)*8+c]) add((r+2*d)*8+c, {dbl:1}); }
      for (const dc of [-1,1]){ if (!inB(r1, c+dc)) continue; const to = r1*8+c+dc;
        if (b[to] && b[to][0] === opp) add(to, r1 === last ? {pr:1} : null); else if (to === st.ep) add(to, {ep:1}); }
    } else if (t === "N" || t === "K"){
      for (const [dr,dc] of (t === "N" ? N8 : K8)){ if (!inB(r+dr, c+dc)) continue; const q = b[(r+dr)*8+c+dc]; if (!q || q[0] === opp) add((r+dr)*8+c+dc); }
      if (t === "K" && sq === (col === "w" ? 60 : 4) && !chAttacked(b, sq, opp)){
        if (st.cs[col+"K"] && !b[sq+1] && !b[sq+2] && b[sq+3] === col+"R" && !chAttacked(b, sq+1, opp) && !chAttacked(b, sq+2, opp)) add(sq+2, {ck:1});
        if (st.cs[col+"Q"] && !b[sq-1] && !b[sq-2] && !b[sq-3] && b[sq-4] === col+"R" && !chAttacked(b, sq-1, opp) && !chAttacked(b, sq-2, opp)) add(sq-2, {cq:1});
      }
    } else {
      for (const [dr,dc] of (t === "B" ? DIAG : t === "R" ? ORTH : DIAG.concat(ORTH))){ let rr = r+dr, cc = c+dc;
        while (inB(rr, cc)){ const q = b[rr*8+cc]; if (!q) add(rr*8+cc); else { if (q[0] === opp) add(rr*8+cc); break; } rr += dr; cc += dc; } }
    }
  }
  return out;
}
function chApply(st, m){
  const b = st.b.slice(), p = b[m.f], col = p[0], cs = Object.assign({}, st.cs);
  b[m.t] = p; b[m.f] = null;
  if (m.ep) b[m.t + (col === "w" ? 8 : -8)] = null;
  if (m.pr) b[m.t] = col+"Q";
  if (m.ck){ b[m.t-1] = b[m.t+1]; b[m.t+1] = null; }
  if (m.cq){ b[m.t+1] = b[m.t-2]; b[m.t-2] = null; }
  if (p[1] === "K"){ cs[col+"K"] = 0; cs[col+"Q"] = 0; }
  for (const [sq,k] of [[63,"wK"],[56,"wQ"],[7,"bK"],[0,"bQ"]]) if (m.f === sq || m.t === sq) cs[k] = 0;
  return {b, turn: col === "w" ? "b" : "w", cs, ep: m.dbl ? (m.f+m.t)/2 : -1, sel:-1, mv:[], last:m};
}
const chInCheck = (b, col) => chAttacked(b, b.indexOf(col+"K"), col === "w" ? "b" : "w");
const chLegal = (st, col) => chPseudo(st, col).filter(m => !chInCheck(chApply(st, m).b, col));
const CVAL = {P:100, N:320, B:330, R:500, Q:900, K:0};
function chEval(b){
  let s = 0;
  for (let sq = 0; sq < 64; sq++){ const p = b[sq]; if (!p) continue; const r = sq >> 3, c = sq & 7;
    let v = CVAL[p[1]]; const center = 3.5 - Math.max(Math.abs(3.5-r), Math.abs(3.5-c));
    if (p[1] === "N" || p[1] === "B") v += center*8;
    if (p[1] === "P") v += (p[0] === "w" ? 6-r : r-1)*6 + center*3;
    s += p[0] === "b" ? v : -v; }
  return s;
}
function chSearch(st, d, al, be, maxi){
  const col = maxi ? "b" : "w";
  if (d === 0) return chEval(st.b);
  const ms = chLegal(st, col);
  if (!ms.length) return chInCheck(st.b, col) ? (maxi ? -100000-d : 100000+d) : 0;
  ms.sort((x, y) => (st.b[y.t] ? CVAL[st.b[y.t][1]] : 0) - (st.b[x.t] ? CVAL[st.b[x.t][1]] : 0));
  let best = maxi ? -Infinity : Infinity;
  for (const m of ms){ const v = chSearch(chApply(st, m), d-1, al, be, !maxi);
    if (maxi){ best = Math.max(best, v); al = Math.max(al, v); } else { best = Math.min(best, v); be = Math.min(be, v); } if (be <= al) break; }
  return best;
}
function chAI(st, level){
  const ms = chLegal(st, "b"); if (!ms.length) return null;
  if (level === "facile"){ const caps = ms.filter(m => st.b[m.t]); return caps.length && Math.random() < .35 ? pick(caps) : pick(ms); }
  const D = level === "moyen" ? 2 : 3, noise = level === "moyen" ? 40 : 4;
  let best = ms[0], bv = -Infinity;
  for (const m of ms){ const v = chSearch(chApply(st, m), D-1, -Infinity, Infinity, false) + Math.random()*noise; if (v > bv){ bv = v; best = m; } }
  return best;
}
function chAfter(st){
  const col = st.turn, ms = chLegal(st, col), chk = chInCheck(st.b, col);
  if (!ms.length){ if (chk) gameEnd(col === "b" ? "win" : "lose", "Échec et mat !"); else gameEnd("draw", "Pat !"); return true; }
  if (chk){ G.msg = col === "w" ? "Échec ! Protégez votre roi." : "Échec au roi d'OKA !"; if (col === "w") say("Attention, échec !", "rappel"); }
  return false;
}
function chClick(sq){
  let s = G.s; if (s.over || s.busy || s.turn !== "w") return;
  const m = s.mv.find(x => x.t === sq);
  if (s.sel >= 0 && m){
    G.s = s = chApply(s, m); G.msg = ""; render(); if (chAfter(s)) return;
    s.busy = true; if (!G.msg) G.msg = "OKA réfléchit…"; render();
    later(() => { const a = chAI(s, G.level); if (!a) return; G.s = chApply(s, a); G.msg = ""; if (!chAfter(G.s) && !G.msg) G.msg = "À vous !"; render(); }, 120);
    return;
  }
  if (s.b[sq] && s.b[sq][0] === "w"){ s.sel = sq; s.mv = chLegal(s, "w").filter(x => x.f === sq); }
  else { s.sel = -1; s.mv = []; }
  render();
}
const GLYPH = {K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟"};
function viewChess(s){
  const kChk = ["w","b"].map(c => chInCheck(s.b, c) ? s.b.indexOf(c+"K") : -1);
  return `<div class="board chess">${s.b.map((p, sq) => { const r = sq >> 3, c = sq & 7;
    const cls = [(r+c) % 2 ? "sq-d" : "sq-l", sq === s.sel ? "sel" : "", s.mv.some(m => m.t === sq) ? "tgt" : "", s.last && (s.last.f === sq || s.last.t === sq) ? "lastm" : "", kChk.includes(sq) ? "chk" : ""].join(" ");
    return `<button data-a="ch" data-i="${sq}" class="${cls}">${p ? `<span class="${p[0] === "w" ? "pw" : "pb"}">${GLYPH[p[1]]}︎</span>` : ""}</button>`; }).join("")}</div>`;
}

/* ---------- SUDOKU ---------- */
const sdOk = (g, r, c, n) => { for (let k = 0; k < 9; k++){ if (g[r*9+k] === n || g[k*9+c] === n) return false; }
  const br = r - r%3, bc = c - c%3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[(br+i)*9+bc+j] === n) return false; return true; };
function sdFill(g){ const i = g.indexOf(0); if (i < 0) return true; const r = Math.floor(i/9), c = i%9;
  for (const n of shuffle([1,2,3,4,5,6,7,8,9])) if (sdOk(g, r, c, n)){ g[i] = n; if (sdFill(g)) return true; g[i] = 0; } return false; }
function sdInit(level){
  const sol = Array(81).fill(0); sdFill(sol);
  const cur = sol.slice(), k = {facile:36, moyen:46, difficile:54}[level];
  shuffle([...Array(81).keys()]).slice(0, k).forEach(i => cur[i] = 0);
  return {sol, cur, fixed:cur.map(v => !!v), sel:-1};
}
function sdCheck(){
  const s = G.s;
  if (s.cur.every((v, i) => v === s.sol[i])) gameEnd("win", "Grille terminée !");
  else if (s.cur.every(v => v)) { G.msg = "La grille est pleine, mais il reste des erreurs."; render(); }
}
function sdClick(i){ const s = G.s; if (s.over || s.fixed[i]) return; s.sel = i; render(); }
function sdNum(n){ const s = G.s; if (s.over || s.sel < 0 || s.fixed[s.sel]) return; s.cur[s.sel] = n; render(); sdCheck(); }
function sdHint(){
  const s = G.s; if (s.over) return;
  const cand = s.cur.map((v, i) => v !== s.sol[i] ? i : -1).filter(i => i >= 0); if (!cand.length) return;
  const i = s.sel >= 0 && s.cur[s.sel] !== s.sol[s.sel] ? s.sel : pick(cand);
  s.cur[i] = s.sol[i]; s.fixed[i] = true; s.sel = -1; render();
  say(`Indice : ligne ${Math.floor(i/9)+1}, colonne ${i%9+1}, c'est un ${s.sol[i]}.`, "rappel");
  sdCheck();
}
function viewSudoku(s){
  const showErr = G.level !== "difficile";
  return `<div class="sdwrap"><div class="board sud">${s.cur.map((v, i) => { const r = Math.floor(i/9), c = i%9;
      const cls = [s.fixed[i] ? "fx" : "", i === s.sel ? "sel" : "", c % 3 === 2 && c < 8 ? "b3" : "", r % 3 === 2 && r < 8 ? "b3b" : "", showErr && v && !s.fixed[i] && v !== s.sol[i] ? "err" : ""].join(" ");
      return `<button data-a="sd" data-i="${i}" class="${cls}">${v || ""}</button>`; }).join("")}</div>
    <div class="sdside"><div class="pad">${[1,2,3,4,5,6,7,8,9].map(n => `<button class="btn alt" data-a="sdn" data-i="${n}">${n}</button>`).join("")}<button class="btn ghost" data-a="sdn" data-i="0" aria-label="Effacer">${ic("x")}</button></div>
    <button class="btn orange" data-a="sdh" style="width:100%;justify-content:center;margin-top:8px">Un indice ?</button></div></div>`;
}

/* ---------- SCRABBLE (version simplifiée, sans plateau) ---------- */
const SC_VAL = {A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:10,L:1,M:2,N:1,O:1,P:3,Q:8,R:1,S:1,T:1,U:1,V:4,W:10,X:10,Y:10,Z:10};
const SC_BAG = "AAAAAAAAABBCCDDDEEEEEEEEEEEEEEEFFGGHHIIIIIIIIJKLLLLLMMMNNNNNNOOOOOOPPQRRRRRRSSSSSSTTTTTTUUUUUUVVWXYZ";
const SC_WORDS = ("AH AI AN AS AU BA BE BU CA CE CI DE DO DU EN ES ET EU FA FI HA HE IL IN JE LA LE LI LU MA ME MI MU NE NI NO NU ON OR OS OU RE RI SA SE SI SU TA TE TU UN US VA VU " +
  "AIL AIR AMI ANE ARC ART BAC BAL BAS BEC BIO BLE BOL BON BUS BUT CAP CAR CIL COL COQ CRI CRU DES DIT DON DOS DOT DUO DUR EAU ETE FAN FEE FER FEU FIL FIN FIT FOI FOU GAI GAZ GEL GUI ILE JUS LAC LIS LIT LOI LOT LUI MAI MAL MAT MER MIE MIS MOI MOT MUR NET NEZ NID NOM NUL OIE ONT OSE OUI PAS PEU PIC PIE PIN PLI POT PRE PUR RAT RIZ ROC ROI RUE SAC SEC SEL SET SIX SOL SON SOU SUD SUR TAS THE TOI TON TOT TRI TUE UNE UNI USE VAN VER VIE VIF VIN VIS VOL VUE " +
  "AIDE AILE AIME AMIE ANGE ARME AUBE AUTO AVEC BAIN BALE BANC BEAU BETE BIEN BISE BLEU BOIS BOUT BRAS CAFE CAGE CAPE CAVE CIEL CINQ CLE COEUR COIN CORDE CORPS COTE COUP COUR CRAN CUBE DAME DATE DENT DIRE DOUX DRAP DUNE ECOLE ETOILE FACE FAIM FETE FEUX FIER FILE FILS FLEUR FOIN FOIS FOND FORT FOUR FRAIS GARE GENS GOUT GRIS GROS HIER IDEE JEUX JOIE JOUR JUPE LAIT LAME LAPIN LIEN LIEU LION LIRE LIVRE LOIN LONG LUNE MAIN MAIS MARE MERE MIEL MINE MODE MOIS MONT MORT MOTS MUSE NAGE NEUF NUIT ONCLE OPERA OURS PAGE PAIN PAIR PAIX PARC PART PEAU PERE PIED PILE PIPE PLAT PLUIE PLUS POIS PONT PORT POTE PRIX PUITS QUAI RADIO RAME RANG RARE RIRE RIVE ROBE ROSE ROUE ROUTE SAGE SAIN SALE SANG SAUT SEIN SENS SEUL SIGNE SOIR SOLE SORT SOUPE SUCRE TANTE TAPIS TARTE TEMPS TERRE TETE THEATRE TIGRE TOIT TOUR TRAIN TROU TUBE UNION USINE VASE VEAU VENT VERS VERT VIDE VILLE VOIE VOIR VOIX VOTE " +
  "ABEILLE ACTEUR ADIEU AGNEAU AIMER AMOUR ANNEE ARBRE ARGENT ASSIETTE AUTEUR AVION BALLE BANANE BARQUE BATEAU BEURRE BIJOU BLANC BONBON BONNET BOUCHE BRAVO BROSSE CADEAU CAHIER CANARD CARTE CERISE CHAISE CHANT CHAPEAU CHAT CHATEAU CHAUD CHEMIN CHEVAL CHIEN CITRON CLOCHE COLLINE CONTE CORNE COUSIN CRAIE CREPE DANSE DESSIN DOIGT DRAPEAU ECHARPE ENFANT EPICE ETAGE FARINE FENETRE FERME FILLE FOLIE FORET FRERE FROMAGE FRUIT GALET GARDE GATEAU GENOU GLACE GOUTTE GRAINE GRAND GUITARE HERBE HIVER HOMME HONNEUR HUILE IMAGE JARDIN JAUNE JEUNE JOURNAL LAINE LEGUME LETTRE LIMONADE LITRE LUMIERE MAISON MARCHE MATIN MELON MENTHE MIROIR MONDE MOUTON MUSIQUE NAPPE NEIGE NOTE NUAGE OISEAU OLIVE OMBRE ORANGE ORAGE OREILLE OUTIL PALAIS PANIER PAPIER PARENT PATE PECHE PENSEE PERLE PETIT PIANO PIERRE PLAGE PLANTE POIRE POISSON POMME PORTE POULE PRAIRIE PRINCE QUATRE RAISIN REINE RENARD REPAS RIVIERE ROUGE RUBAN SABLE SALADE SAISON SALON SAUCE SAVON SEMAINE SERRE SOLEIL SOURIS STYLO TABLE TASSE TOMATE TRESOR VACHE VALISE VELO VIOLON VOISIN VOYAGE ").trim().split(/\s+/);
const SC_DICT = new Set(SC_WORDS);
const scScore = w => [...w].reduce((a, l) => a + (SC_VAL[l] || 0), 0) + (w.length >= 7 ? 50 : 0);
function scCanMake(w, rack){ const r = rack.slice(); for (const l of w){ const i = r.indexOf(l); if (i < 0) return false; r.splice(i, 1); } return true; }
function scDraw(bag){ for (;;){ const r = bag.splice(0, 7); if (r.filter(l => "AEIOUY".includes(l)).length >= 2) return r; bag.push(...r); shuffle(bag); } }
function scInit(){ const s = {round:0, rounds:5, you:0, oka:0, used:[], log:[], confirm:null}; scNewRound(s); return s; }
function scNewRound(s){ s.round++; const bag = shuffle([...SC_BAG]); s.rackY = scDraw(bag); s.rackO = scDraw(bag); s.used = []; s.confirm = null; }
function scWord(){ return G.s.used.map(i => G.s.rackY[i]).join(""); }
function scTile(i){ const s = G.s; if (s.over || s.busy) return; const k = s.used.indexOf(i); if (k >= 0) s.used.splice(k, 1); else s.used.push(i); render(); }
function scSubmit(force){
  const s = G.s, w = scWord(); if (s.over || s.busy) return;
  if (w.length < 2){ toast("Formez un mot d'au moins deux lettres."); return; }
  if (!force && !SC_DICT.has(w)){ s.confirm = w; render(); say(`Je ne connais pas le mot « ${w.toLowerCase()} ». Est-ce un vrai mot ?`, "oublie"); return; }
  const pts = scScore(w); s.you += pts; s.log.unshift(`Vous : ${w} (${pts} points)`); s.confirm = null; scOka(`${w.toLowerCase()}, ${pts} points.`);
}
function scPass(){ const s = G.s; if (s.over || s.busy) return; s.log.unshift("Vous passez votre tour"); scOka("Vous passez."); }
function scOka(prefix){
  const s = G.s; s.busy = true; s.used = []; G.msg = "OKA cherche un mot…"; render();
  later(() => {
    let cand = SC_WORDS.filter(w => scCanMake(w, s.rackO)).sort((a, b) => scScore(b) - scScore(a));
    if (G.level === "facile") cand = cand.filter(w => w.length <= 4);
    let w = null;
    if (cand.length) w = G.level === "difficile" ? cand[0] : G.level === "moyen" ? pick(cand.slice(0, Math.max(1, Math.ceil(cand.length/2)))) : pick(cand);
    let line;
    if (w){ const pts = scScore(w); s.oka += pts; s.log.unshift(`OKA : ${w} (${pts} points)`); line = `Moi, je joue ${w.toLowerCase()}, ${pts} points.`; }
    else { s.log.unshift("OKA passe son tour"); line = "Je ne trouve pas de mot, je passe."; }
    s.busy = false;
    if (s.round >= s.rounds){ const res = s.you > s.oka ? "win" : s.you < s.oka ? "lose" : "draw"; gameEnd(res, `${line} Score final : vous ${s.you}, moi ${s.oka}.`); return; }
    scNewRound(s); G.msg = `Manche ${s.round} sur ${s.rounds}. À vous !`; render(); say(line, "sociable");
  }, 900);
}
function viewScrabble(s){
  const w = scWord();
  return `<div class="scores"><span>Vous : ${s.you}</span><span>OKA : ${s.oka}</span><span class="muted">Manche ${Math.min(s.round, s.rounds)} / ${s.rounds}</span></div>
    <div class="word" aria-label="Votre mot">${s.used.map(i => `<button class="tile" data-a="sct" data-i="${i}">${s.rackY[i]}<small>${SC_VAL[s.rackY[i]]}</small></button>`).join("") || `<span class="muted" style="align-self:center">Touchez vos lettres pour former un mot</span>`}</div>
    <div class="tiles">${s.rackY.map((l, i) => `<button class="tile ${s.used.includes(i) ? "used" : ""}" data-a="sct" data-i="${i}">${l}<small>${SC_VAL[l]}</small></button>`).join("")}</div>
    ${s.confirm ? `<div class="card warn" style="text-align:center"><div class="big" style="justify-content:center;font-size:20px">« ${esc(s.confirm)} » : je ne connais pas ce mot.</div><div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-a="scy">C'est un vrai mot, on compte</button><button class="btn ghost" data-a="scn">Je change de mot</button></div></div>`
      : `<div class="row" style="justify-content:center"><button class="btn" data-a="scv" ${w.length < 2 ? "disabled" : ""}>Valider ${w ? "« " + w + " » · " + scScore(w) + " pts" : ""}</button><button class="btn ghost" data-a="scc">Effacer</button><button class="btn alt" data-a="scp">Passer</button></div>`}
    <div class="small muted" style="margin-top:10px">${s.log.slice(0, 6).map(esc).join("<br>")}</div>
    <p class="small muted">Version simplifiée sans plateau : chaque lettre vaut ses points du Scrabble, et un mot de 7 lettres donne 50 points de bonus.</p>`;
}

/* ---------- MÉMO ---------- */
const MEMO_ICONS = ["sun","heart","star","home","calendar","chat","phone","mail","clock","building","people","pencil","moon","medic"];
function memoInit(){ const ics = shuffle(MEMO_ICONS.slice()).slice(0, 8); return {cards:shuffle(ics.concat(ics)).map(ic => ({ic, open:false, done:null})), flip:[], turn:"you", you:0, oka:0, mem:{}, busy:false}; }
const MEMO_P = {facile:.25, moyen:.6, difficile:1};
function memoSee(i){ const s = G.s; if (Math.random() < MEMO_P[G.level]) s.mem[i] = s.cards[i].ic; }
function memoFlip(i, who){
  const s = G.s, c = s.cards[i]; c.open = true; s.flip.push(i); memoSee(i); render();
  if (s.flip.length < 2) return;
  const [a, b] = s.flip; s.busy = true;
  setTimeout(() => {
    if (!G.s || G.s !== s) return;
    if (s.cards[a].ic === s.cards[b].ic){
      s.cards[a].done = s.cards[b].done = who; s[who]++; delete s.mem[a]; delete s.mem[b]; s.flip = []; s.busy = false;
      if (s.cards.every(x => x.done)){ render(); return gameEnd(s.you > s.oka ? "win" : s.you < s.oka ? "lose" : "draw", `Vous ${s.you} paire${s.you > 1 ? "s" : ""}, moi ${s.oka}.`); }
      G.msg = who === "you" ? "Une paire ! Rejouez." : "Une paire pour OKA, je rejoue."; render();
      if (who === "oka") setTimeout(memoOka, 700);
    } else {
      s.cards[a].open = s.cards[b].open = false; s.flip = []; s.busy = false;
      s.turn = who === "you" ? "oka" : "you"; G.msg = s.turn === "you" ? "À vous !" : "À OKA de jouer…"; render();
      if (s.turn === "oka") setTimeout(memoOka, 700);
    }
  }, 1100);
}
function memoOka(){
  const s = G.s; if (!s || s.over) return;
  const left = s.cards.map((c, i) => c.done ? -1 : i).filter(i => i >= 0);
  const known = Object.keys(s.mem).map(Number).filter(i => !s.cards[i].done);
  let first = null;
  for (const i of known){ const j = known.find(k => k !== i && s.mem[k] === s.mem[i]); if (j != null){ first = i; break; } }
  if (first == null){ const unk = left.filter(i => !(i in s.mem)); first = pick(unk.length ? unk : left); }
  s.busy = true; memoFlip(first, "oka");
  setTimeout(() => {
    if (G.s !== s || s.over) return;
    const ic = s.cards[first].ic;
    let second = known.find(k => k !== first && s.mem[k] === ic && !s.cards[k].done);
    if (second == null){ const unk = left.filter(i => i !== first && !(i in s.mem)); second = pick(unk.length ? unk : left.filter(i => i !== first)); }
    memoFlip(second, "oka");
  }, 800);
}
function memoClick(i){ const s = G.s; if (s.over || s.busy || s.turn !== "you" || s.cards[i].open || s.cards[i].done) return; memoFlip(i, "you"); }
function viewMemo(s){
  return `<div class="scores"><span>Vous : ${s.you}</span><span>OKA : ${s.oka}</span></div>
    <div class="board memo">${s.cards.map((c, i) => `<button data-a="mm" data-i="${i}" class="${c.done ? "done" : c.open ? "open" : ""}" aria-label="carte ${i+1}">${c.open || c.done ? `<span style="color:var(--ico${i%3+1})">${ic(c.ic)}</span>` : `<span class="back"></span>`}</button>`).join("")}</div>`;
}

/* ---------- vue de l'onglet Jeux ---------- */
const GINIT = {morpion:() => ({b:Array(9).fill("")}), p4:() => ({g:Array(42).fill(0)}), echecs:chInit, sudoku:sdInit, scrabble:scInit, memo:memoInit};
const GVIEW = {morpion:viewTTT, p4:viewP4, echecs:viewChess, sudoku:viewSudoku, scrabble:viewScrabble, memo:viewMemo};
const GICON = {
  morpion:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M17 6v36M31 6v36M6 17h36M6 31h36"/><path d="M9 9l5 5M14 9l-5 5" /><circle cx="38" cy="38" r="3"/></svg>',
  p4:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="5" y="8" width="38" height="32" rx="3"/><circle cx="15" cy="18" r="4"/><circle cx="24" cy="18" r="4"/><circle cx="33" cy="30" r="4" fill="currentColor"/><circle cx="24" cy="30" r="4" fill="currentColor"/><circle cx="15" cy="30" r="4"/></svg>',
  echecs:'<svg viewBox="0 0 48 48"><text x="24" y="38" text-anchor="middle" font-size="38" fill="currentColor">♞︎</text></svg>',
  sudoku:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="36" height="36" rx="2"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/><text x="12" y="16" font-size="9" fill="currentColor" stroke="none" text-anchor="middle">5</text><text x="36" y="40" font-size="9" fill="currentColor" stroke="none" text-anchor="middle">3</text><text x="24" y="28" font-size="9" fill="currentColor" stroke="none" text-anchor="middle">9</text></svg>',
  scrabble:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="8" width="32" height="32" rx="4"/><text x="23" y="33" font-size="22" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">A</text><text x="34" y="37" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>',
  memo:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="10" width="20" height="28" rx="3"/><rect x="22" y="8" width="20" height="28" rx="3" transform="rotate(8 32 22)"/><path d="M16 20l2 4 4 .5-3 2.5 1 4-4-2-4 2 1-4-3-2.5 4-.5z" fill="currentColor" stroke="none"/></svg>'
};
function viewJeux(){
  if (!G.game) return `<h2>Jouer avec OKA</h2><p class="muted">Choisissez un jeu. OKA vous demandera le niveau à chaque partie.</p>
    <div class="gmenu">${Object.keys(GAMES).map((k, i) => `<button class="gcard" data-a="gg" data-i="${k}"><span style="color:var(--ico${i%3+1})">${GICON[k]}</span>${GAMES[k].nom}</button>`).join("")}</div>`;
  const head = `<div class="gbar"><h2 style="margin:0">${GAMES[G.game].nom}${G.level ? ` <span class="tag">${LEVELS[G.level]}</span>` : ""}</h2>
    <div class="row">${G.level ? `<button class="btn sm" data-a="gn">Nouvelle partie</button>` : ""}<button class="btn sm ghost" data-a="gm">Autres jeux</button></div></div>`;
  if (!G.level) return head + `<p class="big" style="display:block;font-size:24px">Quel niveau voulez-vous ?</p>
    <div class="lvls">${Object.keys(LEVELS).map(l => `<button class="btn ${l === "moyen" ? "orange" : l === "difficile" ? "" : "alt"}" data-a="gl" data-i="${l}">${LEVELS[l]}</button>`).join("")}</div>`;
  return head + `<div class="gmsg">${esc(G.msg)}</div><div id="gameZone">${GVIEW[G.game](G.s)}</div>`;
}
function gameClick(e){
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, i = b.dataset.i;
  wake();
  ({gg:() => chooseGame(i), gl:() => chooseLevel(i), gn:() => { pending = {type:"niveau"}; G.level = null; G.s = null; G.msg = ""; render(); say("Nouvelle partie ! Quel niveau cette fois : facile, moyen ou difficile ?", "sociable"); },
    gm:() => { G = {game:null, level:null, s:null, msg:""}; pending = null; render(); },
    ttt:() => tttClick(+i), p4:() => p4Click(+i), ch:() => chClick(+i), sd:() => sdClick(+i), sdn:() => sdNum(+i), sdh:sdHint,
    sct:() => scTile(+i), scv:() => scSubmit(false), scy:() => scSubmit(true), scn:() => { G.s.confirm = null; G.s.used = []; render(); }, scc:() => { G.s.used = []; render(); }, scp:scPass,
    mm:() => memoClick(+i)}[a] || (() => {}))();
}
