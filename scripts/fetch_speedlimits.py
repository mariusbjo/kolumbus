# scripts/fetch_speedlimits.py
import requests, json, math, time
from config import HEADERS_NVDB

BASE_URL = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105"
params = {
    "inkluder": "egenskaper,lokasjon",
    "fylke": "11"  # Rogaland
}

speedlimits = {}
all_points = []

url = BASE_URL
while url:
    print(f"Henter: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=HEADERS_NVDB)
    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
        break

    data = res.json()
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
            linje = geo.get("linje")

            if punkt:
                lat = punkt.get("lat")
                lon = punkt.get("lon")
                key = f"{lat:.4f},{lon:.4f}"
                speedlimits[key] = verdi
                all_points.append((lat, lon, verdi))
                added += 1
            elif linje:
                coords = linje.get("koordinater", [])
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
with open("data/speedlimits.json", "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)
print("✅ speedlimits.json skrevet med", len(speedlimits), "punkter")
