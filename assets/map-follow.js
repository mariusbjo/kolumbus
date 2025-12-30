// -----------------------------------------------------
// map-follow.js
// Håndterer followBus, stopFollow og smart reset view
// -----------------------------------------------------

import { BEST_VIEW_ZOOM } from './map-core.js';

// Disse variablene holdes modul-lokalt
let followBusId = null;
let prevViewCenter = null;
let prevViewZoom = null;

// Andre moduler (route/history) får vite når follow endres
let onFollowChange = null;

// -----------------------------------------------------
// Registrer callback for når follow-modus endres
// (brukes av map-route.js og map-history.js)
// -----------------------------------------------------
export function registerFollowCallback(fn) {
  onFollowChange = fn;
}

// -----------------------------------------------------
// Følg en buss
// -----------------------------------------------------
export function followBus(map, id) {
  // Lagre utsnitt før vi begynner å følge
  if (!followBusId) {
    prevViewCenter = map.getCenter();
    prevViewZoom = map.getZoom();
  }

  followBusId = id;

  // Zoom inn til best visning
  map.setZoom(BEST_VIEW_ZOOM);

  // Varsle andre moduler
  if (onFollowChange) onFollowChange(followBusId);
}

// -----------------------------------------------------
// Stopp følge-modus
// -----------------------------------------------------
export function stopFollow(map, resetPrevView = true) {
  followBusId = null;

  // Varsle andre moduler
  if (onFollowChange) onFollowChange(null);

  // Tilbakestill utsnitt hvis ønsket
  if (resetPrevView && prevViewCenter && typeof prevViewZoom === "number") {
    map.setView(prevViewCenter, prevViewZoom);
  }

  if (resetPrevView) {
    prevViewCenter = null;
    prevViewZoom = null;
  }
}

// -----------------------------------------------------
// Hent ID på bussen som følges
// -----------------------------------------------------
export function getFollowBusId() {
  return followBusId;
}

// -----------------------------------------------------
// Koble kartklikk til stopFollow
// -----------------------------------------------------
export function enableMapClickToStopFollow(map) {
  map.on("click", () => stopFollow(map));
}
