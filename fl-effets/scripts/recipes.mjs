/**
 * Recettes d'animations pour Forbidden Lands.
 *
 * FX : catalogue des effets, avec un nom français (c'est ce nom qui s'affiche dans Foundry).
 *      « fl.… » = effets créés pour ce module (dossier assets/), le reste vient du pack d'animations installé.
 * Une recette = une liste d'étapes jouées dans l'ordre ; la première est l'effet principal.
 *
 * Étape : { kind, fx, scale, below, delay, wait }
 *  kind : "self" (lanceur) · "area" (grande zone autour du lanceur) · "target" (sur chaque cible)
 *         "beam" (rayon du lanceur vers la cible) · "beamback" (de la cible vers le lanceur)
 *         "orb" (projectile qui vole jusqu'à la cible) · "melee" · "projectile"
 *  wait : l'étape suivante attend la fin de celle-ci (en ms, négatif = un peu avant la fin)
 *  delay : retard de l'étape (ms) ; below : sous les jetons
 */

/* -------------------------------------------- */
/*  Catalogue des effets                        */
/* -------------------------------------------- */

export const FX = {};
const fx = (group, entries) => {
  for (const [id, label, file] of entries) FX[`${group}.${id}`] = { group, label, file };
};

fx("Feu", [
  ["incantation", "Feu – mains en flammes", "jb2a.cast_generic.fire.01.orange"],
  ["trait", "Feu – trait de feu", "jb2a.fire_bolt.orange"],
  ["rayon", "Feu – rayons brûlants", "jb2a.scorching_ray.01.orange"],
  ["boule", "Feu – boule de feu (trajet)", "jb2a.fireball.beam.orange"],
  ["explosion", "Feu – explosion", "jb2a.fireball.explosion.orange"],
  ["impact", "Feu – impact", "jb2a.impact.fire.01.orange"],
  ["flammes", "Feu – la cible brûle", "jb2a.flames.04.complete.orange"],
  ["anneau", "Feu – anneau de feu", "jb2a.fire_ring.900px.red"],
  ["eruption", "Feu – colonne de feu", "jb2a.eruption.orange.01"],
  ["sol", "Feu – sol calciné", "jb2a.scorched_earth.black"],
  ["sol2", "Feu – sol calciné (petit)", "jb2a.scorched_earth.02.black"],
  ["bouclier", "Feu – bouclier de flammes (dessus)", "jb2a.shield_themed.above.fire.01.orange"],
  ["bouclier_dessous", "Feu – bouclier de flammes (dessous)", "jb2a.shield_themed.below.fire.01.orange"],
  ["souffle", "Feu – souffle en ligne", "jb2a.breath_weapons.fire.line.orange"],
  ["souffle_cone", "Feu – souffle en cône", "jb2a.breath_weapons.fire.cone.orange.01"],
  ["epee", "Feu – lame enflammée", "jb2a.melee_attack.03.magical_greatsword.01.orange"]
]);
fx("Glace", [
  ["incantation", "Glace – aura de froid (aspire)", "jb2a.aura_themed.01.inward.complete.cold.01.blue"],
  ["aura", "Glace – aura de froid (rayonne)", "jb2a.aura_themed.01.outward.complete.cold.01.blue"],
  ["trait", "Glace – rayon de givre", "jb2a.ray_of_frost.blue"],
  ["eclat", "Glace – éclat de glace", "jb2a.spell_projectile.ice_shard.blue"],
  ["boule", "Glace – boule de neige", "jb2a.snowball_toss.white.01"],
  ["impact", "Glace – impact gelé", "jb2a.impact.frost.white.01"],
  ["pics", "Glace – pics de glace", "jb2a.ice_spikes.radial.burst.white"],
  ["sol", "Glace – sol gelé", "jb2a.impact.ground_crack.frost.01.white"],
  ["bouclier", "Glace – bouclier de glace", "jb2a.shield_themed.above.ice.01.blue"],
  ["tempete", "Glace – tempête de grésil", "jb2a.sleet_storm.blue"],
  ["souffle", "Glace – souffle glacé", "jb2a.breath_weapons.cold.cone.blue"],
  ["cone", "Glace – cône de froid", "jb2a.cone_of_cold.blue"]
]);
fx("Foudre", [
  ["trait", "Foudre – arc électrique", "jb2a.witch_bolt.blue"],
  ["eclair", "Foudre – éclair", "jb2a.lightning_bolt.narrow.blue"],
  ["chaine", "Foudre – éclair en chaîne", "jb2a.chain_lightning.primary.blue"],
  ["frappe", "Foudre – la foudre tombe", "jb2a.lightning_strike.blue"],
  ["impact", "Foudre – électricité statique", "jb2a.static_electricity.01.blue"],
  ["orage", "Foudre – orage", "jb2a.call_lightning.low_res.blue"],
  ["souffle", "Foudre – souffle d'éclairs", "jb2a.breath_weapons.lightning.line.blue"]
]);
fx("Poison", [
  ["orbe", "Poison – orbe venimeux", "fl.orbe.poison"],
  ["impact", "Poison – éclaboussure", "fl.eclat.poison"],
  ["nuage", "Poison – nuage toxique", "fl.nuage.poison"],
  ["marque", "Poison – empoisonné", "jb2a.markers.poison.dark_green.01"],
  ["fleche", "Poison – flèche empoisonnée", "jb2a.arrow.poison.green.01"],
  ["souffle", "Poison – souffle toxique", "jb2a.breath_weapons.poison.cone.green"]
]);
fx("Acide", [
  ["orbe", "Acide – crachat acide", "fl.orbe.acide"],
  ["impact", "Acide – éclaboussure", "fl.eclat.acide"],
  ["souffle", "Acide – jet d'acide", "jb2a.breath_weapons.acid.line.green"]
]);
fx("Sang", [
  ["orbe", "Sang – orbe de sang", "fl.orbe.sang"],
  ["impact", "Sang – éclaboussure", "fl.eclat.sang"],
  ["brume", "Sang – brume de sang", "fl.brume.sang"],
  ["gerbe", "Sang – giclée", "jb2a.liquid.splash02.red"],
  ["gerbe_cote", "Sang – giclée de côté", "jb2a.liquid.splash_side02.red"],
  ["goutte", "Sang – gouttes", "jb2a.markers.drop.red.01"],
  ["malediction", "Sang – malédiction", "jb2a.condition.curse.01.001.red"]
]);
fx("Ombre", [
  ["orbe", "Ombre – orbe d'ombre", "fl.orbe.ombre"],
  ["impact", "Ombre – éclat d'ombre", "fl.eclat.ombre"],
  ["vrilles", "Ombre – vrilles d'ombre", "fl.vrilles.ombre"],
  ["tenebres", "Ombre – ténèbres", "jb2a.darkness.black"],
  ["filaments", "Ombre – filaments", "jb2a.energy_strands.range.multiple.purple.01"],
  ["aspiration", "Ombre – vie aspirée", "jb2a.energy_strands.in.green.01"],
  ["crane", "Ombre – crâne fumant", "jb2a.toll_the_dead.green.skull_smoke"],
  ["onde", "Ombre – onde mortelle", "jb2a.toll_the_dead.green.shockwave"],
  ["glas", "Ombre – glas", "jb2a.toll_the_dead.green.bell"],
  ["peur", "Ombre – peur", "jb2a.markers.fear.dark_purple.01"],
  ["horreur", "Ombre – horreur", "jb2a.markers.horror.purple.01"],
  ["malediction", "Ombre – malédiction", "jb2a.condition.curse.01.010.red"],
  ["desintegration", "Ombre – rayon de désintégration", "jb2a.disintegrate.green"],
  ["gouffre", "Ombre – gouffre", "jb2a.celestial_bodies.black_hole.001.8x8.outward.complete.blue"]
]);
fx("Lumière", [
  ["trait", "Lumière – trait sacré", "jb2a.guiding_bolt.01.blueyellow"],
  ["flamme", "Lumière – flamme sacrée", "jb2a.sacred_flame.target.yellow"],
  ["benediction", "Lumière – bénédiction", "jb2a.bless.400px.intro.yellow"],
  ["lueur", "Lumière – lueur", "jb2a.markers.light.complete.blue"],
  ["etoiles", "Lumière – cercle d'étoiles", "jb2a.markers.circle_of_stars.blue"],
  ["scintillement", "Lumière – scintillement", "jb2a.swirling_sparkles.01.blue"],
  ["soin_or", "Soin – lumière dorée", "jb2a.healing_generic.200px.yellow"],
  ["soin_vert", "Soin – lumière verte", "jb2a.healing_generic.200px.green"],
  ["soin_bleu", "Soin – mains guérisseuses", "jb2a.cure_wounds.400px.blue"],
  ["soin_grand", "Soin – grande guérison", "jb2a.healing_generic.03.burst.bluegreen"],
  ["remede", "Soin – remède", "jb2a.healing_generic.burst.greenorange"]
]);
fx("Nature", [
  ["feuilles", "Nature – tourbillon de feuilles", "jb2a.swirling_leaves.complete.01.green"],
  ["trait", "Nature – feuilles lancées", "jb2a.swirling_leaves.ranged.greenorange"],
  ["envol", "Nature – envol de pétales", "jb2a.swirling_leaves.outburst.01.pink"],
  ["ronces", "Nature – ronces", "jb2a.entangle.green"],
  ["liane", "Nature – liane", "jb2a.vine.complete.nature.single.01.green"],
  ["pousse", "Nature – végétation qui pousse", "jb2a.plant_growth.03.round.2x2.complete.greenyellow"],
  ["aura", "Nature – aura sauvage (aspire)", "jb2a.aura_themed.01.inward.complete.nature.01.green"],
  ["aura_out", "Nature – aura sauvage (rayonne)", "jb2a.aura_themed.01.outward.complete.nature.01.green"],
  ["aura_bois", "Nature – aura du bois", "jb2a.aura_themed.01.orbit.complete.wood.01.green"],
  ["aura_bois_in", "Nature – aura du bois (aspire)", "jb2a.aura_themed.01.inward.complete.wood.01.green"],
  ["griffes", "Nature – griffes", "jb2a.claws.400px.red"],
  ["morsure", "Nature – morsure", "jb2a.bite.400px.red"]
]);
fx("Terre", [
  ["incantation", "Terre – poussière et pierre", "jb2a.cast_generic.earth.01.browngreen"],
  ["rocher", "Terre – rocher lancé", "jb2a.boulder.toss.02.01.stone.brown"],
  ["eboulis", "Terre – éboulis", "jb2a.falling_rocks.top.1x1.grey"],
  ["fissure", "Terre – sol qui se fend", "jb2a.impact.ground_crack.02.orange"],
  ["seisme", "Terre – séisme", "jb2a.impact.ground_crack.01.orange"],
  ["poussiere", "Terre – nuage de poussière", "jb2a.smoke.puff.centered.grey"],
  ["aura", "Terre – aura de métal (rayonne)", "jb2a.aura_themed.01.outward.complete.metal.01.grey"],
  ["aura_in", "Terre – aura de métal (aspire)", "jb2a.aura_themed.01.inward.complete.metal.01.grey"]
]);
fx("Vent", [
  ["rafale", "Vent – rafale", "jb2a.gust_of_wind.default"],
  ["tourbillon", "Vent – tourbillon", "jb2a.whirlwind.bluegrey"],
  ["lignes", "Vent – souffle du vent", "jb2a.wind_lines.01.01.white"],
  ["mur", "Vent – mur de vent", "jb2a.wind_wall.200x100"]
]);
fx("Eau", [
  ["incantation", "Eau – mains ruisselantes", "jb2a.cast_generic.water.02.blue"],
  ["impact", "Eau – impact d'eau", "jb2a.impact.water.02.blue"],
  ["gerbe", "Eau – gerbe d'eau", "jb2a.liquid.splash.blue"]
]);
fx("Esprit", [
  ["filaments", "Esprit – filaments psychiques", "jb2a.energy_strands.range.standard.purple.01"],
  ["rayon", "Esprit – rayon d'énergie", "jb2a.energy_beam.normal.bluepink.02"],
  ["symbole", "Esprit – symbole hypnotique", "jb2a.sleep.symbol.pink"],
  ["transe", "Esprit – transe", "jb2a.sleep.target.pink"],
  ["chaines", "Esprit – chaînes spectrales", "jb2a.markers.chain.spectral_standard.complete"],
  ["chaines_fer", "Esprit – chaînes de fer", "jb2a.markers.chain.standard.complete"],
  ["runes", "Esprit – runes", "jb2a.markers.runes.orange.01"],
  ["bulle", "Esprit – bulle protectrice", "jb2a.markers.bubble.complete.blue"],
  ["sceau", "Esprit – sceau", "jb2a.ward.star.yellow.01"],
  ["rune_garde", "Esprit – rune de garde", "jb2a.ward.rune.yellow.01"],
  ["detection", "Esprit – détection", "jb2a.detect_magic.circle.blue"],
  ["regard", "Esprit – regard lointain", "jb2a.detect_magic.cone.blue"],
  ["dissipation", "Esprit – dissipation", "jb2a.explosion.04.blue"],
  ["portail", "Esprit – portail", "jb2a.portals.vertical.ring.bright_yellow"],
  ["coeur", "Esprit – charme", "jb2a.markers.heart.pink.01"],
  ["musique", "Esprit – notes de musique", "jb2a.markers.music_note.blue.01"],
  ["son", "Esprit – onde sonore", "jb2a.soundwave.01.blue"],
  ["onde_choc", "Esprit – onde de choc", "jb2a.thunderwave.center.blue"],
  ["etourdi", "Esprit – étourdi", "jb2a.dizzy_stars.400px.blueorange"]
]);
fx("Cercle", [
  ["divination", "Cercle – Divination", "fl.cercle.divination"],
  ["sang", "Cercle – Magie du sang", "fl.cercle.sang"],
  ["mort", "Cercle – Magie de la mort", "fl.cercle.mort"],
  ["generale", "Cercle – Magie générale", "fl.cercle.generale"],
  ["guerison", "Cercle – Guérison", "fl.cercle.guerison"],
  ["metamorphose", "Cercle – Métamorphose", "fl.cercle.metamorphose"],
  ["pierre", "Cercle – Chant de pierre", "fl.cercle.pierre"],
  ["symbolisme", "Cercle – Symbolisme", "fl.cercle.symbolisme"],
  ["demon", "Cercle – Démoniaque", "fl.cercle.demon"]
]);
fx("Arme", [
  ["epee", "Arme – épée", "jb2a.sword.melee.01.white"],
  ["epee_courte", "Arme – épée courte", "jb2a.shortsword.melee.01.white"],
  ["epee_2m", "Arme – épée à deux mains", "jb2a.greatsword.melee.standard.white"],
  ["fauchon", "Arme – fauchon", "jb2a.falchion.melee.01.white"],
  ["cimeterre", "Arme – cimeterre", "jb2a.scimitar.melee.01.white"],
  ["dague", "Arme – dague", "jb2a.dagger.melee.02.white"],
  ["dague_lancee", "Arme – dague lancée", "jb2a.dagger.throw.01.white"],
  ["hachette", "Arme – hachette", "jb2a.handaxe.melee.standard.white"],
  ["hache_guerre", "Arme – hache de guerre", "jb2a.melee_attack.02.battleaxe.01"],
  ["hache_2m", "Arme – hache à deux mains", "jb2a.greataxe.melee.standard.white"],
  ["masse", "Arme – masse", "jb2a.mace.melee.01.white"],
  ["marteau", "Arme – marteau", "jb2a.hammer.melee.01.white"],
  ["marteau_guerre", "Arme – marteau de guerre", "jb2a.warhammer.melee.01.white"],
  ["grand_marteau", "Arme – grand marteau", "jb2a.maul.melee.standard.white"],
  ["fleau", "Arme – fléau", "jb2a.melee_attack.01.flail.01"],
  ["gourdin", "Arme – gourdin", "jb2a.club.melee.01.white"],
  ["massue", "Arme – massue", "jb2a.greatclub.standard.white"],
  ["baton", "Arme – bâton", "jb2a.quarterstaff.melee.01.white"],
  ["lance", "Arme – lance", "jb2a.spear.melee.01.white"],
  ["hallebarde", "Arme – hallebarde", "jb2a.halberd.melee.01.white"],
  ["bouclier", "Arme – coup de bouclier", "jb2a.melee_attack.06.shield.01"],
  ["entaille", "Arme – entaille", "jb2a.melee_generic.slash.01.orange"],
  ["poing", "Arme – coup de poing", "jb2a.unarmed_strike.physical.01.blue"],
  ["fleche", "Arme – flèche", "jb2a.arrow.physical.white.01"],
  ["carreau", "Arme – carreau d'arbalète", "jb2a.bolt.physical.orange"],
  ["bille", "Arme – pierre de fronde", "jb2a.bullet.01.orange"],
  ["pierre", "Arme – pierre lancée", "jb2a.boulder.toss.02.01.stone.brown"],
  ["francisque", "Arme – hache lancée", "jb2a.throwable.throw.bomb.01.black"],
  ["impact", "Arme – impact", "jb2a.impact.005.orange"],
  ["griffe_monstre", "Monstre – griffe", "jb2a.melee_generic.creature_attack.claw.001.red"],
  ["coup_monstre", "Monstre – coup", "jb2a.melee_generic.creature_attack.fist.001.red"],
  ["pince", "Monstre – pince", "jb2a.melee_generic.creature_attack.pincer.001.red"]
]);

/** Fichier réel d'un effet : identifiant du catalogue, ou chemin direct. */
export function fileOf(ref) {
  if (!ref) return null;
  return FX[ref]?.file ?? ref;
}

/* -------------------------------------------- */
/*  Écoles de magie                             */
/* -------------------------------------------- */

export const SCHOOLS = {
  divination: { label: "Divination", icon: "sheikah-eye", cast: "Cercle.divination", fallback: [{ kind: "self", fx: "Esprit.detection" }] },
  blood: { label: "Magie du sang", icon: "triple-corn", cast: "Cercle.sang", fallback: [{ kind: "orb", fx: "Sang.orbe", wait: -50 }, { kind: "target", fx: "Sang.impact" }] },
  death: { label: "Magie de la mort", icon: "barbed-sun", cast: "Cercle.mort", fallback: [{ kind: "orb", fx: "Ombre.orbe", wait: -50 }, { kind: "target", fx: "Ombre.impact" }] },
  general: { label: "Magie générale", icon: "divided-square", cast: "Cercle.generale", fallback: [{ kind: "self", fx: "Esprit.bulle" }] },
  healing: { label: "Guérison", icon: "triorb", cast: "Cercle.guerison", fallback: [{ kind: "target", fx: "Lumière.soin_or" }] },
  shapeshift: { label: "Métamorphose", icon: "moebius-triangle", cast: "Cercle.metamorphose", fallback: [{ kind: "self", fx: "Nature.aura" }] },
  stone: { label: "Chant de pierre", icon: "stone-sphere", cast: "Cercle.pierre", fallback: [{ kind: "self", fx: "Terre.aura" }] },
  symbol: { label: "Symbolisme", icon: "boomerang-sun", cast: "Cercle.symbolisme", fallback: [{ kind: "target", fx: "Esprit.runes" }] },
  demon: { label: "Pouvoirs démoniaques", icon: "triple-beak", cast: "Cercle.demon", fallback: [{ kind: "target", fx: "Feu.flammes" }] },
  generic: { label: "Magie", icon: "", cast: "Cercle.generale", fallback: [{ kind: "target", fx: "Lumière.lueur" }] }
};

/* -------------------------------------------- */
/*  Motifs réutilisables                        */
/* -------------------------------------------- */

const self = (f, o = {}) => ({ kind: "self", fx: f, ...o });
const area = (f, o = {}) => ({ kind: "area", fx: f, ...o });
const tgt = (f, o = {}) => ({ kind: "target", fx: f, ...o });
const beam = (f, o = {}) => ({ kind: "beam", fx: f, wait: -500, ...o });
const back = (f, o = {}) => ({ kind: "beamback", fx: f, wait: -500, ...o });
const orb = (f, o = {}) => ({ kind: "orb", fx: f, wait: -50, ...o });

/* -------------------------------------------- */
/*  Sorts (noms français et anglais)            */
/* -------------------------------------------- */

const S = (names, school, steps, extra = {}) => ({ names, school, steps, ...extra });

export const SPELLS = [
  // Divination
  S(["Divination"], "divination", [self("Esprit.detection", { scale: 1.3 }), self("Lumière.etoiles", { delay: 400 })]),
  S(["Vision lointaine", "Farsight"], "divination", [self("Esprit.regard", { scale: 1.4 }), self("Lumière.scintillement", { delay: 300 })]),
  S(["Pressentiment", "Intuition"], "divination", [self("Lumière.etoiles"), self("Lumière.scintillement", { delay: 300 })]),
  S(["Porteur de lumière", "Lightbringer"], "divination", [self("Lumière.scintillement"), area("Lumière.lueur", { scale: 1.3, delay: 300 })]),
  S(["Télépathie", "Telepathy"], "divination", [beam("Esprit.filaments"), tgt("Esprit.symbole", { scale: .9 })]),
  S(["Voie révélée", "True Path"], "divination", [self("Lumière.etoiles"), self("Esprit.regard", { delay: 400 })]),
  S(["Regard perçant", "True Sight"], "divination", [self("Esprit.regard", { scale: 1.4 }), self("Lumière.scintillement", { delay: 200 })]),
  S(["Visions du passé", "Visions of the Past"], "divination", [area("Esprit.detection"), self("Lumière.etoiles", { delay: 500 })]),
  S(["Murmures du vent", "Words on the Wind"], "divination", [self("Vent.lignes", { scale: 1.4 }), self("Esprit.son", { delay: 300 })]),

  // Magie du sang
  S(["Asservissement démoniaque", "Bind Demon"], "blood", [orb("Sang.orbe"), tgt("Sang.impact"), tgt("Esprit.chaines_fer", { delay: 300 })]),
  S(["Arrachement de l'âme", "Bind Soul"], "blood", [tgt("Sang.impact"), back("Ombre.filaments", { delay: 300 }), self("Sang.brume", { scale: .8 })]),
  S(["Lien de sang", "Blood Bond"], "blood", [self("Sang.goutte"), orb("Sang.orbe", { delay: 300 }), tgt("Sang.brume", { scale: .7 })]),
  S(["Concentration sanguine", "Blood Channeling"], "blood", [self("Sang.brume", { scale: .9 }), self("Sang.goutte", { delay: 600 })]),
  S(["Malédiction de sang", "Blood Curse"], "blood", [orb("Sang.orbe"), tgt("Sang.impact"), tgt("Sang.malediction", { delay: 300 })]),
  S(["Enfant du feu", "Firewalker"], "blood", [self("Feu.incantation"), self("Feu.bouclier", { delay: 400 }), self("Feu.bouclier_dessous", { below: true, delay: 400 })]),
  S(["Immolation", "Immolate"], "blood", [self("Feu.incantation"), beam("Feu.trait", { delay: 300 }), tgt("Feu.impact"), tgt("Feu.flammes", { scale: 1.2, delay: 200 })]),
  S(["Bouillonnement sanguin", "Stir the Blood"], "blood", [orb("Sang.orbe"), tgt("Sang.brume", { scale: .7 }), tgt("Esprit.coeur", { delay: 300 })]),

  // Feu de Zytéra (Le Châtiment du Corbeau)
  S(["Embrasement", "Conflagration"], "demon", [self("Feu.incantation"), area("Feu.anneau", { scale: 1.2, delay: 300 }), area("Feu.sol", { below: true, delay: 600 }), tgt("Feu.flammes", { scale: 1.1, delay: 1200 })]),
  S(["Colonne de feu", "Pillar of Fire"], "demon", [self("Feu.incantation"), tgt("Feu.eruption", { scale: 1.6, delay: 300 }), tgt("Feu.sol2", { below: true, delay: 800 }), tgt("Feu.flammes", { delay: 1500 })]),

  // Magie de la mort
  S(["Pourriture", "Befoul"], "death", [orb("Poison.orbe"), tgt("Poison.nuage", { scale: 1.1 })]),
  S(["Frisson de la tombe", "Chill of the Grave"], "death", [tgt("Ombre.vrilles", { scale: .9 }), tgt("Glace.impact", { delay: 300 }), tgt("Glace.sol", { below: true, delay: 300 })]),
  S(["Contamination", "Contaminate"], "death", [orb("Poison.orbe"), tgt("Poison.impact"), tgt("Poison.marque", { delay: 400 })]),
  S(["Aura de malaise", "Ghoulish Glare"], "death", [self("Ombre.tenebres", { scale: .8 }), tgt("Ombre.peur", { delay: 500 })]),
  S(["Main du destin", "Hand of Doom"], "death", [orb("Ombre.orbe"), tgt("Ombre.impact"), tgt("Ombre.crane", { delay: 200 })]),
  S(["Nécromancie", "Raise the Dead"], "death", [area("Ombre.vrilles"), area("Ombre.onde", { delay: 500 })]),
  S(["Langage des morts", "Speak to the Dead"], "death", [tgt("Ombre.glas"), self("Ombre.vrilles", { scale: .7, delay: 400 })]),
  S(["Vol de vie", "Steal Life"], "death", [tgt("Ombre.impact"), back("Ombre.filaments", { delay: 200 }), self("Ombre.aspiration")]),
  S(["Terreur", "Terror"], "death", [tgt("Ombre.vrilles", { scale: .9 }), tgt("Ombre.horreur", { delay: 400 })]),
  S(["Poids des années", "Weight of Ages"], "death", [orb("Ombre.orbe"), tgt("Ombre.impact"), tgt("Ombre.malediction", { delay: 200 })]),

  // Magie générale
  S(["Liaison magique", "Bind Magic"], "general", [self("Esprit.rune_garde"), self("Esprit.runes", { delay: 400 })]),
  S(["Dissipation", "Dispel Magic"], "general", [beam("Esprit.rayon"), tgt("Esprit.dissipation"), tgt("Lumière.scintillement", { delay: 300 })]),
  S(["Sceau magique", "Magical Seal"], "general", [tgt("Esprit.sceau"), tgt("Lumière.scintillement", { delay: 400 })]),
  S(["Voile magique", "Obscure Magic"], "general", [self("Esprit.bulle"), self("Ombre.tenebres", { scale: .7, delay: 300 })]),
  S(["Perception de la magie", "Sense Magic"], "general", [area("Esprit.detection"), self("Lumière.scintillement", { delay: 300 })]),
  S(["Transfert", "Transfer"], "general", [beam("Esprit.rayon"), tgt("Lumière.scintillement")]),

  // Guérison
  S(["Bannissement des démons", "Banish Demon"], "healing", [beam("Lumière.trait"), tgt("Lumière.flamme", { scale: 1.2 })]),
  S(["Purification spirituelle", "Cleanse Spirit"], "healing", [tgt("Lumière.soin_or"), tgt("Lumière.scintillement", { delay: 400 })]),
  S(["Imposition des mains", "Healing Hands"], "healing", [tgt("Lumière.soin_bleu"), tgt("Lumière.scintillement", { delay: 600 })]),
  S(["Cicatrisation", "Mend Wounds"], "healing", [tgt("Lumière.soin_vert"), tgt("Lumière.scintillement", { delay: 500 })]),
  S(["Remède de la nature", "Nature's Cure"], "healing", [tgt("Nature.feuilles", { scale: .9 }), tgt("Lumière.remede", { delay: 400 })]),
  S(["Purge des morts-vivants", "Purge Undead"], "healing", [area("Lumière.benediction"), tgt("Lumière.flamme", { scale: 1.2, delay: 500 })]),
  S(["Résurrection", "Resurrection"], "healing", [tgt("Lumière.benediction", { below: true }), tgt("Lumière.soin_grand", { delay: 500 }), tgt("Lumière.lueur", { delay: 900 })]),
  S(["Sérénité", "Serenity"], "healing", [area("Lumière.benediction"), area("Lumière.scintillement", { delay: 400 })]),
  S(["Maître des cieux", "Weathermaster"], "healing", [area("Vent.tourbillon"), area("Foudre.orage", { delay: 600 })]),

  // Métamorphose
  S(["Forme animale", "Animal Form"], "shapeshift", [self("Nature.aura"), self("Nature.feuilles", { delay: 500 })]),
  S(["Langage animal", "Animal Speech"], "shapeshift", [self("Nature.feuilles", { scale: .7 }), tgt("Esprit.musique", { delay: 300 })]),
  S(["Griffe de l'ours", "Bear's Claw"], "shapeshift", [self("Nature.aura_bois", { scale: .8 }), tgt("Nature.griffes", { delay: 300 }), tgt("Sang.gerbe", { delay: 600 })]),
  S(["Maître des bêtes", "Beastmaster"], "shapeshift", [area("Nature.aura_out"), tgt("Esprit.chaines", { delay: 500 })]),
  S(["Allure féline", "Cat's Paw"], "shapeshift", [self("Nature.aura_bois"), self("Ombre.tenebres", { scale: .6, delay: 400 })]),
  S(["Bond du cerf", "Deer's Dash"], "shapeshift", [self("Nature.envol"), self("Vent.lignes", { delay: 200 })]),
  S(["Œil de faucon", "Hawk's Eye"], "shapeshift", [self("Nature.aura_bois_in"), self("Esprit.regard", { delay: 400 })]),
  S(["Âme primitive", "Primal Soul"], "shapeshift", [tgt("Nature.griffes", { scale: .8 }), tgt("Sang.malediction", { delay: 300 })]),

  // Chant de pierre
  S(["Poussière des profondeurs", "Dust from the Deep"], "stone", [self("Terre.incantation"), area("Terre.poussiere", { scale: 1.6, delay: 300 })]),
  S(["Tremblement de terre", "Earthquake"], "stone", [area("Terre.seisme", { below: true }), area("Terre.poussiere", { delay: 300 }), tgt("Terre.eboulis", { delay: 500 })]),
  S(["Chant de fer", "Iron Song"], "stone", [self("Esprit.son"), self("Terre.aura", { delay: 300 })]),
  S(["Tempête de rocs", "Stone Storm"], "stone", [beam("Terre.rocher"), tgt("Terre.eboulis"), tgt("Terre.poussiere", { delay: 200 })]),
  S(["Maître des pierres", "Stonesmith"], "stone", [self("Terre.incantation"), tgt("Terre.eboulis", { delay: 300 })]),
  S(["Étourdissement", "Stun"], "stone", [area("Esprit.onde_choc"), tgt("Esprit.etourdi", { delay: 500 })]),
  S(["Invocation de golem", "Summon Golem"], "stone", [area("Terre.seisme", { below: true }), area("Terre.aura", { delay: 400 }), self("Terre.poussiere", { delay: 600 })]),
  S(["Voix de la montagne", "Voice of the Mountain"], "stone", [self("Terre.aura_in"), self("Esprit.son", { delay: 400 })]),
  S(["Fissures", "Wither"], "stone", [tgt("Terre.fissure", { below: true }), tgt("Terre.poussiere", { delay: 300 })]),

  // Symbolisme
  S(["Aveuglement", "Blind"], "symbol", [tgt("Esprit.runes"), tgt("Ombre.tenebres", { scale: 1.1, delay: 400 })]),
  S(["Appât", "Entice"], "symbol", [tgt("Esprit.runes"), tgt("Esprit.coeur", { delay: 400 })]),
  S(["Terreur", "Horrify"], "symbol", [tgt("Esprit.runes"), tgt("Ombre.horreur", { delay: 400 })]),
  S(["Illusion"], "symbol", [tgt("Esprit.symbole"), tgt("Lumière.scintillement", { delay: 300 })]),
  S(["Oubli", "Mind Trick"], "symbol", [tgt("Esprit.runes"), tgt("Esprit.transe", { delay: 400 })]),
  S(["Paralysie", "Paralyze"], "symbol", [tgt("Esprit.symbole"), tgt("Esprit.chaines", { delay: 400 })]),
  S(["Portail", "Portal"], "symbol", [area("Esprit.runes"), area("Esprit.portail", { delay: 500 })]),
  S(["Rune de pouvoir", "Power Rune"], "symbol", [tgt("Esprit.runes"), tgt("Esprit.rune_garde", { delay: 300 })]),
  S(["Pantin", "Puppeteer"], "symbol", [beam("Ombre.filaments"), tgt("Esprit.chaines")])
];

/* -------------------------------------------- */
/*  Éléments des armes et des monstres          */
/* -------------------------------------------- */

/** Mots-clés d'élément dans le nom d'une arme ou d'une attaque. */
export const ELEMENTS = [
  { id: "feu", re: /feu|flamm|br[uû]l|incendi|fire|flame|burn/i, bolt: "Feu.trait", impact: "Feu.impact", linger: "Feu.flammes", breath: "Feu.souffle", melee: "Feu.epee" },
  { id: "glace", re: /glac|givre|froid|gel[ée]?|neige|frost|ice|cold|snow/i, bolt: "Glace.eclat", impact: "Glace.impact", linger: "Glace.pics", breath: "Glace.souffle" },
  { id: "foudre", re: /foudre|[ée]clair|[ée]lectr|tonnerre|lightning|thunder|shock/i, bolt: "Foudre.trait", impact: "Foudre.impact", breath: "Foudre.souffle" },
  { id: "poison", re: /poison|venin|venim|toxi|veno/i, bolt: "Poison.orbe", boltKind: "orb", impact: "Poison.impact", linger: "Poison.marque", breath: "Poison.souffle" },
  { id: "acide", re: /acid/i, bolt: "Acide.orbe", boltKind: "orb", impact: "Acide.impact", breath: "Acide.souffle" },
  { id: "ombre", re: /ombre|t[ée]n[èe]br|n[ée]cro|shadow|dark/i, bolt: "Ombre.orbe", boltKind: "orb", impact: "Ombre.impact" }
];

/* -------------------------------------------- */
/*  Armes (ordre : du plus précis au plus vague) */
/* -------------------------------------------- */

const W = (re, melee, ranged) => ({ re: new RegExp(re, "i"), melee, ranged });

export const WEAPONS = [
  W("deux mains.*(épée|epee)|(épée|epee).*deux mains|two-handed sword|greatsword", "Arme.epee_2m"),
  W("hache.*deux mains|two-handed axe|greataxe", "Arme.hache_2m"),
  W("grand marteau|heavy warhammer|maul", "Arme.grand_marteau"),
  W("francisque|throwing axe", "Arme.hachette", "Arme.francisque"),
  W("couteau de lancer|throwing knife", "Arme.dague", "Arme.dague_lancee"),
  W("javelot|throwing spear|javelin", "Arme.lance", "Arme.fleche"),
  W("arbal[eè]te|crossbow", null, "Arme.carreau"),
  W("\\barc\\b|bow|fl[eè]che|arrow", null, "Arme.fleche"),
  W("fronde|sling", null, "Arme.bille"),
  W("caillou|pierre|rock|stone", null, "Arme.pierre"),
  W("dague|couteau|dagger|knife", "Arme.dague", "Arme.dague_lancee"),
  W("fauchon|falchion", "Arme.fauchon"),
  W("cimeterre|scimitar", "Arme.cimeterre"),
  W("épée courte|epee courte|shortsword", "Arme.epee_courte"),
  W("épée|epee|sword", "Arme.epee"),
  W("hache de guerre|battleaxe", "Arme.hache_guerre"),
  W("hachette|hache|axe", "Arme.hachette", "Arme.francisque"),
  W("hallebarde|halberd", "Arme.hallebarde"),
  W("pique|lance|trident|pike|spear", "Arme.lance", "Arme.fleche"),
  W("fléau|fleau|morgenstern|flail|morningstar", "Arme.fleau"),
  W("marteau de guerre|warhammer", "Arme.marteau_guerre"),
  W("marteau|pioche|hammer|pickaxe", "Arme.marteau"),
  W("masse|mace", "Arme.masse"),
  W("massue|greatclub", "Arme.massue"),
  W("gourdin|club", "Arme.gourdin"),
  W("bâton|baton|staff", "Arme.baton"),
  W("bouclier|shield", "Arme.bouclier")
];

/** Attaques de monstres (objets « monsterAttack »). */
export const CREATURE = [
  W("souffle|haleine|crach|breath|spit", null, "Feu.souffle"),
  W("morsure|mord|bite|crocs|fangs", "Nature.morsure"),
  W("griff|claw|serre|talon", "Nature.griffes"),
  W("pince|pincer", "Arme.pince"),
  W("poing|coup|frappe|fist|punch|slam|piétin|pietin|charge|queue|tail|corne|horn", "Arme.coup_monstre")
];

export const DEFAULTS = {
  melee: "Arme.entaille",
  ranged: "Arme.fleche",
  creature: "Arme.griffe_monstre",
  unarmed: "Arme.poing",
  hit: "Arme.impact",
  mishap: "Sang.malediction"
};

/** Effets quand un personnage ou un monstre perd des points d'attribut. */
export const DAMAGE = {
  strength: ["Sang.gerbe", "Sang.gerbe_cote"],
  agility: ["Sang.gerbe_cote"],
  wits: ["Esprit.etourdi"],
  empathy: ["Ombre.peur"],
  broken: "Sang.impact"
};

/* -------------------------------------------- */
/*  Effets créés pour ce module                 */
/* -------------------------------------------- */

export const CUSTOM_DB = {
  cercle: Object.fromEntries(["divination", "sang", "mort", "generale", "guerison", "metamorphose", "pierre", "symbolisme", "demon"]
    .map((k) => [k, `modules/fl-effets/assets/cercle_${k}.webm`])),
  orbe: Object.fromEntries(["sang", "poison", "ombre", "acide"].map((k) => [k, `modules/fl-effets/assets/orbe_${k}.webm`])),
  eclat: Object.fromEntries(["sang", "poison", "ombre", "acide"].map((k) => [k, `modules/fl-effets/assets/eclat_${k}.webm`])),
  nuage: { poison: "modules/fl-effets/assets/nuage_poison.webm" },
  brume: { sang: "modules/fl-effets/assets/brume_sang.webm" },
  vrilles: { ombre: "modules/fl-effets/assets/vrilles_ombre.webm" }
};
