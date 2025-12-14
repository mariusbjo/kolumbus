// assets/script.js
const map = L.map('map').setView([58.97, 5.73], 12); // Stavanger-regionen

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

async function loadData() {
  try {
    const res = await fetch('data/entur.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    const vehicles = payload.vehicles || [];
    const markers = [];

    vehicles.forEach(v => {
      const code = v.line?.publicCode ?? '—';
      const name = v.line?.name ?? '';
      const popup = `
        <strong>${code}</strong> ${name}<br>
        Mode: ${v.mode ?? 'unknown'}<br>
        Oppdatert: ${v.updatedAt ?? '—'}
      `;
      const m = L.marker([v.lat, v.lon]);
      m.bindPopup(popup);
      m.addTo(map);
      markers.push(m);
    });

    if (markers.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (err) {
    console.error('Feil ved lasting av data:', err);
  }
}

loadData();
