// ============================================
// PLAY PAGE - Entry form + map
// Fun, interactive, mobile-first
// ============================================

let map = null;
let marker = null;
let gameData = null;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (!code) {
    showError('No game code provided. Please scan the QR code again.');
    return;
  }

  try {
    const res = await apiRequest(`/api/games/${code}`);

    if (!res.ok) {
      showError(res.error || 'Game not found');
      return;
    }

    if (res.status !== 'active') {
      if (res.status === 'draft') {
        showError('This game hasn\'t started yet. Check back soon!');
      } else {
        showError('This game has ended. Thanks for playing!');
      }
      return;
    }

    gameData = res;
    document.getElementById('gameName').textContent = res.name;
    document.title = `${res.name} - Treasure Hunt`;

    renderFormFields(res.form_fields || []);
    initMap(res.map_config || {});

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('entryForm').classList.add('visible');

  } catch (err) {
    console.error('Load error:', err);
    showError('Failed to load game. Please try again.');
  }
});

// ============================================
// MAP
// ============================================

function initMap(config) {
  const center = config.center || [-27.4698, 153.0251];
  const zoom = config.zoom || 13;

  map = L.map('map', {
    center: center,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false
  });

  // Zoom control on right side
  L.control.zoom({ position: 'topright' }).addTo(map);

  // CartoDB Voyager - colourful, modern, fun-looking tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OSM &copy; CARTO'
  }).addTo(map);

  // Set bounds if provided
  if (config.bounds) {
    map.setMaxBounds(config.bounds);
    map.options.minZoom = map.getZoom() - 2;
  }

  // Click to place marker
  map.on('click', (e) => {
    placeMarker(e.latlng.lat, e.latlng.lng);
  });
}

function placeMarker(lat, lng) {
  const isNew = !marker;

  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    // Transportme branded pin icon
    const pinIcon = L.icon({
      iconUrl: 'assets/pin-icon.svg',
      iconSize: [44, 56],
      iconAnchor: [22, 56]
    });

    marker = L.marker([lat, lng], {
      draggable: true,
      icon: pinIcon,
      autoPan: true
    }).addTo(map);

    marker.on('dragend', () => {
      checkCanSubmit();
    });

    // Hide hint, show placed message
    document.getElementById('mapHint').classList.add('hidden');
    document.getElementById('pinPlacedMsg').classList.add('visible');
  }

  // Subtle bounce animation on the marker
  if (isNew) {
    const el = marker.getElement();
    if (el) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      el.style.transform = 'translateY(-20px)';
      setTimeout(() => { el.style.transform = ''; }, 50);
    }
  }

  checkCanSubmit();
}

// ============================================
// FORM FIELDS
// ============================================

function renderFormFields(fields) {
  const container = document.getElementById('formFields');

  if (fields.length === 0) return;

  fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', `field_${field.name}`);
    label.textContent = field.label || field.name;
    if (field.required) {
      const req = document.createElement('span');
      req.className = 'required';
      req.textContent = ' *';
      label.appendChild(req);
    }

    let input;
    if (field.type === 'select' && field.options) {
      input = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `Select ${field.label || field.name}`;
      input.appendChild(placeholder);
      field.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      input.placeholder = field.placeholder || '';
    }

    input.id = `field_${field.name}`;
    input.name = field.name;
    input.dataset.required = field.required ? 'true' : 'false';

    input.addEventListener('input', checkCanSubmit);

    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
  });
}

// ============================================
// VALIDATION & SUBMIT
// ============================================

function checkCanSubmit() {
  const hasMarker = marker !== null;
  const fields = document.querySelectorAll('#formFields input, #formFields select');
  let allValid = true;

  fields.forEach(field => {
    if (field.dataset.required === 'true' && !field.value.trim()) {
      allValid = false;
    }
  });

  document.getElementById('submitBtn').disabled = !(hasMarker && allValid);
}

document.getElementById('submitBtn').addEventListener('click', async () => {
  const btn = document.getElementById('submitBtn');
  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    // Collect form data
    const formData = {};
    const fields = document.querySelectorAll('#formFields input, #formFields select');
    fields.forEach(field => {
      if (field.value.trim()) {
        formData[field.name] = field.value.trim();
      }
    });

    const latlng = marker.getLatLng();

    const res = await apiRequest(`/api/games/${gameData.code}/entries`, {
      method: 'POST',
      body: JSON.stringify({
        marker_lat: latlng.lat,
        marker_lng: latlng.lng,
        form_data: formData
      })
    });

    if (!res.ok) {
      showToast(res.error || 'Failed to submit entry', true);
      btn.disabled = false;
      btn.textContent = 'Lock In My Guess';
      return;
    }

    // Show success with confetti!
    document.getElementById('entryForm').classList.remove('visible');
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('successScreen').classList.add('visible');
    launchConfetti();

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Failed to submit. Please try again.', true);
    btn.disabled = false;
    btn.textContent = 'Lock In My Guess';
  }
});

// ============================================
// CONFETTI
// ============================================

function launchConfetti() {
  const container = document.getElementById('confetti');
  const colors = ['#f57e20', '#3aa9e0', '#357cc0', '#16a34a', '#eab308', '#ef4444', '#8b5cf6'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (Math.random() * 8 + 6) + 'px';
    piece.style.height = (Math.random() * 8 + 6) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    piece.style.animationDelay = (Math.random() * 0.8) + 's';
    container.appendChild(piece);
  }

  // Clean up after animation
  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}

// ============================================
// HELPERS
// ============================================

function showError(message) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorScreen').classList.add('visible');
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');

  requestAnimationFrame(() => {
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  });
}
