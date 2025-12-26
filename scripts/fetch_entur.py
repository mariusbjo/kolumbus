import requests
import json
import os
import sys
import time

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug_entur.json"

API_URL = "https://api.entur.io/realtime/v1/vehicles/graphql"
HEADERS = {
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

# Entur har fjernet "id" → nytt felt er "vehicleId"
QUERY = """
{
  vehicles(codespaceId:"KOL") {
    vehicleId
    line { lineRef }
    lastUpdated
    location { latitude longitude }
  }
}
"""

MAX_RETRIES = 3
TIMEOUT = 10  # sekunder
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def safe_write_json(path, data):
    """Skriv JSON trygt til fil."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def fetch_entur():
    """Hent data fra Entur med retry og robust validering."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"🔄 Henter sanntidsdata fra Entur (forsøk {attempt}/{MAX_RETRIES})…")

            res = requests.post(
                API_URL,
                json={"query": QUERY},
                headers=HEADERS,
                timeout=TIMEOUT
            )

            if res.status_code != 200:
                print(f"⚠️ HTTP {res.status_code} fra Entur")
                time.sleep(2)
                continue

            # Forsøk å parse JSON
            try:
                data = res.json()
            except Exception as e:
                print(f"❌ API returnerte ikke gyldig JSON: {e}")
                time.sleep(2)
                continue

            # Lagre debug-data
            safe_write_json(DEBUG_PATH, data)

            # GraphQL-feil?
            if "errors" in data:
                print(f"❌ GraphQL-feil fra Entur: {data['errors']}")
                time.sleep(2)
                continue

            # Respons må inneholde "data"
            if not isinstance(data, dict) or "data" not in data:
                print("❌ Ugyldig respons – mangler 'data'-felt.")
                time.sleep(2)
                continue

            return data

        except requests.exceptions.Timeout:
            print("⏳ Timeout – prøver igjen…")
            time.sleep(2)

        except requests.exceptions.RequestException as e:
            print(f"❌ Nettverksfeil: {e}")
            time.sleep(2)

    print("❌ Klarte ikke hente data fra Entur etter flere forsøk.")
    return None


def validate_and_extract(data):
    """Valider API-respons og trekk ut kjøretøydata."""
    if not isinstance(data, dict):
        print("❌ API-respons er ikke et JSON-objekt.")
        return []

    vehicles = data.get("data", {}).get("vehicles")
    if not isinstance(vehicles, list):
        print("❌ 'vehicles' mangler eller er ikke en liste.")
        return []

    print(f"🚍 Fant {len(vehicles)} kjøretøy")

    entries = []
    for v in vehicles:
        loc = v.get("location") or {}
        lat = loc.get("latitude")
        lon = loc.get("longitude")

        # Hopp over kjøretøy uten posisjon
        if lat is None or lon is None:
            continue

        entries.append({
            "id": v.get("vehicleId"),
            "lineRef": v.get("line", {}).get("lineRef"),
            "lat": lat,
            "lon": lon,
            "lastUpdated": v.get("lastUpdated")
        })

    return entries


def enforce_file_size(path):
    """Sjekk at filen ikke overstiger GitHub sin 100MB-grense."""
    size = os.path.getsize(path)
    if size > MAX_FILE_SIZE:
        print(f"❌ Filen {path} er for stor ({size} bytes). Sletter.")
        os.remove(path)
        sys.exit(1)


def main():
    data = fetch_entur()

    if not data:
        print("❌ Ingen data hentet – avbryter.")
        sys.exit(1)

    entries = validate_and_extract(data)

    # Skriv kolumbus.json
    safe_write_json(OUT_PATH, entries)
    enforce_file_size(OUT_PATH)

    print(f"✅ kolumbus.json skrevet med {len(entries)} kjøretøy")


if __name__ == "__main__":
    main()
