// -----------------------------------------------------
// map-core.js
// Kartinitiering, tilelayer, zoom-panel, zoom-indikator
// -----------------------------------------------------

import { getScaleForZoom } from './utils.js';

export const BEST_VIEW_ZOOM = 17;

let mapInstance = null;
let currentScale = 1;

// Hent gjeldende zoom-adaptive scale (brukes av andre moduler)
export function getCurrentScale() {
  return currentScale;
}

// Initier Leaflet-kartet
export function initMap() {
  // Standard utsnitt (tilpasses som du ønsker)
  mapInstance = L.map('map', {
    zoomControl: false   // Fjern Leaflet sin innebygde zoom-kontroll
  }).setView([58.97, 5.73], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  // Init scale basert på start-zoom
  currentScale = getScaleForZoom(mapInstance.getZoom());

  return mapInstance;
}

// Sett opp zoom-panel: slider, +/-, indikator, draggable
export function setupZoomPanel(map) {
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const zoomPanel = document.querySelector(".zoom-control");
  const zoomLevelLabel = document.getElementById("zoom-level");

  // Felles funksjon for å holde scale, slider og label i sync
  function updateZoomUI() {
    const z = map.getZoom();
    currentScale = getScaleForZoom(z);

    if (zoomSlider) {
      zoomSlider.value = z;
    }

    if (zoomLevelLabel) {
      zoomLevelLabel.textContent = "Zoom: " + z;
    }
  }

  // Init slider med nåværende zoom
  if (zoomSlider) {
    zoomSlider.value = map.getZoom();

    // Slider → kart
    zoomSlider.oninput = () => {
      const targetZoom = parseInt(zoomSlider.value, 10);
      map.setZoom(targetZoom);
      updateZoomUI();
    };
  }

  // Kart → UI (scale, slider, label)
  map.on("zoomend", updateZoomUI);

  // Knapper
  if (zoomInBtn) {
    zoomInBtn.onclick = () => {
      map.zoomIn();
      // zoomend-event vil trigge updateZoomUI, men vi kaller den
      // også direkte for rask respons
      updateZoomUI();
    };
  }

  if (zoomOutBtn) {
    zoomOutBtn.onclick = () => {
      map.zoomOut();
      updateZoomUI();
    };
  }

  // Init label + scale ved oppstart
  updateZoomUI();

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
}
