# scripts/fetch_entur.py
import os, json, requests
from datetime import datetime, timezone

URL = "https://api.entur.io/realtime/v2/vehicles/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

QUERY = """
{
  vehicles(codespaceId:"KOL") {
    vehicleId
    lastUpdated
    location { latitude longitude }
    line { publicCode }
    bearing
  }
}
"""

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug.json"

def main():
    try:
        resp = requests.post(URL, headers=HEADERS, json={"query": QUERY}, timeout=30)
        resp.raise_for_status()
        payload = resp.json()

        vehicles = payload.get("data", {}).get("vehicles", [])
        cleaned = [
            {
                "vehicleId": v.get("vehicleId"),
                "line": {
                    "publicCode": v.get("line", {}).get("publicCode")
                },
                "lat": v.get("location", {}).get("latitude"),
                "lon": v.get("location", {}).get("longitude"),
                "bearing": v.get("bearing"),
                "lastUpdated": v.get("lastUpdated")
            }
            for v in vehicles if v.get("location")
        ]

        result = {
            "meta": {
                "source": "Entur Realtime Vehicles API (Kolumbus)",
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
            print(f"No Kolumbus vehicles found. Wrote {OUT_PATH} with 0 entries and saved raw response to {DEBUG_PATH}.")
        else:
            print(f"Wrote {OUT_PATH} with {len(cleaned)} Kolumbus vehicles.")

    except Exception as e:
        print(f"Error fetching vehicles: {e}")

if __name__ == "__main__":
    main()
