// assets/utils.js

import * as turf from '@turf/turf';

let speedLimitsCache = [];

/**
 * Laster inn speedlimits.json og legger det i cache
 */
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

/**
 * Returnerer fartsgrense basert på avrundet posisjon (grov cache)
 */
export function getCachedSpeedLimit(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return speedLimitsCache[key] || null;
}

/**
 * Beregner avstand mellom to koordinater (meter)
 */
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

/**
 * Finn gjeldende fartsgrense for en posisjon ved å sjekke nærmeste segment
 */
export function getSpeedLimitForPosition(lat, lon) {
  if (!speedLimitsCache || !Array.isArray(speedLimitsCache)) return null;

  const pt = turf.point([lon, lat]);
  let nearest = null;
  let nearestDist = Infinity;

  for (const seg of speedLimitsCache) {
    if (!seg.geometry || !seg.geometry.coordinates) continue;
    const line = turf.lineString(seg.geometry.coordinates);
    const dist = turf.pointToLineDistance(pt, line);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = seg;
    }
  }
  return nearest ? nearest.speed_limit : null;
}
