// Tarifs du Manuel du joueur (chapitre IX, p. 179-195) : nom, prix en pièces de cuivre, disponibilité, poids, page.
// Disponibilité : C = courant, I = inhabituel, R = rare, "" = non précisé par le livre.
// Poids : t = minuscule, l = léger, n = normal, h = lourd, "" = aucun / non précisé.
// Monnaie (Manuel p. 37) : 10 pièces de cuivre = 1 pièce d'argent ; 10 pièces d'argent = 1 pièce d'or.
// « etab » : établissement du village qui le vend (réglage maison, voir REGLES).

const c = (n) => n, a = (n) => n * 10, o = (n) => n * 100;

export const CATEGORIES = [
  ["auberge", "Auberge et repas", "fa-solid fa-beer-mug-empty"],
  ["services", "Services", "fa-solid fa-hand-holding-heart"],
  ["marchandises", "Marchandises", "fa-solid fa-sack-xmark"],
  ["melee", "Armes de corps-à-corps", "fa-solid fa-khanda"],
  ["distance", "Armes à distance", "fa-solid fa-bow-arrow"],
  ["armures", "Armures et boucliers", "fa-solid fa-shield-halved"],
  ["vetements", "Vêtements", "fa-solid fa-shirt"],
  ["outils", "Outils", "fa-solid fa-hammer"],
  ["matieres", "Matières premières et vivres", "fa-solid fa-wheat-awn"],
  ["animaux", "Animaux", "fa-solid fa-horse"],
  ["transports", "Moyens de transport", "fa-solid fa-sailboat"],
  ["batiments", "Bâtiments (construction)", "fa-solid fa-house"]
];

// [nom, prix, dispo, poids, page, note?]
const RAW = {
  auberge: [
    ["Bain dans une auberge", c(3), "C", "", 180],
    ["Chambre d'auberge, dortoir", c(2), "C", "", 180, "Une nuit."],
    ["Chambre d'auberge individuelle", c(5), "C", "", 180, "Une nuit."],
    ["Résidence luxueuse", a(2), "I", "", 180, "Une nuit."],
    ["Bol de ragoût", c(3), "C", "", 180, "Couvre la NOURRITURE de la journée."],
    ["Repas copieux", a(1), "C", "", 180, "Couvre l'EAU et la NOURRITURE de la journée."],
    ["Festin", o(1), "I", "", 180, "Couvre l'EAU et la NOURRITURE de la journée."],
    ["Chope de bière", c(2), "C", "", 180, "Couvre l'EAU de la journée."],
    ["Coupe de vin", c(4), "I", "", 180, "Couvre l'EAU de la journée."]
  ],
  services: [
    ["Coupe de cheveux", c(5), "C", "", 180],
    ["Soins", a(5), "I", "", 180, "Un guérisseur de village a Empathie 4 et SOINS 2."],
    ["Garde du corps (par jour)", a(1), "I", "", 180],
    ["Lavage de vêtements", c(5), "C", "", 180],
    ["Courrier (par hexagone)", a(1), "C", "", 180],
    ["Droit de passage", c(2), "C", "", 180],
    ["Professeur (par jour, ou plus)", a(1), "I", "", 180, "Règles des professeurs : Manuel p. 40."]
  ],
  marchandises: [
    ["Flèches, pointes en métal", c(12), "C", "n", 182], ["Flèches, pointes en bois", c(6), "C", "n", 182],
    ["Carquois", c(8), "C", "", 182], ["Grappin", a(3), "I", "n", 182], ["Corde, 10 mètres", a(2), "C", "n", 182],
    ["Chandelle de suif", c(6), "C", "t", 182], ["Lampe à huile", c(5), "C", "l", 182], ["Lanterne", a(2), "C", "l", 182],
    ["Torches", c(5), "C", "n", 182], ["Sacoche", c(8), "C", "", 182], ["Sac à dos", a(4), "C", "", 182],
    ["Outre", a(3), "C", "", 182], ["Bandages", c(6), "C", "l", 182], ["Huile pour lampe", c(2), "C", "l", 182],
    ["Encre et plume", a(2), "I", "t", 182], ["Parchemin", c(6), "I", "t", 182], ["Couverture", c(7), "C", "l", 182],
    ["Couverture fourrée", a(3), "C", "n", 182],
    ["Briquet à silex", c(2), "C", "t", 184], ["Outils de crochetage", o(1), "I", "t", 184], ["Rations de voyage", a(1), "C", "n", 184],
    ["Cuisine de campagne", a(4), "I", "h", 184], ["Chaudron", c(18), "C", "n", 184], ["Coupe en métal", c(7), "I", "l", 184],
    ["Chope", c(2), "C", "l", 184], ["Assiette en métal", c(8), "I", "l", 184], ["Couteau de poche", c(6), "C", "t", 184],
    ["Cuillère", c(8), "I", "t", 184], ["Piège à ours", a(5), "C", "n", 184], ["Collet", a(1), "C", "l", 184],
    ["Tonneau", c(8), "C", "h", 184], ["Pichet en terre cuite", c(5), "C", "l", 184], ["Petite tente", a(2), "C", "n", 184],
    ["Grande tente", a(5), "I", "h", 184], ["Canne à pêche", c(4), "C", "l", 184], ["Filet de pêche", a(1), "C", "n", 184],
    ["Loupe", o(3), "R", "t", 184], ["Symbole sacré", a(1), "I", "t", 184],
    ["Craie", c(2), "C", "t", 186], ["Carte", a(4), "I", "t", 186], ["Longue-vue", o(3), "R", "n", 186],
    ["Boule de cristal", a(6), "I", "l", 186], ["Sablier", a(12), "R", "l", 186], ["Balance", a(3), "I", "n", 186],
    ["Flûte", c(15), "C", "l", 186], ["Corne", a(3), "C", "n", 186], ["Lyre", a(5), "I", "n", 186], ["Harpe", a(8), "R", "h", 186],
    ["Tambour", c(18), "C", "n", 186],
    ["Poison mortel", a(5), "R", "t", 186, "Toxicité 3 ; chaque cran de Toxicité en plus double le prix."],
    ["Poison paralysant", a(4), "R", "t", 186, "Toxicité 3 ; chaque cran de Toxicité en plus double le prix."],
    ["Poison narcotique", a(3), "R", "t", 186, "Toxicité 3 ; chaque cran de Toxicité en plus double le prix."],
    ["Poison hallucinogène", a(4), "R", "t", 186, "Toxicité 3 ; chaque cran de Toxicité en plus double le prix."]
  ],
  melee: [
    ["Couteau", a(1), "C", "l", 186], ["Dague", a(2), "C", "l", 186], ["Fauchon", a(4), "C", "n", 186], ["Épée courte", a(6), "C", "n", 186],
    ["Épée large", a(10), "C", "n", 188], ["Épée bâtarde", a(18), "I", "h", 188], ["Épée à deux mains", o(4), "R", "h", 188],
    ["Cimeterre", a(8), "I", "n", 188], ["Hachette", a(2), "C", "n", 188], ["Hache de guerre", a(6), "I", "h", 188],
    ["Hache à deux mains", a(24), "I", "h", 188], ["Masse d'armes", a(4), "C", "n", 188], ["Morgenstern", a(8), "I", "n", 188],
    ["Marteau de guerre", a(12), "I", "n", 188], ["Fléau d'armes", a(16), "I", "n", 188], ["Gourdin", a(1), "C", "n", 188],
    ["Massue", a(2), "C", "h", 188], ["Grand marteau de guerre", a(22), "I", "h", 188], ["Bâton", a(1), "C", "n", 188],
    ["Lance courte", a(2), "C", "n", 188], ["Lance longue", a(4), "C", "n", 188], ["Pique", a(12), "I", "h", 188],
    ["Hallebarde", o(3), "R", "h", 188], ["Trident", a(6), "R", "n", 188]
  ],
  distance: [
    ["Couteau de lancer", a(1), "C", "l", 188], ["Francisque", a(2), "C", "n", 188], ["Javelot", a(2), "C", "n", 188],
    ["Fronde", a(1), "C", "l", 188], ["Arc court", a(6), "C", "l", 188], ["Arc long", a(12), "I", "n", 188],
    ["Arbalète légère", a(24), "I", "n", 188], ["Arbalète lourde", o(4), "R", "h", 188]
  ],
  armures: [
    ["Petit bouclier", a(6), "C", "l", 190], ["Grand bouclier", a(15), "I", "n", 190], ["Armure en cuir", a(4), "C", "l", 190],
    ["Armure en cuir clouté", a(6), "I", "n", 190], ["Cotte de mailles", a(24), "I", "h", 190], ["Armure de plate", o(8), "R", "h", 190],
    ["Casque en cuir clouté", a(3), "I", "l", 190], ["Cervelière", a(8), "I", "l", 190], ["Spangenhelm", a(18), "I", "n", 190],
    ["Grand heaume", o(3), "R", "n", 190]
  ],
  vetements: [
    ["Haillons", c(5), "C", "", 190], ["Tenue simple", c(15), "C", "", 190], ["Tenue luxueuse", o(4), "R", "", 190],
    ["Fourrure", a(3), "I", "", 190], ["Tunique", a(1), "C", "", 190], ["Cape", a(2), "I", "", 190],
    ["Paire de bottes", a(3), "I", "", 190], ["Boucle en argent", a(8), "I", "", 190]
  ],
  transports: [
    ["Charrette", a(15), "C", "", 190, "Tirée par un animal : deux personnes et 50 objets."],
    ["Chariot", o(3), "C", "", 190, "Tiré par deux animaux : quatre personnes et 200 objets."],
    ["Canoë", a(6), "C", "", 190, "Deux personnes et 10 objets."],
    ["Barque", a(15), "C", "", 190, "Quatre personnes et 50 objets."],
    ["Bateau à voile", o(4), "I", "", 190, "Six personnes et 200 objets."]
  ],
  outils: [
    ["Scie", a(5), "I", "n", 192], ["Marteau", a(1), "C", "n", 192], ["Masse", a(2), "C", "h", 192], ["Pioche", c(15), "C", "n", 192],
    ["Pelle", a(2), "C", "n", 192], ["Cognée", a(2), "C", "n", 192], ["Pinces", a(2), "I", "l", 192], ["Fil et aiguille", c(3), "C", "t", 192]
  ],
  matieres: [
    ["Minerai de fer", c(4), "", "", 192], ["Fer", a(1), "", "", 192], ["Argent (métal)", o(1), "", "", 192], ["Or (métal)", o(10), "", "", 192],
    ["Pierre", c(2), "", "", 192], ["Verre", a(8), "", "", 192], ["Bois", c(3), "", "", 192], ["Cuir", c(12), "", "", 192],
    ["Tissu, laine", c(8), "", "", 192], ["Tissu, soie", o(1), "", "", 192, "Ne se trouve pas dans les Contrées Interdites."],
    ["Laine", c(4), "", "", 192, "Se garde un mois."], ["Céréales", c(3), "", "", 192, "Se gardent un mois."],
    ["Viande", c(6), "", "", 192, "Se garde un jour."], ["Peau", c(8), "", "", 192, "Se garde une semaine."],
    ["Farine", c(6), "", "", 194, "Se garde un mois."], ["Légumes", c(4), "", "", 194, "Se gardent un jour."],
    ["Poisson", c(5), "", "", 194, "Se garde un jour."], ["Pain", a(1), "", "", 194, "Se garde une semaine."],
    ["Suif", c(6), "", "", 194], ["Herbes", a(2), "", "", 194, "Se gardent une semaine."]
  ],
  animaux: [
    ["Cheval de selle", o(2), "I", "", 195, "Caractéristiques : Guide du MJ p. 126."],
    ["Destrier", o(8), "R", "", 195, "Caractéristiques : Guide du MJ p. 126."],
    ["Âne", a(6), "C", "", 195, "Caractéristiques : Guide du MJ p. 127."],
    ["Chien de garde", a(4), "C", "", 195, "Caractéristiques : Guide du MJ p. 126."],
    ["Cochon", a(2), "C", "", 195, "Donne 6 lots de VIANDE abattu."],
    ["Mouton", a(3), "C", "", 195, "2 unités de LAINE tondu, 5 de VIANDE abattu."],
    ["Vache", o(1), "I", "", 195, "1 lot de NOURRITURE (lait) par traite, 6 unités de VIANDE abattue."],
    ["Poulet", c(4), "C", "", 195, "1 lot de VIANDE abattu."],
    ["Pigeon domestique en cage", a(2), "I", "", 195, "Revient au pigeonnier quand on le relâche."]
  ],
  batiments: [
    ["Cottage", o(10), "", "", 194, "200 bois, une semaine."], ["Tour", o(20), "", "", 194, "400 pierre ou 200 bois, deux semaines."],
    ["Maison en pierre", o(30), "", "", 194, "600 pierre, un mois."], ["Ferme", o(50), "", "", 194, "400 bois, un mois."],
    ["Fortin", o(250), "", "", 194, "1 000 bois et 200 pierre, deux mois."], ["Forteresse", o(1000), "", "", 194, "1 000 bois et 5 000 pierre, un an."],
    ["Château", o(3000), "", "", 194, "1 000 bois et 20 000 pierre, cinq ans."], ["Palais", o(10000), "", "", 194, "2 000 bois et 50 000 pierre, dix ans."]
  ]
};

/** Établissements des villages (Guide du MJ p. 170) + « marché » pour le commerce courant. */
export const ETABS = [
  ["marche", "Marché ou comptoir", "Marchandises, vêtements, vivres, animaux de ferme, services courants"],
  ["auberge", "Auberge", "Chambres, bain, repas, boissons"],
  ["taverne", "Taverne", "Repas et boissons (pas de chambre)"],
  ["forgeron", "Forgeron", "Armes, armures, outils de métal, métaux"],
  ["ecurie", "Écurie", "Chevaux et destriers"],
  ["moulin", "Moulin", "Farine"],
  ["scierie", "Scierie", "Bois"],
  ["temple", "Temple", "Soins, symbole sacré"],
  ["milice", "Milice", "Garde du corps"],
  ["port", "Port ou embarcadère", "Barques, canoës, bateaux"]
];

const ETAB_PAR_CAT = { melee: ["forgeron"], armures: ["forgeron"], distance: ["forgeron", "marche"], transports: ["marche"], batiments: [] };
const ETAB_PAR_NOM = {
  "Bain dans une auberge": ["auberge"], "Chambre d'auberge, dortoir": ["auberge"], "Chambre d'auberge individuelle": ["auberge"], "Résidence luxueuse": ["auberge"],
  "Bol de ragoût": ["auberge", "taverne"], "Repas copieux": ["auberge", "taverne"], "Festin": ["auberge", "taverne"],
  "Chope de bière": ["auberge", "taverne"], "Coupe de vin": ["auberge", "taverne"],
  "Soins": ["temple", "marche"], "Garde du corps (par jour)": ["milice", "marche"], "Symbole sacré": ["temple", "marche"],
  "Scie": ["forgeron"], "Marteau": ["forgeron"], "Masse": ["forgeron"], "Pioche": ["forgeron"], "Pelle": ["forgeron"], "Cognée": ["forgeron"], "Pinces": ["forgeron"],
  "Minerai de fer": ["forgeron"], "Fer": ["forgeron"], "Farine": ["moulin", "marche"], "Bois": ["scierie", "marche"],
  "Cheval de selle": ["ecurie"], "Destrier": ["ecurie"],
  "Canoë": ["port"], "Barque": ["port"], "Bateau à voile": ["port"],
  "Grappin": ["forgeron", "marche"], "Lanterne": ["forgeron", "marche"], "Outils de crochetage": ["forgeron", "marche"], "Piège à ours": ["forgeron", "marche"]
};

const ITEM_TYPE = { melee: "weapon", distance: "weapon", armures: "armor", matieres: "rawMaterial" };
const SYS_WEIGHT = { t: "tiny", l: "light", n: "regular", h: "heavy", "": "none" };

export const TARIFS = Object.entries(RAW).flatMap(([cat, rows]) => rows.map(([nom, prix, dispo, poids, page, note]) => ({
  id: `${cat}:${nom}`, cat, nom, prix, dispo, poids, page, note: note ?? "",
  etabs: ETAB_PAR_NOM[nom] ?? ETAB_PAR_CAT[cat] ?? ["marche"],
  objet: !["auberge", "services", "batiments"].includes(cat), // devient un objet sur la fiche
  itemType: ITEM_TYPE[cat] ?? "gear", weight: SYS_WEIGHT[poids] ?? "regular",
  enBoutique: cat !== "batiments"
})));

export const DISPO = { C: "Courant", I: "Inhabituel", R: "Rare", "": "Non précisé" };

/** Raisons de variation des prix d'un lieu : réglages maison (le livre dit seulement que les prix varient beaucoup). */
export const FACTEURS = [
  ["isole", "Isolé, loin des routes", 25],
  ["penurie", "Pénurie (guerre, siège, mauvaise récolte)", 50],
  ["abondance", "Abondance, grand marché", -20],
  ["etrangers", "Les étrangers y sont mal vus", 25],
  ["hospitalite", "Réputé pour son hospitalité", -10],
  ["specialite", "Spécialité locale (une catégorie moins chère)", -20],
  ["perso", "Autre raison", 10]
];
