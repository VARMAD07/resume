#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
import ssl
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SOFT_HTTP = {401, 403, 405, 429}
DEAD_HTTP = {404, 410}
TIMEOUT = 15

class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("href", "src"):
            value = a.get(key)
            if value and value.startswith(("http://", "https://")):
                self.links.add(value)

def probe(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MHF-Portfolio-LinkCheck/1.0)",
        "Accept": "*/*",
    }
    for method in ("HEAD", "GET"):
        try:
            req = Request(url, headers=headers, method=method)
            with urlopen(req, timeout=TIMEOUT, context=ssl.create_default_context()) as response:
                return response.status, "ok"
        except HTTPError as exc:
            if method == "HEAD" and exc.code == 405:
                continue
            if exc.code in SOFT_HTTP:
                return exc.code, "soft"
            if exc.code in DEAD_HTTP:
                return exc.code, "dead"
            if 500 <= exc.code <= 599:
                return exc.code, "soft"
            return exc.code, "soft"
        except (URLError, TimeoutError, ssl.SSLError) as exc:
            if method == "HEAD":
                continue
            return None, f"soft:{exc.__class__.__name__}"
    return None, "soft"

def main():
    parser = LinkCollector()
    parser.feed(HTML.read_text(encoding="utf-8"))
    links = sorted(parser.links)
    dead = []
    print(f"Checking {len(links)} external URLs...")
    for url in links:
        status, state = probe(url)
        host = urlparse(url).netloc
        label = status if status is not None else state
        if state == "dead":
            print(f"DEAD {label} {url}")
            dead.append(url)
        elif state == "ok":
            print(f" OK  {label} {host}")
        else:
            print(f"WARN {label} {url}")
    if dead:
        print("\nDefinitively dead links found:")
        for url in dead:
            print(" -", url)
        raise SystemExit(1)
    print("\nNo definitive 404/410 external links found.")

if __name__ == "__main__":
    main()
