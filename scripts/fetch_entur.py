# scripts/fetch_entur.py
import os
import json
import requests
from datetime import datetime, timezone

URL = "https://api.entur.io/journey-planner/v3/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "ET-Client-Name": os.getenv("ET_CLIENT_NAME", "marius-bjornor-kolumbus-pages-demo")
}

QUERY = """
query Vehicles {
  vehicles {
    id
    mode
    line {
      id
      publicCode
      name
    }
    latitude
    longitude
    bearing
    updatedAt
  }
}
"""

OUT_PATH = "data/entur.json"

def normalize(data):
    # Stripp ned til det viktigste og sorter for deterministisk output
    vehicles = data.get("data", {}).get("vehicles", []) or []
    cleaned = []
    for v in vehicles:
        if v.get("latitude") is None or v.get("longitude") is None:
            continue
        cleaned.append({
            "id": v.get("id"),
            "mode": v.get("mode"),
            "line": {
                "id": v.get("line", {}).get("id"),
                "publicCode": v.get("line", {}).get("publicCode"),
                "name": v.get("line", {}).get("name"),
            },
            "lat": v.get("latitude"),
            "lon": v.get("longitude"),
            "bearing": v.get("bearing"),
            "updatedAt": v.get("updatedAt"),
        })
    # Sorter stabilt for å minimere diff
    cleaned.sort(key=lambda x: (x["line"]["publicCode"] or "", x["id"] or ""))
    return {
        "meta": {
            "source": "Entur Journey Planner v3",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "count": len(cleaned),
        },
        "vehicles": cleaned,
    }

def main():
    resp = requests.post(URL, headers=HEADERS, json={"query": QUERY}, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    if "errors" in payload:
        raise RuntimeError(f"GraphQL errors: {payload['errors']}")

    normalized = normalize(payload)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    # Les nåværende fil for å unngå unødige commits
    old = None
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            try:
                old = json.load(f)
            except Exception:
                old = None

    # Dump deterministisk
    new_text = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    old_text = json.dumps(old, ensure_ascii=False, separators=(",", ":"), sort_keys=True) if old else None

    if new_text != old_text:
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"Wrote {OUT_PATH} with {normalized['meta']['count']} vehicles.")
    else:
        print("No changes detected; skipping write.")

if __name__ == "__main__":
    main()
