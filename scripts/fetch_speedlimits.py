import requests, json, os, time

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/105"

# Minimal spørring: kun fylke og srid
params = {
    "fylke": "11",   # Rogaland
    "srid": "4326",
    "antall": "10"   # hent bare 10 objekter for test
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/json"   # enklere å debugge enn GeoJSON først
}

speedlimits = []
os.makedirs(DEBUG_DIR, exist_ok=True)

url = BASE_URL
page_count = 0

while url:
    print(f"Henter side {page_count+1}: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=headers)
    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    payload = res.json()
    with open(f"{DEBUG_DIR}/page_{page_count+1}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    features = payload.get("objekter", [])  # i standard JSON heter det "objekter"
    print("Fant", len(features), "objekter på denne siden")

    for feat in features:
        egenskaper = feat.get("egenskaper", [])
        limit = None
        for e in egenskaper:
            if e.get("navn") == "Fartsgrense":
                limit = e.get("verdi")
                break

        speedlimits.append({
            "id": feat.get("id"),
            "geometry": feat.get("geometri"),
            "speed_limit": limit
        })

    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        time.sleep(0.5)
    else:
        url = None

    page_count += 1

# Lagre samlet resultat
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

print("✅ speedlimits.json skrevet med", len(speedlimits), "objekter totalt")
