# scripts/fetch_gtfs.py
import os, json, requests
from datetime import datetime, timezone
from google.transit import gtfs_realtime_pb2

# Entur GTFS-RT Vehicle Positions feed
URL = "https://api.entur.io/realtime/v2/vehicles/graphql"
HEADERS = {
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug.json"

def main():
    feed = gtfs_realtime_pb2.FeedMessage()
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    feed.ParseFromString(resp.content)

    vehicles = []
    for entity in feed.entity:
        if entity.HasField("vehicle"):
            v = entity.vehicle
            pos = v.position
            # Filtrer på Kolumbus (agencyId starter med "KOL" eller "Kolumbus")
            agency_id = v.trip.trip_id if v.trip else ""
            if "Kolumbus" in agency_id or "KOL" in agency_id.upper():
                vehicles.append({
                    "id": v.vehicle.id,
                    "tripId": v.trip.trip_id,
                    "routeId": v.trip.route_id,
                    "agency": agency_id,
                    "lat": pos.latitude,
                    "lon": pos.longitude,
                    "bearing": pos.bearing,
                    "timestamp": v.timestamp
                })

    result = {
        "meta": {
            "source": "Entur GTFS-RT vehicle positions",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "count": len(vehicles)
        },
        "vehicles": vehicles
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    if len(vehicles) == 0:
        # fallback: lagre hele feeden som debug
        with open(DEBUG_PATH, "w", encoding="utf-8") as f:
            json.dump(json.loads(feed.__str__()), f, ensure_ascii=False, indent=2)
        print(f"No Kolumbus vehicles found. Wrote {OUT_PATH} with 0 entries and saved raw feed to {DEBUG_PATH}.")
    else:
        print(f"Wrote {OUT_PATH} with {len(vehicles)} Kolumbus vehicles.")

if __name__ == "__main__":
    main()
