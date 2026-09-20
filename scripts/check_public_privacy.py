#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = [
    ROOT / "index.html",
    ROOT / "script.js",
    ROOT / "manifest.webmanifest",
    ROOT / "sw.js",
    ROOT / "404.html",
]

PATTERNS = {
    "OpenAI-style secret": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "private key material": re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    "explicit API secret variable": re.compile(r"\b(?:OPENAI_API_KEY|GEMINI_API_KEY|TWILIO_AUTH_TOKEN|SYSTEM_EMAIL_PASSWORD)\s*[=:]"),
    "credential-bearing URL query": re.compile(r"https?://[^\s\"'<>]+[?&](?:token|auth|api[_-]?key|secret|password)=", re.I),
}

SAFE_MARKERS = (
    "YOUR_ACTUAL_",
    "your_key_here",
    "your_sid_here",
    "your_password_here",
)

def main():
    findings=[]
    for path in PUBLIC_FILES:
        if not path.exists():
            continue
        text=path.read_text(encoding="utf-8",errors="ignore")
        for label,pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                sample=match.group(0)
                if any(marker in sample for marker in SAFE_MARKERS):
                    continue
                findings.append((path.name,label,sample[:120]))
    if findings:
        print("Potential sensitive material found in public portfolio files:")
        for file,label,sample in findings:
            print(f" - {file}: {label}: {sample}")
        raise SystemExit(1)
    print("OK: no obvious secrets, credential-bearing URLs, or private-key material found in public portfolio files.")

if __name__=="__main__":
    main()
