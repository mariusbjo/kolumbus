// assets/icons.js

// ---------------------------------------------------------
// STANDARD BUSSIKON (brukes fortsatt i historikk og fallback)
// ---------------------------------------------------------
export const busIcon = L.icon({
  iconUrl: 'assets/icons/bus-black.png',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// ---------------------------------------------------------
// FARTSSKILT-IKON (brukes langs historikk-ruten i follow-modus)
// Nå med 10 % margin før "over" blir rødt
// ---------------------------------------------------------
export function speedIcon(speed, limit, scale = 1) {
  const over = limit && speed > limit * 1.1;
  const className = over ? 'speed-icon over' : 'speed-icon';

  const size = 32 * scale;
  const anchor = size / 2;

  return L.divIcon({
    className,
    html: `<div>${Math.round(speed)}</div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor]
  });
}

// ---------------------------------------------------------
// KOMBINERT IKON FOR SANNTIDSBUSSEN
// Bussikon + fart i badge + zoom-adaptiv skalering
// scale hentes fra script.js basert på map.getZoom()
// ---------------------------------------------------------
export function busCombinedIcon(speed, limit, scale = 1) {
  const over = limit && speed > limit * 1.1; // 10 % margin
  const badgeClass = over ? "bus-speed-badge over" : "bus-speed-badge";
  const safeSpeed = Math.round(speed ?? 0);
  const safeScale = Number.isFinite(scale) ? scale : 1;

  return L.divIcon({
    className: "bus-combined-marker",
    html: `
      <div class="bus-combined-wrapper" style="transform: scale(${safeScale}); transform-origin: center center;">
        <img src="assets/icons/bus-black.png" class="bus-combined-icon">
        <div class="${badgeClass}">${safeSpeed}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}
