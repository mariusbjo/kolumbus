(function () {
  const AUTO_REFRESH_SECONDS = 180; // 3 min
  let refreshRemaining = AUTO_REFRESH_SECONDS;
  let refreshTimer = null;

  const logEl = document.getElementById("log");

  function log(level, msg) {
    if (!logEl) return;
    const p = document.createElement("p");
    p.className = "log-line";
    const t = new Date().toISOString().slice(11, 19);
    const spanTime = document.createElement("span");
    spanTime.className = "time";
    spanTime.textContent = `[${t}] `;
    const spanMsg = document.createElement("span");
    if (level === "ok") spanMsg.className = "level-ok";
    else if (level === "warn") spanMsg.className = "level-warn";
    else if (level === "err") spanMsg.className = "level-err";
    spanMsg.textContent = msg;
    p.appendChild(spanTime);
    p.appendChild(spanMsg);
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function humanAgo(date) {
    if (!date) return "ukjent";
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "for mindre enn ett minutt siden";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `for ${diffMin} min siden`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `for ${diffH} t siden`;
    const diffD = Math.floor(diffH / 24);
    return `for ${diffD} d siden`;
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  async function loadMetaAndHash() {
    const hashFullEl = document.getElementById("hash-full");
    const hashShortEl = document.getElementById("hash-short");
    const globalStatusDot = document.getElementById("global-status-dot");
    const globalStatusText = document.getElementById("global-status-text");
    const deployTimeEl = document.getElementById("deploy-time");
    const deployAgeEl = document.getElementById("deploy-age");
    const lastDeployHumanEl = document.getElementById("last-deploy-human");

    let ok = true;

    try {
      const hash = await fetchText("meta/last_hash.txt");
      const trimmed = hash.trim();
      hashFullEl.textContent = trimmed || "(tom hash)";
      hashShortEl.textContent = trimmed ? trimmed.slice(0, 8) + "…" : "–";
      log("ok", "Leste data-hash fra meta/last_hash.txt.");
    } catch (e) {
      hashFullEl.textContent =
        "Fant ikke meta/last_hash.txt – har deploy-workflowet kjørt med hash-støtte?";
      hashShortEl.textContent = "–";
      log("warn", "Klarte ikke å lese meta/last_hash.txt.");
      ok = false;
    }

    try {
      const txt = await fetchText("meta/last_deploy.txt");
      const epoch = parseInt(txt.trim(), 10);
      if (!isNaN(epoch)) {
        const date = new Date(epoch * 1000);
        const iso = date.toISOString().replace("T", " ").replace("Z", " UTC");
        deployTimeEl.textContent = iso;
        deployAgeEl.textContent = humanAgo(date);
        lastDeployHumanEl.textContent = humanAgo(date);
        log("ok", `Siste deploy: ${iso}.`);
      } else {
        deployTimeEl.textContent = "ukjent";
        deployAgeEl.textContent = "ukjent alder";
        lastDeployHumanEl.textContent = "ukjent";
        log("warn", "meta/last_deploy.txt inneholder ikke gyldig epoch.");
        ok = false;
      }
    } catch (e) {
      deployTimeEl.textContent = "ukjent";
      deployAgeEl.textContent = "ukjent alder";
      lastDeployHumanEl.textContent = "ukjent";
      log("warn", "Fant ikke meta/last_deploy.txt.");
      ok = false;
    }

    try {
      const v = await fetchJson("meta/version.json");
      if (v && v.updated) {
        document.getElementById("pipeline-state").textContent = "OK";
        document.getElementById("pipeline-detail").textContent =
          "Versjonsmetadata lest fra meta/version.json.";
        log("ok", "Leste meta/version.json.");
      }
    } catch (e) {
      log("warn", "Klarte ikke å lese meta/version.json.");
    }

    if (ok) {
      globalStatusDot.style.background = "#22c55e";
      globalStatusText.textContent = "Datastrøm normal";
    } else {
      globalStatusDot.style.background = "#eab308";
      globalStatusText.textContent = "Delvis status – sjekk logg";
    }
  }

  async function loadKolumbus() {
    const koCountEl = document.getElementById("ko-count");
    const koUpdatedEl = document.getElementById("ko-updated");

    try {
      const data = await fetchJson("data/kolumbus.json");
      const count = Array.isArray(data)
        ? data.length
        : data && data.features
        ? data.features.length
        : 0;
      koCountEl.textContent = count || "0";
      koUpdatedEl.textContent = "kilde: data/kolumbus.json";
      log("ok", `Leste Kolumbus-data (${count} objekter).`);
      return { ok: true, count };
    } catch (e) {
      koCountEl.textContent = "–";
      koUpdatedEl.textContent = "fant ikke data/kolumbus.json";
      log("warn", "Klarte ikke å lese data/kolumbus.json.");
      return { ok: false, count: 0 };
    }
  }

  async function loadSpeedlimits() {
    const slFilesEl = document.getElementById("sl-files");
    const slSizeEl = document.getElementById("sl-size");

    let part = 1;
    let files = 0;
    let totalBytes = 0;

    while (true) {
      const url = `data/speedlimits_part${part}.json`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) break;
        const text = await res.text();
        files++;
        totalBytes += new Blob([text]).size;
        part++;
      } catch (e) {
        break;
      }
      if (part > 200) break; // sanity guard
    }

    if (files === 0) {
      slFilesEl.textContent = "0";
      slSizeEl.textContent = "Ingen delfiler funnet i /data.";
      log("warn", "Fant ingen speedlimits_partX.json i /data.");
      return { ok: false, files: 0, totalBytes: 0 };
    }

    const mb = totalBytes / (1024 * 1024);
    slFilesEl.textContent = `${files}`;
    slSizeEl.textContent = `${files} filer – ca. ${mb.toFixed(1)} MB`;
    log("ok", `Leste ${files} speedlimits-delfiler (~${mb.toFixed(1)} MB).`);

    return { ok: true, files, totalBytes };
  }

  function updateDatasetBadge(okSl, okKo) {
    const dot = document.getElementById("datasets-badge-dot");
    const text = document.getElementById("datasets-badge-text");
    if (okSl && okKo) {
      dot.className = "badge-dot";
      text.textContent = "Begge datasett tilgjengelige";
    } else if (okSl || okKo) {
      dot.className = "badge-dot badge-dot-warn";
      text.textContent = "Delvis tilgjengelig";
    } else {
      dot.className = "badge-dot badge-dot-err";
      text.textContent = "Ingen datasett tilgjengelig";
    }
  }

  function updateDeployBadge() {
    const dot = document.getElementById("deploy-badge-dot");
    const text = document.getElementById("deploy-badge-text");
    const deployAgeEl = document.getElementById("deploy-age");
    const ageText = deployAgeEl.textContent || "";
    if (ageText.includes("t siden") || ageText.includes("d siden")) {
      dot.className = "badge-dot badge-dot-warn";
      text.textContent = "Deploy kan være utdatert";
    } else if (ageText === "ukjent alder") {
      dot.className = "badge-dot badge-dot-warn";
      text.textContent = "Deploy-ukjent";
    } else {
      dot.className = "badge-dot";
      text.textContent = "Deploy ok";
    }
  }

  function updateFreshnessIndicator() {
    const dot = document.getElementById("freshness-dot");
    const text = document.getElementById("freshness-text");
    const deployAgeEl = document.getElementById("deploy-age");
    const age = deployAgeEl.textContent || "";
    if (age.includes("t siden") || age.includes("d siden") || age === "ukjent alder") {
      dot.className = "status-dot status-dot-warn";
      text.textContent =
        "Datastrøm kan være eldre enn 3 timer – sjekk workflow-runner ved behov.";
    } else {
      dot.className = "status-dot";
      text.textContent = "Datastrøm er synkron og nyere enn ~3 timer.";
    }
  }

  function setupThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    const html = document.documentElement;
    const stored = localStorage.getItem("dashboard-theme");

    if (stored === "light" || stored === "dark") {
      html.setAttribute("data-theme", stored);
    } else {
      // default dark
      html.setAttribute("data-theme", "dark");
    }

    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("dashboard-theme", next);
    });
  }

  function setupAutoRefresh() {
    const el = document.getElementById("refresh-countdown");
    if (!el) return;

    function tick() {
      if (refreshRemaining <= 0) {
        log("ok", "Auto-refresh: laster dashboardet på nytt.");
        window.location.reload();
        return;
      }
      el.textContent = `om ${refreshRemaining}s`;
      refreshRemaining -= 1;
    }

    tick();
    refreshTimer = setInterval(tick, 1000);
  }

  async function init() {
    try {
      setupThemeToggle();
      setupAutoRefresh();
      log("ok", "Starter lesing av metadata og datasett…");

      await loadMetaAndHash();
      const sl = await loadSpeedlimits();
      const ko = await loadKolumbus();

      updateDatasetBadge(sl.ok, ko.ok);
      updateDeployBadge();
      updateFreshnessIndicator();

      if (!sl.ok || !ko.ok) {
        document.getElementById("pipeline-state").textContent = "Varsel";
        document.getElementById("pipeline-detail").textContent =
          "Ett eller flere datasett mangler – se logg over.";
      }
    } catch (e) {
      log("err", "Uventet feil i dashboard-logikken: " + e.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

