import json
import os
import sys

DATA_DIR = "data"
OUT_PATH = os.path.join(DATA_DIR, "speedlimits_merged.json")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def load_parts():
    files = sorted(
        f for f in os.listdir(DATA_DIR)
        if f.startswith("speedlimits_part") and f.endswith(".json")
    )

    print(f"🔍 Finner {len(files)} part-filer...")

    if not files:
        print("❌ Ingen part-filer funnet. Avbryter merge.")
        sys.exit(1)

    merged = {}
    duplicate_count = 0

    for fn in files:
        path = os.path.join(DATA_DIR, fn)
        print(f"📄 Leser {path}...")

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"❌ Klarte ikke lese {path}: {e}")
            continue

        if not isinstance(data, list):
            print(f"❌ Filen {path} inneholder ikke en liste. Hopper over.")
            continue

        print(f"   → {len(data)} objekter")

        for item in data:
            if not isinstance(item, dict):
                print(f"⚠️ Ugyldig objekt i {path}: ikke et dict. Hopper over.")
                continue

            if "id" not in item:
                print(f"⚠️ Objekt uten ID i {path}. Hopper over.")
                continue

            obj_id = item["id"]

            if obj_id in merged:
                duplicate_count += 1

            merged[obj_id] = item

    print(f"🔢 Totalt unike objekter: {len(merged)}")
    print(f"♻️ Duplikater overskrevet: {duplicate_count}")

    return merged


def save_merged(merged):
    # Sorter for stabilitet
    sorted_items = sorted(merged.values(), key=lambda x: x["id"])

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_items, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(OUT_PATH)
    print(f"💾 Samlet fil lagret til {OUT_PATH} ({size} bytes)")

    if size > MAX_FILE_SIZE:
        print("❌ Merged-fil er større enn 100MB. Dette vil feile i deploy.")
        sys.exit(1)


if __name__ == "__main__":
    merged = load_parts()
    save_merged(merged)
