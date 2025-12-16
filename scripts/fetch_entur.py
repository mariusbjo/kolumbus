# scripts/fetch_entur.py
import requests, json, os

OUT_PATH = "data/kolumbus.json"
DEBUG_PATH = "data/debug_entur.json"

url = "https://api.entur.io/journey-planner/v3/graphql"
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

payload = {"query": query}

print("Henter sanntidsdata fra Entur (Kolumbus)…")
res = requests.post(url, json=payload, headers=headers)

# Lagre både request og response til debug-fil
debug_info = {
    "request": {
        "url": url,
        "headers": dict(res.request.headers),
        "body": res.request.body.decode("utf-8") if res.request.body else None
    },
    "response": res.json()
}

os.makedirs(os.path.dirname(DEBUG_PATH), exist_ok=True)
with open(DEBUG_PATH, "w", encoding="utf-8") as f:
    json.dump(debug_info, f, ensure_ascii=False, indent=2)

data = debug_info["response"]
vehicles = data.get("data", {}).get("vehicles", [])
print("Fant", len(vehicles), "kjøretøy")

entries = []
for v in vehicles:
    loc = v.get("location", {})
    if loc:
        entries.append({
            "lineRef": v.get("line", {}).get("lineRef"),
            "lat": loc.get("latitude"),
            "lon": loc.get("longitude"),
            "lastUpdated": v.get("lastUpdated")
        })

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=2)

print("✅ kolumbus.json skrevet med", len(entries), "kjøretøy")
