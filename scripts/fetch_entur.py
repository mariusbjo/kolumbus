# scripts/fetch_entur.py
import os, json, requests
from datetime import datetime, timezone
from config import HEADERS_ENTUR

URL = "https://api.entur.io/journey-planner/v3/graphql"

# Ny spørring: vehicleActivity i stedet for vehicles
QUERY = """
query KolumbusVehicles {
  vehicleActivity(modes: [bus, coach], bbox: {
    minLat: 58.20,
    minLon: 4.80,
    maxLat: 59.60,
    maxLon: 6.60
  }) {
    vehicleRef
    lineRef
    mode
    location { latitude longitude }
    bearing
    recordedAtTime
  }
}
"""

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug_entur.json"

def main():
    try:
        resp = requests.post(URL, headers=HEADERS_ENTUR, json={"query": QUERY}, timeout=30)
        payload = resp.json()

        # Lagre alltid rårespons til debug.json
        os.makedirs(os.path.dirname(DEBUG_PATH), exist_ok=True)
        with open(DEBUG_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        if not resp.ok:
            print(f"❌ Feil fra Entur API: {resp.status_code} {resp.text}")
            return

        if "errors" in payload:
            print("⚠️ Entur svarte med feil:", payload["errors"])

        vehicles = payload.get("data", {}).get("vehicleActivity", [])

        cleaned = [
            {
                "id": v.get("vehicleRef"),
                "mode": v.get("mode"),
                "line": {
                    "publicCode": v.get("lineRef"),
                    "name": None
                },
                "lat": v.get("location", {}).get("latitude"),
                "lon": v.get("location", {}).get("longitude"),
                "bearing": v.get("bearing"),
                "updatedAt": v.get("recordedAtTime")
            }
            for v in vehicles if v.get("location", {}).get("latitude") and v.get("location", {}).get("longitude")
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
            print(f"⚠️ Ingen kjøretøy funnet. Wrote {OUT_PATH} with 0 entries. Se {DEBUG_PATH} for detaljer.")
        else:
            print(f"✅ Wrote {OUT_PATH} with {len(cleaned)} Kolumbus vehicles. Første ID: {cleaned[0]['id']}")

    except Exception as e:
        print("❌ Uventet feil:", e)

if __name__ == "__main__":
    main()
