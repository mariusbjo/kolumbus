import requests, json, os

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug_entur.json"

# Riktig endepunkt for sanntidskjøretøy
url = "https://api.entur.io/realtime/v1/vehicles/graphql"
headers = {
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-kolumbus-demo")
}

query = """
{
  vehicles(codespaceId:"KOL") {
    line { lineRef }
    lastUpdated
    location { latitude longitude }
  }
}
"""

print("Henter sanntidsdata fra Entur (Kolumbus)…")
res = requests.post(url, json={"query": query}, headers=headers)

data = res.json()
with open(DEBUG_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

vehicles = data.get("data", {}).get("vehicles", [])
print("Fant", len(vehicles), "kjøretøy")

entries = []
for v in vehicles:
    loc = v.get("location", {})
    if loc:
        entries.append({
            "id": v.get("id"),  # <- legg til kjøretøy-ID
            "lineRef": v.get("line", {}).get("lineRef"),
            "lat": loc.get("latitude"),
            "lon": loc.get("longitude"),
            "lastUpdated": v.get("lastUpdated")
        })

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)

print("✅ kolumbus.json skrevet med", len(entries), "kjøretøy")
