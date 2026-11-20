"use strict";

/* ================= IMAGES ================= */
const IMG_SRC = {
  neutre:"img/neutre.webp",
  tendre:"img/tendre.webp",
  joie:"img/joie.webp",
  gourmand:"img/gourmand.webp",
  accueil:"img/accueil.webp",
  pensive:"img/pensive.webp",
  bravo:"img/bravo.webp",
  inquiete:"img/inquiete.webp",
  rire:"img/rire.webp"
};
// Repères du visage (pixels, images de 720 px de large). Seules les images bouche fermée parlent.
const FACE = {
  neutre:  {mouth:{x:362,y:416,w:63}, eyes:[{x:286,y:297,r:23,ry:22},{x:439,y:296,r:23,ry:22}], nose:{x:362,y:365,r:37}},
  tendre:  {mouth:{x:370,y:437,w:53}, eyes:[{x:289,y:306,r:22,ry:15},{x:441,y:299,r:21,ry:14}], nose:{x:367,y:391,r:35}},
  inquiete:{mouth:{x:360,y:413,w:57}, eyes:[{x:287,y:304,r:22,ry:21},{x:424,y:302,r:21,ry:20}], nose:{x:352,y:370,r:35}},
  pensive: {mouth:{x:360,y:417,w:57}, eyes:[{x:291,y:319,r:20,ry:12},{x:431,y:309,r:20,ry:12}], nose:{x:355,y:370,r:35}}
};
// Les 8 émotions d'OKA (planche Diwaging) + neutre, écoute et sommeil.
// idle = pose affichée ; talk = image bouche fermée utilisée pendant la parole (synchronisation labiale).
const EXPR = {
  neutre:     {idle:"neutre",   talk:"neutre",   label:"Neutre"},
  heureux:    {idle:"rire",     talk:"neutre",   label:"Heureux"},
  compassion: {idle:"tendre",   talk:"tendre",   label:"Compassion"},
  sociable:   {idle:"joie",     talk:"neutre",   label:"Sociable"},
  affame:     {idle:"gourmand", talk:"neutre",   label:"Affamé"},
  rappel:     {idle:"accueil",  talk:"neutre",   label:"Rappel"},
  oublie:     {idle:"pensive",  talk:"pensive",  label:"Oublie"},
  bonne:      {idle:"bravo",    talk:"neutre",   label:"Bonne réponse"},
  mauvaise:   {idle:"inquiete", talk:"inquiete", label:"Mauvaise réponse"},
  ecoute:     {idle:"tendre",   talk:"tendre",   label:"À l'écoute"},
  endormie:   {idle:"neutre",   talk:"neutre",   label:"Endormie", sleep:true}
};
const EXPR_ALIAS = {joyeuse:"heureux", rire:"heureux", curieuse:"sociable", pensive:"oublie", inquiete:"compassion", bravo:"bonne", gourmand:"affame", happy:"heureux"};
