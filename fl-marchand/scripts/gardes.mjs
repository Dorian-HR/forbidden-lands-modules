// Gardes du corps à engager (service « Garde du corps », 1 pièce d'argent par jour, Manuel p. 180).
// Personnages inventés pour le module. Chiffres : le PNJ « Soldat » du Guide du MJ (p. 183), ajusté à chacun.
// attr : [Force, Agilité, Esprit, Empathie]. comp : compétences du système (melee, marksmanship, endurance, survival, scouting, insight, might, move, stealth, healing, manipulation, lore, animal-handling).

export const GARDES = [
  {
    id: "brenna", nom: "Brenna Pied-de-Fer", peuple: "Humaine (Ailander)", age: 38,
    visage: "Mâchoire carrée, nez cassé deux fois, yeux gris qui ne cillent pas.", corps: "Large d'épaules, marche lourdement.", tenue: "Cotte de mailles rapiécée, cape brune.",
    traits: "Taciturne, loyale jusqu'à l'entêtement.",
    histoire: "Brenna a gardé pendant douze ans la porte d'un seigneur ailander qui a fui à la fin de la Brume Écarlate en emportant la solde de ses gens. Elle a traversé le Corvan à pied pour le retrouver, puis a renoncé en route. Depuis, elle vend son bras à qui paie d'avance, et ne pose jamais de questions.",
    veut: "Assez d'argent pour une ferme avec un toit qui ne fuit pas.", fierte: "N'a jamais laissé tomber quelqu'un qu'elle protégeait.", secret: "Elle sait où vit son ancien seigneur. Elle n'y est jamais allée.",
    replique: "« Vous payez, je reste. Vous ne payez plus, je pars. C'est simple. »",
    attr: [4, 3, 3, 2], comp: { melee: 3, endurance: 2, might: 1, survival: 1 }, equip: ["Épée large", "Grand bouclier", "Cotte de mailles"]
  },
  {
    id: "orvik", nom: "Orvik le Chanteur", peuple: "Humain (Aslène)", age: 27,
    visage: "Barbe tressée de perles de bronze, sourire facile.", corps: "Grand, souple, toujours en mouvement.", tenue: "Cuir clouté, une corne pendue au cou.",
    traits: "Bavard, chante faux en marchant, courageux par fierté plus que par nature.",
    histoire: "Fils d'un clan aslène des plaines, Orvik a été chassé pour avoir volé un cheval qu'il comptait rendre. Il garde les voyageurs pour se faire une réputation qu'il pourra rapporter chez lui. Il raconte chaque combat trois fois, et la troisième fois il a tué un ours.",
    veut: "Rentrer au clan avec un exploit digne d'un chant.", fierte: "Sa voix, qu'il croit belle.", secret: "Il a peur des chiens depuis l'enfance.",
    replique: "« Encore un jour, encore une chanson ! »",
    attr: [3, 4, 3, 3], comp: { melee: 2, marksmanship: 2, move: 2, "animal-handling": 2 }, equip: ["Lance courte", "Arc court", "Armure en cuir clouté"]
  },
  {
    id: "gurda", nom: "Gurda Fend-la-Roche", peuple: "Naine", age: 112,
    visage: "Barbe courte roussie par la forge, un œil laiteux.", corps: "Trapue, bras couverts de brûlures anciennes.", tenue: "Plastron de fer martelé, tablier de cuir.",
    traits: "Bourrue, méfiante envers les elfes, d'une honnêteté brutale.",
    histoire: "Gurda a quitté les halls de ses pères quand ils ont refusé de rouvrir les portes après la Brume. Elle pense que les nains ont eu tort de se cacher trois siècles et le dit à qui veut l'entendre. Elle protège les humains par curiosité : elle veut comprendre comment un peuple aussi fragile a survécu.",
    veut: "Voir de ses yeux une forteresse naine abandonnée.", fierte: "Ses cicatrices de forge.", secret: "Elle a été bannie, pas seulement partie.",
    replique: "« Tu as une épée ? Montre. … Pfff. On va s'en faire une vraie. »",
    attr: [5, 2, 3, 2], comp: { melee: 3, endurance: 2, crafting: 2, might: 1 }, equip: ["Hache de guerre", "Petit bouclier", "Cotte de mailles"]
  },
  {
    id: "sael", nom: "Saël des Rameaux", peuple: "Demi-elfe", age: 41,
    visage: "Traits fins, oreilles à peine pointues qu'il cache sous ses cheveux.", corps: "Mince, silencieux.", tenue: "Cape vert sombre, arc long en bandoulière.",
    traits: "Calme, observateur, parle peu et précisément.",
    histoire: "Saël a grandi entre deux mondes et n'a été accueilli dans aucun. Il a appris à tirer à l'arc chez les elfes et à mentir chez les humains. Il préfère les routes aux villes et les clients qui se taisent à ceux qui le remercient.",
    veut: "Savoir qui était son père elfe.", fierte: "N'a jamais manqué une cible immobile.", secret: "Il garde une lettre qu'il ne sait pas lire.",
    replique: "« Deux à gauche, derrière les arbres. Ne vous retournez pas. »",
    attr: [3, 4, 4, 2], comp: { marksmanship: 3, scouting: 3, stealth: 2, melee: 1 }, equip: ["Arc long", "Dague", "Armure en cuir"]
  },
  {
    id: "maline", nom: "Maline la Veuve", peuple: "Humaine (Ailander)", age: 45,
    visage: "Cheveux gris coupés court, rides de rire qui ne servent plus.", corps: "Sèche et nerveuse.", tenue: "Vêtements de deuil, hachette à la ceinture.",
    traits: "Ironique, protectrice, n'accepte pas d'ordres d'un homme ivre.",
    histoire: "Son mari et ses deux fils ont été emportés par des orques un hiver de disette. Maline a pris la hachette du bois de chauffe et ne l'a plus lâchée. Elle n'a pas de rancune particulière : elle a juste décidé de ne plus jamais attendre que quelqu'un vienne la sauver.",
    veut: "Que d'autres familles ne connaissent pas ce qu'elle a connu.", fierte: "Elle a survécu.", secret: "Elle croit qu'un de ses fils est encore vivant chez les orques.",
    replique: "« Mangez d'abord. On ne se bat pas le ventre vide. »",
    attr: [3, 3, 3, 4], comp: { melee: 2, healing: 2, insight: 2, endurance: 1 }, equip: ["Hachette", "Couteau", "Armure en cuir"]
  },
  {
    id: "krag", nom: "Krag Dent-Fendue", peuple: "Orque", age: 24,
    visage: "Une défense brisée, des yeux jaunes très vifs.", corps: "Massif, cicatrices de fouet dans le dos.", tenue: "Peaux mal tannées, gourdin clouté.",
    traits: "Direct, rancunier, d'une loyauté absolue envers qui le traite en égal.",
    histoire: "Krag s'est enfui d'un camp d'esclaves où on le faisait combattre pour amuser les gardes. Il a appris le langage des humains en écoutant les paris sur sa mort. Il sait que les villageois le regardent de travers et il le leur rend bien.",
    veut: "Qu'on l'appelle par son nom.", fierte: "N'a jamais perdu un combat dans l'arène.", secret: "Il a tué un garde en s'évadant ; on le recherche peut-être encore.",
    replique: "« Toi payer Krag. Krag casser ceux qui te veulent du mal. Bon marché. »",
    attr: [5, 3, 2, 2], comp: { melee: 3, might: 2, endurance: 2 }, equip: ["Massue", "Armure en cuir"]
  },
  {
    id: "pipa", nom: "Pipa Doigts-Agiles", peuple: "Halfeline", age: 33,
    visage: "Taches de rousseur, sourcils toujours levés.", corps: "Petite, vive comme un écureuil.", tenue: "Gilet aux poches innombrables, fronde à la hanche.",
    traits: "Curieuse, gourmande, plus courageuse qu'elle ne le paraît.",
    histoire: "Pipa a gardé les greniers de son village contre les rats, puis contre les voleurs, puis contre les voleurs de voleurs. Elle propose ses services parce que personne ne se méfie d'une halfeline, ce qui fait d'elle la meilleure garde qui soit. Elle se paie aussi un peu dans les poches des agresseurs.",
    veut: "Goûter tous les fromages du Corvan.", fierte: "On ne l'a jamais vue venir.", secret: "Elle doit beaucoup d'argent à un receleur de Grinssos.",
    replique: "« Moi ? Une garde ? Justement. »",
    attr: [2, 4, 4, 3], comp: { marksmanship: 2, stealth: 3, "sleight-of-hand": 2, scouting: 2 }, equip: ["Fronde", "Dague", "Armure en cuir"]
  },
  {
    id: "harald", nom: "Harald Sans-Terre", peuple: "Humain (Aulnois)", age: 52,
    visage: "Visage marqué, moustache de soldat, regard fatigué.", corps: "Toujours droit malgré un genou raide.", tenue: "Vieux tabard aulnois délavé sous une cotte de mailles.",
    traits: "Discipliné, pédant sur la tactique, profondément triste.",
    histoire: "Harald est arrivé d'Aulnan avec une compagnie de mercenaires qu'il a vue mourir, homme par homme, pendant les dernières années de la Brume. Il ne peut pas rentrer : sa famille le croit mort et il préfère qu'il en soit ainsi. Il enseigne volontiers à ses clients comment tenir un bouclier.",
    veut: "Qu'on se souvienne des noms de ses hommes.", fierte: "Ses connaissances militaires.", secret: "C'est lui qui a donné l'ordre qui a fait tuer sa compagnie.",
    replique: "« Bouclier haut, coude rentré. Non. Encore. »",
    attr: [4, 3, 4, 2], comp: { melee: 3, endurance: 2, insight: 2, lore: 1 }, equip: ["Épée bâtarde", "Grand bouclier", "Cotte de mailles", "Cervelière"]
  },
  {
    id: "yrsa", nom: "Yrsa aux Loups", peuple: "Lycane", age: 29,
    visage: "Yeux ambrés, une mèche blanche dans des cheveux noirs.", corps: "Nerveuse, renifle l'air sans s'en rendre compte.", tenue: "Fourrures, pieds nus même en hiver.",
    traits: "Sauvage, franche, sent les mensonges et les dit à voix haute.",
    histoire: "Yrsa a quitté sa meute après une querelle de chef qu'elle a perdue. Elle découvre les villages humains avec un mélange de dégoût et d'émerveillement. Elle accepte de garder les gens parce que c'est ce qu'on fait dans une meute, et elle traite ses clients comme des louveteaux maladroits.",
    veut: "Fonder sa propre meute.", fierte: "Son flair.", secret: "Elle a mordu un enfant humain, autrefois, par peur.",
    replique: "« Il ment. Il sent la peur et la bière. Surtout la peur. »",
    attr: [4, 4, 3, 2], comp: { melee: 2, scouting: 3, survival: 3, move: 2 }, equip: ["Lance courte", "Couteau"]
  },
  {
    id: "tobbe", nom: "Tobbe le Gros", peuple: "Humain (Ailander)", age: 34,
    visage: "Joues rouges, bonne figure de boulanger.", corps: "Énorme, fort comme un bœuf, souffle vite.", tenue: "Tunique tendue, gourdin de chêne.",
    traits: "Jovial, glouton, d'un dévouement de chien.",
    histoire: "Tobbe était le fils du meunier jusqu'au jour où il a jeté par la fenêtre deux brigands venus rançonner le moulin. On lui a dit qu'il était fait pour la bagarre et il l'a cru. Il ne se bat pas bien, mais il encaisse les coups comme un mur.",
    veut: "Qu'on le nourrisse correctement.", fierte: "Personne ne l'a jamais fait tomber.", secret: "Il n'a jamais tué personne et il en a peur.",
    replique: "« Je passe devant. Moi, ça me fait moins mal. »",
    attr: [5, 2, 2, 3], comp: { might: 3, endurance: 3, melee: 1 }, equip: ["Gourdin", "Armure en cuir"]
  },
  {
    id: "ilsa", nom: "Ilsa Corbeline", peuple: "Humaine (Ailander)", age: 23,
    visage: "Pâle, cheveux noirs, une plume de corbeau dans la tresse.", corps: "Fine, gestes précis.", tenue: "Manteau sombre, dague à la cheville.",
    traits: "Mystérieuse, pieuse à sa façon, méprise les Frères du Rouillé.",
    histoire: "Ilsa a été élevée en cachette par une Sœur du Corbeau qui lui a appris à se défendre et à se taire. Quand sa protectrice a été brûlée, Ilsa est partie sur les routes. Elle garde les voyageurs, mais elle cherche surtout ceux qui ont allumé le bûcher.",
    veut: "Retrouver les Frères qui ont brûlé sa mère adoptive.", fierte: "Sa foi en Corbeau.", secret: "Elle est elle-même une Sœur du Corbeau, pas encore initiée.",
    replique: "« Corbeau voit tout. Moi aussi, mais je parle moins. »",
    attr: [3, 4, 3, 3], comp: { melee: 2, stealth: 2, insight: 2, healing: 1 }, equip: ["Dague", "Épée courte", "Armure en cuir"]
  },
  {
    id: "borr", nom: "Borr Deux-Haches", peuple: "Humain (Aslène)", age: 40,
    visage: "Crâne rasé, tatouages bleus sur le front.", corps: "Bâti comme un tonneau.", tenue: "Torse nu sous une peau d'ours, une hache dans chaque main.",
    traits: "Bruyant, superstitieux, rit au combat.",
    histoire: "Borr croit qu'il mourra le jour où il posera une de ses haches. Il ne les lâche jamais, même pour manger, ce qui rend les repas compliqués. Ancien éclaireur aslène, il a perdu son clan dans une guerre de pâturages et vend désormais sa folie à qui peut la payer.",
    veut: "Mourir en se battant, mais pas tout de suite.", fierte: "Ses tatouages, un par ennemi.", secret: "Il ne sait plus combien il y en a de vrais.",
    replique: "« Deux haches, deux fois moins de problèmes ! »",
    attr: [4, 4, 2, 2], comp: { melee: 3, endurance: 1, survival: 2 }, equip: ["Hachette", "Hache de guerre"]
  },
  {
    id: "elaine", nom: "Élaine de la Tour Basse", peuple: "Humaine (Aulnoise)", age: 31,
    visage: "Beauté sévère, cicatrice sous la lèvre.", corps: "Port de noble, mains calleuses.", tenue: "Armure de qualité, blason gratté.",
    traits: "Fière, exigeante, généreuse en secret.",
    histoire: "Dernière d'une petite maison noble aulnoise ruinée, Élaine a vendu le domaine pour payer les dettes de son frère. Elle garde maintenant des marchands qu'elle aurait autrefois fait attendre dans l'antichambre. Elle ne s'en plaint jamais, mais elle exige qu'on lui parle poliment.",
    veut: "Racheter la tour de sa famille.", fierte: "Son nom, même s'il ne vaut plus rien.", secret: "Son frère est devenu bandit et elle le protège.",
    replique: "« Vous pouvez m'appeler dame Élaine. Ou garde. Mais pas ma belle. »",
    attr: [4, 3, 3, 3], comp: { melee: 3, manipulation: 2, "animal-handling": 2, endurance: 1 }, equip: ["Épée large", "Petit bouclier", "Armure en cuir clouté", "Cervelière"]
  },
  {
    id: "nikk", nom: "Nikk", peuple: "Gobelin", age: 19,
    visage: "Grandes oreilles percées d'anneaux, dents pointues.", corps: "Maigre, agile, jamais immobile.", tenue: "Haillons multicolores, javelots dans le dos.",
    traits: "Lâche avoué, rusé, étonnamment fiable.",
    histoire: "Nikk a été vendu par sa tribu à un marchand contre un chaudron. Le marchand est mort, le chaudron aussi, et Nikk a gardé le chariot. Il a compris que les humains paient bien pour être protégés et il a compris aussi que le plus sûr est de voir le danger avant tout le monde.",
    veut: "Avoir un chaudron à lui.", fierte: "Il est encore vivant, contrairement aux autres.", secret: "Il espionne parfois ses clients pour le compte d'un chef gobelin.",
    replique: "« Nikk regarde, Nikk prévient, Nikk court. Vous aussi, courez. »",
    attr: [2, 4, 4, 2], comp: { scouting: 3, stealth: 3, marksmanship: 2, move: 2 }, equip: ["Javelot", "Couteau"]
  },
  {
    id: "sigrun", nom: "Sigrun l'Ancienne", peuple: "Humaine (Ailander)", age: 61,
    visage: "Visage tanné, deux tresses blanches.", corps: "Petite mais solide, ne s'essouffle jamais.", tenue: "Vêtements de laine épaisse, bâton ferré.",
    traits: "Sage, patiente, moqueuse envers les jeunes guerriers.",
    histoire: "Sigrun a guidé des troupeaux, des pèlerins et des fugitifs pendant quarante ans. Elle connaît chaque gué, chaque grotte sèche et chaque auberge où l'on ne pose pas de questions. Elle ne se bat plus beaucoup, mais elle évite les combats mieux que personne.",
    veut: "Écrire ses souvenirs avant de mourir, mais elle ne sait pas écrire.", fierte: "Elle n'a jamais perdu un voyageur.", secret: "Elle a guidé un sorcier jusqu'à un lieu maudit, autrefois, et elle sait ce qu'il y a fait.",
    replique: "« Le plus beau combat, c'est celui qu'on n'a pas eu. »",
    attr: [3, 3, 4, 3], comp: { survival: 3, scouting: 2, melee: 1, lore: 2 }, equip: ["Bâton", "Couteau"]
  },
  {
    id: "dag", nom: "Dag Main-Rouge", peuple: "Humain (Ailander)", age: 36,
    visage: "Main droite tachée d'une marque de naissance rouge.", corps: "Sec et dur.", tenue: "Vêtements sombres, arbalète légère.",
    traits: "Froid, méthodique, d'une politesse inquiétante.",
    histoire: "On dit que Dag a été bourreau dans un village du sud. Il ne dément pas. Il garde ses clients comme il faisait son ancien métier : sans émotion et sans erreur. Il refuse de travailler la nuit de la nouvelle lune, sans dire pourquoi.",
    veut: "Qu'on le laisse tranquille avec son passé.", fierte: "Son travail toujours propre.", secret: "Il entend la nuit les voix de ceux qu'il a exécutés.",
    replique: "« Restez derrière moi, je vous prie. Merci. »",
    attr: [3, 4, 4, 2], comp: { marksmanship: 3, melee: 2, insight: 2 }, equip: ["Arbalète légère", "Épée courte", "Armure en cuir clouté"]
  },
  {
    id: "aldo", nom: "Aldo Bonne-Pinte", peuple: "Halfelin", age: 47,
    visage: "Nez rouge, sourire édenté.", corps: "Rond, étonnamment rapide.", tenue: "Chapeau à large bord, couteaux partout.",
    traits: "Bon vivant, menteur sympathique, vise juste.",
    histoire: "Aldo tenait une taverne qui a brûlé un soir de bagarre. Il a décidé que tant qu'à être au milieu des bagarres, autant être payé pour ça. Il lance les couteaux comme d'autres lancent des fléchettes au comptoir, et ne rate jamais un pichet.",
    veut: "Rouvrir une taverne, la plus belle du Corvan.", fierte: "Sa bière, dont il garde la recette.", secret: "C'est lui qui a mis le feu à sa taverne, pour l'assurance d'un marchand.",
    replique: "« Une pour la route, une pour le danger, une pour moi. »",
    attr: [2, 4, 3, 4], comp: { marksmanship: 3, manipulation: 2, stealth: 2 }, equip: ["Couteau de lancer", "Couteau de lancer", "Dague"]
  },
  {
    id: "thora", nom: "Thora Bouclier-d'Os", peuple: "Naine", age: 87,
    visage: "Tresses grises nouées de fil de cuivre, joues rouges de froid.", corps: "Petite montagne de muscles.", tenue: "Bouclier peint d'un crâne, marteau de guerre.",
    traits: "Joyeuse au combat, mélancolique le soir, fidèle.",
    histoire: "Thora a servi dans la garde d'une forteresse naine pendant la Brume. Elle n'a jamais vu le soleil avant soixante ans et le regarde encore se lever chaque matin, émerveillée. Elle garde les humains parce qu'ils lui racontent des histoires de la surface.",
    veut: "Voir la mer.", fierte: "Elle a tenu une porte seule pendant une nuit entière.", secret: "Cette nuit-là, elle a laissé mourir son capitaine pour sauver la porte.",
    replique: "« Encore un lever de soleil. Je ne m'en lasserai pas. »",
    attr: [4, 2, 3, 3], comp: { melee: 3, endurance: 3, might: 1 }, equip: ["Marteau de guerre", "Grand bouclier", "Cotte de mailles"]
  },
  {
    id: "renn", nom: "Renn le Muet", peuple: "Humain (Aslène)", age: 26,
    visage: "Langue coupée, yeux très doux.", corps: "Élancé, gestes lents.", tenue: "Tunique simple, longue lance.",
    traits: "Silencieux, attentif, aime les animaux plus que les gens.",
    histoire: "Renn a perdu sa langue pour avoir témoigné contre un chef de guerre. Il communique par signes et par regards, et ceux qui le connaissent disent qu'il est le plus bavard des gardes. Il soigne les chevaux de ses clients avant de manger.",
    veut: "Que la vérité soit dite un jour.", fierte: "Il n'a pas menti, même quand cela lui a coûté.", secret: "Le chef de guerre est toujours vivant, et Renn sait où.",
    replique: "Il hoche la tête et se met entre vous et la porte.",
    attr: [3, 4, 3, 3], comp: { melee: 2, "animal-handling": 3, insight: 2 }, equip: ["Lance longue", "Couteau", "Armure en cuir"]
  },
  {
    id: "vasha", nom: "Vasha la Rouge", peuple: "Humaine (Ailander)", age: 30,
    visage: "Chevelure rousse, taches de son, regard de défi.", corps: "Athlétique.", tenue: "Cuir clouté et épée courte, toujours un dé dans la poche.",
    traits: "Joueuse, impulsive, très drôle.",
    histoire: "Vasha a perdu au jeu un champ, un cheval et un fiancé, dans cet ordre. Elle garde les voyageurs pour rembourser ses dettes et rejoue tout ce qu'elle gagne. Elle se bat bien, mais elle parie sur l'issue des combats où elle est engagée.",
    veut: "Gagner une fois, une seule, gros.", fierte: "Elle tient sa parole, même au jeu.", secret: "Elle a parié contre son propre client, une fois.",
    replique: "« Je parie deux pièces qu'ils sont trois. … Quatre ? J'ai perdu. »",
    attr: [3, 4, 3, 3], comp: { melee: 2, move: 2, manipulation: 2, marksmanship: 1 }, equip: ["Épée courte", "Petit bouclier", "Armure en cuir clouté"]
  },
  {
    id: "gorm", nom: "Gorm Sang-de-Pierre", peuple: "Orque", age: 33,
    visage: "Peau grise, défenses limées, regard réfléchi.", corps: "Immense mais calme.", tenue: "Armure de plaques dépareillées, grand marteau.",
    traits: "Posé, philosophe, très attaché aux règles qu'il s'est données.",
    histoire: "Gorm a été le second d'un chef orque qui pillait les villages. Un jour, il a refusé de brûler un temple et a dû fuir. Depuis, il cherche à comprendre ce qu'est une vie honnête et a décidé que protéger les faibles en était une.",
    veut: "Être accepté dans un village.", fierte: "Il a changé.", secret: "Il a fait brûler bien d'autres temples avant celui-là.",
    replique: "« La force qui protège vaut mieux que la force qui prend. Je l'ai appris tard. »",
    attr: [5, 2, 3, 2], comp: { melee: 3, might: 2, endurance: 2, insight: 1 }, equip: ["Grand marteau de guerre", "Cotte de mailles"]
  },
  {
    id: "luthe", nom: "Luthe Fine-Lame", peuple: "Elfe", age: 340,
    visage: "Beauté figée, yeux trop clairs pour être humains.", corps: "Grand et immobile, comme une statue.", tenue: "Vêtements anciens et parfaits, épée courbe.",
    traits: "Distant, curieux des mortels, d'une patience infinie.",
    histoire: "Luthe s'est réveillé d'un long sommeil elfique pour découvrir que la Brume était levée. Il trouve les humains fascinants et éphémères, comme des papillons. Il les garde pour les observer, et prend des notes mentales sur leur façon de mourir.",
    veut: "Comprendre pourquoi les humains se pressent tant.", fierte: "Il a vu la fondation de royaumes aujourd'hui oubliés.", secret: "Il a dormi parce qu'il fuyait un crime commis il y a trois siècles.",
    replique: "« Vous vivrez peut-être soixante ans. Ne les gâchez pas sous mon regard. »",
    attr: [3, 5, 4, 1], comp: { melee: 3, insight: 2, lore: 2, scouting: 1 }, equip: ["Cimeterre", "Armure en cuir"]
  },
  {
    id: "hedda", nom: "Hedda Bras-de-Saule", peuple: "Humaine (Ailander)", age: 22,
    visage: "Jeune, visage rond, cicatrice fraîche au sourcil.", corps: "Robuste paysanne.", tenue: "Fourche transformée en lance, gilet de cuir.",
    traits: "Naïve, travailleuse, apprend vite.",
    histoire: "Hedda a défendu sa ferme contre des pillards avec une fourche et a gagné. Le lendemain, elle a vendu la ferme et la vache et s'est mise en route pour devenir une héroïne. Elle n'en sait pas encore beaucoup, mais elle écoute tout ce qu'on lui dit.",
    veut: "Qu'on chante un jour ses exploits.", fierte: "Elle n'a pas fui.", secret: "Les pillards étaient ses cousins.",
    replique: "« Vous croyez que ça compte comme une aventure, ça ? »",
    attr: [4, 3, 3, 3], comp: { melee: 2, endurance: 2, might: 1, survival: 1 }, equip: ["Lance longue", "Armure en cuir"]
  },
  {
    id: "mord", nom: "Mord le Balafré", peuple: "Humain (Aulnois)", age: 44,
    visage: "Une balafre du front au menton, sourire de travers.", corps: "Nerveux, des mains de tueur.", tenue: "Vêtements de qualité volés, rapière de fortune.",
    traits: "Cynique, cupide, mais il ne trahit jamais un contrat signé.",
    histoire: "Mord a été bandit, déserteur, chasseur de primes et encore bandit. Il est honnête sur un point : il vend ses services au plus offrant, mais une fois payé, il va jusqu'au bout. On ne l'aime pas, mais on le respecte.",
    veut: "Assez d'or pour ne plus jamais obéir à personne.", fierte: "Sa parole, la seule chose qu'il n'ait jamais vendue.", secret: "Il y a une prime sur sa tête dans trois villages.",
    replique: "« Je ne suis pas un homme bien. Mais je suis un homme payé. »",
    attr: [3, 4, 3, 2], comp: { melee: 3, stealth: 2, manipulation: 1, insight: 2 }, equip: ["Épée courte", "Dague", "Armure en cuir clouté"]
  },
  {
    id: "anouk", nom: "Anouk Œil-de-Faucon", peuple: "Demi-elfe", age: 35,
    visage: "Yeux perçants, cheveux d'un blond presque blanc.", corps: "Agile et léger.", tenue: "Cape de plumes, arc court et carquois bien garni.",
    traits: "Orgueilleuse, vive, tendre avec les enfants.",
    histoire: "Anouk a été pisteuse pour un seigneur qui chassait autre chose que du gibier. Elle l'a quitté le jour où elle a compris ce qu'il chassait. Elle garde aujourd'hui les voyageurs et les mène par des sentiers que personne d'autre ne connaît.",
    veut: "Que ce seigneur paie.", fierte: "Ses yeux, qui voient un lièvre à cinq cents pas.", secret: "Elle a pisté pour lui des gens qui sont morts.",
    replique: "« Il y a eu du passage ici. Hier soir. Quatre pieds… non, six. »",
    attr: [3, 5, 3, 2], comp: { marksmanship: 3, scouting: 3, survival: 2 }, equip: ["Arc court", "Couteau", "Armure en cuir"]
  },
  {
    id: "kolbjorn", nom: "Kolbjörn", peuple: "Humain (Aslène)", age: 50,
    visage: "Barbe blanche en éventail, nez rougi par le froid.", corps: "Colosse vieillissant.", tenue: "Fourrures, hache à deux mains.",
    traits: "Paternel, têtu, raconte toujours la même histoire.",
    histoire: "Kolbjörn a été chef de guerre d'un petit clan aslène qui n'existe plus. Il a survécu à tout le monde et n'en tire aucune gloire. Il protège les jeunes voyageurs comme il aurait voulu protéger les siens.",
    veut: "Mourir l'arme à la main, de vieillesse si possible.", fierte: "Son clan, même disparu.", secret: "Il a fui la dernière bataille.",
    replique: "« Quand j'avais votre âge… asseyez-vous, c'est long. »",
    attr: [5, 2, 3, 3], comp: { melee: 3, endurance: 2, survival: 2, might: 1 }, equip: ["Hache à deux mains", "Fourrure"]
  },
  {
    id: "seyna", nom: "Seyna Pas-de-Velours", peuple: "Humaine (Ailander)", age: 28,
    visage: "Visage quelconque qu'on oublie aussitôt.", corps: "Moyenne en tout.", tenue: "Vêtements gris, deux dagues cachées.",
    traits: "Discrète, prudente, ne fait confiance à personne.",
    histoire: "Seyna a été la garde d'un marchand qui a été assassiné quand même. Elle a tué l'assassin, puis compris qu'il avait été payé par la femme du marchand. Depuis, elle surveille autant ses clients que leurs ennemis.",
    veut: "Ne plus jamais être prise par surprise.", fierte: "Personne ne la remarque.", secret: "Elle a gardé l'argent de l'assassin.",
    replique: "« Ne mangez pas ça. Laissez-moi goûter d'abord. »",
    attr: [3, 4, 4, 2], comp: { melee: 2, stealth: 3, insight: 3 }, equip: ["Dague", "Dague", "Armure en cuir"]
  },
  {
    id: "brok", nom: "Brok Pied-Bot", peuple: "Nain", age: 140,
    visage: "Barbe jusqu'à la ceinture, sourcils broussailleux.", corps: "Boite d'un pied mais avance sans relâche.", tenue: "Arbalète lourde, carreaux gravés de runes.",
    traits: "Grincheux, méticuleux, fidèle à sa parole jusqu'au ridicule.",
    histoire: "Brok a été ingénieur dans les mines naines. Un éboulement lui a pris un pied et ses frères. Il a quitté les profondeurs pour ne plus jamais être enterré vivant et préfère désormais les grands espaces, même s'il s'en plaint.",
    veut: "Construire une machine qui empêche les éboulements.", fierte: "Ses carreaux, qu'il fabrique lui-même.", secret: "L'éboulement était peut-être de sa faute.",
    replique: "« Ce pont tiendra. Pas longtemps, mais il tiendra. Passez vite. »",
    attr: [4, 3, 4, 2], comp: { marksmanship: 3, crafting: 3, endurance: 1 }, equip: ["Arbalète lourde", "Hachette", "Armure en cuir clouté"]
  },
  {
    id: "liv", nom: "Liv aux Mains Douces", peuple: "Humaine (Ailander)", age: 37,
    visage: "Regard bienveillant, cicatrices aux avant-bras.", corps: "Solide.", tenue: "Tablier de cuir, sacoche de bandages, masse d'armes.",
    traits: "Douce, décidée, intraitable sur l'hygiène.",
    histoire: "Liv a soigné les blessés d'une guerre entre deux villages, puis a pris une arme parce qu'on tuait ses patients pendant qu'elle les soignait. Elle garde et soigne, dans cet ordre ou dans l'autre selon le jour.",
    veut: "Un endroit où soigner sans avoir à se battre.", fierte: "Elle a sauvé plus de vies qu'elle n'en a pris.", secret: "Elle a laissé mourir un blessé qu'elle connaissait trop bien.",
    replique: "« Saignez moins, s'il vous plaît, je viens de laver mes bandages. »",
    attr: [3, 3, 3, 4], comp: { healing: 3, melee: 2, insight: 2 }, equip: ["Masse d'armes", "Petit bouclier", "Bandages", "Armure en cuir"]
  },
  {
    id: "ulf", nom: "Ulf le Long", peuple: "Humain (Aslène)", age: 31,
    visage: "Visage en lame de couteau, cheveux filasses.", corps: "Plus de deux mètres, tout en os.", tenue: "Longue pique, cotte de mailles trop courte.",
    traits: "Lent à parler, rapide à frapper, aime la pêche.",
    histoire: "Ulf a été soldat dans une garnison qui a été oubliée par son seigneur. Ils ont attendu la relève pendant deux ans, puis sont rentrés chacun chez soi. Ulf n'avait plus de chez soi, alors il garde les autres sur le chemin du leur.",
    veut: "Un lac poissonneux et du calme.", fierte: "La garnison n'a jamais été prise.", secret: "Il a déserté le premier, pas le dernier.",
    replique: "« … Oui. »",
    attr: [4, 3, 3, 2], comp: { melee: 3, endurance: 2, survival: 2 }, equip: ["Pique", "Cotte de mailles"]
  },
  {
    id: "fennick", nom: "Fennick le Rouillé", peuple: "Humain (Ailander)", age: 39,
    visage: "Tonsure mal entretenue, regard de fanatique repenti.", corps: "Ventre rond, poigne solide.", tenue: "Robe brune élimée, fléau d'armes.",
    traits: "Hanté, sincère, cherche le pardon en protégeant les autres.",
    histoire: "Fennick a été Frère du Rouillé. Il a dénoncé, jugé et brûlé. Un jour, il a douté, et ce doute ne l'a plus quitté. Il a quitté l'ordre et garde désormais les voyageurs, y compris ceux qu'il aurait autrefois envoyés au bûcher.",
    veut: "Se pardonner.", fierte: "Il a eu le courage de partir.", secret: "Ses anciens frères le cherchent pour le juger.",
    replique: "« J'ai servi un dieu de rouille. Je préfère maintenant servir quelqu'un qui saigne. »",
    attr: [4, 3, 3, 3], comp: { melee: 2, lore: 2, manipulation: 2, endurance: 1 }, equip: ["Fléau d'armes", "Armure en cuir"]
  }
];

/** Prompt pour générer le portrait d'un garde avec un outil d'images (ChatGPT, etc.). */
export function promptImage(g) {
  return [
    `Portrait d'un personnage de jeu de rôle dark fantasy, pour une fiche de PNJ.`,
    `Qui : ${g.nom}, ${g.peuple.toLowerCase()}, ${g.age} ans, garde du corps qu'on engage sur les routes.`,
    `Visage : ${g.visage}`,
    `Silhouette : ${g.corps}`,
    `Tenue et armes : ${g.tenue} Équipement : ${g.equip.join(", ").toLowerCase()}.`,
    `Caractère à faire sentir dans l'expression et la posture : ${g.traits}`,
    `Style : illustration peinte à la main, encre et aquarelle aux couleurs sourdes, ambiance nordique médiévale rude et mélancolique, comme dans un vieux manuel de jeu de rôle ; lumière naturelle douce ; pas de texte, pas de logo, pas de cadre.`,
    `Cadrage : portrait vertical en buste (format 2:3), le personnage regarde vers le spectateur, fond de parchemin clair légèrement taché.`
  ].join("\n");
}
