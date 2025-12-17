import requests, json, os, time, math
from datetime import datetime
from shapely import wkt

OUT_PATH = "data/speedlimits.json"
DEBUG_DIR = "data/debug_nvdb"
LOG_PATH = "data/speedlimits.log"

BASE_URL = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/105"

params = {
    "fylke": "11",   # Rogaland
    "srid": "4326",
    "antall": "100",  # hent 100 per side
    "inkluder": "geometri,egenskaper"
}

headers = {
    "X-Client": "marius-kolumbus-demo",
    "Accept": "application/json"
}

# Last inn eksisterende oppføringer hvis filen finnes
existing_ids = set()
speedlimits = []
if os.path.exists(OUT_PATH):
    with open(OUT_PATH, "r", encoding="utf-8") as f:
        try:
            loaded = json.load(f)
            if isinstance(loaded, list):
                speedlimits = loaded
                existing_ids = {str(item.get("id")) for item in speedlimits if "id" in item}
                print(f"Fant {len(existing_ids)} eksisterende oppføringer, hopper over disse.")
            else:
                print("⚠️ speedlimits.json var ikke en liste, starter på nytt.")
        except Exception:
            print("Kunne ikke lese eksisterende speedlimits.json, starter på nytt.")

os.makedirs(DEBUG_DIR, exist_ok=True)
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

# Resume: finn siste neste.href fra loggfilen
resume_url = None
if os.path.exists(LOG_PATH):
    with open(LOG_PATH, "r", encoding="utf-8") as logf:
        for line in logf:
            if "Neste URL:" in line:
                resume_url = line.split("Neste URL:")[1].strip()
if resume_url:
    print(f"▶️ Starter videre fra lagret URL: {resume_url}")
    url = resume_url
else:
    url = BASE_URL

page_count = 0
total_objects = None
new_count = 0
avg_time = None
total_pages = None
empty_streak = 0

MAX_PAGES = 500
EMPTY_LIMIT = 10

def log_message(msg):
    """Skriv melding både til terminal og loggfil med tidsstempel"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as logf:
        logf.write(line + "\n")

def print_progress(current_page, total_pages, est_remaining):
    bar_length = 40
    progress = current_page / total_pages
    filled = int(bar_length * progress)
    bar = "#" * filled + "-" * (bar_length - filled)
    msg = f"[{bar}] {progress*100:.1f}% | Estimert gjenværende tid: {est_remaining/60:.1f} min"
    log_message(msg)

def convert_wkt_to_geojson(wkt_str):
    """Konverter NVDB WKT til GeoJSON LineString"""
    try:
        geom = wkt.loads(wkt_str)
        coords = [(x, y) for x, y, *_ in geom.coords]  # ignorer Z
        return {"type": "LineString", "coordinates": coords}
    except Exception:
        return None

while url and page_count < MAX_PAGES:
    start_time = time.time()
    log_message(f"Henter side {page_count+1}: {url}")
    res = requests.get(url, params=params if url == BASE_URL else None, headers=headers)
    if not res.ok:
        log_message(f"❌ Feil ved henting: {res.status_code} {res.text}")
        break

    payload = res.json()

    # Sjekk totalt antall på første side
    if page_count == 0 and total_objects is None:
        total_objects = payload.get("metadata", {}).get("totaltAntall")
        if total_objects:
            total_pages = math.ceil(total_objects / int(params["antall"]))
            log_message(f"Totalt antall objekter i Rogaland: {total_objects}")
            log_message(f"Forventet antall sider: {total_pages}")
            if total_objects > 20000:
                log_message("❌ Avbryter: totaltAntall overstiger 20 000")
                break

    with open(f"{DEBUG_DIR}/page_{page_count+1}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    objekter = payload.get("objekter", [])
    log_message(f"Fant {len(objekter)} objekter på denne siden")

    if len(objekter) == 0:
        empty_streak += 1
        if empty_streak >= EMPTY_LIMIT:
            log_message(f"❌ Avbryter: {empty_streak} tomme sider på rad")
            break
    else:
        empty_streak = 0

    for obj in objekter:
        obj_id = str(obj.get("id"))
        if obj_id in existing_ids:
            continue
        egenskaper = obj.get("egenskaper", [])
        limit = None
        for e in egenskaper:
            if e.get("navn") == "Fartsgrense":
                limit = e.get("verdi")
                break

        geojson_geom = None
        geom_obj = obj.get("geometri")
        if geom_obj and "wkt" in geom_obj:
            geojson_geom = convert_wkt_to_geojson(geom_obj["wkt"])

        speedlimits.append({
            "id": obj_id,
            "geometry": geojson_geom,
            "speed_limit": limit
        })
        existing_ids.add(obj_id)
        new_count += 1

    elapsed = time.time() - start_time
    if avg_time is None:
        avg_time = elapsed
    else:
        avg_time = (avg_time * page_count + elapsed) / (page_count + 1)

    if total_pages:
        remaining_pages = total_pages - (page_count + 1)
        est_remaining = remaining_pages * avg_time
        log_message(f"➡️ Nye objekter lagt til så langt: {new_count}")
        print_progress(page_count+1, total_pages, est_remaining)

    neste = payload.get("metadata", {}).get("neste")
    if isinstance(neste, dict) and "href" in neste:
        url = neste["href"]
        log_message(f"Neste URL: {url}")
        time.sleep(0.5)
    else:
        url = None

    page_count += 1

    # Lagre hver 10. side
    if page_count % 10 == 0:
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(speedlimits, f, ensure_ascii=False, indent=2)
        log_message(f"💾 Lagret midlertidig etter {page_count} sider, totalt {len(speedlimits)} objekter")

# Lagre til slutt
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(speedlimits, f, ensure_ascii=False, indent=2)

log_message(f"✅ speedlimits.json skrevet med {len(speedlimits)} objekter totalt")
log_message(f"➕ Nye objekter lagt til denne kjøringen: {new_count}")
