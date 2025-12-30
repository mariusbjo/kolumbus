// -----------------------------------------------------
// map-history.js
// Canvas-basert historikkvisning med mini-busCombined-ikoner
// -----------------------------------------------------

import {
  getMinHistoryDistanceMeters,
  computeFade
} from './utils.js';

import { getFollowBusId, registerFollowCallback } from './map-follow.js';
import { createMiniBusIconCanvas } from './mini-bus-icon.js';

let historyLayer = null;
let mapRef = null;
let historyByIdRef = null;

function ensureHistoryLayer(map) {
  if (!historyLayer) {
    historyLayer = L.canvas({ padding: 0.5 });
    map.addLayer(historyLayer);
  }
}

export function clearHistory() {
  if (historyLayer && historyLayer._ctx) {
    const ctx = historyLayer._ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

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

  const ctx = historyLayer._ctx;
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lastIndex = hist.length - 1;
  const minDist = getMinHistoryDistanceMeters(map.getZoom());

  let lastAccepted = null;

  for (let i = 0; i < lastIndex; i++) {
    const p = hist[i];

    if (!(p.speed && p.speed > 1)) continue;

    if (lastAccepted) {
      const d = map.distance([lastAccepted.lat, lastAccepted.lon], [p.lat, p.lon]);
      if (d < minDist) continue;
    }

    const alpha = computeFade(i, lastIndex);

    const iconCanvas = createMiniBusIconCanvas(
      p.speed,
      p.speedLimit,
      p.bearing,
      1 // scale for mini-ikon
    );

    const pixel = map.latLngToContainerPoint([p.lat, p.lon]);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(iconCanvas, pixel.x - 8, pixel.y - 8);
    ctx.restore();

    lastAccepted = p;
  }
}

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
