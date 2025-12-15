// assets/icons.js

export const busIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61231.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

export function speedIcon(speed) {
  return L.divIcon({
    className: 'speed-icon',
    html: `<div>${Math.round(speed)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

