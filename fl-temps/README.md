# Forbidden Lands – Le Temps des Contrées (fl-temps) · v4.0.0

Module Foundry VTT (v13–v14, système forbidden-lands 14) de gestion du temps, selon l'**Almanach des Contrées Interdites**.

## Calendrier (almanach)
- Année de **360 jours** : 8 mois aturéens de **44 jours** (Thaw, Caitelyn, Equis, Solace, Lannis, Fallow, Reaping, Dearth),
  chacun ouvert par une **fête hors semaine** (Mi-hiver, Jour de l'Éveil, Équinoxe de printemps, Fête de l'Abondance,
  Mi-été, Fête des Récoltes, Équinoxe d'automne, Jour de la Dégénérescence).
- **Semaines de 11 jours** : Luten, Shuden, Theden, Feochen, Orden, Hepten, Chaen, Felling, Reaving, Cendling, Deuil.
  Date : « Orden, 2e semaine de Lannis 1165 ». Jour de fête : « Mi-été 1165 ».
- **4 Quarts de jour** et **luminosité** selon la saison (Manuel du joueur), **chercher à manger** selon le mois.
- **Lune** : 1re pleine lune le 7 de Thaw 1165, mois synodique de 29,530588 j : reproduit exactement le tableau des lunes de 1165
  (et le décalage de −6 jours par an).

## Effets
- Obscurité de la scène, illumination globale, aube et crépuscule (teinte), nuit plus claire à la pleine lune.
- Message public à chaque Quart. Fiches privées au MJ : fête du jour (coutumes par peuple, Livre/Proposé, part de la fête),
  pleine et nouvelle lune, Deuil, deux comptes des jours (fête du Corbeau 4–5 jours après), présage.
- Bouton **Almanach** : les 8 fêtes, la lune, les règles maison et la **table des présages (1d66)**, avec un bouton pour la lancer.
- Deux pleines lunes dans un mois : le jour de la fête suivante, le MJ reçoit un rappel avec un bouton « Lancer 1d66 ».
- Chercher à manger de nuit (règle maison) : 0 à la pleine lune, −1 aux quartiers, −2 à la nouvelle lune, en plus de la saison.
- Règles maison désactivables (réglage « Afficher les règles maison »).

Les textes de l'almanach sont dans `scripts/almanach.mjs` : modifiables directement.

## Automatisation des jets (système Forbidden Lands)
Les modificateurs s'ajoutent tout seuls, déjà cochés, dans la fenêtre de jet du système :
- **Ouvrir la marche** (bouton de la feuille de Groupe) dans l'obscurité : −2, ou −1 les nuits de pleine lune.
- **Chercher des provisions** : saison (livre) + lune la nuit (0 / −1 / −2).
- **Tir** dans l'obscurité, sur une scène synchronisée avec le temps : −2, ou −1 à la pleine lune.
- **Soins** un jour de Deuil : +1 proposé, à cocher.
- **Effets en cours** (affichés dans le panneau) : part de la fête accordée, présages chiffrés.
- Présage tiré automatiquement au Matin de la fête qui suit un mois à deux pleines lunes, effets appliqués (11, 14, 16, 31, 35, 45, 56).
- Bouton « Marcher dans l'obscurité (PERCEPTION) » dans le message de chaque Quart obscur.
- Bouton « Appliquer aux personnages » sur la part de la fête (Mi-hiver, Équinoxe de printemps, Mi-été, Équinoxe d'automne).

## Météo (v4)
- Tirée chaque jour selon la **saison** et le **terrain du groupe** (à cocher par le MJ dans le panneau :
  Plaine, Forêt, Forêt dense, Collines, Montagne, Lac, Marécages, Tourbière, Ruines), d'après le climat
  de l'Europe du Nord. Persistance d'un jour à l'autre, rarement plus de 2–3 jours de pluie d'affilée.
- Vent, précipitations (pluie ou neige), température, brume/brouillard, orages (tables du Livre des Bêtes adaptées).
- **Cachée** jusqu'à ce que le MJ l'annonce (bouton « Annoncer la météo » : message avec phrases d'ambiance).
  Prévision du lendemain pour le MJ, relance, choix manuel, bouton on/off. Premières neiges signalées.
- **Effets dans les jets** (pour tous, monstres compris) : Ouvrir la marche (ciel dégagé +1, bruine −1, averse −2,
  brouillard −1), Préparer le camp (calme +1, coups de vent −1, tempête −2), Tir (averse, tempête, brouillard épais −1),
  Endurance −2 si tempête et averse. Rappels des jets d'Endurance par Quart sous les jets de voyage.
- La règle de pleine lune ne joue que par **ciel dégagé**.
- **Effets visuels** maison : pluie, neige, brouillard, feuilles d'automne, poussière, et éclairs pendant les orages
  (2 à 4 par minute, au hasard, avec flash). Désactivables par chaque joueur.
- **Maître des cieux** : quand le sort est lancé, le MJ peut choisir la nouvelle météo.

## Macros
```js
FLTemps.nextQuarter();
FLTemps.advanceTours(4);           // +1 heure
FLTemps.setDate(1165, 4, 16, 0);   // an, mois (0 = Thaw … 7 = Dearth), jour 1-44 (0 = fête), quart (0 = Matin)
FLTemps.showAlmanac();
FLTemps.rollOmen();                // présage 1d66 (MJ)
FLTemps.getState();
```

## Mise à jour depuis la v1
L'année passe de 365 à 360 jours : refixez la date une fois avec le bouton « Date ».
N'utilisez pas SmallTime en même temps.
