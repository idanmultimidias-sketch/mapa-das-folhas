<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>javascript
const STORAGE_KEY = 'mapa_folhas_v8';
let locations = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let map, markersLayer, userCoords = null;
let selectedType = 'qualquer_horario';
let currentPhoto = '', currentPlant = null, currentFilter = 'all', isSelectingMap = false;

window.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  getUserGPS(false);
  renderPins();
  updateBadge();
});

function initMap() {
  map = L.map('map', { zoomControl: false }).setView([-23.5505, -46.6333], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  setTimeout(() => map.invalidateSize(), 250);
  window.addEventListener('resize', () => map.invalidateSize());

  map.on('click', (e) => {
    if (isSelectingMap) {
      isSelectingMap = false;
      setFormCoords(e.latlng.lat, e.latlng.lng, `🗺️ ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      openFormSheet(currentPlant);
    }
  });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function setupEvents() {
  document.getElementById('btn-gps').onclick = () => getUserGPS(true);

  // Barra de navegação inferior (o verde caminha)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      if (tab === 'add') {
        openFormSheet(null);
        return;
      }
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.overlay-screen').forEach(s => s.classList.remove('active'));
      if (tab === 'leaves') {
        renderLeavesList();
        document.getElementById('screen-leaves').classList.add('active');
      } else if (tab === 'settings') {
        document.getElementById('screen-settings').classList.add('active');
      } else {
        map.invalidateSize();
      }
    };
  });

  // Filtros superiores (o verde caminha)
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderPins();
    };
  });

  document.getElementById('search-input').oninput = renderPins;
  document.getElementById('form-close').onclick = closeSheets;
  document.getElementById('det-close').onclick = closeSheets;

  // Abas de localização (o verde caminha)
  document.getElementById('tab-loc-gps').onclick = () => {
    document.getElementById('tab-loc-gps').classList.add('active');
    document.getElementById('tab-loc-addr').classList.remove('active');
    document.getElementById('panel-gps').style.display = 'flex';
    document.getElementById('panel-addr').style.display = 'none';
  };

  document.getElementById('tab-loc-addr').onclick = () => {
    document.getElementById('tab-loc-addr').classList.add('active');
    document.getElementById('tab-loc-gps').classList.remove('active');
    document.getElementById('panel-addr').style.display = 'flex';
    document.getElementById('panel-gps').style.display = 'none';
  };

  document.getElementById('btn-get-gps').onclick = () => getUserGPS(false);
  document.getElementById('btn-pick-map').onclick = () => {
    isSelectingMap = true;
    closeSheets();
    toast('Toque em qualquer ponto do mapa!');
  };

  document.getElementById('btn-search-addr').onclick = searchAddressNominatim;

  // Horários (o verde caminha)
  document.getElementById('card-night').onclick = () => setFormTimeType('movimentado');
  document.getElementById('card-day').onclick = () => setFormTimeType('qualquer_horario');

  // Foto
  const fileInput = document.getElementById('f-file');
  document.getElementById('photo-box').onclick = () => fileInput.click();
  fileInput.onchange = handlePhotoUpload;

  // Ações de cadastro e detalhes
  document.getElementById('btn-save').onclick = savePlantRecord;
  document.getElementById('btn-form-delete').onclick = () => {
    if (currentPlant && confirm('Deseja apagar esta folha?')) deletePlantRecord(currentPlant.id);
  };
  document.getElementById('det-route').onclick = () => {
    if (!currentPlant) return;
    const origin = userCoords ? `${userCoords.lat},${userCoords.lng}` : '';
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentPlant.lat},${currentPlant.lng}${origin ? `&origin=${origin}` : ''}`, '_blank');
  };
  document.getElementById('det-edit').onclick = () => {
    const item = currentPlant;
    closeSheets();
    openFormSheet(item);
  };
  document.getElementById('det-delete').onclick = () => {
    if (currentPlant && confirm('Tem certeza que deseja apagar?')) deletePlantRecord(currentPlant.id);
  };

  // Backup e Limpeza
  document.getElementById('btn-export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(locations, null, 2)], { type: 'application/json' }));
    a.download = `backup-folhas.json`;
    a.click();
  };
  document.getElementById('btn-clear-all').onclick = () => {
    if (confirm('Deseja apagar todas as folhas salvas?')) {
      locations = [];
      localStorage.removeItem(STORAGE_KEY);
      closeSheets();
      renderPins();
      updateBadge();
      toast('Registros apagados');
    }
  };
}

function getUserGPS(shouldCenter) {
  if (!navigator.geolocation) {
    const c = map.getCenter();
    setFormCoords(c.lat, c.lng, `Centro do mapa: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setFormCoords(userCoords.lat, userCoords.lng, `📍 GPS: ${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`);
      if (shouldCenter) {
        map.setView([userCoords.lat, userCoords.lng], 16);
        toast('Localização atualizada');
      }
    },
    () => {
      const c = map.getCenter();
      setFormCoords(c.lat, c.lng, `Centro do mapa: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
    },
    { enableHighAccuracy: true }
  );
}

function setFormCoords(lat, lng, label) {
  document.getElementById('f-lat').value = lat;
  document.getElementById('f-lng').value = lng;
  document.getElementById('lbl-gps-status').textContent = label;
}

function setFormTimeType(type) {
  selectedType = type;
  document.getElementById('card-night').className = type === 'movimentado' ? 'choice-card selected' : 'choice-card';
  document.getElementById('card-day').className = type === 'qualquer_horario' ? 'choice-card selected' : 'choice-card';
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement('canvas');
      let w = img.width, h = img.height, max = 450;
      if (w > h && w > max) { h = Math.round((h * max) / w); w = max; }
      else if (h > max) { w = Math.round((w * max) / h); h = max; }
      cvs.width = w; cvs.height = h;
      cvs.getContext('2d').drawImage(img, 0, 0, w, h);
      currentPhoto = cvs.toDataURL('image/jpeg', 0.65);
      document.getElementById('photo-img').src = currentPhoto;
      document.getElementById('photo-img').style.display = 'block';
      document.getElementById('photo-txt').style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function searchAddressNominatim() {
  const query = document.getElementById('f-address').value.trim();
  const status = document.getElementById('lbl-addr-status');
  if (!query) return alert('Digite um endereço');
  status.textContent = 'Buscando...';
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
    .then(r => r.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setFormCoords(lat, lon, `📍 Encontrado: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        status.textContent = 'Endereço localizado no mapa!';
        map.setView([lat, lon], 16);
        toast('Localização encontrada');
      } else {
        status.textContent = 'Endereço não localizado';
      }
    })
    .catch(() => { status.textContent = 'Erro ao buscar endereço'; });
}

function openFormSheet(item) {
  closeSheets();
  currentPlant = item || null;
  document.getElementById('form-title').textContent = item ? 'Editar Folha' : 'Nova Folha';
  document.getElementById('f-id').value = item ? item.id : '';
  document.getElementById('f-name').value = item ? item.name : '';
  document.getElementById('f-obs').value = item ? (item.obs || '') : '';
  document.getElementById('f-address').value = item ? (item.address || '') : '';
  document.getElementById('btn-form-delete').style.display = item ? 'block' : 'none';

  setFormTimeType(item ? item.type : 'qualquer_horario');
  currentPhoto = item ? (item.photo || '') : '';

  const pImg = document.getElementById('photo-img');
  const pTxt = document.getElementById('photo-txt');
  if (currentPhoto) {
    pImg.src = currentPhoto; pImg.style.display = 'block'; pTxt.style.display = 'none';
  } else {
    pImg.style.display = 'none'; pTxt.style.display = 'block';
  }

  if (item) {
    setFormCoords(item.lat, item.lng, `📍 ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`);
  } else {
    const c = userCoords || map.getCenter();
    setFormCoords(c.lat, c.lng, `📍 Ponto atual: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
  }

  document.getElementById('sheet-form').classList.add('active');
}

function closeSheets() {
  document.querySelectorAll('.sheet-overlay').forEach(s => s.classList.remove('active'));
}

function savePlantRecord() {
  const name = document.getElementById('f-name').value.trim();
  let lat = parseFloat(document.getElementById('f-lat').value);
  let lng = parseFloat(document.getElementById('f-lng').value);
  const obs = document.getElementById('f-obs').value.trim();
  const address = document.getElementById('f-address').value.trim();
  const id = document.getElementById('f-id').value;

  if (!name) return alert('Por favor, informe o nome da folha ou planta');
  if (isNaN(lat) || isNaN(lng)) {
    const center = map.getCenter();
    lat = center.lat;
    lng = center.lng;
  }

  if (id) {
    const idx = locations.findIndex(x => x.id === id);
    if (idx !== -1) {
      locations[idx] = { id, name, lat, lng, obs, address, type: selectedType, photo: currentPhoto };
    }
  } else {
    locations.push({
      id: 'folha_' + Date.now(),
      name, lat, lng, obs, address, type: selectedType, photo: currentPhoto
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  closeSheets();
  renderPins();
  updateBadge();
  map.setView([lat, lng], 16);
  toast('Folha salva com sucesso!');
}

function deletePlantRecord(id) {
  locations = locations.filter(x => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  closeSheets();
  renderPins();
  updateBadge();
  toast('Folha apagada');
}

function renderPins() {
  markersLayer.clearLayers();
  const query = document.getElementById('search-input').value.trim().toLowerCase();

  locations.forEach(item => {
    if (currentFilter !== 'all' && item.type !== currentFilter) return;
    if (query && !item.name.toLowerCase().includes(query)) return;

    const icon = L.divIcon({
      className: '',
      html: `<div class="leaf-pin">🌿<span>${item.type === 'movimentado' ? '🌙' : '🕐'}</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([item.lat, item.lng], { icon }).addTo(markersLayer);
    marker.on('click', () => openDetailsSheet(item));
  });
}

function updateBadge() {
  document.getElementById('count-label').textContent = locations.length;
}

function openDetailsSheet(item) {
  closeSheets();
  currentPlant = item;
  document.getElementById('det-name').textContent = item.name;

  const img = document.getElementById('det-img');
  const photoBox = document.querySelector('.det-photo-container');
  if (item.photo) {
    img.src = item.photo; photoBox.style.display = 'block';
  } else {
    photoBox.style.display = 'none';
  }

  document.getElementById('det-badge').textContent = item.type === 'movimentado' ? '🌙 Após 00h' : '🕐 Qualquer horário';
  document.getElementById('det-addr').textContent = item.address ? `📍 ${item.address}` : `📍 ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`;
  document.getElementById('det-obs').textContent = item.obs || 'Sem observações cadastradas.';

  document.getElementById('sheet-details').classList.add('active');
}

function renderLeavesList() {
  const container = document.getElementById('leaves-container');
  container.innerHTML = '';
  if (!locations.length) {
    container.innerHTML = '<div style="font-size:0.85rem; color:var(--muted); padding:10px 0;">Nenhuma folha cadastrada ainda.</div>';
    return;
  }
  locations.forEach(item => {
    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div style="font-size:0.74rem; color:var(--muted);">${item.type === 'movimentado' ? '🌙 Após 00h' : '🕐 Qualquer horário'}</div>
      </div>
      <span style="font-weight:800; font-size:1.1rem;">➔</span>
    `;
    card.onclick = () => {
      document.querySelectorAll('.overlay-screen').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="map"]').classList.add('active');
      map.invalidateSize();
      map.setView([item.lat, item.lng], 16);
      openDetailsSheet(item);
    };
    container.appendChild(card);
  });
}</body></html>