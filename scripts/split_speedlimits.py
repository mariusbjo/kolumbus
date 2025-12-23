import json
import os
import math

DATA_DIR = "data"
MERGED_FILE = os.path.join(DATA_DIR, "speedlimits_merged.json")
CHUNK_SIZE = 10000  # juster ved behov

def split_file():
    with open(MERGED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    total = len(data)
    chunks = math.ceil(total / CHUNK_SIZE)

    print(f"Splitter {total} objekter i {chunks} filer...")

    # Slett gamle part-filer
    for fn in os.listdir(DATA_DIR):
        if fn.startswith("speedlimits_part") and fn.endswith(".json"):
            os.remove(os.path.join(DATA_DIR, fn))

    # Lag nye part-filer
    for i in range(chunks):
        start = i * CHUNK_SIZE
        end = start + CHUNK_SIZE
        chunk = data[start:end]

        out_path = os.path.join(DATA_DIR, f"speedlimits_part{i+1}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, indent=2)

        print(f"Lagret {len(chunk)} objekter til {out_path}")

if __name__ == "__main__":
    split_file()
