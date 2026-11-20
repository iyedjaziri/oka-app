"use strict";

/* ================= RENDU DE L'AVATAR (Canvas) ================= */
const cv = document.getElementById("face"), ctx = cv.getContext("2d");
const IM = {};
let loaded = 0;
const BG = {};
for (const k in IMG_SRC){ const i = new Image(); i.onload = () => { loaded++;
  try{ const c = document.createElement("canvas"); c.width = c.height = 8; const x = c.getContext("2d"); x.drawImage(i, 4, 4, 40, 40, 0, 0, 8, 8);
    const d = x.getImageData(0,0,8,8).data; let r=0,g=0,b=0; for (let j=0;j<d.length;j+=4){ r+=d[j]; g+=d[j+1]; b+=d[j+2]; } const n = d.length/4;
    BG[k] = `rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})`; }catch(e){} };
  i.src = IMG_SRC[k]; IM[k] = i; }

const av = {
  expr:"neutre", img:"neutre", prev:null, fade:1,
  speaking:false, listening:false, sleeping:false,
  open:0, wide:1, tOpen:0, tWide:1,
  blink:0, nextBlink:performance.now()+2500, blinkT:-1,
  gx:0, gy:0, tgx:0, tgy:0, nextGaze:0,
  sniff:0, nextSniff:performance.now()+6000,
  tilt:0, nod:0, lastAct:Date.now()
};
function setImg(name){ if (av.img === name) return; av.prev = av.img; av.img = name; av.fade = 0; }
function setExpr(e){
  e = EXPR_ALIAS[e] || e;
  if (!EXPR[e]) e = "neutre";
  av.expr = e;
  document.getElementById("exprLbl").textContent = EXPR[e].label;
  setImg(av.speaking ? EXPR[e].talk : EXPR[e].idle);
}
let lastBg = "";
function bgOf(name){ return BG[name] || "#f6f6f5"; }

function drawFace(name, alpha, t){
  const img = IM[name]; if (!img || !img.complete || !img.naturalWidth) return;
  const W = 720, H = Math.round(img.naturalHeight*720/img.naturalWidth), oy = 806 - H;
  const f = FACE[name];
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, oy, W, H);
  const sx = img.naturalWidth/720; // échelle source
  const src = (x,y,w,h,dx,dy,dw,dh) => ctx.drawImage(img, x*sx, y*sx, w*sx, h*sx, dx, dy+oy, dw, dh);
  if (f){
    // regard : petits déplacements de l'iris
    if (Math.abs(av.gx)+Math.abs(av.gy) > .1){
      for (const e of f.eyes){
        ctx.save(); ctx.beginPath(); ctx.ellipse(e.x, e.y+oy, e.r*.72, e.ry*.72, 0, 0, Math.PI*2); ctx.clip();
        src(e.x-e.r-av.gx, e.y-e.ry-av.gy, e.r*2, e.ry*2, e.x-e.r, e.y-e.ry, e.r*2, e.ry*2);
        ctx.restore();
      }
    }
    // truffe qui renifle
    if (av.sniff > .01){
      const n = f.nose, s = 1 + .05*av.sniff, r = n.r*1.25;
      ctx.save(); ctx.beginPath(); ctx.ellipse(n.x, n.y+oy, r, r*.85, 0, 0, Math.PI*2); ctx.clip();
      src(n.x-r, n.y-r, r*2, r*2, n.x-r*s, n.y-r*s - 1.5*av.sniff, r*2*s, r*2*s);
      ctx.restore();
    }
    // bouche
    const m = f.mouth, o = av.open;
    if (o > .02){
      const h = o * m.w * .62, hw = m.w * (.55 + .35*o) * av.wide;
      // intérieur de la bouche
      ctx.save();
      const g = ctx.createRadialGradient(m.x, m.y+oy+h*.4, 2, m.x, m.y+oy+h*.4, hw);
      g.addColorStop(0, "#5a1a1a"); g.addColorStop(1, "#1d0606");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(m.x-hw, m.y+oy);
      ctx.quadraticCurveTo(m.x, m.y+oy-3, m.x+hw, m.y+oy);
      ctx.quadraticCurveTo(m.x+hw*.8, m.y+oy+h*1.15, m.x, m.y+oy+h*1.2);
      ctx.quadraticCurveTo(m.x-hw*.8, m.y+oy+h*1.15, m.x-hw, m.y+oy);
      ctx.fill();
      // dents du haut
      if (o > .35){ ctx.fillStyle = "rgba(245,240,230,.9)"; ctx.beginPath(); ctx.ellipse(m.x, m.y+oy+2, hw*.55, Math.min(4, h*.18), 0, 0, Math.PI); ctx.fill(); }
      // langue
      ctx.fillStyle = "#c9636a"; ctx.beginPath(); ctx.ellipse(m.x, m.y+oy+h*.85, hw*.5, h*.3, 0, Math.PI, 0); ctx.fill();
      ctx.restore();
      // mâchoire : la fourrure sous la bouche descend (patch adouci)
      const pw = m.w*2.1, ph = m.w*1.45;
      jaw.width = pw*2; jaw.height = ph;
      jctx.clearRect(0,0,jaw.width,ph);
      jctx.drawImage(img, (m.x-pw)*sx, m.y*sx, pw*2*sx, ph*sx, 0, 0, pw*2, ph);
      jctx.globalCompositeOperation = "destination-in";
      jctx.save(); jctx.scale(1.45, 1);
      const mg = jctx.createRadialGradient(pw/1.45, 0, ph*.25, pw/1.45, 0, ph);
      mg.addColorStop(0, "rgba(0,0,0,1)"); mg.addColorStop(.7, "rgba(0,0,0,.85)"); mg.addColorStop(1, "rgba(0,0,0,0)");
      jctx.fillStyle = mg; jctx.fillRect(0, 0, pw*2/1.45, ph); jctx.restore();
      jctx.globalCompositeOperation = "source-over";
      ctx.drawImage(jaw, m.x-pw, m.y+oy+h, pw*2, ph - h*.55);
    }
    // paupières : faites avec la vraie fourrure sous l'œil
    const b = av.sleeping ? 1 : av.blink;
    if (b > .02){
      f.eyes.forEach((e, k) => {
        const lw = e.r*2.8, top = e.y - e.ry*1.35, lh = e.ry*2.5*b;
        const sx0 = k === 0 ? e.x - e.r*2.5 : e.x + e.r*1.3; // fourrure du côté extérieur de l'œil
        ctx.save(); ctx.beginPath(); ctx.ellipse(e.x, e.y+oy, e.r*1.32, e.ry*1.3, 0, 0, Math.PI*2); ctx.clip();
        src(sx0, e.y - e.ry*1.3, e.r*1.2, e.ry*1.4, e.x-lw/2, top, lw, lh);
        ctx.strokeStyle = "rgba(40,15,8,.75)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(e.x-e.r*1.2, top+lh-2); ctx.quadraticCurveTo(e.x, top+lh+4*b, e.x+e.r*1.2, top+lh-2); ctx.stroke();
        ctx.restore();
      });
    }
  }
  ctx.globalAlpha = 1;
}
const jaw = document.createElement("canvas"), jctx = jaw.getContext("2d");

function frame(t){
  // clignements
  if (!av.sleeping && t > av.nextBlink && av.blinkT < 0){ av.blinkT = t; }
  if (av.blinkT >= 0){ const p = (t - av.blinkT)/160; av.blink = p<1 ? Math.sin(p*Math.PI) : 0; if (p>=1){ av.blinkT = -1; av.nextBlink = t + 2200 + Math.random()*4000; if (Math.random()<.15) av.nextBlink = t+220; } }
  // regard par petits coups (saccades)
  if (t > av.nextGaze){ av.tgx = av.listening ? 0 : (Math.random()*2-1)*2.6; av.tgy = (Math.random()*2-1)*1.2; av.nextGaze = t + 900 + Math.random()*2600; }
  av.gx += (av.tgx-av.gx)*.35; av.gy += (av.tgy-av.gy)*.35;
  // truffe
  if (t > av.nextSniff){ av.sniffT = t; av.nextSniff = t + 5000 + Math.random()*9000; }
  if (av.sniffT){ const p = (t-av.sniffT)/700; av.sniff = p<1 ? Math.abs(Math.sin(p*Math.PI*3))*(1-p) : 0; if (p>=1) av.sniffT = 0; }
  // bouche (lissée)
  lipUpdate(t);
  av.open += (av.tOpen-av.open)*.4; av.wide += (av.tWide-av.wide)*.3;
  // tête
  const breath = Math.sin(t/1100*(av.sleeping?.6:1));
  av.tilt += ((av.listening ? .055 : av.sleeping ? -.04 : 0) - av.tilt)*.05;
  const sway = Math.sin(t/2300)*.012 + Math.sin(t/3700)*.008 + (av.speaking ? Math.sin(t/420)*.012 : 0);
  const nod = av.speaking ? av.open*5 : 0;
  av.fade = Math.min(1, av.fade + .07);

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,720,800);
  ctx.translate(360, 800); ctx.rotate(av.tilt + sway); ctx.scale(1+breath*.006, 1+breath*.01); ctx.translate(-360, -800 + nod);
  if (av.prev && av.fade < 1){ drawFace(av.prev, 1, t); drawFace(av.img, av.fade, t); }
  else drawFace(av.img, 1, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---- synchronisation labiale à partir du texte ---- */
const lip = {text:"", start:0, cps:12, off:0, active:false, vol:null};
function shapeOf(c){
  c = norm(c);
  if ("a".includes(c)) return [1, 1];
  if ("e".includes(c)) return [.6, 1.05];
  if ("iy".includes(c)) return [.38, 1.2];
  if ("o".includes(c)) return [.75, .8];
  if ("u".includes(c)) return [.42, .68];
  if ("mbp".includes(c)) return [0, 1];
  if (/[a-z]/.test(c)) return [.22, 1];
  return [0, 1];
}
function lipStart(text, rate){ lip.text = text; lip.start = performance.now(); lip.cps = 13.5*rate; lip.off = 0; lip.active = true; }
function lipBoundary(charIndex){ const exp = (performance.now()-lip.start)/1000*lip.cps; lip.off = charIndex - exp; }
function lipStop(){ lip.active = false; lip.vol = null; av.tOpen = 0; av.tWide = 1; }
function lipUpdate(t){
  if (!lip.active){ av.tOpen = 0; return; }
  const i = Math.floor((t - lip.start)/1000*lip.cps + lip.off);
  const s = lip.text.slice(i, i+2);
  let [o, w] = s.startsWith("ou") ? [.4, .62] : shapeOf(s[0]||" ");
  if (i >= lip.text.length) o = 0;
  if (lip.vol != null) o = Math.min(1, lip.vol*3.2) * (o>0 ? 1 : .4);
  av.tOpen = o * .9; av.tWide = w;
}
