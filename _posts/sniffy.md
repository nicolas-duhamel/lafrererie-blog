---
title: "Sniffy"
excerpt: "Web, downunder 2024"
coverImage: "/assets/blog/hello-world/cover.jpg"
date: "2024-07-08"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "/assets/blog/hello-world/cover.jpg"
---

[Source du challenge](https://github.com/DownUnderCTF/Challenges_2024_Public/tree/main/web/sniffy/src)

Après une rapide review de code, on remarque que notre input est passé à la fonction readfile dans audio.php. On aurait potentiellement la possibilité de lire des fichiers arbitraires, cependant certains check sont fait avant pour ne pas lire n'importe quoi. En particulier, il faut que le fichier est un mime type qui commence par "audio". 

La première chose d'inhabituelle est l'emplacement du flag. Le flag est stocké dans la session et on a la possibilité d'écrire dans la session à travers le paramètre "theme". Les sessions php sont stockés dans /tmp/sess_<PHPSESSID> et avec la remarque de l'on a fait précédemment, tout semble pointer vers le fait qu'il faut lire le fichier session grâce à audio.php.

Il ne nous reste plus qu'à comprendre comment bypass le check sur le mime type. La doc php sur la fonction mime_content_type, nous apprend que le mime type est déterminer à partir d'un fichier de configuration mime.types. Je suis tombé sur ce fichier [https://github.com/waviq/PHP/blob/master/Laravel-Orang1/public/filemanager/connectors/php/plugins/rsc/share/magic.mime](https://github.com/waviq/PHP/blob/master/Laravel-Orang1/public/filemanager/connectors/php/plugins/rsc/share/magic.mime) qui doit être à peu de chose prêt une copie du fichier dans docker. 

Le fichier commence par nous expliquer la syntaxe, chaque ligne commence par un numéro qui est l'indice à laquelle la fonction commence à chercher une suite de bytes, la suite de bytes en question et le mime type de retour. Dans le fichier, on voit des choses très classique, avec des mime type qui lisent les premiers bytes. Puis on tombe sur cette ligne,
```1080	string	CD81		audio/x-mod```

Qui est très intéressante puisqu'il suffit d'écrire un "CD81" au bon endroit en plein milieu du fichier pour que notre fichier soit reconnu en tant que audio. Sachant que le paramètre theme nous permet d'écrire dans les fichiers de sessions, en connaissant la taille du flag, on peut avoir le padding exact pour écrire "CD81" à l'indice 1080. En local, cela fonctionne bien.

Sur le serveur, ne connaissant pas le taille du flag, il nous faire un léger bruteforce.

```python
import requests

# we need to put CD81 at index 1080
padding = 1080-30 # 30 is len of extra data

for len_flag in range(40,60):
    x = "A"*(padding-len_flag)
    r = requests.get(f"https://web-sniffy-d9920bbcf9df.2024.ductf.dev/index.php?theme={x}CD81")
    sessid = r.cookies["PHPSESSID"]
    r = requests.get(f"https://web-sniffy-d9920bbcf9df.2024.ductf.dev/audio.php?f=../../../../tmp/sess_{sessid}")
    print(r.status_code, r.text)
    if r.status_code != 403:
        break
```
