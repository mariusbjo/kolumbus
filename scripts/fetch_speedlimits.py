import requests, json, os

OUT_PATH = "data/speedlimits.json"
DEBUG_PATH = "data/debug_nvdb.json"

url = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105"
params = {
    "fylke": "11",          # Rogaland
    "inkluder": "alle",
    "segmentering": "true",
    "srid": "4326"          # WGS84 lat/lon
}
headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/vnd.geo+json"
}

res = requests.get(url, params=params, headers=headers)
if not res.ok:
    print("❌ Feil ved henting:", res.status_code, res.text)
    exit(1)

data = res.json()
with open(DEBUG_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

features = data.get("features", [])
print("Fant", len(features), "features")

speedlimits = {}
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
            speedlimits[f"{lat:.5f},{lon:.5f}"] = fart
        elif geom_type == "LineString":
            for lon, lat in coords:
                speedlimits[f"{lat:.5f},{lon:.5f}"] = fart

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter totalt")
