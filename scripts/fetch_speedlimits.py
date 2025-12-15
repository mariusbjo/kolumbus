# scripts/fetch_speedlimits.py
import requests, json, math, time, os
from config import HEADERS_NVDB

# Vegobjekttype 105 = Fartsgrense
BASE_URL = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105"
params = {
    "inkluder": "egenskaper,lokasjon",
    "fylke": "11"  # Rogaland
}

OUT_PATH = "data/speedlimits.json"
DEBUG_PATH = "data/debug_nvdb.json"

speedlimits = {}
all_points = []

def fetch_veglenke_coords(veglenke_id):
    """Slå opp veglenkesekvens og returner koordinater"""
    url = f"https://nvdbapiles-v3.atlas.vegvesen.no/vegnett/veglenkesekvenser/{veglenke_id}"
    res = requests.get(url, headers=HEADERS_NVDB)
    if res.ok:
        geo = res.json().get("geometri", {})
        return geo.get("koordinater", [])
    else:
        print("❌ Feil ved henting av veglenkesekvens:", res.status_code)
        return []

url = BASE_URL
while url:
    print(f"Henter: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=HEADERS_NVDB)

    # Lagre alltid rårespons til debug-fil
    try:
        payload = res.json()
        os.makedirs(os.path.dirname(DEBUG_PATH), exist_ok=True)
        with open(DEBUG_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    data = payload
    objekter = data.get("objekter", [])
    if not objekter:
        break

    added = 0
    for obj in objekter:
        verdi = None
        for e in obj.get("egenskaper", []):
            if e.get("id") == 2021 or e.get("navn") == "Fartsgrense":
                verdi = e.get("verdi")

        if verdi is not None:
            geo = obj.get("lokasjon", {}).get("geometri", {})
            punkt = geo.get("punkt")

            if punkt:
                lat = punkt.get("lat")
                lon = punkt.get("lon")
                key = f"{lat:.4f},{lon:.4f}"
                speedlimits[key] = verdi
                all_points.append((lat, lon, verdi))
                added += 1
            else:
                # Hent veglenkesekvensid fra egenskaper
                for e in obj.get("egenskaper", []):
                    if e.get("navn") == "Liste av lokasjonsattributt":
                        innhold = e.get("innhold", [])
                        for inn in innhold:
                            veglenke_id = inn.get("veglenkesekvensid")
                            if veglenke_id:
                                coords = fetch_veglenke_coords(veglenke_id)
                                for lon, lat in coords:
                                    key = f"{lat:.4f},{lon:.4f}"
                                    speedlimits[key] = verdi
                                    all_points.append((lat, lon, verdi))
                                    added += 1

    print(f"  ➕ Lagret {added} punkter fra denne siden")

    neste = data.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        time.sleep(0.5)
    else:
        url = None

print(f"Hentet totalt {len(all_points)} fartsgrensepunkter fra NVDB")

# Lagre til JSON
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)
print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter")
