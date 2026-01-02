// -----------------------------------------------------
// map-realtime.js
// Henter sanntidsdata, oppdaterer markører, rute og historikk
// -----------------------------------------------------

import { ENTUR_URL, CLIENT_NAME, UPDATE_INTERVAL } from './config.js';
import {
  haversine,
  loadSpeedLimits,
  getSpeedLimitForPosition
} from './utils.js';
import { busCombinedIcon } from './icons.js';

import { getCurrentScale } from './map-core.js';
import {
  followBus,
  getFollowBusId
} from './map-follow.js';
import {
  updateRouteForBus,
  clearRoute,
  setupFitRouteButton
} from './map-route.js';
import {
  updateHistoryForBus,
  trimAllHistory
} from './map-history.js';

// Markører for sanntidsbusser
const markers = {};

// Historikk per buss-id:
// { [id]: [{ lat, lon, timestamp, speed, speedLimit }, ...] }
const historyById = {};


// -----------------------------------------------------
// Smooth animasjon av markør (posisjon over tid)
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
// Hent sanntidsdata fra Entur og oppdater kartet
// -----------------------------------------------------
async function loadKolumbusLive(map) {
  try {
    const query = `
      {
        vehicles(codespaceId:"KOL") {
          vehicleId
          lastUpdated
          location { latitude longitude }
          line { publicCode }
          bearing
        }
      }
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

      if (!historyById[id]) historyById[id] = [];
      const hist = historyById[id];
      const prev = hist.length ? hist[hist.length - 1] : null;

      // Timestamp: bruk Entur sin, men fall tilbake hvis den ikke endrer seg
      let now = new Date(v.lastUpdated).getTime();
      if (!now || (prev && now === prev.timestamp)) {
        now = Date.now();
      }

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
      hist.push({
        lat: pos[0],
        lon: pos[1],
        timestamp: now,
        speed,
        speedLimit,
        bearing: v.bearing ?? null
      });
    }

    // Trim historikk til 20 minutter for alle busser
    trimAllHistory(historyById, 20);

    // Oppdater sanntidsmarkører
    const scale = getCurrentScale();

    for (const v of vehicles) {
      const id = v.vehicleId;
      const pos = [v.location.latitude, v.location.longitude];
      const code = v.line?.publicCode ?? "—";

      const hist = historyById[id];
      const lastPoint = hist?.[hist.length - 1];
      const speed = lastPoint?.speed ?? null;
      const speedLimit = lastPoint?.speedLimit ?? null;

      const icon = busCombinedIcon(speed, speedLimit, scale);

      if (!markers[id]) {
        const popup = `
          <strong>Linje ${code}</strong><br>
          ID: ${id}<br>
          Oppdatert: ${v.lastUpdated}
        `;

        const marker = L.marker(pos, { icon }).bindPopup(popup).addTo(map);

        marker.on("click", (e) => {
          e.originalEvent.cancelBubble = true;
          followBus(map, id);
        });

        markers[id] = marker;
      } else {
        const marker = markers[id];
        const prevPos = marker.getLatLng();
        const newPos = L.latLng(pos[0], pos[1]);

        // Smooth animasjon
        animateMarker(marker, prevPos, newPos);

        // Oppdater ikon (scale + fart)
        marker.setIcon(icon);
      }
    }

    // Oppdater rute + historikk for fulgt buss
    const followId = getFollowBusId();
    if (followId) {
      updateRouteForBus(map, followId, historyById);
      updateHistoryForBus(map, historyById);
    } else {
      clearRoute(map);
    }

  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

// -----------------------------------------------------
// Start sanntidsoppdatering
// -----------------------------------------------------
export async function startRealtime(map) {
  setupFitRouteButton(map);
  await loadSpeedLimits();
  await loadKolumbusLive(map);

  setInterval(() => {
    loadKolumbusLive(map);
  }, UPDATE_INTERVAL);
}
