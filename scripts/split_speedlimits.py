import json
import os
import math
import sys

DATA_DIR = "data"
MERGED_FILE = os.path.join(DATA_DIR, "speedlimits_merged.json")
CHUNK_SIZE = 10000  # juster ved behov
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def load_merged():
    if not os.path.exists(MERGED_FILE):
        print(f"❌ Merged-fil mangler: {MERGED_FILE}")
        sys.exit(1)

    try:
        with open(MERGED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Klarte ikke lese merged-fil: {e}")
        sys.exit(1)

    if not isinstance(data, list):
        print("❌ Merged-fil inneholder ikke en liste.")
        sys.exit(1)

    if len(data) == 0:
        print("❌ Merged-fil er tom. Avbryter.")
        sys.exit(1)

    print(f"📄 Merged-fil inneholder {len(data)} objekter.")
    return data


def remove_old_parts():
    print("🧹 Sletter gamle part-filer...")
    for fn in os.listdir(DATA_DIR):
        if fn.startswith("speedlimits_part") and fn.endswith(".json"):
            os.remove(os.path.join(DATA_DIR, fn))


def write_chunk(chunk, index):
    out_path = os.path.join(DATA_DIR, f"speedlimits_part{index}.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(chunk, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(out_path)
    print(f"💾 Lagret {len(chunk)} objekter til {out_path} ({size} bytes)")

    if size > MAX_FILE_SIZE:
        print(f"❌ Chunk {out_path} er større enn 100MB. Avbryter.")
        sys.exit(1)


def split_file():
    data = load_merged()
    total = len(data)

    # Sorter for stabilitet
    data = sorted(data, key=lambda x: x.get("id"))

    chunks = math.ceil(total / CHUNK_SIZE)
    print(f"🔪 Splitter {total} objekter i {chunks} chunk-filer...")

    remove_old_parts()

    for i in range(chunks):
        start = i * CHUNK_SIZE
        end = start + CHUNK_SIZE
        chunk = data[start:end]

        if not chunk:
            print(f"⚠️ Chunk {i+1} er tom. Hopper over.")
            continue

        write_chunk(chunk, i + 1)

    print("✅ Splitting fullført.")


if __name__ == "__main__":
    split_file()
