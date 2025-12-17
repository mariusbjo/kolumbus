// assets/utils.js

let speedLimitsCache = [];

/**
 * Laster inn speedlimits.json og legger det i cache
 */
export async function loadSpeedLimits() {
  try {
    const res = await fetch("data/speedlimits.json", { cache: "no-store" });
    if (res.ok) {
      speedLimitsCache = await res.json();
      console.log(`Speedlimits lastet: ${Array.isArray(speedLimitsCache) ? speedLimitsCache.length : 0} segmenter`);
    } else {
      console.error(`Kunne ikke laste speedlimits.json: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("Kunne ikke laste speedlimits.json:", err);
  }
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
 * Bruker global window.turf med eksplisitt eksport (point, lineString, pointToLineDistance)
 */
export function getSpeedLimitForPosition(lat, lon) {
  // Grunnsjekker
  if (!Array.isArray(speedLimitsCache) || speedLimitsCache.length === 0) return null;
  if (!window.turf || typeof window.turf.point !== "function" || typeof window.turf.lineString !== "function") {
    console.error("Turf er ikke tilgjengelig eller feil eksportert. Forventet window.turf = { point, lineString, pointToLineDistance }.");
    return null;
  }

  const { point, lineString, pointToLineDistance } = window.turf;

  const pt = point([lon, lat]);
  let nearest = null;
  let nearestDist = Infinity;

  for (const seg of speedLimitsCache) {
    if (!seg || !seg.geometry || !Array.isArray(seg.geometry.coordinates)) continue;

    try {
      const line = lineString(seg.geometry.coordinates);
      const dist = pointToLineDistance(pt, line); // standard Turf-avstand i grader/meters basert på default
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = seg;
      }
    } catch (e) {
      // Skip segmenter med ugyldig geometri
      continue;
    }
  }

  return (nearest && typeof nearest.speed_limit === "number") ? nearest.speed_limit : null;
}
