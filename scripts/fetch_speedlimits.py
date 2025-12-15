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
    # Bruk params kun på første kall, deretter følger vi href direkte
    res = requests.get(url, params=params if url == BASE_URL else None, headers=HEADERS_NVDB)
    if not res.ok:
        print("❌ Feil ved henting:", res.status_code, res.text)
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
            lok = obj.get("lokasjon", {})
            punkt = lok.get("geometri", {}).get("punkt")
            if punkt:
                lat = punkt.get("lat")
                lon = punkt.get("lon")
                key = f"{lat:.4f},{lon:.4f}"
                speedlimits[key] = verdi
                all_points.append((lat, lon, verdi))

    # Neste side?
    neste = data.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]   # bruk kun href-strengen
        time.sleep(0.5)       # rate control
    else:
        url = None

print(f"Hentet {len(all_points)} fartsgrensepunkter fra NVDB")

# Grid fallback
lat_min, lat_max = 58.0, 59.0
lon_min, lon_max = 5.0, 7.0
step = 0.01

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

for lat in [lat_min + i*step for i in range(int((lat_max-lat_min)/step)+1)]:
    for lon in [lon_min + j*step for j in range(int((lon_max-lon_min)/step)+1)]:
        key = f"{lat:.4f},{lon:.4f}"
        if key in speedlimits:
            continue
        nearest = None
        nearest_dist = float("inf")
        for plat, plon, limit in all_points:
            dist = haversine(lat, lon, plat, plon)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest = limit
        if nearest:
            speedlimits[key] = nearest

print(f"Totalt {len(speedlimits)} punkter lagret (inkl. grid fallback)")

with open("data/speedlimits.json", "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)
