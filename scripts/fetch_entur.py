# scripts/fetch_entur.py
import os, json, requests
from datetime import datetime, timezone

URL = "https://api.entur.io/journey-planner/v3/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

QUERY = """
query AllVehicles {
  vehicles(bbox: {
    minLat: 58.20,
    minLon: 4.80,
    maxLat: 59.60,
    maxLon: 6.60
  }) {
    id
    mode
    line { publicCode name }
    latitude
    longitude
    updatedAt
  }
}

"""

OUT_PATH = "data/kolumbus.json"

def main():
    resp = requests.post(URL, headers=HEADERS, json={"query": QUERY}, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    vehicles = payload.get("data", {}).get("vehicles", [])
    cleaned = [
        {
            "id": v["id"],
            "line": v["line"],
            "lat": v["latitude"],
            "lon": v["longitude"],
            "bearing": v.get("bearing"),
            "updatedAt": v.get("updatedAt")
        }
        for v in vehicles if v.get("latitude") and v.get("longitude")
    ]

    result = {
        "meta": {
            "source": "Entur API – Kolumbus busser",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "count": len(cleaned)
        },
        "vehicles": cleaned
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH} with {len(cleaned)} Kolumbus buses.")

if __name__ == "__main__":
    main()
