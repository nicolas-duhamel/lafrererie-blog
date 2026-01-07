---
title: "AES, Telegram's secret"
excerpt: "Crypto, Root-me XMAS"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2026-01-07"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---


This challenge was released as Day 10 of the Root‑Me XMAS CTF. It was initially classified as easy, but was later reclassified as medium due to low number of solves. At the core of the challenge was AES in Infinite Garble Extension (IGE) mode, a relatively uncommon mode of operation compared to CBC.

IGE can be viewed as an extension of CBC: it introduces additional feedback by XORing not only with the previous ciphertext block but also with the previous plaintext block. Unfortunately, this does not eliminate malleability, which will be the key to solve this challenge.

The encryption process for IGE is illustrated below:
![IGE mode encryption](https://blog.susanka.eu/content/images/2016/12/ige.svg)

Compared to CBC, IGE introduces an additional XOR with the previous plaintext block. However, as with CBC, decryption remains malleable: an attacker who can influence the IV can induce controlled changes in the decrypted plaintext.

Now let's see the challenge.
```bash
   *    .  *       .        *       .       *
    .    *         *        .        *    .      
           \\ || //       
            \\||//         AES - IGE 
    *    *   ||||    *    
            / || \         3xpl01t is a mischievous elf - XMAS2025 - Brute force is not the solution
   .    *  /  ||  \   .    
    *    /____||____\   *  Did you know? Telegram uses AES-IGE x)
        |    |  |    |     You're just a guest for now... Can you change that?
    .   |____|  |____|  .  IV = SHA256(password || find_the_salt)
    
  Rules: admin/root/superuser/flag banned, 10 encryptions max


  1. Encrypt (0/10)  2. Verify (custom IV)  3. Exit
```

We have a wordlist at disposition and no source code. The setup is really weird, no bruteforce but we have a wordlist ? After solving the challenge I can say that we can solve the challenge without the source code but there is no real reason not to disclose it. Also for the intented solution we had to guess the salt and there was an unintended solution that should have been the intended (sounds messy).

We had the possibility to encrypt a text (with the restriction on words), then decrypt with a custom IV and if the decryption contained something like "role=admin" the challenge was solved. 

Let's quickly explain the intended, we were supposed to guess that the salt was "XMAS2025" (why? not sure), then bruteforce the password (why the description say no bruteforce? not sure) using the wordlist. This would give us the IV used to encrypt the text and we could use the malleability of IGE (same as CBC) to flip some bits so that we would pass the check "role=admin".

Now let's explain why we don't really need to guess the IV and a little bit more on malleability. The IGE mode of operation can be summarize by this equation
`c_i = E(m_i xor c_{i-1}) xor m_{i-1}`
where E is the encryption with AES using an unknown key. By rearranging it and specialize to i=2, we obtain
`E(m2 xor c1) = c2 xor m1`
This means that we know the AES encryption (and decryption) of at least one block and this is the only thing we really need to know.

If we try to decrypt `c2 xor m1` with the second part of the IV just null bytes, we know that it will decrypt to `m2 xor c1`. We just need to use the first part of the IV to get what we want.

More precisely, during decryption we have this equation
`plaintext = D(ciphertext xor IV1) xor IV0`
where D is AES decryption with the unknown key.

By choosing, `IV1 = "\x00"*16` and `C = c2 xor m1`, we know that
`D(C xor IV1) = m2 xor c1`. So we just need to choose IV_0 to be  `"role=admin" xor m2 xor c1`. So that the plaintext will containt "role=admin".

In python code, (for simplicity we choose to encrypt the string "a"*32)
```python
# this is the ciphertext from "a"*32
ct = ...
m = "a"*16

IV0 = xor(xor(ct[:16], m), b"role=admin&user=")
IV1 = b"\x00"*16
print("IV: " +(IV0+IV1).hex())
print("CT: " + xor(m, ct[16:32]).hex())
```

Then we know that when we decrypt this cyphertext with this IV this will contain "role=admin" and solve the challenge.