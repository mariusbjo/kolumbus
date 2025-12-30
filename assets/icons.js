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
export function speedIcon(speed, limit) {
  const over = limit && speed > limit * 1.1; // 10 % margin
  const className = over ? 'speed-icon over' : 'speed-icon';

  return L.divIcon({
    className,
    html: `<div>${Math.round(speed)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// ---------------------------------------------------------
// KOMBINERT IKON FOR SANNTIDSBUSSEN
// Bussikon + fart i badge
// Robust HTML-struktur som er trygg å style i CSS
// ---------------------------------------------------------
export function busCombinedIcon(speed, limit) {
  const over = limit && speed > limit * 1.1; // 10 % margin
  const badgeClass = over ? "bus-speed-badge over" : "bus-speed-badge";

  return L.divIcon({
    className: "bus-combined-marker",
    html: `
      <div class="bus-combined-wrapper">
        <img src="assets/icons/bus-black.png" class="bus-combined-icon">
        <div class="${badgeClass}">${Math.round(speed ?? 0)}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}
