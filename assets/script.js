// -----------------------------------------------------
// script.js
// Dirigent for sanntidskartet: kobler sammen modulene
// -----------------------------------------------------

import { initMap, setupZoomPanel } from './map-core.js';
import { enableMapClickToStopFollow } from './map-follow.js';
import { startRealtime } from './map-realtime.js';

// -----------------------------------------------------
// Oppstart
// -----------------------------------------------------
(async function bootstrap() {
  // 1. Initier kartet
  const map = initMap();

  // 2. Sett opp zoom-panel (slider, +/- , indikator, draggable)
  setupZoomPanel(map);

  // 3. Klikk i kartet stopper følge-modus
  enableMapClickToStopFollow(map);

  // 4. Start sanntidsoppdatering
  await startRealtime(map);
})();
