// Filtres de sécurité appliqués AVANT tout appel à un modèle d'IA (deuxième barrière : la tablette filtre déjà).
// Ordre : urgence, santé, hors périmètre. Réponses courtes, au vouvoiement, avec une balise d'émotion.

// même normalisation que la tablette (app/js/03-donnees.js)
export const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

// même liste que DANGER dans app/js/06-cerveau.js
const DANGER = /(je suis tomb|je me suis tomb|chute|je ne peux (plus )?(me )?(relever|lever|bouger)|au secours|a l aide|aidez[- ]moi|j ai (tres )?mal (a la poitrine|au coeur)|douleur (a la )?poitrine|je fais un malaise|malaise|je n arrive (plus|pas) a respirer|je saigne)/;

const SANTE = /\b(medicaments?|doliprane|paracetamol|ibuprofene|aspirine|kardegic|antibiotiques?|somniferes?|anxiolytiques?|cachets?|comprimes?|pilules?|gelules?|sirop|posologie|doses?|ordonnance|traitements?|diagnostic|symptomes?|maladie|est-ce grave|fievre|vertiges?|tension|j ai mal|mal (a la|au|aux) |maigrir|perdre du poids|regime)\b/;

const HORS_SUJET: { re: RegExp; texte: string }[] = [
  {
    re: /\b(banque|bancaire|carte bleue|carte bancaire|code (de la |de ma |de |secret)|code confidentiel|virement|rib|iban|mot de passe|placement|bourse|impots?|credit|emprunt|assurance vie|argent)\b/,
    texte: "Je ne peux pas vous aider pour l'argent ou la banque. Ne donnez jamais vos codes ni votre carte, même au téléphone : cela peut être une arnaque. Parlez-en à un proche ou appelez votre banque. [[EXPR:compassion]]",
  },
  {
    re: /\b(voter|vote|elections?|politique|president de la republique|gouvernement|deputes?|partis? politiques?)\b/,
    texte: "Je ne donne pas d'avis sur la politique : c'est à vous de choisir. Si vous voulez en parler, vos proches ou votre entourage seront de bon conseil. [[EXPR:neutre]]",
  },
  {
    re: /\b(testament|heritage|succession|proces|avocat)\b/,
    texte: "Je ne peux pas vous conseiller sur les questions de droit. Un notaire, un avocat ou le CCAS pourra vous aider. Voulez-vous en parler à un proche ? [[EXPR:neutre]]",
  },
  {
    re: /\b(religion|dieu existe|quel dieu)\b/,
    texte: "Je préfère ne pas donner d'avis sur la religion. C'est un sujet très personnel, à partager avec les personnes de votre choix. [[EXPR:neutre]]",
  },
  {
    re: /\b(parier|paris sportifs|loto|casino|tierce|jeux d argent|machine a sous)\b/,
    texte: "Je ne parle pas des jeux d'argent. Si vous voulez jouer, je vous propose un jeu ici, sans argent : morpion, mémo ou un petit quiz ? [[EXPR:sociable]]",
  },
  {
    re: /\b(armes?|fusils?|pistolets?|sexe|sexuel(le)?s?|drogues?|cannabis|cocaine)\b/,
    texte: "Je ne peux pas parler de ce sujet. Parlons d'autre chose : voulez-vous une idée de sortie ou un petit jeu ? [[EXPR:neutre]]",
  },
  {
    re: /^(?=.*\b(repar\w*|depann\w*|virus|ne marche (plus|pas)|en panne)\b)(?=.*\b(ordinateur|telephone|tablette|internet|wifi|box|imprimante)\b)/,
    texte: "Je ne sais pas réparer les appareils. Un proche ou un conseiller numérique de la mairie pourra vous aider. Voulez-vous que j'appelle quelqu'un ? [[EXPR:oublie]]",
  },
];

export type Filtre = { categorie: "urgence" | "sante" | "hors_sujet"; texte: string };

export function filtrer(message: string): Filtre | null {
  const n = norm(message);
  if (DANGER.test(n)) {
    return { categorie: "urgence", texte: "Je préviens vos proches tout de suite. Restez calme, je suis là. [[ALERTE]] [[EXPR:compassion]]" };
  }
  if (SANTE.test(n)) {
    return {
      categorie: "sante",
      texte: "Je ne peux pas donner d'avis médical, ni sur un traitement. Le mieux est d'en parler à votre médecin. Si ça ne va pas du tout, dites « aidez-moi » et je préviens vos proches. [[EXPR:compassion]]",
    };
  }
  for (const h of HORS_SUJET) if (h.re.test(n)) return { categorie: "hors_sujet", texte: h.texte };
  return null;
}
