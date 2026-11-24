/**
 * Les lieux : quel son jouer selon le moment de la journée (Quart 0 Matin, 1 Journée, 2 Soir, 3 Nuit).
 * outdoor : la pluie et le vent couvrent le lieu (volume réduit sous l'averse).
 * bells : le lieu a une cloche (sonne au Matin et au Soir).
 * radius : portée par défaut, en cases.
 */
const day = (jour, nuit) => (q) => (q === 3 ? nuit : jour);
/** En hiver, les lieux en plein air ont leur propre son : pas de grillons, pas d'oiseaux, le froid et la neige. */
const hiver = (normal, enHiver) => (q, saison) => (saison === "hiver" ? enHiver : normal)(q);
/** Dans les tavernes, ce n'est pas le même musicien chaque jour : 6 airs, 6 jeux d'instruments. */
export const AIRS = ["L'Auberge de la vieille tour (luth)", "Le Conte du barde (luth et flûte)", "La Danse du ménestrel (luth et viole)",
  "Le Festin du roi", "Jour de marché", "Réjouissances"];

export const GROUPS = [
  { id: "habites", label: "Lieux habités", icon: "fa-house-chimney" },
  { id: "eaux", label: "Eaux", icon: "fa-water" },
  { id: "forts", label: "Forteresses", icon: "fa-chess-rook" },
  { id: "sombres", label: "Lieux sombres", icon: "fa-skull" },
  { id: "etranges", label: "Lieux étranges", icon: "fa-eye" }
];

const eau = (base) => (q, saison) => (saison === "hiver" ? `${base}_hiver` : q === 3 ? `${base}_nuit` : `${base}_jour`);
/** Musiques de combat (une au hasard à chaque combat). */
export const COMBATS = ["Bataille médiévale", "Thème de bataille A", "Thème de bataille B", "Poursuite acharnée", "Combat épique"];

export const LIEUX = {
  riviere: { label: "Rivière, gué", group: "eaux", icon: "fa-water", outdoor: true, radius: 12, file: eau("riviere"), hint: "Le Fleuve Rouge, la Lame, un gué ou un pont — eau qui gronde" },
  ruisseau: { label: "Ruisseau, source", group: "eaux", icon: "fa-droplet", outdoor: true, radius: 6, file: eau("ruisseau"), hint: "Un ruisseau dans les bois, une source près du camp — eau qui murmure" },
  village: { label: "Village", group: "habites", icon: "fa-house-chimney", outdoor: true, bells: true, radius: 14, file: hiver(day("village_jour", "village_nuit"), day("village_hiver_jour", "village_hiver_nuit")), hint: "Les Fossés, Agurville, la Cité de Pierre" },
  hameau: { label: "Hameau, ferme", group: "habites", icon: "fa-wheat-awn", outdoor: true, radius: 8, file: hiver(day("hameau_jour", "hameau_nuit"), day("hameau_hiver_jour", "hameau_hiver_nuit")), hint: "Maison du Pêcheur, cabane du garde-chasse" },
  taverne: { label: "Taverne, auberge", group: "habites", icon: "fa-beer-mug-empty", radius: 4, file: (q, s, jour = 0) => (q === 0 ? "taverne_matin" : `${q >= 2 ? "taverne_animee" : "taverne_calme"}_${((jour % AIRS.length) + AIRS.length) % AIRS.length}`),
    hint: "Les Trois Crânes, La Main du Cadavre, Le Cœur d'Aulnan — presque vide le matin, le musicien arrive dans la journée, pleine le soir ; un musicien différent chaque jour" },
  forge: { label: "Forge", group: "habites", icon: "fa-hammer", radius: 4, file: day("forge_active", "forge_braises"), hint: "Le jour on frappe, la nuit les braises" },
  chapelle: { label: "Chapelle, temple", group: "habites", icon: "fa-place-of-worship", bells: true, radius: 5, file: () => "chapelle", hint: "Chapelle du Rouillé, Ancien Temple — chant grave et écho" },
  port: { label: "Petit port de pêche", group: "habites", icon: "fa-anchor", outdoor: true, radius: 10, file: hiver(day("port_jour", "port_nuit"), day("port_hiver_jour", "port_nuit")), hint: "Pélagie, le port des Fossés" },
  moulin: { label: "Moulin à eau", group: "habites", icon: "fa-gear", outdoor: true, radius: 5, file: () => "moulin", hint: "Le Moulin Plaintif de Grinssos" },
  marche: { label: "Marché, place", group: "habites", icon: "fa-scale-balanced", outdoor: true, radius: 8, file: hiver((q) => (q >= 2 ? "marche_nuit" : "marche_jour"), (q) => (q >= 2 ? "marche_nuit" : "marche_hiver_jour")), hint: "Grinssos, Roquefleurie, le marché aux chevaux — vide le soir" },
  paturages: { label: "Pâturages, enclos", group: "habites", icon: "fa-cow", outdoor: true, radius: 10, file: hiver(day("paturages_jour", "paturages_nuit"), day("paturages_hiver_jour", "hiver_nuit")), hint: "Moutons, vaches et sonnailles" },
  camp: { label: "Camp, bivouac", group: "habites", icon: "fa-campground", outdoor: true, radius: 6, file: hiver(day("camp_jour", "camp_nuit"), day("camp_hiver_jour", "camp_hiver_nuit")), hint: "Camps des Quardes et des Galdanes, camp de brigands" },
  chateau: { label: "Château, remparts", group: "forts", icon: "fa-chess-rook", outdoor: true, bells: true, radius: 14, file: hiver(day("chateau_jour", "chateau_nuit"), day("chateau_hiver_jour", "chateau_hiver_nuit")), hint: "Âprepierre, Oeil-de-Rose, Vond" },
  forteresse_naine: { label: "Forteresse naine", group: "forts", icon: "fa-mountain", radius: 14, file: () => "forteresse_naine", hint: "Vond, Roquefleurie, l'Ascenseur des Ancêtres" },
  forteresse: { label: "Votre forteresse", group: "forts", icon: "fa-shield-halved", outdoor: true, radius: 10, file: hiver(day("forteresse_jour", "forteresse_nuit"), day("forteresse_hiver_jour", "camp_hiver_nuit")), hint: "La forteresse du groupe : chantier, bêtes, journaliers" },
  crypte: { label: "Crypte, catacombes", group: "sombres", icon: "fa-skull", radius: 8, file: () => "crypte", hint: "La Crypte des Fossés, les catacombes de la Sorcière" },
  cimetiere: { label: "Cimetière", group: "sombres", icon: "fa-cross", outdoor: true, radius: 8, file: hiver(day("cimetiere_jour", "cimetiere_nuit"), day("cimetiere_hiver_jour", "cimetiere_hiver_nuit")), hint: "L'ancien et le nouveau cimetière" },
  vallee_morts: { label: "Vallée des Morts", group: "sombres", icon: "fa-ghost", outdoor: true, radius: 20, file: () => "vallee_morts", hint: "Silence oppressant, gémissements au loin" },
  cachots: { label: "Cachots", group: "sombres", icon: "fa-link", radius: 6, file: () => "cachots", hint: "Les Cachots de Vond, la Maison des Chaînes" },
  mine: { label: "Mine", group: "sombres", icon: "fa-person-digging", radius: 10, file: () => "mine", hint: "Les Mines de Tisseroche, Corvasse — pompes, wagonnets, pioches" },
  grotte: { label: "Grotte, caverne", group: "sombres", icon: "fa-water", radius: 10, file: () => "grotte", hint: "Grotte aux Champignons, Grotte de l'Ours" },
  antre_dragon: { label: "Antre de dragon", group: "sombres", icon: "fa-dragon", radius: 10, file: () => "antre_dragon", hint: "Roquefleurie, Pic d'Ambre — un souffle énorme" },
  laboratoire: { label: "Laboratoire maudit", group: "sombres", icon: "fa-flask", radius: 6, file: () => "laboratoire", hint: "Le Mogarium de Zytéra, le laboratoire d'Âprepierre" },
  rituel: { label: "Rituel démoniaque", group: "sombres", icon: "fa-fire", radius: 8, file: () => "rituel", hint: "Le Chaudron de Sang, le Démonarium" },
  ruines_anciennes: { label: "Ruines anciennes", group: "etranges", icon: "fa-archway", outdoor: true, radius: 12, file: () => "ruines_anciennes", hint: "Ruines elfiques, vieilles pierres chantantes" },
  brume_ecarlate: { label: "La Brume Écarlate", group: "etranges", icon: "fa-smog", outdoor: true, radius: 30, file: () => "brume_ecarlate", hint: "Pour le passage de la Brume" },
  falaises: { label: "Falaises, bord de mer", group: "etranges", icon: "fa-water", outdoor: true, radius: 14, file: () => "falaises", hint: "Les falaises de Pélagie, la Chambre des Vents" },
  arene: { label: "Arène", group: "etranges", icon: "fa-people-group", outdoor: true, radius: 12, file: () => "arene", hint: "L'arène de Corvasse" }
};

/** Scènes des livres → ambiance proposée pour toute la scène. */
export const BOOK_SCENES = [
  [/foss[ée]s/i, "village"], [/^[aâ]prepierre/i, "chateau"], [/vall[ée]e des morts/i, "vallee_morts"],
  [/grinssos/i, "village"], [/corvasse/i, "mine"], [/p[ée]lagie/i, "port"],
  [/roquefleurie.*profondeur/i, "grotte"], [/roquefleurie/i, "forteresse_naine"],
  [/pic d.ambre.*int/i, "antre_dragon"], [/pic d.ambre/i, "chateau"], [/oeil-de-rose|œil-de-rose/i, "chateau"],
  [/demeure de la sorci[èe]re/i, "rituel"], [/tisseroche/i, "mine"], [/vond.*int/i, "cachots"], [/vond/i, "chateau"]
];
