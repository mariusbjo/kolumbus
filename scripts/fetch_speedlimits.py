# scripts/fetch_speedlimits.py
import requests
import json

# Liste over koordinater du vil cache fartsgrenser for.
# I praksis kan du generere denne fra bussruter eller et grid over området.
coordinates = [
    (58.9668, 5.7340),
    (58.9701, 5.7302),
    (58.9755, 5.7250),
]

speedlimits = {}

for lat, lon in coordinates:
    url = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105"
    body = {
        "lokasjon": {
            "srid": "wgs84",
            "punkt": { "lat": lat, "lon": lon },
            "radius": 50
        }
    }
    try:
        res = requests.post(url, headers={"Content-Type": "application/json", "Accept": "application/json"}, json=body)
        if res.ok:
            data = res.json()
            obj = data.get("objekter", [{}])[0]
            if obj:
                for e in obj.get("egenskaper", []):
                    if e.get("id") == 5962:  # fartsgrense
                        key = f"{lat:.4f},{lon:.4f}"
                        speedlimits[key] = e.get("verdi")
    except Exception as e:
        print(f"Feil ved henting av fartsgrense for {lat},{lon}: {e}")

with open("data/speedlimits.json", "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)
