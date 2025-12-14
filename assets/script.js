// assets/script.js

// Sett opp kartet (sentrert på Rogaland)
const map = L.map('map').setView([58.97, 5.73], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Hent og vis Kolumbus-busser
async function loadKolumbus() {
  try {
    const res = await fetch('data/kolumbus.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    const vehicles = payload.vehicles || [];
    const markers = [];

    vehicles.forEach(v => {
      const code = v.line?.publicCode ?? '—';
      const name = v.line?.name ?? '';
      const popup = `
        <strong>${code}</strong> ${name}<br>
        Oppdatert: ${v.updatedAt ?? '—'}
      `;
      const marker = L.marker([v.lat, v.lon]);
      marker.bindPopup(popup);
      marker.addTo(map);
      markers.push(marker);
    });

    if (markers.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (err) {
    console.error('Feil ved lasting av Kolumbus-data:', err);
  }
}

loadKolumbus();
