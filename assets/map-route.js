// -----------------------------------------------------
// map-route.js
// Håndterer rutevisning for fulgt buss (polyline + fit)
// -----------------------------------------------------

// Intern referanse til rute-polyline
let routeLayer = null;

// -----------------------------------------------------
// Oppdater ruten for en gitt buss basert på historikk
// historyById: { [busId]: [{ lat, lon, ... }, ...] }
// -----------------------------------------------------
export function updateRouteForBus(map, followBusId, historyById) {
  if (!followBusId || !historyById || !historyById[followBusId]) {
    clearRoute(map);
    return;
  }

  const hist = historyById[followBusId];
  if (!hist.length) {
    clearRoute(map);
    return;
  }

  const points = hist.map((p) => [p.lat, p.lon]);

  if (!routeLayer) {
    // Opprett polyline første gang
    routeLayer = L.polyline(points, { color: "blue" }).addTo(map);
  } else {
    // Gjenbruk eksisterende polyline
    routeLayer.setLatLngs(points);
  }
}

// -----------------------------------------------------
// Fjern ruten fra kartet
// -----------------------------------------------------
export function clearRoute(map) {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

// -----------------------------------------------------
// Fit til gjeldende rute (brukes av "fit"-knappen)
// -----------------------------------------------------
export function fitRouteToCurrent(map) {
  if (!routeLayer) return;
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
}

// -----------------------------------------------------
// Koble "fit route"-knappen til ruten (zoom-panelet)
// -----------------------------------------------------
export function setupFitRouteButton(map) {
  const zoomFitBtn = document.getElementById("zoom-fit");
  if (!zoomFitBtn) return;

  zoomFitBtn.onclick = () => {
    fitRouteToCurrent(map);
  };
}
