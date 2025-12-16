import requests, json, os

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug_entur.json"

url = "https://api.entur.io/journey-planner/v3/graphql"
headers = {
    "ET-Client-Name": "marius-kolumbus-demo"
}

query = """
query {
  vehicles(authorities: ["KOL"]) {
    id
    bearing
    line { id publicCode name }
    location { latitude longitude }
  }
}
"""

print("Henter sanntidsdata fra Entur…")
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
            "id": v.get("id"),
            "line": v.get("line", {}).get("publicCode"),
            "lineName": v.get("line", {}).get("name"),
            "lat": loc.get("latitude"),
            "lon": loc.get("longitude"),
            "bearing": v.get("bearing")
        })

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)

print("✅ kolumbus.json skrevet med", len(entries), "kjøretøy")
