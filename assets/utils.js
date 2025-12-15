// assets/utils.js

let speedLimitsCache = {};

export async function loadSpeedLimits() {
  try {
    const res = await fetch("data/speedlimits.json", { cache: "no-store" });
    if (res.ok) {
      speedLimitsCache = await res.json();
    }
  } catch (err) {
    console.error("Kunne ikke laste speedlimits.json:", err);
  }
}

export function getCachedSpeedLimit(lat, lon) {
  // Bruk avrundet nøkkel (4 desimaler gir ca. 11 m presisjon)
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return speedLimitsCache[key] || null;
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
