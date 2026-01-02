// -----------------------------------------------------
// map-history.js
// DOM-basert historikkvisning med speedIcon()
// -----------------------------------------------------

import { getFollowBusId, registerFollowCallback } from './map-follow.js';
import { speedIcon } from './icons.js';

let historyLayer = null;     // L.layerGroup() for historikkmarkører
let mapRef = null;
let historyByIdRef = null;

// -----------------------------------------------------
// Sørg for at vi har et eget DOM-lag for historikk
// -----------------------------------------------------
function ensureHistoryLayer(map) {
  if (!historyLayer) {
    historyLayer = L.layerGroup().addTo(map);
  }
}

// -----------------------------------------------------
// Fjern alle historikkmarkører
// -----------------------------------------------------
export function clearHistory() {
  if (historyLayer) {
    historyLayer.clearLayers();
  }
}

// -----------------------------------------------------
// Tegn historikk for bussen som følges
// -----------------------------------------------------
export function updateHistoryForBus(map, historyById) {
  mapRef = map;
  historyByIdRef = historyById;

  const followId = getFollowBusId();
  if (!followId || !historyById[followId]) {
    clearHistory();
    return;
  }

  // Kun behold historikk for fulgt buss
  for (const id of Object.keys(historyById)) {
    if (id !== followId) delete historyById[id];
  }

  const hist = historyById[followId];
  if (!hist.length) {
    clearHistory();
    return;
  }

  ensureHistoryLayer(map);
  historyLayer.clearLayers();

  // -----------------------------------------------------
  // DOM-basert historikk:
  // - kun punkter bakover i tid (hopper over siste)
  // - kun speed > 15 km/t
  // - minimumsavstand mellom punkter (20 meter)
  // -----------------------------------------------------

  let lastAccepted = null;

  for (let i = 0; i < hist.length - 1; i++) {
    const p = hist[i];

    // Hopp over punkter uten fart eller under 15 km/t
    if (p.speed == null || p.speed < 15) continue;

    // Minimumsavstand mellom historikkpunkter
    if (lastAccepted) {
      const d = map.distance(
        [lastAccepted.lat, lastAccepted.lon],
        [p.lat, p.lon]
      );
      if (d < 20) continue; // 20 meter terskel
    }

    // Opprett DOM-markør
    const marker = L.marker([p.lat, p.lon], {
      icon: speedIcon(p.speed, p.speedLimit)
    });

    historyLayer.addLayer(marker);
    lastAccepted = p;
  }
}

// -----------------------------------------------------
// Oppdater historikk når follow endres
// -----------------------------------------------------
registerFollowCallback(() => {
  if (mapRef && historyByIdRef) {
    updateHistoryForBus(mapRef, historyByIdRef);
  }
});

// -----------------------------------------------------
// Trim historikk for alle busser (kalles fra realtime)
// -----------------------------------------------------
export function trimAllHistory(historyById, minutes = 20) {
  const cutoff = Date.now() - minutes * 60 * 1000;

  for (const id of Object.keys(historyById)) {
    const arr = historyById[id];
    if (!arr || !arr.length) continue;

    historyById[id] = arr.filter(p => p.timestamp >= cutoff);
  }
}
