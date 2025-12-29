// assets/icons.js

// Standard ikon for alle busser (sort buss)
export const busIcon = L.icon({
  iconUrl: 'assets/icons/bus-black.png',   // <-- nytt ikon (sort buss)
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// Fartsskilt-ikon som brukes KUN når en buss er valgt
export function speedIcon(speed, limit) {
  const over = limit && speed > limit;
  const className = over ? 'speed-icon over' : 'speed-icon';

  return L.divIcon({
    className,
    html: `<div>${Math.round(speed)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Kombinert ikon: buss + fartsbadge
export function busWithSpeedIcon(speed, limit) {
  const over = limit && speed > limit;
  const badgeClass = over ? "speed-badge over" : "speed-badge";

  return L.divIcon({
    className: "bus-marker",
    html: `
      <div class="bus-icon-wrapper">
        <img src="assets/icons/bus-black.png" class="bus-icon">
        <div class="${badgeClass}">${Math.round(speed)}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}
