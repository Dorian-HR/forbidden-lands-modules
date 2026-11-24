/**
 * Données de l'Almanach des Contrées Interdites (document de jeu privé du MJ).
 * « Livre » : tiré des livres (reformulé). « Proposé » : coutume ou règle maison.
 * Vous pouvez modifier librement les textes de ce fichier.
 */

export const WEEKDAYS = ["Luten", "Shuden", "Theden", "Feochen", "Orden", "Hepten", "Chaen", "Felling", "Reaving", "Cendling", "Deuil"];

export const MONTHS = [
  { name: "Thaw", meaning: "« dégel » : la fin de l'hiver", bookPhase: "Déclin de l'hiver", season: "hiver", forage: -2 },
  { name: "Caitelyn", meaning: "pas de sens connu", bookPhase: "Début du printemps", season: "printemps", forage: -1 },
  { name: "Equis", meaning: "évoque l'équinoxe, qui vient de passer", bookPhase: "Déclin du printemps", season: "printemps", forage: -1 },
  { name: "Solace", meaning: "« réconfort » : la saison douce", bookPhase: "Début de l'été", season: "ete", forage: 0 },
  { name: "Lannis", meaning: "pas de sens connu", bookPhase: "Déclin de l'été", season: "ete", forage: 0 },
  { name: "Fallow", meaning: "« jachère » : les champs se reposent après la récolte", bookPhase: "Début de l'automne", season: "automne", forage: 1 },
  { name: "Reaping", meaning: "« moisson » : les dernières récoltes, l'abattage des bêtes", bookPhase: "Déclin de l'automne", season: "automne", forage: 1 },
  { name: "Dearth", meaning: "« disette » : l'entrée dans l'hiver", bookPhase: "Début de l'hiver", season: "hiver", forage: -2 }
];

const L = "Livre", P = "Proposé";

export const FEASTS = [
  {
    name: "Mi-hiver", subtitle: "La nuit la plus longue",
    book: "Le livre donne le nom de la fête et dit que c'est ce jour-là que les chefs religieux annoncent le calendrier de l'année.",
    customs: [
      { people: "Frères du Rouillé", tag: P, text: "Sur la place, ils lisent les dates de l'année et lèvent le tribut d'hiver. Le village qui ne paie pas sait ce qui l'attend à la prochaine récolte.", ref: "GMJ 35, 39" },
      { people: "Congrégation du Serpent", tag: P, text: "À Havreloin, le psychopompe Aspis bénit l'année nouvelle. On entoure le temple d'une corde nouée en ouroboros.", ref: "GMJ 36-37" },
      { people: "Ailanders", tag: P, text: "Les Sœurs du Corbeau fêtent leur Mi-hiver 4 ou 5 jours plus tard, et annoncent en secret leur propre compte des jours.", ref: "GMJ 37" },
      { people: "Aslènes", tag: L, text: "Un grand brasier pour que le Cornu les accompagne, comme à chaque fête. En plus (proposé) : chacun y jette une mèche de crin de son cheval.", ref: "GMJ 42" },
      { people: "Nains", tag: P, text: "La Vénération de la Terre (fête naine du livre, sans date) placée au cœur de l'hiver, quand le Foyer du Colosse est au plus loin : prières, festins, chants et combats entre clans.", ref: "CdC 125, GMJ 40" },
      { people: "Halfelins", tag: P, text: "Volets clos et chansons dans les tavernes. Dans la cave, en secret, un rite nocturne pour Eor.", ref: "GMJ 70-71" },
      { people: "Gobelins", tag: P, text: "La plus longue nuit de l'année est la leur : grande virée nocturne et sacrifices à Eor.", ref: "GMJ 70-71" }
    ],
    none: "Elfes, Orques, Lycans, Ogres, Sauriens (engourdis par l'hiver).",
    part: "Le serment de la longue nuit : devant le brasier, le PJ annonce à voix haute un but pour l'année (tuer une bête, trouver un lieu, venger quelqu'un…). Le jour où il l'accomplit, il gagne 1d6 points de Volonté. Un seul serment à la fois.",
    partShort: "Serment devant le feu : 1d6 Volonté le jour où il est tenu",
    inBooks: "Aucun scénario des livres ne se passe à la Mi-hiver."
  },
  {
    name: "Jour de l'Éveil", subtitle: "La fin de l'hiver",
    book: "Le livre donne seulement le nom de la fête et sa place dans l'année.",
    customs: [
      { people: "Aulnois", tag: P, text: "À midi, on ouvre portes et volets pour faire sortir l'hiver, et l'on réveille ruches et bêtes au son des chaudrons. Branches d'aulne aux portes, comme à toutes les fêtes (livre).", ref: "GMJ 45" },
      { people: "Bourgeons", tag: P, text: "La tournée des ents : offrandes et chants dans les clairières pour les réveiller (le livre décrit ces offrandes, pas leur date).", ref: "GMJ 55" },
      { people: "Lycans", tag: P, text: "Naissance des portées : on présente les petits à la Chasseresse. Ni chasse ni sang ce jour-là.", ref: "GMJ 67" },
      { people: "Aslènes", tag: P, text: "Premières courses de chevaux de l'année, autour du brasier.", ref: "GMJ 42" },
      { people: "Halfelins", tag: P, text: "Premières semailles, en chantant.", ref: "GMJ 71" }
    ],
    none: "Elfes, Nains, Orques, Gobelins, Ogres, Sauriens.",
    part: "Aider aux travaux de l'Éveil : le village loge et nourrit le PJ pendant 1d6 jours.",
    partShort: "Logé et nourri 1d6 j",
    inBooks: "Aucun scénario des livres ne se passe à cette fête."
  },
  {
    name: "Équinoxe de printemps", subtitle: "Le jour égal à la nuit",
    book: "Le livre de base place ici le Délice d'Ondée : aux Fossés, les villageois font déborder leur puits pour bénir les champs.",
    customs: [
      { people: "Villageois, Ailanders, Bourgeons", tag: L, text: "Le Délice d'Ondée : on appelle la déesse dans un puits ou un seau, qui déborde si elle répond. On lave le village de cette eau et l'on en garde en tonneaux.", ref: "GMJ 42, 200" },
      { people: "Elfes", tag: P, text: "Ils ne fêtent pas, mais respectent Ondée : un elfe de passage peut être prié de bénir l'eau.", ref: "GMJ 42, 52" },
      { people: "Congrégation du Serpent", tag: P, text: "Jour d'équilibre : on règle ses dettes et l'on marie les promis.", ref: "GMJ 36" },
      { people: "Halfelins", tag: P, text: "Échange de cadeaux entre voisins : ce qu'on donne doit valoir exactement ce qu'on reçoit.", ref: "GMJ 71" },
      { people: "Aslènes", tag: L, text: "Le brasier de fête.", ref: "GMJ 42" }
    ],
    none: "Nains, Orques, Lycans, Gobelins, Ogres, Sauriens.",
    part: "Avec l'eau du Délice : +1 aux jets de Soins pendant 1d6 jours.",
    partShort: "+1 Soins 1d6 j (eau du Délice)",
    inBooks: "Les Fossés (Guide du MJ, p. 200) : le Délice d'Ondée au puits du village."
  },
  {
    name: "Fête de l'Abondance", subtitle: "La fin du printemps",
    book: "Le livre donne seulement le nom de la fête et sa place dans l'année.",
    customs: [
      { people: "Aulnois", tag: P, text: "Grands marchés et concours (lutte, tir à l'arc, cuisine). Les Frères du Rouillé prélèvent la « part d'Hème » sur chaque étal.", ref: "GMJ 39" },
      { people: "Ailanders", tag: P, text: "Les mêmes marchés, en évitant les villages tenus par le Rouillé.", ref: "GMJ 48" },
      { people: "Aslènes", tag: P, text: "Foire aux chevaux.", ref: "GMJ 49" },
      { people: "Halfelins", tag: P, text: "Leur grande fête : trois jours de banquets dans les tavernes. Parler des gobelins à table est interdit.", ref: "GMJ 71" },
      { people: "Rameaux", tag: P, text: "Ils viennent vendre leur savoir : lectures, remèdes, petits sorts.", ref: "GMJ 48" },
      { people: "Gobelins", tag: P, text: "Ils profitent de la foule pour chaparder.", ref: "GMJ 71" },
      { people: "Sauriens", tag: P, text: "Premier « jour faste » de l'année : chaque famille festoie à son étang.", ref: "GMJ 69" }
    ],
    none: "Elfes, Nains, Orques, Lycans, Ogres.",
    part: "Le jour de la fête, tout s'achète au prix normal, même ce qui est rare ailleurs. Mais sur un jet de Perception raté, on a volé quelque chose au PJ.",
    partShort: "Prix normal le jour même ; Perception ratée : volé",
    inBooks: "Aucun scénario des livres ne se passe à cette fête."
  },
  {
    name: "Mi-été", subtitle: "La nuit la plus courte",
    book: "Le livre donne seulement le nom de la fête et sa place dans l'année.",
    customs: [
      { people: "Villageois", tag: P, text: "Feux sur les collines, au-dessus desquels on saute pour se purifier. On prie Éther pour un temps clément jusqu'aux moissons.", ref: "GMJ 41" },
      { people: "Aslènes", tag: P, text: "La grande fête du Cornu : brasiers géants et courses. Les Quardes partent en pèlerinage vers Zertorme, au pic d'Ambre (le livre décrit le pèlerinage, pas sa date).", ref: "GMJ 42" },
      { people: "Nains", tag: P, text: "La Remontée : le Foyer du Colosse est au plus haut. Ils sortent le contempler à l'aube, les yeux voilés, eux qui supportent mal le soleil. Un des rares jours où l'on peut commercer avec eux.", ref: "GMJ 40, 57" },
      { people: "Gobelins", tag: P, text: "La nuit la plus courte est la pire de l'année : ils se terrent.", ref: "GMJ 71" }
    ],
    none: "Elfes, Halfelins, Orques, Lycans, Ogres, Sauriens.",
    part: "Sauter par-dessus le feu (jet de Souplesse, sans mettre le paquet) : +1 point de Volonté. Raté : 1 point de dégât, et le MJ lit un présage dans la brûlure.",
    partShort: "Saut du feu : +1 Volonté ; raté : 1 dégât",
    inBooks: "Aucun scénario des livres ne se passe à cette fête."
  },
  {
    name: "Fête des Récoltes", subtitle: "Le début de l'automne",
    book: "Le livre de base donne seulement le nom. Le Châtiment du Corbeau décrit une fête annuelle des moissons à la Demeure de la Sorcière, sans la relier à cette date.",
    customs: [
      { people: "Frères du Rouillé", tag: P, text: "La fête des moissons de la Demeure de la Sorcière (livre) placée ici : les villages apportent leurs idoles pour qu'on les couvre de sang et qu'on les bénisse.", ref: "CdC 160" },
      { people: "Aulnois", tag: P, text: "On rentre la moisson et l'on brûle la dernière gerbe. La Garde de Fer escorte les percepteurs du Rouillé.", ref: "GMJ 39" },
      { people: "Ailanders", tag: P, text: "Les Sœurs bénissent les champs (elles aident aux récoltes, dit le livre). On cache une part du grain au Rouillé.", ref: "GMJ 37" },
      { people: "Aslènes", tag: P, text: "On répand sur les champs les cendres du brasier, car celles du Cornu fertilisent la terre.", ref: "GMJ 42" },
      { people: "Halfelins", tag: P, text: "Cueillettes et conserves. La plus grosse courge du village est offerte en secret à Eor.", ref: "GMJ 70-71" },
      { people: "Orques", tag: P, text: "Certains clans attaquent juste après la récolte, quand les greniers sont pleins.", ref: "GMJ 62" },
      { people: "Gobelins", tag: P, text: "Ils visitent les greniers la nuit.", ref: "GMJ 71" }
    ],
    none: "Elfes, Nains, Lycans, Ogres, Sauriens.",
    part: "Aider à la moisson toute la journée : 1d6 rations, et le village loge le PJ pendant 1d6 jours.",
    partShort: "1d6 rations, logé 1d6 j",
    inBooks: "La Demeure de la Sorcière (Châtiment du Corbeau, p. 160) : la fête des moissons de Hème."
  },
  {
    name: "Équinoxe d'automne", subtitle: "Le jour des morts",
    book: "Le livre donne seulement le nom de la fête et sa place dans l'année.",
    customs: [
      { people: "Villageois", tag: P, text: "Tout le village va au cimetière apaiser les morts sans repos par la musique et la parole. Le livre dit qu'on le fait régulièrement ; ce jour-là, tout le monde y va.", ref: "GMJ 45" },
      { people: "Frères du Rouillé", tag: P, text: "Ils passent ramasser les morts qui ne reposent pas.", ref: "GMJ 39, 45" },
      { people: "Ailanders", tag: P, text: "Les Sœurs reviennent bénir les tombes, souvent au nez des Frères.", ref: "GMJ 37" },
      { people: "Aslènes (Galdanes)", tag: P, text: "Chants mélancoliques pour l'Aslénie perdue. Un cheval sans cavalier court pour chaque disparu.", ref: "GMJ 50" },
      { people: "Nains méromanniens", tag: P, text: "Boisson et vieux chants de Fort Hurleur, pour la cité perdue.", ref: "GMJ 58" },
      { people: "Lycans", tag: P, text: "La Grande Traque : plusieurs jours de chasse rituelle. Tout ce qui court devient gibier.", ref: "GMJ 67" },
      { people: "Orques", tag: P, text: "Le Compte des Cicatrices : chaque guerrier montre ses blessures de l'année et en raconte l'histoire.", ref: "GMJ 62" }
    ],
    none: "Elfes, Halfelins, Gobelins, Ogres, Sauriens.",
    part: "Avoir apaisé les morts au cimetière : +1 au premier jet contre un mort-vivant dans les 1d6 jours. Pendant la Grande Traque, les rencontres doublent en territoire lycan.",
    partShort: "+1 au 1er jet contre un mort-vivant (1d6 j)",
    inBooks: "Aucun scénario des livres ne se passe à cette fête."
  },
  {
    name: "Jour de la Dégénérescence", subtitle: "Avant l'hiver",
    book: "Le livre donne seulement le nom de la fête et sa place dans l'année.",
    customs: [
      { people: "Frères du Rouillé", tag: P, text: "Leur grande fête : offrandes de métal rouillé, chaînes à charbons ardents, rubis elfiques brisés sur les autels-enclumes (rituels décrits par le livre).", ref: "GMJ 39, 53" },
      { people: "Lycans", tag: P, text: "Certaines meutes rejoignent les Frères pour honorer Hème, la Chasseresse.", ref: "GMJ 67" },
      { people: "Tous les villages", tag: P, text: "Une offrande de sang au Rôdeur nocturne, pour éloigner le malheur de l'hiver.", ref: "GMJ 41" },
      { people: "Ailanders", tag: P, text: "On se cache en attendant que ça passe. Dans les villages libres, on brûle ce qui est usé ou maudit.", ref: "GMJ 48" },
      { people: "Faucheurs repentis", tag: P, text: "Grand rassemblement parmi les corbeaux, où l'on récite les péchés de l'humanité.", ref: "GMJ 38" },
      { people: "Orques", tag: P, text: "La Nuit des Chaînes : on fête la fin de l'esclavage en frappant des chaînes. Chaque esclave du clan peut défier un guerrier pour reprendre son rang.", ref: "GMJ 62, 66" }
    ],
    none: "Elfes, Bourgeons, Nains, Halfelins, Gobelins, Ogres, Sauriens.",
    part: "Une offrande au Rôdeur nocturne (1 ration, ou 1 point de dégât) : pendant 1d6 jours, la première mauvaise rencontre de voyage est évitée.",
    partShort: "Offrande : 1re mauvaise rencontre évitée (1d6 j)",
    inBooks: "Aucun scénario des livres ne se passe à cette fête."
  }
];

export const MOON_CUSTOMS = {
  full: [
    { people: "Ogres", tag: L, text: "Grande fête à Corvasse à chaque pleine lune, avec défis de lutte.", ref: "CdC 63" },
    { people: "Gobelins", tag: L, text: "Ils hurlent avec les loups et lèchent la sève des arbres de sang.", ref: "MdJ 21" },
    { people: "Lycans", tag: L, text: "Hurlements en chœur et tambours ; rituels de sang.", ref: "GMJ 67-68" },
    { people: "Halfelins et gobelins", tag: L, text: "Les enfants nés cette nuit-là sont promis à un grand destin.", ref: "GMJ 71" },
    { people: "Halfelins", tag: P, text: "On pose une assiette sur le rebord de la fenêtre pour Eor.", ref: "GMJ 70" }
  ],
  new: [
    { people: "Tous", tag: L, text: "Eor voile son visage, rongée de remords.", ref: "GMJ 70" },
    { people: "Halfelins", tag: P, text: "Nuit de pénitence de la Pénita : jeûne et rites secrets.", ref: "GMJ 70" },
    { people: "Gobelins", tag: P, text: "Nuit de vol rituel : une fois par an, chacun doit voler un objet de valeur avant l'aube.", ref: "GMJ 70-71" }
  ]
};

/** Table des présages (1d66) : deux pleines lunes dans le même mois, à lancer le jour de la fête suivante. */
export const OMENS = [
  { theme: "Le ciel", items: [
    ["La lune rouge", "La seconde pleine lune se lève couleur de sang. Les fidèles du Rouillé y voient la faveur de Hème, ceux du Corbeau un avertissement : −1 en Manipulation auprès du camp adverse jusqu'à la fin du mois."],
    ["Le halo", "Un anneau pâle entoure la lune toute la nuit. Le lendemain, une tempête : un Quart de marche perdu, ou un jet d'Endurance contre le froid."],
    ["L'étoile filante", "Une étoile rouge traverse le ciel. Les elfes la prennent pour un signe du Vagabond vermeil ; un elfe PJ gagne 1 point de Volonté."],
    ["La nuit sans ombre", "La lune est si claire qu'on y voit comme en plein jour : cette nuit, aucun malus d'obscurité."],
    ["L'éclipse", "La lune s'éteint une heure. Halfelins et gobelins se cachent : Eor a fermé l'œil. Tout jet tenté pendant ce temps ne peut pas être poussé."],
    ["Le ciel vert", "Des lueurs dansent au-dessus de l'horizon. Les voyageurs disent qu'elles montrent le chemin : +1 au guide le lendemain."]
  ] },
  { theme: "Les morts", items: [
    ["Le cimetière ouvert", "Une tombe du village est vide au matin. Personne ne sait si le mort est parti seul."],
    ["La procession", "Les morts sans repos marchent en file vers un même lieu. Les suivre mène à un site d'aventure."],
    ["La voix du défunt", "Un PJ entend un mort qu'il a connu l'appeler par son nom. Il doit réussir un jet d'Intuition, sinon il perd 1 point d'Esprit."],
    ["Le reflet", "Dans un puits, quelqu'un voit le visage d'un mort à la place du sien. Le village réclame un rite d'apaisement avant la fête."],
    ["Les corbeaux", "Des centaines de corbeaux se posent sur les toits sans un cri. Les Sœurs y voient un bon signe, les Frères cherchent un coupable."],
    ["Le mort qui parle", "Un mort sans repos répond enfin à une question avant de trouver la paix. Le MJ donne une information vraie."]
  ] },
  { theme: "La nature", items: [
    ["Les bêtes fuient", "Pendant 1d6 jours, le gibier quitte la région : −1 pour chasser, +1 pour repérer ce qu'il fuit."],
    ["Le loup blanc", "Un loup blanc suit le groupe à distance pendant 1d6 jours, sans jamais attaquer."],
    ["Les hurlements", "Les lycans hurlent toute la nuit, plus près que d'habitude. Une rencontre de plus en forêt ce mois-ci."],
    ["La source tarie", "Le puits ou la rivière du village baisse d'un coup. On accuse une sorcière, un voisin ou les PJ."],
    ["La floraison", "Des fleurs éclosent hors saison. +1 pour chercher à manger pendant 1d6 jours."],
    ["Les vers", "Le sol se couvre de vers à l'aube, comme ceux qui ont préparé la terre pour les humains selon l'Église du Corbeau. Bonne récolte annoncée."]
  ] },
  { theme: "Les gens et les cultes", items: [
    ["Le prêcheur", "Un prêtre errant annonce la fin des temps sur la place. La moitié du village le suit, l'autre veut le chasser."],
    ["Les deux fêtes", "Fidèles du Rouillé et du Corbeau se disputent la date de la fête. Bagarre si personne ne calme le jeu."],
    ["La dîme", "Les Frères du Rouillé passent lever un tribut en plus « pour détourner le présage »."],
    ["La sœur en fuite", "Une Sœur du Corbeau demande refuge aux PJ pour une nuit : la Garde de Fer est sur ses traces."],
    ["Le mariage", "Le village avance un mariage pour profiter de la chance des deux lunes. Les PJ sont invités, et +1 en Manipulation dans ce village pendant 1d6 jours."],
    ["L'enfant des deux lunes", "Un enfant naît entre les deux pleines lunes. Les uns y voient un élu, les autres un monstre : deux camps se forment."]
  ] },
  { theme: "Rêves et signes", items: [
    ["Le rêve partagé", "Tous les PJ font le même rêve : un lieu ou un visage. Le MJ y glisse une piste vers un site d'aventure."],
    ["La prophétie", "Un vieillard du village récite une prophétie en dormant. Elle concerne l'un des PJ."],
    ["Le nom écrit", "Le nom d'un PJ apparaît gravé sur une pierre, une porte ou un arbre, sans que personne l'ait écrit."],
    ["Le double", "Des villageois jurent avoir vu un PJ ailleurs, à la même heure."],
    ["Le signe d'Eor", "Halfelins et gobelins y voient une bénédiction : un PJ halfelin ou gobelin gagne 1 point de Volonté, les autres entendent une rumeur vraie de plus."],
    ["Le silence", "Une nuit entière, aucun bruit : ni vent, ni bête, ni chien. Le lendemain, tout le monde est à cran (−1 en Intuition pour tous jusqu'au soir)."]
  ] },
  { theme: "Magie et démons", items: [
    ["La magie déborde", "Jusqu'à la fin du mois, chaque jet de sort se fait avec 1 dé de plus : plus de chances de surpuissance, mais aussi d'incident magique."],
    ["La brume rouge", "Une brume rougeâtre monte à l'aube et rappelle la Brume. Panique : le village ferme ses portes 1d6 jours."],
    ["Le démon en rêve", "Un démon parle à un PJ en rêve et lui offre un marché. Refuser coûte 1 point d'Esprit ; accepter, c'est au MJ de voir."],
    ["La pierre qui chante", "Une ruine proche résonne d'un chant la nuit. Les nains y voient le travail d'un chantepierre ; les autres n'osent pas approcher."],
    ["L'artefact s'éveille", "Un objet ancien du village (une épée, une idole) tremble ou brille. Quelqu'un veut le vendre, quelqu'un veut le détruire."],
    ["Le grand présage", "Quelque chose d'énorme se prépare dans la région. Le MJ choisit l'événement de campagne suivant et l'avance d'une étape."]
  ] }
];

/** Résultat d'un 1d66 (dé des dizaines, dé des unités). */
export function omenFor(tens, units) {
  const t = OMENS[tens - 1];
  const [title, text] = t.items[units - 1];
  return { code: `${tens}${units}`, theme: t.theme, title, text };
}

export const RULES = {
  fullMoonNight: "Pleine lune, par ciel dégagé : le malus de −2 pour l'obscurité (guide qui ouvre la marche, attaques à distance) passe à −1.",
  forageDark: "Chercher à manger dans l'obscurité : selon la lune, de 0 à la pleine lune à −2 à la nouvelle lune (−1 aux quartiers). S'ajoute au modificateur de saison.",
  deuil: "Deuil, le jour des morts : un jet de Soins, ou une tentative pour apaiser un mort, fait sur une tombe ou près d'un mort reçoit +1 (ce jet ne peut pas être poussé).",
  omen: "Deux pleines lunes dans le même mois : présage (le livre ne dit pas lequel). Le soir où se lève la seconde pleine lune, lancez 1d66 sur la table des présages.",
  twoCounts: "Les Sœurs du Corbeau comptent 4 ou 5 jours de retard sur les Frères du Rouillé : les fidèles du Corbeau fêtent leur fête maintenant.",
  part: "La part de la fête : passer le jour de fête dans une communauté qui la célèbre, et y prendre part. Un seul bonus par fête, 1d6 jours au plus ; le jet qui en profite ne peut pas être poussé."
};
