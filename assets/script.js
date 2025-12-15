// assets/script.js
import { ENTUR_URL, CLIENT_NAME, UPDATE_INTERVAL } from './config.js';
import { haversine } from './utils.js';
import { busIcon, speedIcon } from './icons.js';

const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markers = {};
let history = {};
let followBusId = null;
let routeLayer = null;
let speedMarkers = [];

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
    const res = await fetch(ENTUR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": CLIENT_NAME
      },
      body: JSON.stringify({ query })
    });
    const payload = await res.json();
    const vehicles = payload.data?.vehicles || [];

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

      const now = new Date(v.lastUpdated).getTime();
      if (!history[v.vehicleId]) history[v.vehicleId] = [];
      const prev = history[v.vehicleId].slice(-1)[0];
      let speed = null;
      if (prev) {
        const dt = (now - prev.timestamp) / 1000;
        const dist = haversine(prev.lat, prev.lon, v.location.latitude, v.location.longitude);
        if (dt > 0) speed = (dist / dt) * 3.6;
      }
      history[v.vehicleId].push({ lat: v.location.latitude, lon: v.location.longitude, timestamp: now, speed });
      const cutoff = now - 30 * 60 * 1000;
      history[v.vehicleId] = history[v.vehicleId].filter(p => p.timestamp >= cutoff);
    });

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

      if (markers[followBusId]) {
        const pos = markers[followBusId].getLatLng();
        map.setView(pos, map.getZoom());
      }
    }
  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

window.followBus = function(id) {
  followBusId = id;
  alert(`Du følger nå buss ${id}. Klikk på en annen buss for å bytte.`);
};

loadKolumbusLive();
setInterval(loadKolumbusLive, UPDATE_INTERVAL);
