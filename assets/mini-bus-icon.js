// -----------------------------------------------------
// mini-bus-icon.js
// Lager et 16x16 canvas-ikon basert på busCombinedIcon-stil
// -----------------------------------------------------

const busImg = new Image();
busImg.src = "assets/icons/bus-black.png";

// Cache for ikonvarianter
// key = `${speed}|${limit}|${bearing}|${scale}`
const miniIconCache = {};

export function createMiniBusIconCanvas(speed, limit, bearing, scale = 1) {
  const safeSpeed = Math.round(speed ?? 0);
  const over = limit && speed > limit * 1.1;

  const key = `${safeSpeed}|${limit}|${bearing}|${scale}`;
  if (miniIconCache[key]) return miniIconCache[key];

  // Base canvas
  const size = 16 * scale;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Vent til bussikonet er lastet
  if (!busImg.complete) {
    busImg.onload = () => createMiniBusIconCanvas(speed, limit, bearing, scale);
  }

  ctx.save();

  // Flytt til midten for rotasjon
  ctx.translate(size / 2, size / 2);

  // Bearing → radianer
  if (Number.isFinite(bearing)) {
    ctx.rotate((bearing * Math.PI) / 180);
  }

  // Tegn bussikon (12x12 px)
  const iconSize = 12 * scale;
  ctx.drawImage(busImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);

  // Tegn fart-badge (liten sirkel)
  const badgeRadius = 6 * scale;
  ctx.beginPath();
  ctx.fillStyle = over ? "#ff3333" : "#2ecc71";
  ctx.arc(iconSize * 0.35, -iconSize * 0.35, badgeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Fartstall
  ctx.fillStyle = "white";
  ctx.font = `${7 * scale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(safeSpeed, iconSize * 0.35, -iconSize * 0.35);

  ctx.restore();

  miniIconCache[key] = canvas;
  return canvas;
}
