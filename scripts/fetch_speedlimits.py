# scripts/fetch_speedlimits.py
import requests, json, os

OUT_PATH = "data/speedlimits.json"
DEBUG_PATH = "data/debug_nvdb.json"

# NVDB API v4 – Vegobjekttype 105 = Fartsgrense
BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105"

# Parametere: her kan du justere filter
params = {
    "fylke": "11",          # Rogaland
    "inkluder": "alle",     # inkluder alle egenskaper og lokasjon
    "segmentering": "true",
    "srid": "4326"          # WGS84 lat/lon
    # alternativt: legg til "kartutsnitt=minX,minY,maxX,maxY" for bounding box
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

print(f"Henter fartsgrenser fra NVDB v4: {BASE_URL}")
res = requests.get(BASE_URL, params=params, headers=headers)

if not res.ok:
    print("❌ Feil ved henting:", res.status_code, res.text)
    exit(1)

try:
    payload = res.json()
    os.makedirs(os.path.dirname(DEBUG_PATH), exist_ok=True)
    with open(DEBUG_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
except Exception as e:
    print("❌ Klarte ikke å parse JSON:", e)
    exit(1)

features = payload.get("features", [])
print("Fant", len(features), "features")

added = 0
for feat in features:
    props = feat.get("properties", {})
    fart = None
    for e in props.get("egenskaper", []):
        if e.get("navn") == "Fartsgrense":
            fart = e.get("verdi")

    if fart is not None:
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

print(f"➕ Lagret {added} nye punkter")

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter totalt")
