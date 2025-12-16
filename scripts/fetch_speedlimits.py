# scripts/fetch_speedlimits.py
import requests, json, os, time

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105"

params = {
    "kommune": "1103",      # Stavanger
    "inkluder": "alle",
    "segmentering": "true",
    "srid": "4326"          # WGS84 lat/lon
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/vnd.geo+json"
}

# Last inn eksisterende data hvis det finnes
if os.path.exists(OUT_PATH):
    with open(OUT_PATH, "r", encoding="utf-8") as f:
        speedlimits = json.load(f)
else:
    speedlimits = {}

os.makedirs(DEBUG_DIR, exist_ok=True)

url = BASE_URL
page_count = 0
total_added = 0

while url:
    print(f"Henter side {page_count+1}: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=headers)

    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    payload = res.json()
    with open(f"{DEBUG_DIR}/stavanger_page_{page_count+1}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    features = payload.get("features", [])
    print("Fant", len(features), "features på denne siden")

    added = 0
    for feat in features:
        fart = None
        for e in feat.get("properties", {}).get("egenskaper", []):
            if e.get("navn") == "Fartsgrense":
                fart = e.get("verdi")

        if fart:
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            geom_type = geom.get("type")

            if geom_type == "Point":
                lon, lat = coords
                key = f"{lat:.5f},{lon:.5f}"
                if key not in speedlimits:
                    speedlimits[key] = fart
                    added += 1
            elif geom_type == "LineString":
                for lon, lat in coords:
                    key = f"{lat:.5f},{lon:.5f}"
                    if key not in speedlimits:
                        speedlimits[key] = fart
                        added += 1

    print(f"  ➕ Lagret {added} nye punkter fra denne siden")
    total_added += added

    # Følg paginering
    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        time.sleep(0.5)
    else:
        url = None

    page_count += 1

print(f"Hentet totalt {total_added} nye punkter fra NVDB (Stavanger)")

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter totalt")
