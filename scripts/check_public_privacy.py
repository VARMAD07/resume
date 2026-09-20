#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()
TEXT_SUFFIXES = {".html",".js",".mjs",".json",".md",".txt",".xml",".yml",".yaml",".webmanifest",".css",".svg"}
EXCLUDED_DIRS = {".git","node_modules","visual-qa","lhci-results"}

PATTERNS = {
    "OpenAI-style secret": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "private key material": re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    "explicit API secret variable": re.compile(r"\b(?:OPENAI_API_KEY|GEMINI_API_KEY|TWILIO_AUTH_TOKEN|SYSTEM_EMAIL_PASSWORD)\s*[=:]"),
    "credential-bearing URL query": re.compile(r"https?://[^\s\"'<>]+[?&](?:token|auth|api[_-]?key|secret|password)=", re.I),
    "GitHub personal access token": re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b"),
}

SAFE_MARKERS = (
    "YOUR_ACTUAL_",
    "your_key_here",
    "your_sid_here",
    "your_password_here",
)

def candidate_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.resolve() == SELF:
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"robots.txt"}:
            continue
        if path.stat().st_size > 2_000_000:
            continue
        yield path

def main():
    findings=[]
    checked=0
    for path in candidate_files():
        checked+=1
        text=path.read_text(encoding="utf-8",errors="ignore")
        for label,pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                sample=match.group(0)
                if any(marker in sample for marker in SAFE_MARKERS):
                    continue
                findings.append((str(path.relative_to(ROOT)),label,sample[:120]))
    if findings:
        print("Potential sensitive material found in public repository text files:")
        for file,label,sample in findings:
            print(f" - {file}: {label}: {sample}")
        raise SystemExit(1)
    print(f"OK: scanned {checked} public repository text files; no obvious secrets, credential-bearing URLs, tokens, or private-key material found.")

if __name__=="__main__":
    main()
