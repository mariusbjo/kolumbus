# scripts/config.py
import os

# Unik identifikasjon for ditt prosjekt
USER_AGENT = "Forsøk BUSS-sanntid/1.0 (https://mariusbjo.github.io/kolumbus/)"

# Entur krever ET-Client-Name i tillegg
ET_CLIENT_NAME = os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")

HEADERS_ENTUR = {
    "Content-Type": "application/json",
    "ET-Client-Name": ET_CLIENT_NAME,
    "User-Agent": USER_AGENT
}

HEADERS_NVDB = {
    "Accept": "application/json",
    "User-Agent": USER_AGENT
}
