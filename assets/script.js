// assets/script.js
import { ENTUR_URL, CLIENT_NAME, UPDATE_INTERVAL } from './config.js';
import { haversine, loadSpeedLimits, getSpeedLimitForPosition } from './utils.js';
import { busIcon, speedIcon, busCombinedIcon } from './icons.js';

const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markers = {};
let history = {};
let followBusId = null;
let routeLayer = null;
let speedMarkers = [];
let speedBadgeMarkers = {}; // beholdes for sikkerhet

// -----------------------------------------------------
// PREMIUM ZOOM CONTROL (slider, +/-, fit, reset, draggable)
// -----------------------------------------------------
const zoomSlider = document.getElementById("zoom-slider");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomFitBtn = document.getElementById("zoom-fit");
const zoomResetBtn = document.getElementById("zoom-reset");
const zoomPanel = document.querySelector(".zoom-control");

// Init slider med nåværende zoom
if (zoomSlider) {
  zoomSlider.value = map.getZoom();

  // Slider → kart
  zoomSlider.oninput = () => {
    map.setZoom(parseInt(zoomSlider.value));
  };

  // Kart → slider
  map.on("zoomend", () => {
    zoomSlider.value = map.getZoom();
  });
}

// Knapper
if (zoomInBtn) zoomInBtn.onclick = () => map.zoomIn();
if (zoomOutBtn) zoomOutBtn.onclick = () => map.zoomOut();

// Fit-route: zoom til hele ruten hvis vi følger en buss og har rute
if (zoomFitBtn) {
  zoomFitBtn.onclick = () => {
    if (routeLayer) {
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    }
  };
}

// -----------------------------------------------------
// ZOOM-ADAPTIVE IKONER
// -----------------------------------------------------
let currentScale = 1;
const BEST_VIEW_ZOOM = 17; // zoom når bruker klikker på buss

function getScaleForZoom(z) {
  return Math.min(1.8, Math.max(0.6, z / 10));
}

map.on("zoomend", () => {
  currentScale = getScaleForZoom(map.getZoom());
});

// -----------------------------------------------------
// SMOOTH ANIMASJON
// -----------------------------------------------------
function animateMarker(marker, from, to, duration = 500) {
  const start = performance.now();

  function frame(t) {
    const progress = Math.min((t - start) / duration, 1);
    const lat = from.lat + (to.lat - from.lat) * progress;
    const lon = from.lng + (to.lng - from.lng) * progress;

    marker.setLatLng([lat, lon]);

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// -----------------------------------------------------
// MINIMUMSAVSTAND FOR HISTORISKE FARTSIKONER (zoom-adaptiv)
// -----------------------------------------------------
function getMinHistoryDistanceMeters() {
  const z = map.getZoom();
  const scale = Math.pow(2, z - BEST_VIEW_ZOOM);
  const baseDistance = 20; // meter ved BEST_VIEW_ZOOM
  return baseDistance * scale;
}

// -----------------------------------------------------
// SMART RESET VIEW (kompass): husk utsnitt før follow
// -----------------------------------------------------
let prevViewCenter = null;
let prevViewZoom = null;

if (zoomResetBtn) {
  zoomResetBtn.onclick = () => {
    if (prevViewCenter && typeof prevViewZoom === "number") {
      // Stopp følge-modus og rydd overlays
      stopFollow(false); // ikke nullstill prevView*

      // Gå tilbake til tidligere utsnitt
      map.setView(prevViewCenter, prevViewZoom);

      // Nullstill lagret view
      prevViewCenter = null;
      prevViewZoom = null;
    }
  };
}

// -----------------------------------------------------
// DRAGGABLE ZOOM-PANEL
// -----------------------------------------------------
if (zoomPanel) {
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  zoomPanel.addEventListener("mousedown", (e) => {
    // Ikke start drag når man klikker på knapper eller slider
    const target = e.target;
    if (
      target.tagName === "BUTTON" ||
      target.id === "zoom-slider" ||
      target.closest("button")
    ) {
      return;
    }

    isDragging = true;
    const rect = zoomPanel.getBoundingClientRect();

    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Lås panel til eksplisitt left/top når vi begynner å dra
    zoomPanel.style.left = rect.left + "px";
    zoomPanel.style.top = rect.top + "px";
    zoomPanel.style.bottom = "auto";
    zoomPanel.style.transform = "none";

    const onMove = (ev) => {
      if (!isDragging) return;
      zoomPanel.style.left = ev.clientX - dragOffsetX + "px";
      zoomPanel.style.top = ev.clientY - dragOffsetY + "px";
    };

    const onUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// Klikk i kartet stopper følge-modus
map.on("click", () => stopFollow());

// Last inn fartsgrense-cache ved oppstart
await loadSpeedLimits();

async function loadKolumbusLive() {
  try {
    const query = `
    { vehicles(codespaceId:"KOL") {
        vehicleId
        lastUpdated
        location { latitude longitude }
        line { publicCode }
        bearing
      } }
    `;

    const res = await fetch(ENTUR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": CLIENT_NAME
      },
      body: JSON.stringify({ query })
    });

    const payload = await res.json();
    const vehicles = payload.data?.vehicles || [];

    for (const v of vehicles) {
      const id = v.vehicleId;
      const pos = [v.location.latitude, v.location.longitude];
      const code = v.line?.publicCode ?? "—";

      const now = new Date(v.lastUpdated).getTime();
      if (!history[id]) history[id] = [];
      const prev = history[id].slice(-1)[0];

      // Beregn fart
      let speed = null;
      if (prev) {
        const dt = (now - prev.timestamp) / 1000;
        const dist = haversine(prev.lat, prev.lon, pos[0], pos[1]);
        if (dt > 0) speed = (dist / dt) * 3.6;
      }

      // Finn fartsgrense
      const speedLimit = getSpeedLimitForPosition(pos[0], pos[1]);

      // Logg historikk
      history[id].push({
        lat: pos[0],
        lon: pos[1],
        timestamp: now,
        speed,
        speedLimit
      });

      const cutoff = now - 30 * 60 * 1000;
      history[id] = history[id].filter(p => p.timestamp >= cutoff);

      // -----------------------------------------------------
      // SANNTIDSBUSS: Kombinert ikon (buss + fart + scale)
      // -----------------------------------------------------
      const icon = busCombinedIcon(speed, speedLimit, currentScale);

      if (!markers[id]) {
        const popup = `
          <strong>Linje ${code}</strong><br>
          ID: ${id}<br>
          Oppdatert: ${v.lastUpdated}
        `;

        markers[id] = L.marker(pos, { icon })
          .bindPopup(popup)
          .addTo(map);

        markers[id].on("click", (e) => {
          e.originalEvent.cancelBubble = true;
          followBus(id);
        });

      } else {
        const prevPos = markers[id].getLatLng();
        const newPos = L.latLng(pos[0], pos[1]);

        // Smooth animasjon
        animateMarker(markers[id], prevPos, newPos);

        // Oppdater ikon (scale + fart)
        markers[id].setIcon(icon);
      }
    }

    // -----------------------------------------------------
    // FØLG BUSS-MODUS (uten auto-follow)
    // -----------------------------------------------------
    if (followBusId && history[followBusId]) {
      if (routeLayer) map.removeLayer(routeLayer);
      speedMarkers.forEach(m => map.removeLayer(m));
      speedMarkers = [];

      const hist = history[followBusId];

      // Rute: alle historikkpunkter
      const points = hist.map(p => [p.lat, p.lon]);
      routeLayer = L.polyline(points, { color: "blue" }).addTo(map);

      // Historikk langs ruten
      const lastIndex = hist.length - 1;
      const minDist = getMinHistoryDistanceMeters();

      let lastAccepted = null;

      for (let i = 0; i < lastIndex; i++) {
        const p = hist[i];

        if (!(p.speed && p.speed > 1)) continue;

        if (lastAccepted) {
          const d = haversine(lastAccepted.lat, lastAccepted.lon, p.lat, p.lon);
          if (d < minDist) continue;
        }

        const sm = L.marker([p.lat, p.lon], {
          icon: speedIcon(p.speed, p.speedLimit)
        });

        sm.addTo(map);

        const alpha = lastIndex > 1
          ? 0.25 + 0.75 * (i / (lastIndex - 1))
          : 1.0;

        sm.on('add', () => {
          const el = sm.getElement();
          if (el) el.style.opacity = alpha.toFixed(2);
        });

        speedMarkers.push(sm);
        lastAccepted = p;
      }
    }

  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

// Klikk på buss → følg
window.followBus = function (id) {
  // Lagre utsnitt før vi begynner å følge
  if (!followBusId) {
    prevViewCenter = map.getCenter();
    prevViewZoom = map.getZoom();
  }

  followBusId = id;
  map.setZoom(BEST_VIEW_ZOOM);
};

// Klikk i kartet → stopp følge
window.stopFollow = function (resetPrevView = true) {
  followBusId = null;

  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }

  speedMarkers.forEach(m => map.removeLayer(m));
  speedMarkers = [];

  Object.values(speedBadgeMarkers).forEach(m => map.removeLayer(m));
  speedBadgeMarkers = {};

  if (resetPrevView) {
    prevViewCenter = null;
    prevViewZoom = null;
  }
};

loadKolumbusLive();
setInterval(loadKolumbusLive, UPDATE_INTERVAL);
