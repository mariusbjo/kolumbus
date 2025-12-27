// assets/utils.js

let speedLimitsCache = [];

/**
 * Laster inn speedlimits.json og legger det i cache
 * + preprosesserer bounding boxes for raskere oppslag
 */
export async function loadSpeedLimits() {
  try {
    const res = await fetch("data/speedlimits.json", { cache: "no-store" });
    if (res.ok) {
      speedLimitsCache = await res.json();

      // Precompute bounding boxes for each segment
      if (typeof turf !== "undefined") {
        speedLimitsCache.forEach(seg => {
          try {
            if (seg.geometry?.coordinates) {
              const line = turf.lineString(seg.geometry.coordinates);
              seg._bbox = turf.bbox(line); // [minX, minY, maxX, maxY]
            }
          } catch {
            seg._bbox = null;
          }
        });
      }

      console.log(
        `Speedlimits lastet: ${
          Array.isArray(speedLimitsCache) ? speedLimitsCache.length : 0
        } segmenter`
      );
    } else {
      console.error(
        `Kunne ikke laste speedlimits.json: ${res.status} ${res.statusText}`
      );
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Finn gjeldende fartsgrense for en posisjon ved å sjekke nærmeste segment
 * Optimalisert:
 *  - Bounding box prefilter
 *  - Maks avstand cutoff (40 m)
 *  - Turf pointToLineDistance
 */
export function getSpeedLimitForPosition(lat, lon) {
  if (!Array.isArray(speedLimitsCache) || speedLimitsCache.length === 0)
    return null;

  if (typeof turf === "undefined") {
    console.error("Turf er ikke lastet inn!");
    return null;
  }

  const pt = turf.point([lon, lat]);

  let nearest = null;
  let nearestDist = Infinity;

  for (const seg of speedLimitsCache) {
    if (!seg.geometry?.coordinates) continue;

    // -----------------------------
    // 1. Bounding box prefilter
    // -----------------------------
    if (seg._bbox) {
      const [minX, minY, maxX, maxY] = seg._bbox;

      // +/- 0.001° ≈ 110 m margin
      if (
        lon < minX - 0.001 ||
        lon > maxX + 0.001 ||
        lat < minY - 0.001 ||
        lat > maxY + 0.001
      ) {
        continue;
      }
    }

    try {
      const line = turf.lineString(seg.geometry.coordinates);

      // -----------------------------
      // 2. Avstand til segment
      // -----------------------------
      const dist = turf.pointToLineDistance(pt, line, { units: "meters" });

      // 3. Cutoff: ignorer segmenter > 40 m unna
      if (dist > 40) continue;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = seg;
      }
    } catch {
      continue;
    }
  }

  if (nearest) {
    // console.log(
    //   `Nærmeste segment: avstand=${nearestDist.toFixed(1)}m, limit=${nearest.speed_limit}`
    // );
    return nearest.speed_limit;
  }

  return null;
}
