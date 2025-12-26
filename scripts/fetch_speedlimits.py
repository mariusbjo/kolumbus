import requests
import json
import os
import time
import math
import sys

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

CHUNK_SIZE = 10000
MAX_EMPTY_STREAK = 50
MAX_ERROR_STREAK = 10


def load_existing_ids():
    """
    Les eksisterende ID-er fra tidligere part-filer.
    Vi ser KUN på speedlimits_part*.json for å unngå støy.
    """
    existing_ids = set()

    if not os.path.exists(OUT_DIR):
        return existing_ids

    part_files = sorted(
        f for f in os.listdir(OUT_DIR)
        if f.startswith("speedlimits_part") and f.endswith(".json")
    )

    log_message(f"▶️ Skanner {len(part_files)} eksisterende part-filer for ID-er...")

    for fn in part_files:
        path = os.path.join(OUT_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, list):
                    log_message(f"⚠️ {path} inneholder ikke en liste – hopper over.")
                    continue
                for item in data:
                    existing_ids.add(str(item.get("id")))
        except Exception as e:
            log_message(f"⚠️ Klarte ikke lese {path}: {e}")

    log_message(f"▶️ Fant {len(existing_ids)} eksisterende objekter totalt.")
    return existing_ids


def load_resume_url():
    """
    Prøv å finne siste 'Neste URL' fra logg-filen.
    """
    if not os.path.exists(LOG_PATH):
        return None

    resume_url = None
    with open(LOG_PATH, "r", encoding="utf-8") as logf:
        for line in logf:
            if "Neste URL:" in line:
                resume_url = line.split("Neste URL:")[1].strip()

    if resume_url:
        log_message(f"▶️ Gjenopptar fra: {resume_url}")
    return resume_url


def save_chunk(buffer, part_index):
    out_file = os.path.join(OUT_DIR, f"speedlimits_part{part_index}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(buffer, f, ensure_ascii=False, indent=2)
    log_message(f"💾 Lagret {len(buffer)} objekter til {out_file}")


def get_next_part_index():
    """
    Finn neste part-indeks basert på eksisterende part-filer.
    """
    if not os.path.exists(OUT_DIR):
        return 1

    part_files = [
        fn for fn in os.listdir(OUT_DIR)
        if fn.startswith("speedlimits_part") and fn.endswith(".json")
    ]

    if not part_files:
        return 1

    indices = []
    for fn in part_files:
        try:
            num = int(fn.replace("speedlimits_part", "").replace(".json", ""))
            indices.append(num)
        except ValueError:
            continue

    return max(indices) + 1 if indices else 1


def main():
    os.makedirs(DEBUG_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    existing_ids = load_existing_ids()
    resume_url = load_resume_url()

    url = resume_url if resume_url else BASE_URL

    page_count = 0
    total_objects = None
    new_count = 0
    avg_time = None
    total_pages = None
    buffer = []

    empty_streak = 0
    error_streak = 0
    part_index = get_next_part_index()

    while url:
        start_time = time.time()
        log_message(f"Henter side {page_count + 1}: {url}")

        try:
            res = requests.get(
                url,
                params=params if url == BASE_URL else None,
                headers=headers,
                timeout=30
            )
        except Exception as e:
            error_streak += 1
            log_message(f"❌ Nettverksfeil: {e} (streak={error_streak}), prøver igjen om 5 sek...")
            if error_streak >= MAX_ERROR_STREAK:
                log_message("❌ For mange nettverksfeil på rad. Stopper.")
                break
            time.sleep(5)
            continue

        if not res.ok:
            error_streak += 1
            log_message(f"❌ Feil {res.status_code}: {res.text[:500]} (streak={error_streak}), prøver igjen om 5 sek...")
            if error_streak >= MAX_ERROR_STREAK:
                log_message("❌ For mange HTTP-feil på rad. Stopper.")
                break
            time.sleep(5)
            continue
        else:
            error_streak = 0

        try:
            payload = res.json()
        except Exception as e:
            error_streak += 1
            log_message(f"❌ Klarte ikke parse JSON: {e} (streak={error_streak})")
            if error_streak >= MAX_ERROR_STREAK:
                log_message("❌ For mange JSON-feil på rad. Stopper.")
                break
            time.sleep(5)
            continue

        debug_path = os.path.join(DEBUG_DIR, f"page_{page_count + 1}.json")
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log_message(f"⚠️ Klarte ikke skrive debug-fil {debug_path}: {e}")

        if page_count == 0:
            total_objects = payload.get("metadata", {}).get("totaltAntall")
            if isinstance(total_objects, int):
                total_pages = math.ceil(total_objects / int(params["antall"]))
                log_message(f"Totalt antall objekter: {total_objects}")
                log_message(f"Forventet antall sider: {total_pages}")

        objekter = payload.get("objekter", [])
        log_message(f"Fant {len(objekter)} objekter på denne siden.")

        if len(objekter) == 0:
            empty_streak += 1
            log_message(f"⚠️ Tom side #{empty_streak}")

            if empty_streak >= MAX_EMPTY_STREAK:
                log_message("❌ For mange tomme sider på rad, stopper.")
                break

            time.sleep(0.5)
            page_count += 1
            continue
        else:
            empty_streak = 0

        for obj in objekter:
            obj_id = str(obj.get("id"))
            if obj_id in existing_ids:
                continue

            limit = None
            for e in obj.get("egenskaper", []):
                if e.get("navn") == "Fartsgrense":
                    limit = e.get("verdi")
                    break

            geojson_geom = None
            geom_obj = obj.get("geometri")
            if geom_obj and "wkt" in geom_obj:
                try:
                    geojson_geom = convert_wkt_to_geojson(geom_obj["wkt"])
                except Exception as e:
                    log_message(f"⚠️ Klarte ikke konvertere WKT for id={obj_id}: {e}")

            buffer.append({
                "id": obj_id,
                "geometry": geojson_geom,
                "speed_limit": limit
            })

            existing_ids.add(obj_id)
            new_count += 1

            if len(buffer) >= CHUNK_SIZE:
                save_chunk(buffer, part_index)
                part_index += 1
                buffer = []

        elapsed = time.time() - start_time
        avg_time = elapsed if avg_time is None else (avg_time * page_count + elapsed) / (page_count + 1)

        if total_pages:
            remaining_pages = total_pages - (page_count + 1)
            est_remaining = remaining_pages * avg_time
            print_progress(page_count + 1, total_pages, est_remaining)

        neste = payload.get("metadata", {}).get("neste")
        if isinstance(neste, dict) and "href" in neste:
            url = neste["href"]
            log_message(f"Neste URL: {url}")
            time.sleep(0.3)
        else:
            log_message("Ingen neste-side, ferdig.")
            url = None

        page_count += 1

    if buffer:
        save_chunk(buffer, part_index)

    log_message(f"✅ Ferdig. Totalt nye objekter i denne kjøringen: {new_count}")


if __name__ == "__main__":
    main()
