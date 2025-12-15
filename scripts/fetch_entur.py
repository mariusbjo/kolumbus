# scripts/fetch_entur.py
import os, json, requests
from datetime import datetime, timezone
from config import HEADERS_ENTUR

URL = "https://api.entur.io/journey-planner/v3/graphql"

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
    try:
        resp = requests.post(URL, headers=HEADERS_ENTUR, json={"query": QUERY}, timeout=30)
        if not resp.ok:
            print(f"❌ Feil fra Entur API: {resp.status_code} {resp.text}")
            return

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
            with open(DEBUG_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            print(f"⚠️ Ingen kjøretøy funnet. Wrote {OUT_PATH} with 0 entries and saved raw response to {DEBUG_PATH}.")
        else:
            print(f"✅ Wrote {OUT_PATH} with {len(cleaned)} Kolumbus vehicles. Første ID: {cleaned[0]['id']}")

    except Exception as e:
        print("❌ Uventet feil:", e)

if __name__ == "__main__":
    main()
