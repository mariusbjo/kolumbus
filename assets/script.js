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

let markers = {};

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
      const popup = `
        <strong>Linje ${v.line.publicCode}</strong><br>
        ID: ${v.vehicleId}<br>
        Oppdatert: ${v.lastUpdated}
      `;
      const marker = L.marker(
        [v.location.latitude, v.location.longitude],
        { icon: busIcon }
      ).bindPopup(popup);
      marker.addTo(map);
      markers[v.vehicleId] = marker;
    });
  } catch (err) {
    console.error("Feil ved henting av sanntidsdata:", err);
  }
}

// Last inn første gang og oppdater hvert 10. sekund
loadKolumbusLive();
setInterval(loadKolumbusLive, 10000);
