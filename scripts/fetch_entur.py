# scripts/fetch_entur.py
import os, json, requests
from datetime import datetime, timezone

URL = "https://api.entur.io/journey-planner/v3/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

QUERY = """
query KolumbusVehicles {
  vehicles(modes: [bus, coach], bbox: {
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
    bearing
    updatedAt
  }
}
"""

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug.json"

def main():
    resp = requests.post(URL, headers=HEADERS, json={"query": QUERY}, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    vehicles = payload.get("data", {}).get("vehicles", [])
    cleaned = [
        {
            "id": v.get("id"),
            "mode": v.get("mode"),
            "line": {
                "publicCode": v.get("line", {}).get("publicCode"),
                "name": v.get("line", {}).get("name")
            },
            "lat": v.get("latitude"),
            "lon": v.get("longitude"),
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

    if len(cleaned) == 0:
        # fallback: lagre hele råresponsen for feilsøking
        with open(DEBUG_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"No vehicles found. Wrote {OUT_PATH} with 0 entries and saved raw response to {DEBUG_PATH}.")
    else:
        print(f"Wrote {OUT_PATH} with {len(cleaned)} Kolumbus vehicles.")

if __name__ == "__main__":
    main()
