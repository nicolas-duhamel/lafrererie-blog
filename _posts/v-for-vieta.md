---
title: "V for Vieta"
excerpt: "This is the challenge V for Vieta from downunder 2024"
coverImage: "/assets/blog/hello-world/cover.jpg"
date: "2024-07-08"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "/assets/blog/hello-world/cover.jpg"
---

[Source du challenge](https://github.com/DownUnderCTF/Challenges_2024_Public/tree/main/crypto/v-for-vieta/src)

Cela aurait pu faire un bon challenge beginner/misc. Au vu du peu nombre de résolution comparait à la difficulté que je perçoit je me sens obliger d'expliquer comment approcher un tel challenge. Pour résumer, on nous envoi un entier k qui est un carré et on doit trouver a,b tel que ```(a**2 + a * b + b**2) / (2 * a * b + 1) = k```.

A posteriori, on pourrait remarquer qu'il y a des simplifications si on pose ```a = sqrt(k)``` qui est un entier par hypothèse. Mais oublions cette solution "évidente". Une remarque que l'on peut faire c'est qu'il n'y a aucune hypothèse sur k autre que c'est un carré, on peut donc faire l'hypothèse que de telles solutions existent pour tout carré. 

On se restreint à ```a,b > 0```. Si l'on n'a aucune idée de comment résoudre un tel problème, on peut toujours faire les "petits cas", ```k=4``` est le premier exemple non trivial. En faisant un brute force sur a et b, on remarque que ```a=2``` et calculer ```b = a*(2*k-1)```. On peut faire le test pour ```k=9```, sur les petits exemples on se rend compte que ```a = sqrt(k)``` est une solution "évidente".

C'est la première étape, cependant ce n'est pas fini, on effectue un test sur la taille de a et b, il faut qu'ils aient tous les deux une taille >= 2048 bits. Ce qui n'est pas le cas de notre solution "évidente". On va utiliser ici un principe de "monté", généralement on fait plutôt des descentes i.e. à partir d'une solution on construit une solution plus petite. Ici on fait l'inverse, à partir d'une solution on construit une solution plus grande.

Encore une fois si on ne sais pas comment s'y prendre, on va faire le test pour ```k=4``` et en déduire une règle générale. On se rend compte qu'il y a deux solutions qui ont le même b, ce qui est logique au vu de l'équation quadratique. On connait une solution, pour calculer la deuxième, on va faire le calcul classique de discriminant et de racines d'équation quadratique. En posant ```delta = (b-2*k*b)**2 - 4*(b**2-k)``` et ```a = ((2*k*b - b) + sqrt(delta))/2```. On trouve la deuxième solution qui est plus grande que la première et avec a > b.

Il nous suffit maintenant de swapper les variables a,b et ce qui nous permet de faire une boucle simplement avec des valeurs de plus en plus grande pour a et b.

```python
from pwn import *
import json
import libnum

conn = connect("2024.ductf.dev", 30018)
print(conn.recvuntil(b"\n"))
while True:
    data = json.loads(conn.recvuntil(b"\n"))
    print(data)
    k = int(data["k"])
    a = libnum.nroot(k,2)
    b = a*(2*k-1)
    while a.bit_length() <= 2048 or b.bit_length() <= 2048:
        delta = (b-2*k*b)**2 - 4*(b**2-k)
        a = (2*k*b - b) + libnum.nroot(delta,2)
        a = a//2
        a,b = b,a
    conn.sendline(json.dumps({"a": a, "b": b}).encode())
    level = int(data["level"])
    if level - level // 5 <= 8:
        conn.interactive()
        exit()
```
