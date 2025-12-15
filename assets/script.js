// assets/script.js

// Sett opp kartet (sentrert på Rogaland)
const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Tilpasset ikon for busser
const busIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/61/61231.png', // bussikon
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

let markers = {};

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
        Oppdatert: ${v.lastUpdated ?? '—'}
      `;
      const marker = L.marker([v.lat, v.lon], { icon: busIcon }).bindPopup(popup);
      marker.addTo(map);
      markers[v.vehicleId] = marker;
    });

    if (vehicles.length) {
      const group = L.featureGroup(Object.values(markers));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (err) {
    console.error('Feil ved lasting av Kolumbus-data:', err);
  }
}

// Last inn første gang og oppdater hvert 10. sekund
loadKolumbus();
setInterval(loadKolumbus, 10000);
