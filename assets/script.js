// assets/script.js
import { ENTUR_URL, CLIENT_NAME, UPDATE_INTERVAL } from './config.js';
import { haversine, getSpeedLimit } from './utils.js';
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

    for (const v of vehicles) {
      const code = v.line?.publicCode ?? '—';
      const popup = `
        <strong>Linje ${code}</strong><br>
        ID: ${v.vehicleId}<br>
        Oppdatert: ${v.lastUpdated}<br>
        <button onclick="followBus('${v.vehicleId}')">Følg denne bussen</button>
        <button onclick="stopFollow()">Slutt å følg</button>
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
      const speedLimit = await getSpeedLimit(v.location.latitude, v.location.longitude);

      history[v.vehicleId].push({
        lat: v.location.latitude,
        lon: v.location.longitude,
        timestamp: now,
        speed,
        speedLimit
      });
      const cutoff = now - 30 * 60 * 1000;
      history[v.vehicleId] = history[v.vehicleId].filter(p => p.timestamp >= cutoff);
    }

    if (followBusId && history[followBusId]) {
      if (routeLayer) map.removeLayer(routeLayer);
      speedMarkers.forEach(m => map.removeLayer(m));
      speedMarkers = [];

      const points = history[followBusId].map(p => [p.lat, p.lon]);
      routeLayer = L.polyline(points, { color: 'blue' }).addTo(map);

      history[followBusId].forEach(p => {
        if (p.speed) {
          const sm = L.marker([p.lat, p.lon], { icon: speedIcon(p.speed, p.speedLimit) });
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
  alert(`Du følger nå buss ${id}. Klikk 'Slutt å følg' for å stoppe.`);
};

window.stopFollow = function() {
  followBusId = null;
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  speedMarkers.forEach(m => map.removeLayer(m));
  speedMarkers = [];
  alert("Du følger ikke lenger en buss.");
};

loadKolumbusLive();
setInterval(loadKolumbusLive, UPDATE_INTERVAL);
