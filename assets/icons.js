// assets/icons.js

export const busIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61231.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

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
