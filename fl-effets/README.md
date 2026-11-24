# Forbidden Lands – Effets (fl-effets) · v2.0.0

Animations automatiques pour Foundry 14 + système forbidden-lands 14.
Les modules requis (Sequencer et le pack d'animations) sont proposés par Foundry à l'activation.

## Ce qui est animé
- **Armes** : une animation par arme du livre. Touche = impact sur la cible ; aucun succès = le coup ou le tir part à côté.
- **Élément dans le nom** d'une arme ou d'une attaque de monstre :
  feu / flamme, glace / givre / froid, foudre / éclair, poison / venin, acide, ombre / ténèbres.
  Tir → projectile de l'élément ; mêlée → impact de l'élément ; « Souffle… » d'un monstre → souffle de l'élément.
- **Sorts** : les 68 sorts du livre de base + Embrasement et Colonne de feu (Le Châtiment du Corbeau).
  Cercle d'incantation de l'école (Divination, Sang, Mort, Générale, Guérison, Métamorphose, Chant de pierre,
  Symbolisme, Démoniaque), puis une suite d'effets : incantation, trajet, impact, effet persistant.
  Un incident magique ajoute un contrecoup rouge sur le lanceur. Un sort inconnu prend l'effet de son école.
- **Dégâts** : le sang gicle quand la Force baisse (plus de dégâts = plus de sang, flaque si Brisé),
  étoiles pour l'Esprit, effroi pour l'Empathie.

## Effets maison (dossier assets/)
Créés pour ce module : les 9 cercles d'incantation des écoles de Forbidden Lands, les orbes et éclats
de sang, poison, ombre et acide, le nuage de poison, la brume de sang et les vrilles d'ombre.

## Comment jouer
1. Le joueur **cible** l'adversaire (touche T).
2. Il lance l'attaque ou le sort depuis sa fiche.
3. L'animation se joue pour tout le monde quand le résultat arrive dans le tchat.
Un sort sans cible se joue sur le lanceur.

## Changer l'animation d'un objet
Bouton **Animation** en haut de la fiche d'une arme, d'un sort ou d'une attaque de monstre :
choix d'un effet dans la liste (classée par élément), type, école, bouton **Tester**.
Toutes les recettes sont dans `scripts/recipes.mjs`.

## Macro
```js
FLEffets.play(item, true); // joue l'animation de l'objet, du jeton sélectionné vers les cibles
```
