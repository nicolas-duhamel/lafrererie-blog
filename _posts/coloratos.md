---
title: "Coloratops"
excerpt: "Reverse, FCSC 2025"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2025-04-24"
author:
  name: Nainnain
  picture: "/assets/blog/authors/nainnain.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---

Voici un crackme plein de couleurs avec des allures old school.

(ATTENTION Write up très verbeux)
## Execution


On nous donne un fichier binaire elf. 
A l'execution, une fenetres SDL s'ouvre avec une input de texte qui accepte les caracteres hexa ainsi que FCSC{}. On note que les caractères changent de couleurs de façon plus ou moins aléatoire en fonction du caractere suivant (en tout cas une fois le caractere suivant défini le début reste fixe).

![](https://i.imgur.com/HFq3stR.jpeg)

On note aussi un timer en haut à gauche. Lorsque le timer arrive à zero. WE LOSE!
![](https://i.imgur.com/52ZP6hE.jpeg)

## Decompilation
On décompile dans Ghidra. Sans grande surprise la fonction main contient la boucle SDL principal.
```c
    iVar2 = SDL_Init(0x20);
    //puis plus loin
    DAT_5555557bf1e0 =
    SDL_CreateWindow("FCSC 2025 - Coloratops",0x2fff0000,0x2fff0000,0x4b0,0x2ae,0x14);
    // encore plus loin
    DAT_5555557bf370 = SDL_GetTicks();
    while (local_24 != 0) {
    // boucle principal
    }

```

je passe outre des bouts de code d'initialisation de variable sur lesquels on reviendra plus tard. Mais intéressons nous à la boucle principal.  

### Boucle d'input
On commence tout de suite par un while sur un SDL_PollEvent, je vous la met dans toute sa splendeur (avec certaines de mes annotations).

```c
while (iVar2 = SDL_PollEvent(local_d8), iVar2 != 0) {
if (local_d8[0] == 0x100) {
    /* KEY DOWN */
    local_24 = 0;
}
else if (local_d8[0] == 0x303) {
    i_compchar = 0;
    while (sVar6 = strlen(user_input), i_compchar < sVar6) {
    if (((DAT_0036b360_LEN < 0x40) &&
        (pcVar5 = strchr("FCSC{}abcdef0123456789",(int)user_input[i_compchar]),
        pcVar5 != (char *)0x0)) && (DAT_0036b360_LEN < 0xff)) {
        pcVar5 = &DAT_0036b260_input + DAT_0036b360_LEN;
        DAT_0036b360_LEN = DAT_0036b360_LEN + 1;
        *pcVar5 = user_input[i_compchar];
        (&DAT_0036b260_input)[DAT_0036b360_LEN] = 0;
    }
    i_compchar = i_compchar + 1;
    }
}
else if (local_d8[0] == 0x300) {
    /* SDL_TEXTINPUT */
    if (((local_c4 == 8) && ((local_c0 & 0xc0) == 0)) && (DAT_0036b360_LEN != 0)) {
    puVar1 = &DAT_5555557bf25f + DAT_0036b360_LEN;
    DAT_0036b360_LEN = DAT_0036b360_LEN - 1;
    *puVar1 = 0;
    }
    else if ((local_c4 == 0x71) && ((local_c0 & 0xc0) != 0)) {
    local_24 = 0;
    }
    else if ((local_c4 == 99) && ((local_c0 & 0xc0) != 0)) {
    memset(&DAT_0036b260_input,0,0x100);
    DAT_0036b360_LEN = 0;
    }
    else if ((local_c4 == 8) && ((local_c0 & 0xc0) != 0)) {
    memset(&DAT_0036b260_input,0,0x100);
    DAT_0036b360_LEN = 0;
    }
    else if (local_c4 == 0x1b) {
    memset(&DAT_0036b260_input,0,0x100);
    DAT_0036b360_LEN = 0;
    }
    else if (local_c4 == 0x20) {
    DAT_5555557bf374_sound = DAT_5555557bf374_sound ^ 1;
    SDL_PauseAudioDevice(DAT_5555557bf210,DAT_5555557bf374_sound == 0);
    }
    else if (((local_c4 == 0x76) && ((local_c0 & 0xc0) != 0)) &&
            (user_input2 = (char *)SDL_GetClipboardText(), user_input2 != (char *)0x0)
            ) {
    i2 = 0;
    while (sVar6 = strlen(user_input2), i2 < sVar6) {
        if (((DAT_0036b360_LEN < 0x40) &&
            (pcVar5 = strchr("FCSC{}abcdef0123456789",(int)user_input2[i2]),
            pcVar5 != (char *)0x0)) && (DAT_0036b360_LEN < 0xff)) {
        pcVar5 = &DAT_0036b260_input + DAT_0036b360_LEN;
        DAT_0036b360_LEN = DAT_0036b360_LEN + 1;
        *pcVar5 = user_input2[i2];
        (&DAT_0036b260_input)[DAT_0036b360_LEN] = 0;
        }
        i2 = i2 + 1;
    }
    SDL_free(user_input2);
    }
}
}
```

On peut regarder la doc https://wiki.libsdl.org/SDL2/SDL_PollEvent . Ca prend en parametre un SDL_event qui va trigger en fonction des events. Donc typiquement quand on press une touche.


```c
while (event):
    switch(event):
        case  0x100:
        //
        case 0x303:
        //
        case 0x300:
        //

```
On va pas tout décortiquer mais un truc qui capte notre attention c'est le check:

```c
if (((DAT_0036b360_LEN < 0x40) &&
    (pcVar5 = strchr("FCSC{}abcdef0123456789",(int)user_input2[i2]),
    pcVar5 != (char *)0x0)) && (DAT_0036b360_LEN < 0xff))
```
Qui apparait à deux endroits différents. Clairement cela vérifie que la variable que j'ai rename "user_input2" ne contient que les char contenu dans "FCSC{}abcdef0123456789", ceci pour les 64 premier char, plus une conditions sur la longueur.  
C'est cohérent avec le format des flags "FCSC{chaine hexa}".  

Donc globalement cette boucle d'event ne sert pour nous qu'a écrire notre flag.

### Flag Checking
Ensuite nous avons ce bout de code
```c

DAT_0036b368_checkFlag =
    (uint)(((((DAT_0036b260_input == 'F' && DAT_5555557bf261 == 'C') &&
            DAT_5555557bf262 == 'S') && DAT_5555557bf263 == 'C') &&
            DAT_5555557bf264 == '{') && (&DAT_5555557bf25f)[DAT_0036b360_LEN] == '}');
uVar3 = FUN_55555555dc77(DAT_0036b1e8_renderer);
DAT_0036b368_checkFlag = uVar3 & DAT_0036b368_checkFlag;
```
J'ai rename la variable en checkFlag. Clairement nous avons un check sur notre input. Il doit commencer par "FCSC{" et finir par "}.  
Puis nous avons un call à cette fonction FUN_55555555dc77, et on va AND avec le résultat des chekcs précédents.  
On peut donc supposer que FUN_55555555dc77 est notre flag checker. Problème? Il prend comme unique variable le global renderer, donc comment pouvons nous suivre notre input. Il va falloir regarder plus en détails car ce code est plein de variable global.  

Avant cela finissons de regarder la boucle SDL pour avoir une vision globale (nous reviendrons sur FUN_55555555dc77 par la suite)

### Rendu des images
Nous allons avoir plusieurs "rendu" du SDL en fonction des conditions.

Un petit mot sur le rendu SDL, enfin ce que j'en ai compris avec ce chall.   
Nous pouvons calculer des surfaces, puis les convertires en texture.  
On peut ajouter ces textures via SDL_RenderCopy (avec des parametres qui permettent d'extraire un rectangle de la surface et de la coler à un endroit précis)  
Finalement on va afficher les render via 
```c
SDL_RenderPresent(DAT_0036b1e8_renderer);
```
#### Rendu du texte
Juste après notre flag checker nous avons ce petit bout de code
```c

if (DAT_0036b36c == 0) {
    unaff_RBX = (ulong)((uint)CONCAT62((int6)(unaff_RBX >> 0x10),0xffff) | 0xffff0000);
        /* 260=our input
            */
    local_40 = TTF_RenderText_Blended(DAT_5555557bf208,&DAT_0036b260_input,unaff_RBX);
    if (local_40 != 0) {
        local_20_TEXT = SDL_CreateTextureFromSurface(DAT_0036b1e8_renderer,local_40);
        local_90 = *(undefined4 *)(local_40 + 0x10);
        local_8c = *(undefined4 *)(local_40 + 0x14);
        SDL_FreeSurface(local_40);
    }
    }
```
D'abord vendons la meche rapidement sur DAT_0036b36c. C'est une variable qui vaut zero au début du programme. Et qui est modifié à un endroit très précis.

```c
iVar2 = SDL_GetTicks();
time_elapsed = (uint)(iVar2 - DAT_5555557bf370) / 1000;
if ((0x3b < time_elapsed) && (DAT_0036b36c_timeout == 0)) {
DAT_0036b36c_timeout = 1;
}
```
J'ai rename les variable. On peut décrypter facilement ce passage.  iVar2 est le ticks donc le temps écoulé, on converti en secondes en divisant par mille. Puis la comparaison avec 0x3b=59. Donc quand le temps depuis le début dépasse 59s DAT_0036b36c_timeout est set à 1. D'où le rename.  

On peut donc revenir à notre "if (DAT_0036b36c == 0){...}" du dessus, c'est simplement "si le temps n'est pas écoulé". A l'interieur cela défini une texture SDL dans local_20_TEXT, qui contient notre texte.

Point important pour la suite la "surface SDL" est crée par la fonction 
```c
TTF_RenderText_Blended(DAT_5555557bf208,&DAT_0036b260_input,unaff_RBX);
```
https://wiki.libsdl.org/SDL3_ttf/TTF_RenderText_Blended  
La documentation nous donne les arguments, donc la fonte, le texte, qui sont les plus importants.  
SDL_Surface * TTF_RenderText_Blended(TTF_Font *font, const char *text, size_t length, SDL_Color fg);  
TTF_Font * 	font 	the font to render with.  
const char * 	text 	text to render, in UTF-8 encoding.  
size_t 	length 	the length of the text, in bytes, or 0 for null terminated text.  
SDL_Color 	fg 	the foreground color for the text.  

Remarque: on a simplement calculé une texture qui pourra être copié sur le canevas.
#### Clean 
Par la suite on a ces deux lignes qui clean le canvas
```c
SDL_SetRenderDrawColor(DAT_0036b1e8_renderer,0,0,0,0xff);
SDL_RenderClear(DAT_0036b1e8_renderer);
```
Puis le bout de code qui check le temps arrive apres mais je le remet pas

#### Rendu win/lose
On arrive au plus important pour nous.
```c
if (DAT_0036b36c_timeout == 0) {
if (DAT_0036b368_checkFlag == 0) {
    /* main image? */
    SDL_RenderCopy(DAT_0036b1e8_renderer,DAT_5555557bf1f0,0,&DAT_55555555f410);
}
else {
    /* TIME GOOD checkChar GOOD */
    FUN_55555555de2e(&DAT_0036b260_input,DAT_0036b360_LEN,local_138);
    if (DAT_5555557bf200 == 0) {
    FUN_55555555d82a(DAT_0036b1e8_renderer,&DAT_5555557bf200,local_138);
    }
    SDL_RenderCopy(DAT_0036b1e8_renderer,DAT_5555557bf200,0,&DAT_55555555f410);
}
}
else {
    /* TIME OUT        Lost image? */
SDL_RenderCopy(DAT_0036b1e8_renderer,DAT_5555557bf1f8,0,&DAT_55555555f410);
}
```

Ici j'ai perdu du temps... en effet la structure parait simple:
- si le temps est bon mais le flag est mauvais on affiche la main image
- si le temps est bon et le flag est bon on fait des appels a FUN_55555555de2e et FUN_55555555d82a. Puis on rend une image qui semble etre dans DAT_5555557bf200.
- si le temps est écoulé on rend l'image de la lose

Je ne vais pas rentrer plus dans les functions appellé mais quand on rentre dedans on voit des appels a SHA et AES. Globalement on peut décortiquer 

```
key = sha(input)
image = aes_decrypt(data,key)
```
Donc pour faire simple, l'image de la WIN, est encrypté, et pour la décrypter il nous faudra le hash du flag... J'ai passé beaucoup trop de temps la dessus en me demandant si il n'y avait pas un truc.

#### Rendu Icone et temps restant et 
Les rendus suivant sont plus anecdotiques, je les mets pour conclure la boucle.


```c
/* ICone on/off */
if (DAT_5555557bf374_sound == 0) {
    SDL_RenderCopy(DAT_0036b1e8_renderer,DAT_5555557bf250,0,&DAT_55555555f400);
    }
else {
    SDL_RenderCopy(DAT_0036b1e8_renderer,DAT_5555557bf248,0,&DAT_55555555f400);
    }
if (DAT_0036b36c_timeout == 0) {
    snprintf(time_left,8,"%2d ",(ulong)(0x3c - time_elapsed));
    text_time_left = TTF_RenderText_Blended(DAT_5555557bf208,time_left);
    if (text_time_left == 0) break;
    texture_time_left =SDL_CreateTextureFromSurface(DAT_0036b1e8_renderer,text_time_left);
    SDL_FreeSurface(text_time_left);
    if (texture_time_left == 0) break;
    local_f8 = 0x5a;
    local_f4 = 0xf;
    local_f0 = *(undefined4 *)(text_time_left + 0x10);
    local_ec = *(undefined4 *)(text_time_left + 0x14);
    /* time left */
    SDL_RenderCopy(DAT_0036b1e8_renderer,texture_time_left,0,&local_f8);
    SDL_DestroyTexture(texture_time_left);
    }
if ((local_20_TEXT != 0) && (DAT_0036b36c_timeout == 0)) {
    /* AFFICHE LE TEXT  */
    SDL_RenderCopy(DAT_0036b1e8_renderer,local_20_TEXT,0,&local_98);
    }
/* render what we need
    */
SDL_RenderPresent(DAT_0036b1e8_renderer);
```

- Premier if pour afficher l'icone son on/off
- Second if, si le temps n'est pas écoulé, affiche le temps restant
- Troisièeme if , si local_20_TEXT (la texture de notre texte défini avant) et temps non écoulé alors ajoute le temps
- Puis finalement Affiche le tout


### Premiere conclusion
Après cette première analyse un peu trop poussé on a déja bien débroussailler. On connait la structure globale de la boucle:
- Gere les event
- Check le flag
- Genere les rendus

Nous allons donc passer maintenant à la partie intéressante
## Flag checker
On se souvient de cet appel
```c
uVar3 = FUN_55555555dc77(DAT_0036b1e8_renderer);
```
Allons donc voir cette fonction

```c
byte FUN_55555555dc77(void)
{
   // [... init var enlevé]
  memset(local_88,0xff,0x40);
  local_i = 0;
  while( true ) {
    //partie 1
    if (0x3f < local_i) {
      bVar1 = 1;
      for (i2 = 0; i2 < 0x40; i2 = i2 + 1) {
        bVar1 = bVar1 & (uint)local_88[i2] == *(uint *)(&DAT_55555555f420 + i2 * 4);
      }
      return bVar1;
    }
    //partie 2
    local_2c = local_i * 0x11 + 0x3c;
    local_30 = 0x25f;
    local_38 = SDL_CreateRGBSurfaceWithFormat(0,0x10,0x20,0x20,0x16462004);
    if (local_38 == 0) break;
    local_98 = local_2c;
    local_94 = local_30;
    local_90 = 0x10;
    local_8c = 0x20;
    SDL_RenderReadPixels(DAT_0036b1e8_renderer,&local_98,**(undefined4 **)(local_38 + 8),*(undefined8 *)(local_38 + 0x20),*(undefined4 *)(local_38 + 0x18));

    //partie 3
    local_40 = *(long *)(local_38 + 0x20);
    local_d = 0xff;
    for (i = 0; i < 0x20; i = i + 1) {
      for (j = 0; j < 0x10; j = j + 1) {
        local_44 = *(undefined4 *)(local_40 + (long)(j + i * 0x10) * 4);
        if (local_d == 0xff) {
          local_d = FUN_55555555dc32(local_44);
        }
      }
    }
    local_88[local_i] = local_d;
    SDL_FreeSurface(local_38);
    local_i = local_i + 1;
  }
  return 0;
}
```

Analysons cette fonction.  
En préambule rappelons nous que pour que le flag soit validé il faudrait que la fonction retourne 1.

La fonction se sépare en trois partie:
- Quand la boucle atteint 0x40 on a une deuxieme boucle qui va comparer local_88 à une valeur hard codé.
- Puis elle va écrire des pixels SDL_RenderReadPixels depuis notre renderer principal.
- Enfin on va double boucler sur le tableau local_40 et checker FUN_55555555dc32(local_44)

D'abord remarquons que local_40 est un tableau 0x10 X 0x20 qui provient des pixels lus. Ensuite on va checker un par un la valeur de ces pixels avec la fonction FUN_55555555dc32. En gros la boucle fait ceci
```c
for (i=0; i<0x10){
    for(j=0;j<0x10){
        if local_d != 0xff
            local_d = FUN_55555555dc32(pixels[i][j]);
    }
}
```

Allons donc regarder ce que fait FUN_55555555dc32:
```c
ulong FUN_55555555dc32(int param_1)
{
  ulong i;
  i = 0;
  while( true ) {
    if (9 < i) {
      return 0xffffffff;
    }
    if (param_1 == *(int *)(&DAT_55555555f520 + i * 4)) break;
    i = i + 1;
  }
  return i;
}
```
Elle compare la valeur du pixel contre 10 valeur pré-définie, si aucunne n'est trouvé retourne 0xff.

Il n'est pas tres compliqué de retrouver ces valeurs dans ghidra:

![](https://i.imgur.com/OyZjf0e.png)


Etant donné que ce sont des pixels on peut voir qu'ils sont du format 0xXXXXXXFF. Ce sont donc des couleurs qui représente les couleurs de nos characteres (on peut le vérifier dans n'importe quel outils de RGB).

Ainsi notre flag checker fait ceci:
- Charge les valeurs des pixels d'un rectangle de 32x64.
- Cherche un pixel dans une liste de 10 couleurs.
- Affecte l'id de la couleur a local_88
- Compare local_88 avec une liste d'id.

Pour être sur j'ai fait des dumps dans GBD des valeur des pixels. Pour chaque i cela correspond bien à un charactere de notre flag.  

Ainsi on doit extraire:
- la liste des couleurs 
- la liste des ids.

Et le flag pour etre validé doit correspondre à cette liste de couleur.

### Extraction des données

L'outils de votre choix marche. Vous pouvez les lire dans ghidra à la main, faire un dd, charger dans python et extraire.

Testons avec python.
```python
with open("coloratops","rb") as f:
    data = f.read()
#we find those value in ghidra
colors = data[0xb520:0xb548]
colors = [int.from_bytes(colors[i:i+4],"little") for i in range(0,len(colors),4)]
#we find those value in ghidra

target = data[0xb420:0xb520]
target = [int.from_bytes(target[i:i+4],"little") for i in range(0,len(target),4)]

"""
target:
[0, 0, 0, 0, 0, 9, 6, 3, 6, 7, 6, 5, 7, 4, 6, 2, 7, 7, 2, 9, 6, 7, 7, 5, 1, 6, 2, 8, 4, 3, 6, 8, 5, 4, 9, 2, 9, 1, 2, 7, 1, 1, 4, 4, 2, 5, 4, 8, 6, 1, 6, 7, 4, 9, 1, 9, 5, 4, 3, 9, 9, 9, 3, 0]

colors:
['0xffffffff',
 '0xff2f2d80',
 '0xff5e59ff',
 '0xff4c92ff',
 '0xff43aeff',
 '0xff3acaff',
 '0xff26c98a',
 '0xff75a652',
 '0xff934c6a',
 '0xffc48219']
"""
def int_to_rgb(color_int):
    r = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    b = color_int & 0xFF
    return (r / 255, g / 255, b / 255)
rgb_color_palette = [int_to_rgb(colors[i]) for i in range(10)]
rgb_colors_target = [int_to_rgb(colors[i]) for i in target]
plt.imshow(img_target, aspect='auto')

```
We can display them :

![](https://i.imgur.com/G1nfteC.png)
![](https://i.imgur.com/h9SCSMW.png)

On remarque que les 5 premiers char et le dernier sont blancs, normal c'est les char spéciaux du flag "FCSC{}" .

## Résoudre le flag

Une fois ici on peut etre tenté par deux approches, voir même trois:
- brute force à la main
- brute force avec gdb
- recherche l'algo des couleurs

Après quelques essais on se rend vite compte que le faire à la main sera très relou.
En effet la couleur d'un char est déterminé quand on écrit le suivant. Il faut donc beaucoup d'essaie en plus on est limité par le temps.

On pourrait assez facilement modifier le programme pour ne plus être limité par le temps, mais cette solution semble de moins en moins faisable.

![](https://i.imgur.com/Cfw0ihp.png)

### Recherche de l'algo

Nous arrivons ici à la partie la plus maligne de ce chalenge. Quand on essaie de chercher ou les couleurs des characteres sont définies ont se heurte à un mur! C'est un vraie mystère et probablement ici que la plupart pourront abandonner.  

Déja on peut se convaincre que une fois les charactères tracé par l'appel à TTF les couleurs sont déja choisies. En effet il est assez clair qu'il y à zero attribution de couleur par la suite.

Que fait cet appel?
```c
TTF_RenderText_Blended(DAT_5555557bf208,&DAT_0036b260_input,unaff_RBX)
```
https://wiki.libsdl.org/SDL3_ttf/TTF_RenderText_Blended

SDL_Surface * TTF_RenderText_Blended(TTF_Font *font, const char *text, size_t length, SDL_Color fg);

Hmm ainsi nous avons le texte, la taille et la couleur de fond. Mais aussi la font dans ce parametre globale.

Rappelons nous de ces fonctions d'initialisation des variables que nous avons passé en coup de vent au début. Un petit clic droit dans Ghidra sur find référence nous amene dans cette fonction:


```c

undefined8 FUN_55555555dbc6(long *param_1)

{
  long lVar1;
  undefined8 uVar2;
  
  lVar1 = SDL_RWFromConstMem(&DAT_555555562220,DAT_555555693230);
  if (lVar1 == 0) {
    uVar2 = 1;
  }
  else {
    lVar1 = TTF_OpenFontRW(lVar1,1,0x1c);
    *param_1 = lVar1;
    if (*param_1 == 0) {
      uVar2 = 1;
    }
    else {
      uVar2 = 0;
    }
  }
  return uVar2;
}
```
On savait déja que DAT_5555557bf208 était une font, mais c'est une font qui ne vient pas du systeme. Elle est chargé directement depuis la mémoire via:
SDL_RWops* SDL_RWFromConstMem(const void *mem,
                              int size);
Ce n'est pas un comportement  normal! En général les fontes sont classiques. Et pour qui s'est déja intéressé au sujet, certains comportements obscure peuvent s'y cacher.

### Dump de la font

On va voir dans ghidra
![](https://i.imgur.com/Qd1wfqq.png)

On voit aussi la taille dans DAT_555555693230 = 0x131010. On reprend notre python


```python
#0xd220 depuis ghidra
data_font = data[0xd220:0xd220+0x131010]
with open("font.ttf","wb") as f:
    f.write(data_font)
```
```
└─$ file font.ttf
font.ttf: TrueType Font data, 13 tables, 1st "COLR", 6 names, Microsoft, language 0x409, type 1 string, FCSCRegular13.37 (FCSC);NONE;FCSC-RegularFCSC RegularVersion 13.37 (FCSC)FCSC-Regular\002
```

### Analyse de la font
Quelques recherches sur internet nous donne les outils pour  analyser la font:
```
ttx font.ttf
```

On peut aussi aller sur des sites come https://fontdrop.info et drop la font.

![](https://i.imgur.com/46M19D8.png)

Donc l'algo des couleurs est INCLUS dans la font elle même, (chapeau bas au créateur du challenge).

Maintenant il s'agit de comprendre cet algo. Le font.ttx est un fichier énorme avec beaucoup de données.

```
//Début de font.ttx chaque charactere est décliné sous 10 versions de couleur différentes. Ainsi c de couleur blanche sera "c" mais c de la couleur 1 sera "c.c1".
<COLR>
    <version value="0"/>
    <ColorGlyph name="C">
      <layer colorID="0" name="C"/>
    </ColorGlyph>
    <ColorGlyph name="C.c1">
      <layer colorID="1" name="C.c1"/>
    </ColorGlyph>
    <ColorGlyph name="C.c2">
      <layer colorID="2" name="C.c2"/>
    </ColorGlyph>
    <ColorGlyph name="C.c3">
      <layer colorID="3" name="C.c3"/>
    </ColorGlyph>
// la palette dec couleur
  <CPAL>
    <version value="0"/>
    <numPaletteEntries value="10"/>
    <palette index="0">
      <color index="0" value="#FFFFFFFF"/>
      <color index="1" value="#802D2FFF"/>
      <color index="2" value="#FF595EFF"/>
      <color index="3" value="#FF924CFF"/>
      <color index="4" value="#FFAE43FF"/>
      <color index="5" value="#FFCA3AFF"/>
      <color index="6" value="#8AC926FF"/>
      <color index="7" value="#52A675FF"/>
      <color index="8" value="#6A4C93FF"/>
      <color index="9" value="#1982C4FF"/>
    </palette>
  </CPAL>

//
```
Bon ici on va discuter avec chatGPT qui nous explique qu'il existe des règles de substitution. Voir ici https://learn.microsoft.com/en-us/typography/opentype/otspec170/gsub .

Le fichier xml dumpé par ttx n'est pas vraiment lisible par les humains. Mais à force de persévérance on comprend un peu comment cela fonctionne:
- Il existe une liste de règle de substitution
- On applique ces règles une à une à chaque caractère
- Ces règles peuvent dépendre des characteres précédents ou suivant.

En gros nous avont un finite state automata.

### Analyse d'une règle
Nous avons 7851 règle. On va en regarder une pour essayer de comprendre un peu ce qui se passe.  
Déja chaque règle est incluse dans une balise lookup index avec un id.

```
<Lookup index="0">
[...]
</Lookup>
```

Nous avons quelques infos plus moins utiles par exemple le type de règles. Ici de part la doc microsoft on voit que la règle 6 c'est:  
Chaining Context (format 6.1 6.2 6.3) 	Replace one or more glyphs in chained context
```

    <ExtensionLookupType value="6"/>
    <ChainContextSubst Format="2">
    <Coverage>
        <Glyph value="b"/>
        <Glyph value="b.c1"/>
        <Glyph value="b.c2"/>
        <Glyph value="b.c3"/>
        <Glyph value="b.c4"/>
        <Glyph value="b.c5"/>
        <Glyph value="b.c6"/>
        <Glyph value="b.c7"/>
        <Glyph value="b.c8"/>
        <Glyph value="b.c9"/>
    </Coverage>
```

On à le coverage qui correspond à quel caractère sera potentiellement substitué. Donc ici si on est sur un b la règle peut peut être s'appliquer.  

Ensuite des définitions de classes pour regrouper les glyphes
```
<BacktrackClassDef>
</BacktrackClassDef>
<InputClassDef>
    <ClassDef glyph="b" class="1"/>
    <ClassDef glyph="b.c1" class="1"/>
    <ClassDef glyph="b.c2" class="1"/>
    <ClassDef glyph="b.c3" class="1"/>
    <ClassDef glyph="b.c4" class="1"/>
    <ClassDef glyph="b.c5" class="1"/>
    <ClassDef glyph="b.c6" class="1"/>
    <ClassDef glyph="b.c7" class="1"/>
    <ClassDef glyph="b.c8" class="1"/>
    <ClassDef glyph="b.c9" class="1"/>
</InputClassDef>
<LookAheadClassDef>
    <ClassDef glyph="a" class="1"/>
    <ClassDef glyph="a.c1" class="1"/>
    <ClassDef glyph="a.c2" class="1"/>
    <ClassDef glyph="a.c3" class="1"/>
    <ClassDef glyph="a.c4" class="1"/>
    <ClassDef glyph="a.c5" class="1"/>
    <ClassDef glyph="a.c6" class="1"/>
    <ClassDef glyph="a.c7" class="1"/>
    <ClassDef glyph="a.c8" class="1"/>
    <ClassDef glyph="a.c9" class="1"/>
    <ClassDef glyph="b" class="2"/>
    [... tous les autres suivent avec a= class1 b=class2 etc]
```
Dans ce cas il n'y aura pas de "backtrack" dont on regardera pas le caractere avant. On sera bien sur "b" et le caractere suivant appartiendra à une classe commune (les "a" avec les "a", les "c" avec les ""c etc...).  
``
<ChainSubClassRule index="0">
<!-- BacktrackGlyphCount=0 -->
<!-- InputGlyphCount=1 -->
<!-- LookAheadGlyphCount=1 -->
<LookAhead index="0" value="1"/>
<!-- SubstCount=1 -->
<SubstLookupRecord index="0">
    <SequenceIndex value="0"/>
    <LookupListIndex value="10"/>
</SubstLookupRecord>
</ChainSubClassRule>
<ChainSubClassRule index="1">
<!-- BacktrackGlyphCount=0 -->
<!-- InputGlyphCount=1 -->
<!-- LookAheadGlyphCount=1 -->
<LookAhead index="0" value="2"/>
<!-- SubstCount=1 -->
<SubstLookupRecord index="0">
    <SequenceIndex value="0"/>
    <LookupListIndex value="11"/>
</SubstLookupRecord>
</ChainSubClassRule>
[14 autres regles du meme type]
```

Viennent ensuite le coeur de l'algo. Nous avonsdéja deux choses importantes: <!-- BacktrackGlyphCount=0 --> et <!-- LookAheadGlyphCount=1 --> ce qui signifie que l'on considère 0 char avant et 1 seul après. Donc ici seulement un seul après.  
Puis en fonction des 16 valeurs du glyphe suivant on appliquera une substitution.

Ainsi la première sous règle, nous dit "LookAhead index="0" value="1" ", donc index= 0 == prochain caractere, et value=1 signifie la classe 1 donc un "a".

Donc si un "b" est suivi d'un "a" applique la règle "10" (LookupListIndex value="10").

Et oui c'est pas fini il faut encore aller chercher une règle.
Heureusemnt celle ci est relativement simple:

```
<Lookup index="10">
<LookupType value="7"/>
<LookupFlag value="0"/>
<!-- SubTableCount=1 -->
<ExtensionSubst index="0" Format="1">
    <ExtensionLookupType value="1"/>
    <SingleSubst>
    <Substitution in="b" out="b.c6"/>
    <Substitution in="b.c1" out="b.c6"/>
    <Substitution in="b.c2" out="b.c6"/>
    <Substitution in="b.c3" out="b.c6"/>
    <Substitution in="b.c4" out="b.c6"/>
    <Substitution in="b.c5" out="b.c6"/>
    <Substitution in="b.c6" out="b.c6"/>
    <Substitution in="b.c7" out="b.c6"/>
    <Substitution in="b.c8" out="b.c6"/>
    <Substitution in="b.c9" out="b.c6"/>
    </SingleSubst>
</ExtensionSubst>
</Lookup>
```

Ainsi notre b sera substitué selon cette table.

On peut test dans fontdrive.
![image](ba.png)

On voit que notre "b" qui était un b "pur se transforme en "b" vert clair. On peut check avec les couleurs.
```
<color index="6" value="#8AC926FF"/>
```
![image](color6.png)

A priori on est bon.

Un autre outils tres pratique pour checker ceci est hbshape (https://harfbuzz.github.io/).

```
└─$ hb-shape font.ttf "ba"
[b.c6=0+1240|a=1+1240]
```
Ce qui confirme notre glyphe "b" est convertie en glyphe "b.c6" ie b de 6eme couleur.

### Résumé des règles

Au final après analyse de pas mal de règle on se rend compte qu'il y a des règles qui vont backtrack très loin derriere mais toujours regarder un glyphe suivant.  
En réalité il y a exactement 256 règle dans chaque cas c'est à dire 16 pour le glyphe actuelle et 16 pour le glyphe suivant.  
On remarque aussi que les glyphes précédents dasn les règles ne code pas de valeur, ils ont tous la même classe, c'est donc des règle de positions.  

Ainsi on a quelque chose qui ressemble à:
Pour chaque position (entre 0 et 56), pour chaque charactere actuel et pour chaque caractere suivant nous avont une substitution.
C'est donc une table du style sub[56][16][16].

Cependant il y a une subtilité en plus. Chaque règle s'applique dans l'ordre. Donc par exemple la règle qui change "ba" en "b.c6a" pourrait s'appliquer en premier plusieurs fois.  
Ce qui est sur c'est que chaque classe de caractere est stable (un a n'est pas transformé en b), donc on peut calculer la substitution finale.

### Backtracking
Bon c'est bien gentils tout ça, mais nous on veut un flag. Et on a déja un moyen de décoder les couleurs via hb-shape. Au lieu de passer des heures à coder un parser de gsub, on pourrait pas juste se servir de hb-shape et explorer les possiblités.

On va faire un peut de backtracking en python en appelant hb-shape. C'est horriblement lent comparé à du code c avec la bonne lookup table mais ca peut faire l'affaire.


```python
import subprocess

def run_hbshape(str_input, font_path="font.ttf"):
    try:
        # Run the hb-shape command
        result = subprocess.run(
            ["hb-shape", font_path, str_input, "--features=*"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            text=True
        )

        # Output is something like: [zero.c1=0+1240|one.c2=1+1240]
        output = result.stdout.strip()

        if not output.startswith("[") or not output.endswith("]"):
            raise ValueError("Unexpected hb-shape output: " + output)

        output = output[1:-1]  # Remove [ and ]
        glyphs = output.split("|")

        # Parse just the glyph names: zero.c1, one.c2, etc.
        parsed = [g.split("=")[0] for g in glyphs]

        return parsed

    except subprocess.CalledProcessError as e:
        print("hb-shape failed:", e.stderr)
        return []

    except Exception as e:
        print("Error:", e)
        return []

def parse_hbshape_color(list_hb):
    l=[]
    for x in list_hb:
        if "." in x:
            l.append(int(x[-1]))
        else:
            l.append(0)

    return l
```
Deux petites fonctions pour appeller hb-shape:

```
In [50]: hbs = run_hbshape("FSCS{000}")

In [51]: print(hbs)
['F', 'S', 'C', 'S', 'braceleft', 'zero.c9', 'zero.c2', 'zero.c2', 'braceright.c7']

In [52]: parse_hbshape_color(hbs)
    ...: 
Out[52]: [0, 0, 0, 0, 0, 9, 2, 2, 7]

```

Ca semble marcher maintenant un peu 

```python
possible = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"]
current = "FSCS{"

def backtrack(current, target, max_len=64):
    #if len(current)==63 and current[-1]=="d":
    print(len(current),current,current[-1])
    if len(current) == max_len - 1:
        # Last character must be '}'
        trial = current + "}"
        colors = parse_hbshape_color(run_hbshape(trial))
        if colors == target[:len(trial)]:
            print(f"FOUND: {trial}")
            return trial
        return None

    for c in possible:
        
        trial = current + c
        colors = parse_hbshape_color(run_hbshape(trial))
        if colors[:len(trial)-1] != target[:len(trial)-1]:
            continue  # Prune bad branches
        result = backtrack(trial, target, max_len)
        if result:
            return result  # Found
    return None     

```
Bon la condition de check est un peu surfaite mais ca devrait faire l'affaire en premiere approche si ca trouve.


```
In [56]: backtrack(current, target)
5 FSCS{ {
6 FSCS{0 0
7 FSCS{00 0
8 FSCS{004 4
7 FSCS{05 5
8 FSCS{052 2
9 FSCS{0525 5
10 FSCS{05258 8
9 FSCS{052d d

# Sauf que tres vite on semble un peu y passer un temps infini
60 FSCS{393005d498c15e364c14907f84844a97ec1b0a5ab0935fc5be5f0df f
61 FSCS{393005d498c15e364c14907f84844a97ec1b0a5ab0935fc5be5f0df0 0
62 FSCS{393005d498c15e364c14907f84844a97ec1b0a5ab0935fc5be5f0df0d d
63 FSCS{393005d498c15e364c14907f84844a97ec1b0a5ab0935fc5be5f0df0d4 4
63 FSCS{393005d498c15e364c14907f84844a97ec1b0a5ab0935fc5be5f0df0d7 7

```

Bon là c'est un peu la merde car l'arbre semble un peu trop gros.

### Une dernière idée

Quand on fait des test sur fontdrive on remarque que le bracket de fin est rarement blanc. En réalité il n'est blanc que si il est précédé d'un "d". En regardans les règles GSUB on peut voir ceci pour "braceright".

```
 <Coverage>
    <Glyph value="braceright"/>
</Coverage>
<!-- ChainSubRuleSetCount=1 -->
<ChainSubRuleSet index="0">
    <!-- ChainSubRuleCount=17 -->
    <ChainSubRule index="0">
    <!-- BacktrackGlyphCount=1 -->
    <Backtrack index="0" value="d"/>
    <!-- InputGlyphCount=1 -->
    <!-- LookAheadGlyphCount=0 -->
    <!-- SubstCount=1 -->
    <SubstLookupRecord index="0">
        <SequenceIndex value="0"/>
        <LookupListIndex value="7842"/>
    </SubstLookupRecord>
    </ChainSubRule>
    <ChainSubRule index="1">
    <!-- BacktrackGlyphCount=1 -->
    <Backtrack index="0" value="a"/>
    <!-- InputGlyphCount=1 -->
    <!-- LookAheadGlyphCount=0 -->
    <!-- SubstCount=1 -->
    [...]
```
On a donc plein de lookup table en fonction du char précédent. On peut aller voir les lookup table 7842 etc
```

   <Lookup index="7842">
        <LookupType value="7"/>
        <LookupFlag value="0"/>
        <!-- SubTableCount=1 -->
        <ExtensionSubst index="0" Format="1">
          <ExtensionLookupType value="1"/>
          <SingleSubst>
            <Substitution in="braceright" out="braceright"/>
          </SingleSubst>
        </ExtensionSubst>
      </Lookup>
      <Lookup index="7843">
        <LookupType value="7"/>
        <LookupFlag value="0"/>
        <!-- SubTableCount=1 -->
        <ExtensionSubst index="0" Format="1">
          <ExtensionLookupType value="1"/>
          <SingleSubst>
            <Substitution in="braceright" out="braceright.c9"/>
          </SingleSubst>
        </ExtensionSubst>
      </Lookup>
```
Et donc la règle 7842 garde le blanc en blanc, toutes les autres modifie le right bracket.  

Ok donc notre flag fini par "d}". Cela nous incite à simplement faire notre backtracking dans l'autre sense.
```python
current = "FSCS{0000000000000000000000000000000000000000000000000000000000}"
def backtrack_inverse(current, target,pos=63, max_len=64):
    print(pos,current)
    list_current = list(current)
    print(len(current),current,current[-1])
    if pos==5:
        colors = parse_hbshape_color(run_hbshape(current))
        if colors[:63] == target[:63]:
            return current
        return None
    for c in possible:
        list_current[pos-1] = c
        trial = "".join(list_current)
        colors = parse_hbshape_color(run_hbshape(trial))
        if colors[pos] != target[pos]:
            continue  # Prune bad branches
        result = backtrack_inverse(trial, target,pos-1, max_len)
        if result:
            return result  # Found
    return None    
```
```python
64 FSCS{393005dd2218ba02bfda28559813de7586c267140d08e1e83a4ae5a61d} }
Out[58]: 'FSCS{393005dd2218ba02bfda28559813de7586c267140d08e1e83a4ae5a61d}'

```
Ok notre backtracking a fini apres une minute environ. On test notre flag dans le binaire
![](https://i.imgur.com/WPzCH2K.jpeg)

Argh ca marche toujours pas.  

Qu'on est con c'est FCSC! (bien sur je m'en rend compte apres avoir check dans GDB ...)

FCSC{393005dd2218ba02bfda28559813de7586c267140d08e1e83a4ae5a61d}

![](https://i.imgur.com/CQjF5PG.jpeg)

L'image de win a bien été décodé par aes.

## Conclusion

Un challenge des plus amusants avec deux parties relativement surprenante (à mon niveau):
- l'input du flag checker ne prend pas notre string mais déduit depuis les pixels.
- l'algo des couleurs dans la font

Je ne sais pas si l'intended fait un truc plus malin avec les GSUB pour reverse l'automate en tout cas on c'est bien amusé.  

J'imagine qu'on pouvait ne pas aller chercher la font et faire un backtrack full GDB/capstone
