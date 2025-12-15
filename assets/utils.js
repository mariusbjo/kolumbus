// assets/utils.js

// Haversine for avstand (meter)
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

// Hent fartsgrense fra NVDB API
export async function getSpeedLimit(lat, lon) {
  const url = "https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/105";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        lokasjon: {
          srid: "wgs84",
          punkt: { lat, lon },
          radius: 50
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obj = data.objekter?.[0];
    if (!obj) return null;
    const egenskap = obj.egenskaper?.find(e => e.id === 5962); // 5962 = fartsgrense
    return egenskap?.verdi || null;
  } catch (err) {
    console.error("Feil ved henting av fartsgrense:", err);
    return null;
  }
}

