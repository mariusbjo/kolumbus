# scripts/config.py
import os

# Unik identifikasjon for ditt prosjekt
USER_AGENT = "marius-sanntidskart/1.0 (https://mariusbjo.github.io/kolumbus/; kontakt: marius.bjornor@gmail.com)"

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
