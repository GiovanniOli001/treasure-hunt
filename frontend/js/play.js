// ============================================
// PLAY PAGE - Entry form + map + live reveal
// ============================================

let map = null;
let marker = null;
let gameData = null;
let myEntryId = null;
let pollInterval = null;
let revealMap = null;

// Treasure image URL (the "treasure" person)
const TREASURE_IMAGE = 'https://cdn.theorg.com/091ad477-ab91-4996-840d-fa11178dbd80_medium.jpg';

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

  // Check if user already submitted for this game
  const savedEntryId = localStorage.getItem('th_entry_' + code);

  try {
    const res = await apiRequest('/api/games/' + code);

    if (!res.ok) {
      showError(res.error || 'Game not found');
      return;
    }

    gameData = res;
    document.getElementById('gameName').textContent = res.name;
    document.title = res.name + ' - Treasure Hunt';

    // If game already revealed, go straight to results
    if (res.revealed_at) {
      document.getElementById('loadingScreen').style.display = 'none';
      myEntryId = savedEntryId;
      showReveal();
      return;
    }

    // If user already submitted, show waiting screen
    if (savedEntryId) {
      myEntryId = savedEntryId;
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('successScreen').classList.add('visible');
      startPolling();
      return;
    }

    if (res.status !== 'active') {
      if (res.status === 'draft') {
        showError("This game hasn't started yet. Check back soon!");
      } else {
        showError('This game has ended. Thanks for playing!');
      }
      return;
    }

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
  var center = config.center || [-27.4698, 153.0251];
  var zoom = config.zoom || 13;

  map = L.map('map', {
    center: center,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OSM &copy; CARTO'
  }).addTo(map);

  if (config.bounds) {
    map.setMaxBounds(config.bounds);
    map.options.minZoom = map.getZoom() - 2;
  }

  map.on('click', function(e) {
    placeMarker(e.latlng.lat, e.latlng.lng);
  });
}

function placeMarker(lat, lng) {
  var isNew = !marker;

  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    var pinIcon = L.icon({
      iconUrl: 'assets/pin-icon.svg',
      iconSize: [44, 56],
      iconAnchor: [22, 56]
    });

    marker = L.marker([lat, lng], {
      draggable: true,
      icon: pinIcon,
      autoPan: true
    }).addTo(map);

    marker.on('dragend', function() {
      checkCanSubmit();
    });

    document.getElementById('mapHint').classList.add('hidden');
    document.getElementById('pinPlacedMsg').classList.add('visible');
  }

  if (isNew) {
    var el = marker.getElement();
    if (el) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      el.style.transform = 'translateY(-20px)';
      setTimeout(function() { el.style.transform = ''; }, 50);
    }
  }

  checkCanSubmit();
}

// ============================================
// FORM FIELDS
// ============================================

function renderFormFields(fields) {
  var container = document.getElementById('formFields');
  if (fields.length === 0) return;

  fields.forEach(function(field) {
    var group = document.createElement('div');
    group.className = 'form-group';

    var label = document.createElement('label');
    label.setAttribute('for', 'field_' + field.name);
    label.textContent = field.label || field.name;
    if (field.required) {
      var req = document.createElement('span');
      req.className = 'required';
      req.textContent = ' *';
      label.appendChild(req);
    }

    var input;
    if (field.type === 'select' && field.options) {
      input = document.createElement('select');
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select ' + (field.label || field.name);
      input.appendChild(placeholder);
      field.options.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      input.placeholder = field.placeholder || '';
    }

    input.id = 'field_' + field.name;
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
  var hasMarker = marker !== null;
  var fields = document.querySelectorAll('#formFields input, #formFields select');
  var allValid = true;

  fields.forEach(function(field) {
    if (field.dataset.required === 'true' && !field.value.trim()) {
      allValid = false;
    }
  });

  document.getElementById('submitBtn').disabled = !(hasMarker && allValid);
}

document.getElementById('submitBtn').addEventListener('click', async function() {
  var btn = document.getElementById('submitBtn');
  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    var formData = {};
    var fields = document.querySelectorAll('#formFields input, #formFields select');
    fields.forEach(function(field) {
      if (field.value.trim()) {
        formData[field.name] = field.value.trim();
      }
    });

    var latlng = marker.getLatLng();

    var res = await apiRequest('/api/games/' + gameData.code + '/entries', {
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

    // Save entry ID for results
    myEntryId = res.id;
    localStorage.setItem('th_entry_' + gameData.code, myEntryId);

    // Show waiting screen
    document.getElementById('entryForm').classList.remove('visible');
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('successScreen').classList.add('visible');
    launchConfetti();

    // Start polling for reveal
    startPolling();

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Failed to submit. Please try again.', true);
    btn.disabled = false;
    btn.textContent = 'Lock In My Guess';
  }
});

// ============================================
// POLLING FOR REVEAL
// ============================================

function startPolling() {
  if (pollInterval) return;

  pollInterval = setInterval(async function() {
    try {
      var res = await apiRequest('/api/games/' + gameData.code);
      if (res.ok && res.revealed_at) {
        clearInterval(pollInterval);
        pollInterval = null;
        gameData = res;
        runCountdown();
      }
    } catch (e) {
      // Silently retry
    }
  }, 3000);
}

// ============================================
// COUNTDOWN + REVEAL
// ============================================

function runCountdown() {
  var overlay = document.getElementById('countdownOverlay');
  var numberEl = document.getElementById('countdownNumber');
  overlay.classList.add('visible');

  var count = 3;
  numberEl.textContent = count;

  var timer = setInterval(function() {
    count--;
    if (count > 0) {
      numberEl.textContent = count;
      numberEl.style.animation = 'none';
      // Force reflow to restart animation
      void numberEl.offsetWidth;
      numberEl.style.animation = 'countPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    } else {
      clearInterval(timer);
      numberEl.textContent = '!';
      numberEl.style.animation = 'none';
      void numberEl.offsetWidth;
      numberEl.style.animation = 'countPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

      setTimeout(function() {
        overlay.classList.remove('visible');
        showReveal();
      }, 800);
    }
  }, 1000);
}

async function showReveal() {
  // Hide other screens
  document.getElementById('successScreen').classList.remove('visible');
  document.getElementById('successScreen').style.display = 'none';
  document.getElementById('entryForm').style.display = 'none';

  // Fetch results
  var entryParam = myEntryId ? '?entry_id=' + myEntryId : '';
  var results;
  try {
    results = await apiRequest('/api/games/' + gameData.code + '/entries/results' + entryParam);
  } catch (e) {
    results = null;
  }

  // Show reveal screen
  var revealScreen = document.getElementById('revealScreen');
  revealScreen.classList.add('visible');

  // Winner info
  if (results && results.winner) {
    document.getElementById('revealWinnerName').textContent = results.winner.name;
    document.getElementById('revealWinnerDistance').textContent =
      results.winner.distance_m != null
        ? results.winner.distance_m.toFixed(1) + 'm from the treasure (out of ' + results.total_entries + ' entries)'
        : '';
  }

  // My result
  if (results && results.my_entry) {
    var myResult = document.getElementById('revealMyResult');
    myResult.style.display = '';
    var isWinner = results.my_entry.id === (results.winner && results.winner.id);
    if (isWinner) {
      myResult.classList.add('reveal-is-winner');
      document.getElementById('revealMyRank').textContent = 'YOU WON!';
      document.getElementById('revealMyDistance').textContent =
        results.my_entry.distance_m.toFixed(1) + 'm away';
      // Extra celebration
      setTimeout(function() { launchConfetti(); }, 500);
      setTimeout(function() { launchConfetti(); }, 1500);
    } else {
      document.getElementById('revealMyRank').textContent =
        '#' + results.my_entry.rank + ' of ' + results.total_entries;
      document.getElementById('revealMyDistance').textContent =
        results.my_entry.distance_m != null
          ? results.my_entry.distance_m.toFixed(1) + 'm from the treasure'
          : '';
    }
  }

  // Init reveal map
  initRevealMap(results);

  // Confetti for everyone
  launchConfetti();
}

function initRevealMap(results) {
  var config = gameData.map_config || {};
  var center = config.center || [-27.4698, 153.0251];
  var zoom = config.zoom || 13;

  revealMap = L.map('revealMap', {
    center: center,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OSM &copy; CARTO'
  }).addTo(revealMap);

  var bounds = [];

  // Treasure marker - the guy's face!
  if (results && results.treasure_lat && results.treasure_lng) {
    var treasureIcon = L.divIcon({
      className: '',
      html: '<div style="width:52px;height:52px;border-radius:50%;border:4px solid #f57e20;overflow:hidden;box-shadow:0 4px 16px rgba(245,126,32,0.5)">' +
        '<img src="' + TREASURE_IMAGE + '" style="width:100%;height:100%;object-fit:cover" alt="Treasure">' +
        '</div>',
      iconSize: [52, 52],
      iconAnchor: [26, 26]
    });

    L.marker([results.treasure_lat, results.treasure_lng], { icon: treasureIcon })
      .addTo(revealMap)
      .bindPopup('<b>The Treasure!</b>');
    bounds.push([results.treasure_lat, results.treasure_lng]);
  }

  // Winner marker
  if (results && results.winner) {
    var winnerIcon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;background:#16a34a;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
        '</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    L.marker([results.winner.marker_lat, results.winner.marker_lng], { icon: winnerIcon })
      .addTo(revealMap)
      .bindPopup('<b>' + escapeHtml(results.winner.name) + '</b><br>Winner! ' + results.winner.distance_m.toFixed(1) + 'm');
    bounds.push([results.winner.marker_lat, results.winner.marker_lng]);
  }

  // My entry marker
  if (results && results.my_entry && (!results.winner || results.my_entry.id !== results.winner.id)) {
    var myIcon = L.icon({
      iconUrl: 'assets/pin-icon.svg',
      iconSize: [36, 46],
      iconAnchor: [18, 46]
    });

    L.marker([results.my_entry.marker_lat, results.my_entry.marker_lng], { icon: myIcon })
      .addTo(revealMap)
      .bindPopup('<b>Your Pin</b><br>' + (results.my_entry.distance_m != null ? results.my_entry.distance_m.toFixed(1) + 'm away' : ''));
    bounds.push([results.my_entry.marker_lat, results.my_entry.marker_lng]);
  }

  // Fit bounds
  if (bounds.length >= 2) {
    revealMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  } else if (bounds.length === 1) {
    revealMap.setView(bounds[0], 15);
  }

  setTimeout(function() { revealMap.invalidateSize(); }, 200);
}

// ============================================
// CONFETTI
// ============================================

function launchConfetti() {
  var container = document.getElementById('confetti');
  var colors = ['#f57e20', '#3aa9e0', '#357cc0', '#16a34a', '#eab308', '#ef4444', '#8b5cf6'];

  for (var i = 0; i < 60; i++) {
    var piece = document.createElement('div');
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

  setTimeout(function() { container.innerHTML = ''; }, 4000);
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(message) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorScreen').classList.add('visible');
}

function showToast(message, isError) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');

  requestAnimationFrame(function() {
    toast.classList.add('visible');
    setTimeout(function() {
      toast.classList.remove('visible');
    }, 3000);
  });
}
