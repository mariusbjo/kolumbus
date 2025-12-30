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
// ZOOM-ADAPTIVE IKONER
// -----------------------------------------------------
let currentScale = 1;

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
    // FØLG BUSS-MODUS
    // -----------------------------------------------------
    if (followBusId && history[followBusId]) {
      if (routeLayer) map.removeLayer(routeLayer);
      speedMarkers.forEach(m => map.removeLayer(m));
      speedMarkers = [];

      const hist = history[followBusId];

      // Rute: alle historikkpunkter
      const points = hist.map(p => [p.lat, p.lon]);
      routeLayer = L.polyline(points, { color: "blue" }).addTo(map);

      // Historikk langs ruten: kun når bussen faktisk beveger seg
      // OG ikke på siste punkt (nåværende posisjon)
      const lastIndex = hist.length - 1;

      for (let i = 0; i < lastIndex; i++) {
        const p = hist[i];

        if (p.speed && p.speed > 1) {
          const sm = L.marker([p.lat, p.lon], {
            icon: speedIcon(p.speed, p.speedLimit)
          });

          sm.addTo(map);

          // -----------------------------------------------------
          // TRANSPARENS: eldste punkter er svakere
          // -----------------------------------------------------
          const alpha = 0.25 + 0.75 * (i / (lastIndex - 1));
          sm.on('add', () => {
            const el = sm.getElement();
            if (el) el.style.opacity = alpha.toFixed(2);
          });

          speedMarkers.push(sm);
        }
      }

      if (markers[followBusId]) {
        const pos = markers[followBusId].getLatLng();
        map.setView(pos, map.getZoom());
      }
    }

  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

// Klikk på buss → følg
window.followBus = function (id) {
  followBusId = id;
};

// Klikk i kartet → stopp følge
window.stopFollow = function () {
  followBusId = null;

  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }

  speedMarkers.forEach(m => map.removeLayer(m));
  speedMarkers = [];

  Object.values(speedBadgeMarkers).forEach(m => map.removeLayer(m));
  speedBadgeMarkers = {};
};

loadKolumbusLive();
setInterval(loadKolumbusLive, UPDATE_INTERVAL);
