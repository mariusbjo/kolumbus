// -----------------------------------------------------
// map-history.js
// Canvas-basert historikkvisning for fulgt buss
// -----------------------------------------------------

import {
  getMinHistoryDistanceMeters,
  computeFade,
  trimHistory
} from './utils.js';

import { getFollowBusId, registerFollowCallback } from './map-follow.js';

// Ett felles Canvas-lag for historikkpunkter
let historyLayer = null;

// Intern referanse til kartet
let mapRef = null;

// Historikkdata (pekes til av realtime-modulen)
let historyByIdRef = null;

// -----------------------------------------------------
// Opprett Canvas-lag (kun én gang)
// -----------------------------------------------------
function ensureHistoryLayer(map) {
  if (!historyLayer) {
    historyLayer = L.layerGroup([], { renderer: L.canvas() }).addTo(map);
  }
}

// -----------------------------------------------------
// Fjern alle historikkpunkter fra kartet
// -----------------------------------------------------
export function clearHistory() {
  if (historyLayer) {
    historyLayer.clearLayers();
  }
}

// -----------------------------------------------------
// Tegn historikk for fulgt buss
// -----------------------------------------------------
export function updateHistoryForBus(map, historyById) {
  mapRef = map;
  historyByIdRef = historyById;

  const followId = getFollowBusId();
  if (!followId || !historyById[followId]) {
    clearHistory();
    return;
  }

  const hist = historyById[followId];
  if (!hist.length) {
    clearHistory();
    return;
  }

  ensureHistoryLayer(map);
  clearHistory();

  const lastIndex = hist.length - 1;
  const minDist = getMinHistoryDistanceMeters(map.getZoom());

  let lastAccepted = null;

  for (let i = 0; i < lastIndex; i++) {
    const p = hist[i];

    // Hopp over punkter uten fart
    if (!(p.speed && p.speed > 1)) continue;

    // Minimumsavstand
    if (lastAccepted) {
      const d = L.latLng(lastAccepted.lat, lastAccepted.lon)
        .distanceTo([p.lat, p.lon]);
      if (d < minDist) continue;
    }

    // Fading
    const alpha = computeFade(i, lastIndex);

    // Canvas-marker
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 6,
      color: "#ff8800",
      fillColor: "#ff8800",
      fillOpacity: alpha,
      opacity: alpha,
      renderer: historyLayer.options.renderer
    });

    marker.addTo(historyLayer);
    lastAccepted = p;
  }
}

// -----------------------------------------------------
// Koble followBus → automatisk oppdatering av historikk
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
  for (const id of Object.keys(historyById)) {
    historyById[id] = trimHistory(historyById[id], minutes);
  }
}
