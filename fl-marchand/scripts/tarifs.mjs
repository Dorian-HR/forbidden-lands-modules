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

/* ------------------------------------------------------------------ fabrication (Manuel p. 182-193)
   nom : [matières premières, temps, talents, outils]. Le temps suppose deux Quarts de travail par jour (p. 179). */
export const FAB = {
  "Flèches, pointes en métal": ["1/2 fer, 1 bois", "Quart de jour", "Facteur d'arc, Forgeron", "Forge"],
  "Flèches, pointes en bois": ["1 bois", "Quart de jour", "Facteur d'arc", "Couteau"],
  "Carquois": ["1/2 cuir", "Quart de jour", "Tanneur", "Couteau"],
  "Grappin": ["1 fer", "Quart de jour", "Forgeron", "Forge"],
  "Corde, 10 mètres": ["1 tissu", "Quart de jour", "Tailleur", "Couteau"],
  "Chandelle de suif": ["1/10 tissu, 1/4 suif", "Quart de jour", "", "Feu"],
  "Lampe à huile": ["1 pierre", "Un jour", "", "Feu"],
  "Lanterne": ["1 fer", "Un jour", "Forgeron", "Forge"],
  "Torches": ["1 bois", "Quart de jour", "", "Couteau ou hache"],
  "Sacoche": ["1 tissu", "Quart de jour", "Tailleur", "Couteau"],
  "Sac à dos": ["2 tissus", "Quart de jour", "Tailleur", "Couteau, fil et aiguille"],
  "Outre": ["1 cuir", "Quart de jour", "Tanneur", "Fil et aiguille"],
  "Bandages": ["1/2 tissu", "Quart de jour", "Tailleur", "Couteau"],
  "Huile pour lampe": ["1/4 suif", "Quart de jour", "Tanneur", "Feu"],
  "Encre et plume": ["Plume, 1/10 fer", "Quart de jour", "Tanneur", "Couteau, feu"],
  "Parchemin": ["1/4 cuir", "Quart de jour", "Tanneur", "Couteau"],
  "Couverture": ["1/2 tissu", "Quart de jour", "Tailleur", "Couteau"],
  "Couverture fourrée": ["2 peaux", "Quart de jour", "Tanneur", "Couteau"],
  "Briquet à silex": ["1/10 fer, 1/4 pierre", "Quart de jour", "", ""],
  "Outils de crochetage": ["1/4 fer", "Un jour", "Forgeron, Crochetage", "Forge"],
  "Rations de voyage": ["1 viande, poisson ou légumes", "Quart de jour", "Cuisinier", "Feu"],
  "Cuisine de campagne": ["2 fer", "Un jour", "Cuisinier, Forgeron", "Forge"],
  "Chaudron": ["1 fer", "Un jour", "Cuisinier, Forgeron", "Forge"],
  "Coupe en métal": ["1/2 fer", "Un jour", "Forgeron", "Forge"],
  "Chope": ["1/2 bois", "Quart de jour", "", ""],
  "Assiette en métal": ["1/2 fer", "Un jour", "Forgeron", "Forge"],
  "Couteau de poche": ["1/4 fer", "Quart de jour", "Forgeron", "Forge"],
  "Cuillère": ["1/4 fer", "Un jour", "Forgeron", "Forge"],
  "Piège à ours": ["1 fer", "Un jour", "Forgeron", "Forge"],
  "Collet": ["1/2 tissu ou cuir", "Quart de jour", "Chasseur", "Couteau"],
  "Tonneau": ["2 bois", "Un jour", "", "Scie, marteau"],
  "Pichet en terre cuite": ["1 pierre", "Un jour", "", "Feu"],
  "Petite tente": ["1 tissu ou cuir", "Quart de jour", "Tailleur ou Tanneur", "Couteau, fil et aiguille"],
  "Grande tente": ["2 tissu ou cuir", "Un jour", "Tailleur ou Tanneur", "Couteau, fil et aiguille"],
  "Canne à pêche": ["1/10 fer, 1/10 tissu", "Quart de jour", "Forgeron, Tailleur", "Marteau, forge"],
  "Filet de pêche": ["1 tissu", "Un jour", "Tailleur", "Couteau"],
  "Loupe": ["1/4 fer, 1/2 verre", "Une semaine", "Bâtisseur, Forgeron", ""],
  "Symbole sacré": ["1/2 fer", "Un jour", "Forgeron", "Forge"],
  "Craie": ["1/4 pierre", "Quart de jour", "", ""],
  "Carte": ["Parchemin", "Un jour", "Pisteur", "Encre et plume"],
  "Longue-vue": ["1 fer, 1 verre", "Deux semaines", "Bâtisseur, Forgeron", "Forge"],
  "Boule de cristal": ["1 verre", "Un jour", "Forgeron", "Forge"],
  "Sablier": ["1 pierre", "Une semaine", "Bâtisseur", "Forge"],
  "Balance": ["1/2 fer", "Un jour", "Forgeron", "Forge"],
  "Flûte": ["1/2 bois", "Un jour", "Voie du Chant", "Couteau"],
  "Corne": ["1 bois ou corne d'animal", "Un jour", "Voie du Chant", "Couteau"],
  "Lyre": ["1 bois, 1/4 tissu", "Une semaine", "Voie du Chant", "Couteau"],
  "Harpe": ["2 bois, 1/2 tissu", "Deux semaines", "Voie du Chant", "Couteau"],
  "Tambour": ["1 bois, 1/2 cuir", "Un jour", "Voie du Chant", "Couteau"],
  "Poison mortel": ["1 herbe", "Quart de jour", "Empoisonneur", "Chaudron, feu"],
  "Poison paralysant": ["1 herbe", "Quart de jour", "Empoisonneur", "Chaudron, feu"],
  "Poison narcotique": ["1 herbe", "Quart de jour", "Empoisonneur", "Chaudron, feu"],
  "Poison hallucinogène": ["1 herbe", "Quart de jour", "Empoisonneur", "Chaudron, feu"],
  "Couteau": ["1/2 fer, 1/2 bois", "Quart de jour", "Forgeron", "Forge"],
  "Dague": ["1/2 fer, 1/2 cuir", "Un jour", "Forgeron", "Forge"],
  "Fauchon": ["1 fer, 1/2 cuir", "Un jour", "Forgeron", "Forge"],
  "Épée courte": ["1 fer, 1/2 cuir", "Deux jours", "Forgeron", "Forge"],
  "Épée large": ["2 fer, 1/2 cuir", "Une semaine", "Forgeron", "Forge"],
  "Épée bâtarde": ["3 fer, 1/2 cuir", "Une semaine", "Forgeron", "Forge"],
  "Épée à deux mains": ["4 fer, 1 cuir", "Deux semaines", "Forgeron", "Forge"],
  "Cimeterre": ["1 fer, 1/2 cuir", "Une semaine", "Forgeron", "Forge"],
  "Hachette": ["1/2 fer, 1 bois", "Quart de jour", "Forgeron", "Forge"],
  "Hache de guerre": ["1 fer, 1 bois", "Un jour", "Forgeron", "Forge"],
  "Hache à deux mains": ["2 fer, 2 bois", "Une semaine", "Forgeron", "Forge"],
  "Masse d'armes": ["1 fer, 1 bois", "Un jour", "Forgeron", "Forge"],
  "Morgenstern": ["1 fer, 1 bois", "Deux jours", "Forgeron", "Forge"],
  "Marteau de guerre": ["1 fer, 1 bois", "Deux jours", "Forgeron", "Forge"],
  "Fléau d'armes": ["2 fer, 1 bois", "Une semaine", "Forgeron", "Forge"],
  "Gourdin": ["1 bois", "Quart de jour", "", ""],
  "Massue": ["2 bois", "Quart de jour", "", ""],
  "Grand marteau de guerre": ["3 fer, 2 bois", "Une semaine", "Forgeron", "Forge"],
  "Bâton": ["2 bois", "Quart de jour", "", ""],
  "Lance courte": ["1/2 fer, 1 bois", "Quart de jour", "Forgeron", "Forge"],
  "Lance longue": ["1/2 fer, 2 bois", "Un jour", "Forgeron", "Forge"],
  "Pique": ["1/2 fer, 2 bois", "Deux jours", "Forgeron", "Forge"],
  "Hallebarde": ["1 fer, 2 bois", "Une semaine", "Forgeron", "Forge"],
  "Trident": ["1 fer, 1 bois", "Deux jours", "Forgeron", "Forge"],
  "Couteau de lancer": ["1/2 fer, 1/2 bois", "Quart de jour", "Forgeron", "Forge"],
  "Francisque": ["1/2 fer, 1 bois", "Quart de jour", "Forgeron", "Forge"],
  "Javelot": ["1/2 fer, 1 bois", "Quart de jour", "Forgeron", "Forge"],
  "Fronde": ["1/2 cuir", "Quart de jour", "Facteur d'arc", "Couteau"],
  "Arc court": ["1 bois, 1/4 cuir", "Un jour", "Facteur d'arc", "Couteau"],
  "Arc long": ["2 bois, 1/4 cuir", "Deux jours", "Facteur d'arc", "Couteau"],
  "Arbalète légère": ["1/2 fer, 1 bois, 1 cuir", "Une semaine", "Facteur d'arc, Forgeron", "Forge"],
  "Arbalète lourde": ["1 fer, 2 bois, 1 cuir", "Deux semaines", "Facteur d'arc, Forgeron", "Forge"],
  "Petit bouclier": ["1/2 fer, 1/2 bois, 1 cuir", "Quart de jour", "Forgeron, Tanneur", "Forge"],
  "Grand bouclier": ["1 fer, 1 bois, 2 cuir", "Un jour", "Forgeron, Tanneur", "Forge"],
  "Armure en cuir": ["2 cuir", "Un jour", "Tanneur", "Couteau, fil et aiguille"],
  "Armure en cuir clouté": ["1/2 fer, 2 cuir", "Deux jours", "Forgeron, Tanneur", "Forge, couteau, fil et aiguille"],
  "Cotte de mailles": ["3 fer", "Une semaine", "Forgeron", "Forge"],
  "Armure de plate": ["6 fer", "Deux semaines", "Forgeron", "Forge"],
  "Casque en cuir clouté": ["1/2 fer, 1 cuir", "Un jour", "Forgeron, Tanneur", "Forge, couteau, fil et aiguille"],
  "Cervelière": ["1 fer, 1 cuir", "Deux jours", "Forgeron, Tanneur", "Forge, couteau, fil et aiguille"],
  "Spangenhelm": ["2 fer", "Deux jours", "Forgeron", "Forge"],
  "Grand heaume": ["3 fer", "Une semaine", "Forgeron", "Forge"],
  "Haillons": ["1/2 tissu (laine)", "Quart de jour", "", ""],
  "Tenue simple": ["1 tissu (laine)", "Un jour", "Tailleur", "Fil et aiguille"],
  "Tenue luxueuse": ["2 tissu (soie)", "Une semaine", "Tailleur", "Fil et aiguille"],
  "Fourrure": ["2 peaux", "Quart de jour", "Tailleur", "Fil et aiguille"],
  "Tunique": ["1 tissu (laine)", "Quart de jour", "Tailleur", "Fil et aiguille"],
  "Cape": ["2 tissu (laine)", "Quart de jour", "Tailleur", "Fil et aiguille"],
  "Paire de bottes": ["2 cuir", "Un jour", "Tanneur", "Fil et aiguille"],
  "Boucle en argent": ["1/2 argent", "Un jour", "Forgeron", "Forge"],
  "Charrette": ["30 bois", "Deux jours", "Bâtisseur", "Scie et marteau"],
  "Chariot": ["90 bois", "Une semaine", "Bâtisseur", "Scie et marteau"],
  "Canoë": ["10 bois", "Un jour", "", "Scie et marteau"],
  "Barque": ["20 bois", "Deux jours", "Bâtisseur, Marin", "Scie et marteau"],
  "Bateau à voile": ["60 bois, 10 tissu", "Une semaine", "Bâtisseur, Marin", "Scie et marteau"],
  "Scie": ["1 fer, 1 bois", "Un jour", "Forgeron", "Forge"],
  "Marteau": ["1/2 fer, 1 bois", "Quart de jour", "Forgeron", "Feu, 1 pierre"],
  "Masse": ["1 fer, 2 bois", "Quart de jour", "Forgeron", "Feu, marteau"],
  "Pioche": ["1 fer, 1 bois", "Quart de jour", "Forgeron", "Forge"],
  "Pelle": ["1 fer, 1 bois", "Un jour", "Forgeron", "Forge"],
  "Cognée": ["1/2 fer, 1 bois", "Un jour", "Forgeron", "Forge"],
  "Pinces": ["1 fer", "Un jour", "Forgeron", "Forge"],
  "Fil et aiguille": ["1/10 fer, 1/10 tissu", "Quart de jour", "Forgeron, Tailleur", "Forge"]
};

/* ------------------------------------------------------------------ trouvailles (Guide du MJ p. 187-192)
   [nom, dés, unité (c/a/o), poids, table, page]. La valeur se lance quand on trouve l'objet. */
const TR = (table, page, rows) => rows.map(([nom, d, u, poids]) => ({ nom, d, u, poids, table, page }));
export const TRESORS = [
  ...TR("Transportables simples", 187, [["Statuette en os", 2, "c", "Léger"], ["Fragment d'ambre", 2, "c", "Minuscule"], ["Boucle de ceinture en bronze", 2, "c", "Léger"], ["Dés en os", 2, "c", "Minuscule"], ["Flûte en os", 2, "c", "Léger"],
    ["Bracelet en bronze", 3, "c", "Léger"], ["Anneau en cuivre", 3, "c", "Minuscule"], ["Collier en bronze", 3, "c", "Minuscule"], ["Médaillon en bronze", 3, "c", "Minuscule"], ["Paire de bottes de qualité", 3, "c", "Normal"], ["Paire de gants de qualité", 3, "c", "Léger"],
    ["Corne à boire cerclée de bronze", 4, "c", "Normal"], ["Lanterne", 4, "c", "Léger"], ["Dague en bronze", 4, "c", "Léger"], ["Bouclier en bronze", 4, "c", "Normal"], ["Boucles d'oreilles en bronze", 4, "c", "Minuscule"], ["Arme à une main en bronze", 1, "a", "Normal"],
    ["Livre", 6, "c", "Normal"], ["Gemme simple", 6, "c", "Minuscule"], ["Statuette en bronze", 6, "c", "Léger"], ["Casque en bronze", 1, "a", "Normal"], ["Bandeau en cuivre", 1, "a", "Normal"], ["Couronne en cuivre", 2, "a", "Normal"]]),
  ...TR("Entreposées simples", 188, [["Bol en cuivre", 3, "c", "Léger"], ["Assiette en cuivre", 3, "c", "Normal"], ["Coupe en cuivre", 3, "c", "Léger"], ["Besace", 3, "c", "Léger"], ["Outre", 3, "c", "Léger"],
    ["Boucle de ceinture", 4, "c", "Léger"], ["Marteau", 4, "c", "Normal"], ["Scie", 4, "c", "Normal"], ["Épée courte", 1, "a", "Normal"], ["Petit bouclier", 4, "c", "Léger"], ["Hache", 4, "c", "Normal"],
    ["Lance courte", 5, "c", "Normal"], ["Pot en bronze", 5, "c", "Lourd"], ["Lanterne en bronze", 5, "c", "Léger"], ["Plateau de jeu", 5, "c", "Normal"], ["Coffre", 5, "c", "Lourd"], ["Luth", 5, "c", "Normal"],
    ["Armure en bronze", 1, "o", "Lourd"], ["Miroir en bronze", 2, "a", "3"], ["Palanquin orné de plaques en cuivre", 3, "a", "4"], ["Sarcophage en bronze", 4, "a", "4"], ["Autel en bronze", 5, "a", "5"], ["Statue en bronze", 6, "a", "6"]]),
  ...TR("Transportables spéciales", 188, [["Boîte en argent", 2, "a", "Léger"], ["Perle", 2, "a", "Minuscule"], ["Bol en argent", 2, "a", "Léger"], ["Tableau", 2, "a", "Léger"], ["Coupe en argent", 2, "a", "Léger"],
    ["Bracelet en argent", 3, "a", "Léger"], ["Anneau en argent", 3, "a", "Minuscule"], ["Collier en argent", 3, "a", "Minuscule"], ["Cape élégante avec un fermoir en argent", 3, "a", "Normal"], ["Bottes élégantes", 3, "a", "Normal"], ["Gants en peau de vachette", 3, "a", "Léger"],
    ["Corne à boire cerclée d'argent", 4, "a", "Normal"], ["Broderie", 4, "a", "Normal"], ["Casque finement ciselé", 4, "a", "Léger"], ["Grand bouclier finement décoré", 4, "a", "Normal"], ["Boucles d'oreilles en argent", 4, "a", "Minuscule"], ["Arme à une main exquise", 4, "a", "Normal"],
    ["Livre rare", 5, "a", "Normal"], ["Joyau", 6, "a", "Minuscule"], ["Statuette en argent", 7, "a", "Normal"], ["Casque incrusté d'argent", 8, "a", "Normal"], ["Bandeau en argent", 9, "a", "Léger"], ["Couronne en argent", 1, "o", "Normal"]]),
  ...TR("Entreposées spéciales", 189, [["Médaillon en argent", 3, "a", "Léger"], ["Coffret en argent", 3, "a", "Léger"], ["Tableau (entreposé)", 3, "a", "Lourd"], ["Bol en verre", 3, "a", "Léger"], ["Vase ornementé", 3, "a", "Léger"],
    ["Broche en argent", 4, "a", "Minuscule"], ["Peigne en argent", 4, "a", "Léger"], ["Boîte en argent (entreposée)", 4, "a", "Léger"], ["Amulette en argent", 4, "a", "Léger"], ["Coupe en argent (entreposée)", 4, "a", "Léger"], ["Masque", 4, "a", "Léger"],
    ["Bouteille de vin hors de prix", 5, "a", "Normal"], ["Chapeau élégant", 5, "a", "Léger"], ["Tapisserie", 5, "a", "Lourd"], ["Vitrine", 5, "a", "4"], ["Tapis", 5, "a", "Lourd"], ["Fauteuil", 5, "a", "3"],
    ["Candélabre", 6, "a", "Lourd"], ["Miroir en argent", 6, "a", "4"], ["Palanquin incrusté d'argent", 7, "a", "5"], ["Sarcophage en argent", 8, "a", "6"], ["Autel en argent", 9, "a", "6"], ["Statue en argent", 1, "o", "6"]]),
  ...TR("Transportables précieuses", 190, [["Statuette en or", 5, "a", "Léger"], ["Perles", 5, "a", "Minuscule"], ["Bol en or", 5, "a", "Léger"], ["Amulette en or", 5, "a", "Minuscule"], ["Coupe en or", 5, "a", "Léger"],
    ["Bracelet en or", 5, "a", "Minuscule"], ["Anneau en or", 6, "a", "Minuscule"], ["Collier en or", 6, "a", "Minuscule"], ["Cape en fourrure richement brodée avec un fermoir en or", 6, "a", "Normal"], ["Bottes en écailles de dragon", 6, "a", "Léger"], ["Gants en velours", 6, "a", "Léger"],
    ["Corne à boire cerclée d'or", 1, "o", "Léger"], ["Broderie tissée de fils d'or", 1, "o", "Normal"], ["Casque en or", 2, "o", "Léger"], ["Grand bouclier décoré d'or", 2, "o", "Normal"], ["Armure incrustée d'or", 4, "o", "Lourd"], ["Arme incrustée d'or", 2, "o", "Normal"],
    ["Livre unique", 2, "o", "Normal"], ["Joyau rare", 2, "o", "Minuscule"], ["Anneau serti d'une gemme", 2, "o", "Minuscule"], ["Sceptre", 3, "o", "Léger"], ["Couronne en or", 4, "o", "Léger"]]),
  ...TR("Entreposées précieuses", 191, [["Collier en or (entreposé)", 2, "o", "Léger"], ["Tapisserie magnifique", 2, "o", "3"], ["Tapis tissé", 2, "o", "4"], ["Coupe en or (entreposée)", 2, "o", "Léger"], ["Tableau avec un cadre doré", 2, "o", "3"],
    ["Plateau en or", 3, "o", "Lourd"], ["Statue en or représentant un enfant", 3, "o", "4"], ["Diadème en or", 3, "o", "Léger"], ["Chandelier suspendu", 3, "o", "3"], ["Fauteuil doré", 3, "o", "3"], ["Berceau incrusté d'or", 3, "o", "3"],
    ["Collier serti de gemmes", 4, "o", "Léger"], ["Sceptre serti de gemmes", 4, "o", "Léger"], ["Couronne sertie de gemmes", 4, "o", "Léger"], ["Bureau magnifique", 4, "o", "4"], ["Chaire", 4, "o", "4"], ["Table incrustée d'or", 4, "o", "5"],
    ["Joyau rare de grande taille", 2, "o", "Léger"], ["Miroir en or", 5, "o", "5"], ["Palanquin doré", 5, "o", "6"], ["Sarcophage doré", 6, "o", "7"], ["Statue en or", 7, "o", "8"]])
];

/* ------------------------------------------------------------------ journaliers (Manuel p. 172-174) et garde du corps (p. 180)
   [nom, salaire par jour en cuivre, disponibilité, rôle] */
export const JOURNALIERS = [
  ["Garde du corps", 10, "I", "Vous protège (services courants, Manuel p. 180)."],
  ["Aubergiste", 12, "I", "S'occupe de l'auberge."], ["Boulanger", 6, "C", "S'occupe de la boulangerie."],
  ["Bûcheron", 4, "C", "2 lots de bois par Quart en forêt."], ["Carrier", 3, "C", "Travaille à la carrière."],
  ["Charpentier", 7, "I", "Fabrique en bois ; réussit son jet d'ARTISANAT sur un seul x."],
  ["Chasseur", 6, "C", "1 lot de viande et de peaux par Quart dans la nature."],
  ["Facteur d'arc", 10, "I", "Flèches, arcs, frondes, arbalètes ; réussit sur un seul x."],
  ["Fermier", 5, "C", "Bergerie, pâturages, jardins, champs."],
  ["Forgeron", 10, "I", "Forge, armes, armures, objets en métal ; réussit sur un seul x."],
  ["Garde", 10, "C", "Soldat normal (Guide du MJ p. 183)."], ["Geôlier", 8, "C", "Garde le donjon."],
  ["Intendant", 3, "C", "Entretien de la forteresse."], ["Maître maçon", 20, "I", "Construit les installations sans jet."],
  ["Meunier", 8, "C", "S'occupe du moulin."], ["Mineur", 4, "C", "Travaille à la mine."],
  ["Tailleur", 8, "C", "Échoppe de tailleur, vêtements ; réussit sur un seul x."],
  ["Tanneur", 6, "I", "Tannerie, cuir ; réussit sur un seul x."]
];
