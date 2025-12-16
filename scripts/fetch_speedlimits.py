import requests, json, os, time

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105"

params = {
    "fylke": "11",          # Rogaland
    "inkluder": "alle",
    "segmentering": "true",
    "srid": "4326"
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/vnd.geo+json"
}

speedlimits = {}
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

    features = payload.get("features", [])
    print("Fant", len(features), "features på denne siden")

    # ... samme loop som før for å lagre punkter ...

    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        time.sleep(0.5)
    else:
        url = None

    page_count += 1

print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter totalt")
