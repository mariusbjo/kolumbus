// -----------------------------------------------------
// map-utils.js
// Felles hjelpefunksjoner for sanntidskartet
// -----------------------------------------------------

// Haversine: beregn avstand i meter mellom to lat/lon-punkter
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// Zoom-adaptiv ikon-scale
export function getScaleForZoom(z) {
  return Math.min(1.8, Math.max(0.6, z / 10));
}

// Minimumsavstand for historikkpunkter (zoom-adaptiv)
export function getMinHistoryDistanceMeters(currentZoom, bestViewZoom = 17) {
  const scale = Math.pow(2, currentZoom - bestViewZoom);
  const baseDistance = 20; // meter ved BEST_VIEW_ZOOM
  return baseDistance * scale;
}

// Begrens historikk til X minutter
export function trimHistory(historyArray, minutes = 20) {
  if (!historyArray.length) return historyArray;
  const cutoff = historyArray[historyArray.length - 1].timestamp - minutes * 60 * 1000;
  return historyArray.filter((p) => p.timestamp >= cutoff);
}

// Fading-verdi for historikkpunkter (0–1)
export function computeFade(index, lastIndex) {
  if (lastIndex <= 1) return 1.0;
  return 0.25 + 0.75 * (index / lastIndex);
}
