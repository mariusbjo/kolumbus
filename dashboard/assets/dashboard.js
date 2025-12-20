(function () {
  const AUTO_REFRESH_SECONDS = 180; // 3 min
  let refreshRemaining = AUTO_REFRESH_SECONDS;

  const logEl = document.getElementById("log");

  /* ---------------------------------------------------------
     LOGGING
  --------------------------------------------------------- */
  function log(level, msg) {
    if (!logEl) return;
    const p = document.createElement("p");
    p.className = "log-line";

    const t = new Date().toISOString().slice(11, 19);
    const time = `<span class="time">[${t}]</span>`;

    let cls = "";
    if (level === "ok") cls = "level-ok";
    if (level === "warn") cls = "level-warn";
    if (level === "err") cls = "level-err";

    p.innerHTML = `${time} <span class="${cls}">${msg}</span>`;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------------------------------------------------------
     HELPERS
  --------------------------------------------------------- */
  function humanAgo(date) {
    if (!date) return "ukjent";
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return "mindre enn 1 min siden";
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m} min siden`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} t siden`;
    const d = Math.floor(h / 24);
    return `${d} d siden`;
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

  /* ---------------------------------------------------------
     THEME TOGGLE
  --------------------------------------------------------- */
  function setupThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    const html = document.documentElement;

    const stored = localStorage.getItem("dashboard-theme");
    if (stored === "light" || stored === "dark") {
      html.setAttribute("data-theme", stored);
    }

    toggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("dashboard-theme", next);
    });
  }

  /* ---------------------------------------------------------
     AUTO REFRESH
  --------------------------------------------------------- */
  function setupAutoRefresh() {
    const el = document.getElementById("refresh-countdown");

    function tick() {
      if (refreshRemaining <= 0) {
        log("ok", "Auto-refresh: laster dashboardet på nytt.");
        window.location.reload();
        return;
      }
      el.textContent = `${refreshRemaining}s`;
      refreshRemaining -= 1;
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------
     LOAD HASH + META
  --------------------------------------------------------- */
  async function loadMeta() {
    const hashFullEl = document.getElementById("hash-full");
    const hashShortEl = document.getElementById("hash-short");
    const deployTimeEl = document.getElementById("deploy-time");
    const deployAgeEl = document.getElementById("deploy-age");

    let ok = true;

    // HASH
    try {
      const hash = (await fetchText("meta/last_hash.txt")).trim();
      hashFullEl.textContent = hash;
      hashShortEl.textContent = hash.slice(0, 8) + "…";
      log("ok", "Leste datahash.");
    } catch {
      hashFullEl.textContent = "Fant ikke meta/last_hash.txt";
      hashShortEl.textContent = "–";
      ok = false;
      log("warn", "Klarte ikke å lese last_hash.txt.");
    }

    // DEPLOY TIME
    try {
      const epoch = parseInt((await fetchText("meta/last_deploy.txt")).trim(), 10);
      const date = new Date(epoch * 1000);
      deployTimeEl.textContent = date.toISOString().replace("T", " ").replace("Z", " UTC");
      deployAgeEl.textContent = humanAgo(date);
      log("ok", "Leste deploy-tid.");
    } catch {
      deployTimeEl.textContent = "ukjent";
      deployAgeEl.textContent = "ukjent";
      ok = false;
      log("warn", "Klarte ikke å lese last_deploy.txt.");
    }

    return ok;
  }

  /* ---------------------------------------------------------
     LOAD SPEEDLIMITS
  --------------------------------------------------------- */
  async function loadSpeedlimits() {
    const slFilesEl = document.getElementById("sl-files");
    const slSizeEl = document.getElementById("sl-size");
    const slStatusEl = document.getElementById("sl-status");

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
      } catch {
        break;
      }
      if (part > 200) break;
    }

    if (files === 0) {
      slFilesEl.textContent = "0";
      slSizeEl.textContent = "Ingen filer funnet";
      slStatusEl.textContent = "Feil";
      slStatusEl.classList.add("status-err");
      log("err", "Fant ingen speedlimits-delfiler.");
      return false;
    }

    const mb = totalBytes / (1024 * 1024);
    slFilesEl.textContent = files;
    slSizeEl.textContent = `${mb.toFixed(1)} MB`;
    slStatusEl.textContent = "OK";
    slStatusEl.classList.add("status-ok");

    log("ok", `Leste ${files} speedlimits-delfiler.`);
    return true;
  }

  /* ---------------------------------------------------------
     LOAD KOLUMBUS
  --------------------------------------------------------- */
  async function loadKolumbus() {
    const koCountEl = document.getElementById("ko-count");
    const koUpdatedEl = document.getElementById("ko-updated");
    const koStatusEl = document.getElementById("ko-status");

    try {
      const data = await fetchJson("data/kolumbus.json");
      const count = Array.isArray(data)
        ? data.length
        : data?.features?.length || 0;

      koCountEl.textContent = count;
      koUpdatedEl.textContent = "Oppdatert";
      koStatusEl.textContent = "OK";
      koStatusEl.classList.add("status-ok");

      log("ok", `Leste Kolumbus realtime (${count} objekter).`);
      return true;
    } catch {
      koCountEl.textContent = "–";
      koUpdatedEl.textContent = "Ingen data";
      koStatusEl.textContent = "Feil";
      koStatusEl.classList.add("status-err");

      log("err", "Klarte ikke å lese Kolumbus realtime.");
      return false;
    }
  }

  /* ---------------------------------------------------------
     UPDATE DEPLOY STATUS
  --------------------------------------------------------- */
  function updateDeployStatus() {
    const deployAgeEl = document.getElementById("deploy-age");
    const deployStatusEl = document.getElementById("deploy-status");

    const age = deployAgeEl.textContent;

    if (age.includes("t siden") || age.includes("d siden")) {
      deployStatusEl.textContent = "Varsel";
      deployStatusEl.classList.add("status-warn");
    } else if (age === "ukjent") {
      deployStatusEl.textContent = "Feil";
      deployStatusEl.classList.add("status-err");
    } else {
      deployStatusEl.textContent = "OK";
      deployStatusEl.classList.add("status-ok");
    }
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  async function init() {
    setupThemeToggle();
    setupAutoRefresh();

    log("ok", "Starter dashboard…");

    const metaOk = await loadMeta();
    const slOk = await loadSpeedlimits();
    const koOk = await loadKolumbus();

    updateDeployStatus();

    if (!metaOk || !slOk || !koOk) {
      log("warn", "Ett eller flere datasett mangler eller er ufullstendige.");
    } else {
      log("ok", "Alle datasett lastet inn.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
