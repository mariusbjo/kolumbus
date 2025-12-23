import requests, json, os, time, math
from utils.geometry_utils import convert_wkt_to_geojson
from utils.logger import log_message, print_progress

OUT_DIR = "data"
DEBUG_DIR = "data/debug_nvdb"
LOG_PATH = "data/speedlimits.log"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/105"

params = {
    "fylke": "11",   # Rogaland
    "srid": "4326",
    "antall": "100",
    "inkluder": "geometri,egenskaper"
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/json"
}

# ---------------------------------------------------------
# LOAD EXISTING IDS (resume-safe)
# ---------------------------------------------------------
existing_ids = set()
if os.path.exists(OUT_DIR):
    for fn in os.listdir(OUT_DIR):
        if fn.endswith(".json"):
            with open(os.path.join(OUT_DIR, fn), "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                    for item in data:
                        existing_ids.add(str(item.get("id")))
                except:
                    pass

print(f"▶️ Fant {len(existing_ids)} eksisterende objekter fra tidligere parts.")

os.makedirs(DEBUG_DIR, exist_ok=True)
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------
# RESUME FROM LAST URL
# ---------------------------------------------------------
resume_url = None
if os.path.exists(LOG_PATH):
    with open(LOG_PATH, "r", encoding="utf-8") as logf:
        for line in logf:
            if "Neste URL:" in line:
                resume_url = line.split("Neste URL:")[1].strip()

url = resume_url if resume_url else BASE_URL
if resume_url:
    print(f"▶️ Gjenopptar fra: {resume_url}")

# ---------------------------------------------------------
# STATE
# ---------------------------------------------------------
page_count = 0
total_objects = None
new_count = 0
avg_time = None
total_pages = None
buffer = []

CHUNK_SIZE = 10000
MAX_EMPTY_STREAK = 50
empty_streak = 0

def save_chunk(buffer, part_index):
    out_file = os.path.join(OUT_DIR, f"speedlimits_part{part_index}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(buffer, f, ensure_ascii=False, indent=2)
    log_message(f"💾 Lagret {len(buffer)} objekter til {out_file}")

# ---------------------------------------------------------
# MAIN LOOP
# ---------------------------------------------------------
while url:
    start_time = time.time()
    log_message(f"Henter side {page_count+1}: {url}")

    try:
        res = requests.get(url, params=params if url == BASE_URL else None, headers=headers)
    except Exception as e:
        log_message(f"❌ Nettverksfeil: {e}, prøver igjen om 2 sek...")
        time.sleep(2)
        continue

    if not res.ok:
        log_message(f"❌ Feil {res.status_code}: {res.text}, prøver igjen om 2 sek...")
        time.sleep(2)
        continue

    payload = res.json()

    # Debug dump
    with open(f"{DEBUG_DIR}/page_{page_count+1}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # Total count
    if page_count == 0:
        total_objects = payload.get("metadata", {}).get("totaltAntall")
        if total_objects:
            total_pages = math.ceil(total_objects / int(params["antall"]))
            log_message(f"Totalt antall objekter: {total_objects}")
            log_message(f"Forventet antall sider: {total_pages}")

    objekter = payload.get("objekter", [])
    log_message(f"Fant {len(objekter)} objekter")

    # Handle empty pages
    if len(objekter) == 0:
        empty_streak += 1
        log_message(f"⚠️ Tom side #{empty_streak}")

        if empty_streak >= MAX_EMPTY_STREAK:
            log_message("❌ For mange tomme sider på rad, stopper.")
            break

        # Retry same URL
        time.sleep(0.5)
        continue
    else:
        empty_streak = 0

    # Process objects
    for obj in objekter:
        obj_id = str(obj.get("id"))
        if obj_id in existing_ids:
            continue

        # Extract speed limit
        limit = None
        for e in obj.get("egenskaper", []):
            if e.get("navn") == "Fartsgrense":
                limit = e.get("verdi")
                break

        # Convert geometry
        geojson_geom = None
        geom_obj = obj.get("geometri")
        if geom_obj and "wkt" in geom_obj:
            geojson_geom = convert_wkt_to_geojson(geom_obj["wkt"])

        buffer.append({
            "id": obj_id,
            "geometry": geojson_geom,
            "speed_limit": limit
        })

        existing_ids.add(obj_id)
        new_count += 1

        # Save chunk
        if len(buffer) >= CHUNK_SIZE:
            part_index = len([fn for fn in os.listdir(OUT_DIR) if fn.endswith(".json")]) + 1
            save_chunk(buffer, part_index)
            buffer = []

    # Progress
    elapsed = time.time() - start_time
    avg_time = elapsed if avg_time is None else (avg_time * page_count + elapsed) / (page_count + 1)

    if total_pages:
        remaining_pages = total_pages - (page_count + 1)
        est_remaining = remaining_pages * avg_time
        print_progress(page_count+1, total_pages, est_remaining)

    # Pagination
    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        log_message(f"Neste URL: {url}")
        time.sleep(0.3)
    else:
        log_message("Ingen neste-side, ferdig.")
        url = None

    page_count += 1

# Save remaining
if buffer:
    part_index = len([fn for fn in os.listdir(OUT_DIR) if fn.endswith(".json")]) + 1
    save_chunk(buffer, part_index)

log_message(f"✅ Ferdig. Totalt nye objekter: {new_count}")
