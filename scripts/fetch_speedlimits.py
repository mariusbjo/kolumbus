import requests, json, os, time

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/105"

params = {
    "fylke": "11",   # Rogaland
    "srid": "4326",
    "antall": "100"  # hent 100 per side for effektivitet
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/json"
}

# Last inn eksisterende oppføringer hvis filen finnes
existing_ids = set()
speedlimits = []
if os.path.exists(OUT_PATH):
    with open(OUT_PATH, "r", encoding="utf-8") as f:
        try:
            speedlimits = json.load(f)
            existing_ids = {str(item.get("id")) for item in speedlimits if "id" in item}
            print(f"Fant {len(existing_ids)} eksisterende oppføringer, hopper over disse.")
        except Exception:
            print("Kunne ikke lese eksisterende speedlimits.json, starter på nytt.")
            speedlimits = []

os.makedirs(DEBUG_DIR, exist_ok=True)

url = BASE_URL
page_count = 0
total_objects = None
new_count = 0

while url:
    print(f"Henter side {page_count+1}: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=headers)
    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    payload = res.json()

    # Sjekk totalt antall på første side
    if page_count == 0:
        total_objects = payload.get("metadata", {}).get("totaltAntall")
        if total_objects:
            total_pages = (total_objects // int(params["antall"])) + 1
            print(f"Totalt antall objekter i Rogaland: {total_objects}")
            print(f"Forventet antall sider: {total_pages}")
            if total_objects > 20000:
                print("❌ Avbryter: totaltAntall overstiger 20 000")
                break

    with open(f"{DEBUG_DIR}/page_{page_count+1}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    objekter = payload.get("objekter", [])
    print("Fant", len(objekter), "objekter på denne siden")

    for obj in objekter:
        obj_id = str(obj.get("id"))
        if obj_id in existing_ids:
            continue  # hopp over allerede lagret
        egenskaper = obj.get("egenskaper", [])
        limit = None
        for e in egenskaper:
            if e.get("navn") == "Fartsgrense":
                limit = e.get("verdi")
                break

        speedlimits.append({
            "id": obj_id,
            "geometry": obj.get("geometri"),
            "speed_limit": limit
        })
        existing_ids.add(obj_id)
        new_count += 1

    print(f"➡️ Totalt nye objekter lagt til så langt: {new_count}")

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

print(f"✅ speedlimits.json skrevet med {len(speedlimits)} objekter totalt")
print(f"➕ Nye objekter lagt til denne kjøringen: {new_count}")
