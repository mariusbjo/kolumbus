# scripts/config.py
import os

# Gyldig User-Agent med prosjektidentifikasjon, URL og kontaktinfo
USER_AGENT = "Mozilla/5.0 (compatible; marius-sanntidskart/1.0; +https://mariusbjo.github.io/kolumbus/; kontakt: marius.bjornor@gmail.com)"

# Entur krever ET-Client-Name i tillegg
ET_CLIENT_NAME = os.getenv("ET_CLIENT_NAME", "marius-sanntidskart-demo")

HEADERS_ENTUR = {
    "Content-Type": "application/json",
    "ET-Client-Name": ET_CLIENT_NAME,
    "User-Agent": USER_AGENT
}

HEADERS_NVDB = {
    "Accept": "application/json",
    "User-Agent": USER_AGENT
}
