# scripts/fetch_speedlimits.py
import requests
import json

BASE_URL = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105"
params = {
    "inkluder": "egenskaper,lokasjon",
    "fylke": "11"  # Rogaland
}

speedlimits = {}

page = 1
while True:
    print(f"Henter side {page}...")
    res = requests.get(BASE_URL, params={**params, "side": page}, headers={"Accept": "application/json"})
    if not res.ok:
        print("Feil ved henting:", res.status_code, res.text)
        break

    data = res.json()
    objekter = data.get("objekter", [])
    if not objekter:
        break

    for obj in objekter:
        verdi = None
        for e in obj.get("egenskaper", []):
            if e.get("id") == 5962:  # fartsgrense
                verdi = e.get("verdi")
        if verdi:
            # Bruk midtpunkt av geometri som nøkkel
            lok = obj.get("lokasjon", {})
            punkt = lok.get("geometri", {}).get("punkt")
            if punkt:
                lat = punkt.get("lat")
                lon = punkt.get("lon")
                key = f"{lat:.4f},{lon:.4f}"
                speedlimits[key] = verdi

    # Sjekk om det finnes flere sider
    if "metadata" in data and data["metadata"].get("nesteSide"):
        page += 1
    else:
        break

with open("data/speedlimits.json", "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

print(f"Lagret {len(speedlimits)} fartsgrenser til data/speedlimits.json")
