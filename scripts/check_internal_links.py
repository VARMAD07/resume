#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SITE_PREFIX = "https://varmad07.github.io/resume/"

class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=set()
        self.refs=[]
        self.meta_content_refs=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href","src"):
            value=a.get(key)
            if value:
                self.refs.append((tag,key,value))
        if tag=="meta" and a.get("content") and (a.get("property")=="og:image" or a.get("name")=="twitter:image"):
            self.meta_content_refs.append((tag,"content",a["content"]))

def local_target(value):
    if value.startswith(("mailto:","tel:","javascript:","data:")):
        return None
    if value.startswith("#"):
        return ("fragment", value[1:])
    if value.startswith(SITE_PREFIX):
        value=value[len(SITE_PREFIX):]
    p=urlparse(value)
    if p.scheme or p.netloc:
        return None
    path=unquote(p.path)
    fragment=p.fragment
    if not path and fragment:
        return ("fragment", fragment)
    if path in ("",".","./"):
        if fragment:
            return ("fragment", fragment)
        return None
    return ("file", path.lstrip("./"))

def main():
    parser=Collector()
    parser.feed(HTML.read_text(encoding="utf-8"))
    errors=[]
    for tag,key,value in parser.refs + parser.meta_content_refs:
        target=local_target(value)
        if not target:
            continue
        kind,name=target
        if kind=="fragment":
            if name and name not in parser.ids:
                errors.append(f"Missing anchor #{name} referenced by <{tag} {key}>")
        else:
            clean=name.split("#",1)[0].split("?",1)[0]
            candidate=ROOT / clean
            if clean.endswith("/"):
                candidate=candidate / "index.html"
            if not candidate.exists():
                errors.append(f"Missing local file: {clean} referenced by <{tag} {key}>")
    if errors:
        print("Internal link check failed:")
        for err in errors:
            print(" -",err)
        raise SystemExit(1)
    print(f"OK: checked {len(parser.refs)+len(parser.meta_content_refs)} references and {len(parser.ids)} anchors.")

if __name__=="__main__":
    main()
