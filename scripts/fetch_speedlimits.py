# scripts/fetch_speedlimits.py
import requests, json, time, os
from config import HEADERS_NVDB

BASE_URL = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105"
params = {
    "inkluder": "egenskaper,lokasjon",
    "fylke": "11"  # Rogaland
}

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"

# Last inn eksisterende data hvis det finnes
if os.path.exists(OUT_PATH):
    with open(OUT_PATH, "r", encoding="utf-8") as f:
        speedlimits = json.load(f)
else:
    speedlimits = {}

veglenke_cache = {}

def fetch_veglenke_coords(veglenke_id):
    """Slå opp veglenkesekvens og returner koordinater (med cache)."""
    if veglenke_id in veglenke_cache:
        return veglenke_cache[veglenke_id]

    url = f"https://nvdbapiles-v3.atlas.vegvesen.no/vegnett/veglenkesekvenser/{veglenke_id}"
    res = requests.get(url, headers=HEADERS_NVDB)
    if res.ok:
        geo = res.json().get("geometri", {})
        coords = geo.get("koordinater", [])
        veglenke_cache[veglenke_id] = coords
        return coords
    else:
        print("❌ Feil ved henting av veglenkesekvens:", res.status_code)
        veglenke_cache[veglenke_id] = []
        return []

url = BASE_URL
page_count = 0
max_pages = 3  # testmodus: hent maks 3 sider

os.makedirs(DEBUG_DIR, exist_ok=True)

while url and page_count < max_pages:
    print(f"Henter side {page_count+1}: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=HEADERS_NVDB)

    try:
        payload = res.json()
        with open(f"{DEBUG_DIR}/page_{page_count+1}.json", "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception:
        payload = {}

    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    objekter = payload.get("objekter", [])
    print("Fant", len(objekter), "objekter på denne siden")

    if not objekter:
        break

    added = 0
    for obj in objekter:
        # Finn fartsgrenseverdi
        verdi = None
        for e in obj.get("egenskaper", []):
            if e.get("id") == 2021 or e.get("navn") == "Fartsgrense":
                verdi = e.get("verdi")

        if verdi is not None:
            veglenke_id = obj.get("lokasjon", {}).get("veglenkesekvensid")
            if veglenke_id:
                coords = fetch_veglenke_coords(veglenke_id)
                for lon, lat in coords:
                    key = f"{lat:.5f},{lon:.5f}"
                    if key not in speedlimits:  # hopp over eksisterende
                        speedlimits[key] = verdi
                        added += 1

    print(f"  ➕ Lagret {added} nye punkter fra denne siden")

    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        time.sleep(0.5)
    else:
        url = None

    page_count += 1

print(f"Hentet totalt {len(speedlimits)} fartsgrensepunkter fra NVDB")

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)
print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter totalt")
