# scripts/utils/logger.py
from datetime import datetime

LOG_PATH = "data/speedlimits.log"

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
