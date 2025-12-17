// assets/utils.js

let speedLimitsCache = [];

export async function loadSpeedLimits() {
  try {
    const res = await fetch("data/speedlimits.json", { cache: "no-store" });
    if (res.ok) {
      speedLimitsCache = await res.json();
      console.log(`Speedlimits lastet: ${Array.isArray(speedLimitsCache) ? speedLimitsCache.length : 0} segmenter`);
    }
  } catch (err) {
    console.error("Kunne ikke laste speedlimits.json:", err);
  }
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

export function getSpeedLimitForPosition(lat, lon) {
  if (!Array.isArray(speedLimitsCache) || speedLimitsCache.length === 0) return null;
  if (!window.turf) {
    console.error("Turf er ikke lastet inn!");
    return null;
  }

  const { point, lineString, pointToLineDistance } = window.turf;

  const pt = point([lon, lat]);
  let nearest = null;
  let nearestDist = Infinity;

  for (const seg of speedLimitsCache) {
    if (!seg.geometry || !seg.geometry.coordinates) continue;
    const line = lineString(seg.geometry.coordinates);
    const dist = pointToLineDistance(pt, line);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = seg;
    }
  }
  return nearest ? nearest.speed_limit : null;
}
