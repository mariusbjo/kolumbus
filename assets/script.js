// assets/script.js

// Sett opp kartet (sentrert på Rogaland første gang)
const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Tilpasset ikon for busser
const busIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61231.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

let markers = {};
let followBusId = null; // ID til bussen vi følger

async function loadKolumbus() {
  try {
    const res = await fetch('data/kolumbus.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    const vehicles = payload.vehicles || [];

    // Fjern gamle markører
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    vehicles.forEach(v => {
      const code = v.line?.publicCode ?? '—';
      const popup = `
        <strong>Linje ${code}</strong><br>
        ID: ${v.vehicleId}<br>
        Oppdatert: ${v.lastUpdated ?? '—'}<br>
        <button onclick="followBus('${v.vehicleId}')">Følg denne bussen</button>
      `;
      const marker = L.marker([v.lat, v.lon], { icon: busIcon }).bindPopup(popup);
      marker.addTo(map);
      markers[v.vehicleId] = marker;
    });

    // Hvis vi følger en buss, oppdater kartet til den
    if (followBusId && markers[followBusId]) {
      const pos = markers[followBusId].getLatLng();
      map.setView(pos, map.getZoom());
    }
  } catch (err) {
    console.error('Feil ved lasting av Kolumbus-data:', err);
  }
}

// Funksjon for å aktivere "følg buss"
function followBus(id) {
  followBusId = id;
  alert(`Du følger nå buss ${id}. Klikk på en annen buss for å bytte.`);
}

// Last inn første gang og oppdater hvert 10. sekund
loadKolumbus();
setInterval(loadKolumbus, 10000);
