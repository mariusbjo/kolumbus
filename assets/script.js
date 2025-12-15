// assets/script.js

// Sett opp kartet (sentrert på Rogaland første gang)
const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Ikon for busser
const busIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61231.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Ikon for fartsskilt (genereres dynamisk med km/t)
function speedIcon(speed) {
  return L.divIcon({
    className: 'speed-icon',
    html: `<div style="background:white;border:2px solid red;border-radius:50%;width:32px;height:32px;line-height:32px;text-align:center;font-weight:bold;">${Math.round(speed)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

let markers = {};
let history = {}; // { vehicleId: [ {lat, lon, timestamp, speed}, ... ] }
let followBusId = null;
let routeLayer = null;
let speedMarkers = [];

// Haversine for avstand (meter)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function loadKolumbusLive() {
  try {
    const query = `
    { vehicles(codespaceId:"KOL") {
        vehicleId
        lastUpdated
        location { latitude longitude }
        line { publicCode }
        bearing
      } }
    `;
    const res = await fetch("https://api.entur.io/realtime/v2/vehicles/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "marius-kolumbus-demo"
      },
      body: JSON.stringify({ query })
    });
    const payload = await res.json();
    const vehicles = payload.data?.vehicles || [];

    // Fjern gamle markører
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    vehicles.forEach(v => {
      const code = v.line?.publicCode ?? '—';
      const popup = `
        <strong>Linje ${code}</strong><br>
        ID: ${v.vehicleId}<br>
        Oppdatert: ${v.lastUpdated}<br>
        <button onclick="followBus('${v.vehicleId}')">Følg denne bussen</button>
      `;
      const marker = L.marker(
        [v.location.latitude, v.location.longitude],
        { icon: busIcon }
      ).bindPopup(popup);
      marker.addTo(map);
      markers[v.vehicleId] = marker;

      // Oppdater historikk
      const now = new Date(v.lastUpdated).getTime();
      if (!history[v.vehicleId]) history[v.vehicleId] = [];
      const prev = history[v.vehicleId].slice(-1)[0];
      let speed = null;
      if (prev) {
        const dt = (now - prev.timestamp) / 1000;
        const dist = haversine(prev.lat, prev.lon, v.location.latitude, v.location.longitude);
        if (dt > 0) speed = (dist / dt) * 3.6; // km/t
      }
      history[v.vehicleId].push({
        lat: v.location.latitude,
        lon: v.location.longitude,
        timestamp: now,
        speed
      });
      const cutoff = now - 30 * 60 * 1000;
      history[v.vehicleId] = history[v.vehicleId].filter(p => p.timestamp >= cutoff);
    });

    // Hvis vi følger en buss, tegn rute og fartsskilt
    if (followBusId && history[followBusId]) {
      if (routeLayer) map.removeLayer(routeLayer);
      speedMarkers.forEach(m => map.removeLayer(m));
      speedMarkers = [];

      const points = history[followBusId].map(p => [p.lat, p.lon]);
      routeLayer = L.polyline(points, { color: 'blue' }).addTo(map);

      history[followBusId].forEach(p => {
        if (p.speed) {
          const sm = L.marker([p.lat, p.lon], { icon: speedIcon(p.speed) });
          sm.addTo(map);
          speedMarkers.push(sm);
        }
      });

      // Flytt kartet til bussen
      if (markers[followBusId]) {
        const pos = markers[followBusId].getLatLng();
        map.setView(pos, map.getZoom());
      }
    }
  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

function followBus(id) {
  followBusId = id;
  alert(`Du følger nå buss ${id}. Klikk på en annen buss for å bytte.`);
}

// Last inn første gang og oppdater hvert 5. sekund
loadKolumbusLive();
setInterval(loadKolumbusLive, 5000);
