import json
import os

DATA_DIR = "data"

def load_parts():
    files = sorted(
        f for f in os.listdir(DATA_DIR)
        if f.startswith("speedlimits_part") and f.endswith(".json")
    )
    print(f"Finner {len(files)} part-filer...")
    merged = {}

    for fn in files:
        path = os.path.join(DATA_DIR, fn)
        print(f"Leser {path}...")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                merged[item["id"]] = item

    print(f"Totalt unike objekter: {len(merged)}")
    return merged

def save_merged(merged):
    out_path = os.path.join(DATA_DIR, "speedlimits_merged.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(list(merged.values()), f, ensure_ascii=False, indent=2)
    print(f"Samlet fil lagret til {out_path}")

if __name__ == "__main__":
    merged = load_parts()
    save_merged(merged)
