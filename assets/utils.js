// assets/utils.js

let speedLimitsCache = null;     // Array med alle segmenter
let speedLimitsLoaded = false;   // Flag for caching

/**
 * Laster inn alle speedlimits_partX.json automatisk.
 * Stopper når 3 filer på rad mangler.
 * Resultatet caches i speedLimitsCache.
 */
export async function loadSpeedLimits() {
  if (speedLimitsLoaded && Array.isArray(speedLimitsCache)) {
    console.log("Speedlimits allerede lastet (cache).");
    return;
  }

  console.log("Laster speedlimit-deler...");

  const allSegments = [];
  let part = 1;
  let missingCount = 0;
  const MAX_MISSING = 3;

  while (missingCount < MAX_MISSING) {
    const url = `data/speedlimits_part${part}.json`;

    try {
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        console.warn(`Fant ikke ${url} (status ${res.status})`);
        missingCount++;
        part++;
        continue;
      }

      const json = await res.json();

      if (Array.isArray(json)) {
        allSegments.push(...json);
        console.log(`Lastet ${url} (${json.length} segmenter)`);
      }

      missingCount = 0; // reset siden vi fant en fil

    } catch (err) {
      console.warn(`Feil ved lasting av ${url}:`, err);
      missingCount++;
    }

    part++;
  }

  speedLimitsCache = allSegments;
  speedLimitsLoaded = true;

  console.log(
    `Ferdig: Lastet ${allSegments.length} segmenter fra ${part - missingCount - 1} filer`
  );

  // Precompute bounding boxes for ytelse
  if (typeof turf !== "undefined") {
    speedLimitsCache.forEach(seg => {
      try {
        const coords = seg.geometry?.coordinates;
        if (!coords) {
          seg._bbox = null;
          return;
        }

        const line = turf.lineString(coords);
        seg._bbox = turf.bbox(line); // [minX, minY, maxX, maxY]

      } catch {
        seg._bbox = null;
      }
    });
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
 * Finn gjeldende fartsgrense for en posisjon ved å sjekke nærmeste segment.
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
    const coords = seg.geometry?.coordinates;
    if (!coords) continue;

    // 1. Bounding box prefilter
    const bbox = seg._bbox;
    if (bbox) {
      const [minX, minY, maxX, maxY] = bbox;

      // +/- 0.001° ≈ ~110 m margin
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
      const line = turf.lineString(coords);

      // 2. Avstand til segment
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

  return nearest ? nearest.speed_limit : null;
}

// Zoom-adaptiv ikon-scale
export function getScaleForZoom(z) {
  return Math.min(1.8, Math.max(0.6, z / 10));
}

// Minimumsavstand for historikkpunkter (zoom-adaptiv)
export function getMinHistoryDistanceMeters(currentZoom, bestViewZoom = 17) {
  const scale = Math.pow(2, currentZoom - bestViewZoom);
  const baseDistance = 20; // meter ved BEST_VIEW_ZOOM
  return baseDistance * scale;
}

// Begrens historikk til X minutter
export function trimHistory(historyArray, minutes = 20) {
  if (!historyArray.length) return historyArray;
  const cutoff = historyArray[historyArray.length - 1].timestamp - minutes * 60 * 1000;
  return historyArray.filter((p) => p.timestamp >= cutoff);
}

// Fading-verdi for historikkpunkter (0–1)
export function computeFade(index, lastIndex) {
  if (lastIndex <= 1) return 1.0;
  return 0.25 + 0.75 * (index / lastIndex);
}
