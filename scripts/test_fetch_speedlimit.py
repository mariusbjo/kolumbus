import requests
import json

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/105"

params = {
    "fylke": "11",   # Rogaland
    "srid": "4326",
    "antall": "5",   # hent bare 5 objekter
    "inkluder": "geometri,egenskaper"
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/json"
}

res = requests.get(BASE_URL, params=params, headers=headers)
if not res.ok:
    print("Feil ved henting:", res.status_code, res.text)
    exit()

payload = res.json()
objekter = payload.get("objekter", [])

print(f"Fant {len(objekter)} objekter")
if objekter:
    første = objekter[0]
    print("\nFørste objekt:")
    print("ID:", første.get("id"))
    print("Geometri:", json.dumps(første.get("geometri"), indent=2))
    for e in første.get("egenskaper", []):
        if e.get("navn") == "Fartsgrense":
            print("Fartsgrense:", e.get("verdi"))
