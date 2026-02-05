// ============================================
// ADMIN DASHBOARD
// ============================================

let currentGame = null;
let adminMap = null;
let treasureMarker = null;
let entryMarkers = [];
let editingGameId = null;

// Default form fields template
const defaultFormFields = [
  { name: 'name', label: 'Full Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'company', label: 'Company', type: 'text', required: false },
  { name: 'phone', label: 'Phone', type: 'tel', required: false }
];

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }

  // Verify token
  try {
    const res = await apiRequest('/api/auth/verify');
    if (!res.ok) {
      clearToken();
      window.location.href = '/login.html';
      return;
    }
  } catch {
    clearToken();
    window.location.href = '/login.html';
    return;
  }

  loadGamesList();
  setupEventListeners();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/login.html';
  });

  document.getElementById('newGameBtn').addEventListener('click', () => openGameModal());
  document.getElementById('backToList').addEventListener('click', showListView);
  document.getElementById('editGameBtn').addEventListener('click', () => openGameModal(currentGame));
  document.getElementById('statusBtn').addEventListener('click', toggleGameStatus);
  document.getElementById('setTreasureBtn').addEventListener('click', enableTreasurePlacement);
  document.getElementById('revealBtn').addEventListener('click', revealWinner);
  document.getElementById('exportBtn').addEventListener('click', exportEntries);
  document.getElementById('deleteGameBtn').addEventListener('click', deleteGame);
  document.getElementById('saveGameBtn').addEventListener('click', saveGame);
  document.getElementById('addFieldBtn').addEventListener('click', addFormField);
}

// ============================================
// VIEWS
// ============================================

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

function showListView() {
  showView('gamesListView');
  loadGamesList();
}

// ============================================
// GAMES LIST
// ============================================

async function loadGamesList() {
  const res = await apiRequest('/api/games');
  if (!res.ok) return;

  const games = Array.isArray(res) ? res : [];
  const container = document.getElementById('gamesList');

  if (games.length === 0) {
    container.innerHTML = `
      <div class="no-games">
        <h3>No games yet</h3>
        <p>Create your first treasure hunt game to get started.</p>
      </div>`;
    return;
  }

  container.innerHTML = games.map(g => `
    <div class="game-card" onclick="openGameDetail('${g.id}')">
      <div class="game-card-info">
        <h3>${escapeHtml(g.name)}</h3>
        <span class="game-code">${escapeHtml(g.code)}</span>
      </div>
      <div class="game-card-meta">
        <span class="badge badge-${g.status}">${g.status}</span>
        <span class="entry-count">${g.entry_count || 0} entries</span>
      </div>
    </div>
  `).join('');
}

// ============================================
// GAME DETAIL
// ============================================

async function openGameDetail(gameId) {
  const res = await apiRequest(`/api/games/${gameId}`);
  if (!res.ok) {
    showToast(res.error || 'Failed to load game', true);
    return;
  }

  currentGame = res;
  showView('gameDetailView');
  renderGameDetail();
  loadEntries(gameId);
}

function renderGameDetail() {
  const g = currentGame;

  document.getElementById('detailName').textContent = g.name;
  document.getElementById('detailCode').textContent = g.code;

  const statusBadge = document.getElementById('detailStatus');
  statusBadge.textContent = g.status;
  statusBadge.className = `badge badge-${g.status}`;

  // Update status button text
  const statusBtn = document.getElementById('statusBtn');
  if (g.status === 'draft') {
    statusBtn.textContent = 'Activate';
    statusBtn.style.display = '';
  } else if (g.status === 'active') {
    statusBtn.textContent = 'End Game';
    statusBtn.style.display = '';
  } else {
    statusBtn.style.display = 'none';
  }

  // Stats
  document.getElementById('statTreasure').textContent = g.treasure_lat ? 'Yes' : 'No';
  document.getElementById('statStatus').textContent = g.status.charAt(0).toUpperCase() + g.status.slice(1);

  // Winner banner
  const banner = document.getElementById('winnerBanner');
  if (g.winner_entry_id && g.revealed_at) {
    banner.style.display = '';
    // Winner details loaded with entries
  } else {
    banner.style.display = 'none';
  }

  // Show/hide reveal button
  document.getElementById('revealBtn').style.display =
    g.treasure_lat && !g.winner_entry_id ? '' : 'none';

  initAdminMap();
}

// ============================================
// ADMIN MAP
// ============================================

function initAdminMap() {
  const config = currentGame.map_config || {};
  const center = config.center || [-27.4698, 153.0251];
  const zoom = config.zoom || 13;

  // Remove old map
  if (adminMap) {
    adminMap.remove();
    adminMap = null;
  }
  treasureMarker = null;
  entryMarkers = [];

  adminMap = L.map('adminMap', {
    center: center,
    zoom: zoom
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OSM &copy; CARTO'
  }).addTo(adminMap);

  // Show treasure marker if set
  if (currentGame.treasure_lat && currentGame.treasure_lng) {
    addTreasureMarker(currentGame.treasure_lat, currentGame.treasure_lng);
  }

  // Invalidate size after display
  setTimeout(() => adminMap.invalidateSize(), 100);
}

function addTreasureMarker(lat, lng) {
  if (treasureMarker) {
    treasureMarker.setLatLng([lat, lng]);
    return;
  }

  const icon = L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  treasureMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(adminMap);
  treasureMarker.bindPopup('Treasure Location').openPopup();

  treasureMarker.on('dragend', async () => {
    const pos = treasureMarker.getLatLng();
    await saveTreasureLocation(pos.lat, pos.lng);
  });
}

function addEntryMarker(entry) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#1863DC;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  const formData = entry.form_data || {};
  const name = formData.name || formData.email || 'Anonymous';
  const distance = entry.distance_m != null ? `<br>Distance: ${entry.distance_m.toFixed(1)}m` : '';
  const isWinner = entry.id === currentGame.winner_entry_id;

  const m = L.marker([entry.marker_lat, entry.marker_lng], { icon }).addTo(adminMap);
  m.bindPopup(`<b>${escapeHtml(name)}</b>${distance}${isWinner ? '<br><b style="color:#92400e">WINNER</b>' : ''}`);
  entryMarkers.push(m);
}

function enableTreasurePlacement() {
  showToast('Click the map to place the treasure location');

  const handler = async (e) => {
    adminMap.off('click', handler);
    addTreasureMarker(e.latlng.lat, e.latlng.lng);
    await saveTreasureLocation(e.latlng.lat, e.latlng.lng);
  };

  adminMap.on('click', handler);
}

async function saveTreasureLocation(lat, lng) {
  const res = await apiRequest(`/api/games/${currentGame.id}/treasure`, {
    method: 'PUT',
    body: JSON.stringify({ lat, lng })
  });

  if (res.ok) {
    currentGame.treasure_lat = lat;
    currentGame.treasure_lng = lng;
    document.getElementById('statTreasure').textContent = 'Yes';
    document.getElementById('revealBtn').style.display =
      !currentGame.winner_entry_id ? '' : 'none';
    showToast('Treasure location saved');
  } else {
    showToast(res.error || 'Failed to save', true);
  }
}

// ============================================
// ENTRIES
// ============================================

async function loadEntries(gameId) {
  const res = await apiRequest(`/api/games/${gameId}/entries`);
  if (!res.ok) return;

  const entries = Array.isArray(res) ? res : [];
  document.getElementById('statEntries').textContent = entries.length;

  // Clear old markers
  entryMarkers.forEach(m => m.remove());
  entryMarkers = [];

  // Add markers to map
  entries.forEach(e => addEntryMarker(e));

  // Winner banner
  if (currentGame.winner_entry_id) {
    const winner = entries.find(e => e.id === currentGame.winner_entry_id);
    if (winner) {
      const name = winner.form_data?.name || winner.form_data?.email || 'Unknown';
      document.getElementById('winnerName').textContent = name;
      document.getElementById('winnerDistance').textContent =
        winner.distance_m != null ? `${winner.distance_m.toFixed(1)} meters away` : '';
      document.getElementById('winnerBanner').style.display = '';
    }
  }

  // Render table
  renderEntriesTable(entries);
}

function renderEntriesTable(entries) {
  const wrapper = document.getElementById('entriesTableWrapper');

  if (entries.length === 0) {
    wrapper.innerHTML = '<p style="color:var(--gray-500);font-size:14px">No entries yet</p>';
    return;
  }

  // Get form field labels from game config
  const fields = currentGame.form_fields || [];

  // Sort by distance if available
  const sorted = [...entries].sort((a, b) => {
    if (a.distance_m == null && b.distance_m == null) return 0;
    if (a.distance_m == null) return 1;
    if (b.distance_m == null) return -1;
    return a.distance_m - b.distance_m;
  });

  const headerCells = fields.map(f => `<th>${escapeHtml(f.label)}</th>`).join('');
  const distanceHeader = currentGame.revealed_at ? '<th>Distance</th>' : '';

  let html = `<table class="entries-table">
    <thead><tr><th>#</th>${headerCells}<th>Location</th>${distanceHeader}<th>Submitted</th></tr></thead>
    <tbody>`;

  sorted.forEach((e, i) => {
    const isWinner = e.id === currentGame.winner_entry_id;
    const fieldCells = fields.map(f =>
      `<td>${escapeHtml(e.form_data?.[f.name] || '')}</td>`
    ).join('');
    const distanceCell = currentGame.revealed_at
      ? `<td>${e.distance_m != null ? e.distance_m.toFixed(1) + 'm' : '--'}</td>` : '';
    const time = new Date(e.created_at + 'Z').toLocaleString();

    html += `<tr class="${isWinner ? 'winner' : ''}">
      <td>${i + 1}</td>
      ${fieldCells}
      <td>${e.marker_lat.toFixed(5)}, ${e.marker_lng.toFixed(5)}</td>
      ${distanceCell}
      <td>${time}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  wrapper.innerHTML = html;
}

// ============================================
// GAME ACTIONS
// ============================================

async function toggleGameStatus() {
  const newStatus = currentGame.status === 'draft' ? 'active' : 'ended';
  const label = newStatus === 'active' ? 'activate' : 'end';

  showConfirm(
    `${label.charAt(0).toUpperCase() + label.slice(1)} Game`,
    `Are you sure you want to ${label} this game?`,
    async () => {
      const res = await apiRequest(`/api/games/${currentGame.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        currentGame.status = newStatus;
        renderGameDetail();
        showToast(`Game ${newStatus === 'active' ? 'activated' : 'ended'}`);
      } else {
        showToast(res.error || 'Failed to update status', true);
      }
    }
  );
}

async function revealWinner() {
  if (!currentGame.treasure_lat) {
    showToast('Set the treasure location first', true);
    return;
  }

  showConfirm(
    'Reveal Winner',
    'This will calculate distances for all entries and determine the winner. This action cannot be undone.',
    async () => {
      const res = await apiRequest(`/api/games/${currentGame.id}/reveal`, {
        method: 'POST'
      });

      if (res.ok) {
        showToast(`Winner found! ${res.total_entries} entries evaluated. Closest: ${res.closest_distance_m.toFixed(1)}m`);
        await openGameDetail(currentGame.id);
      } else {
        showToast(res.error || 'Failed to reveal winner', true);
      }
    }
  );
}

async function exportEntries() {
  try {
    const res = await apiRequest(`/api/games/${currentGame.id}/entries/export`);
    if (res.blob) {
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entries-${currentGame.code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exported');
    } else {
      showToast('No data to export', true);
    }
  } catch {
    showToast('Export failed', true);
  }
}

async function deleteGame() {
  showConfirm(
    'Delete Game',
    `Are you sure you want to delete "${currentGame.name}"? This will delete all entries and cannot be undone.`,
    async () => {
      const res = await apiRequest(`/api/games/${currentGame.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast('Game deleted');
        showListView();
      } else {
        showToast(res.error || 'Failed to delete', true);
      }
    }
  );
}

// ============================================
// GAME MODAL
// ============================================

function openGameModal(game = null) {
  editingGameId = game ? game.id : null;
  document.getElementById('gameModalTitle').textContent = game ? 'Edit Game' : 'New Game';

  document.getElementById('gameCode').value = game ? game.code : '';
  document.getElementById('gameCode').disabled = !!game; // Can't change code after creation
  document.getElementById('gameName').value = game ? game.name : '';

  const config = game?.map_config || {};
  document.getElementById('mapCenter').value = config.center
    ? `${config.center[0]}, ${config.center[1]}` : '-27.4698, 153.0251';
  document.getElementById('mapZoom').value = config.zoom || 13;

  // Form fields
  const fields = game?.form_fields?.length ? game.form_fields : defaultFormFields;
  renderFormFieldsEditor(fields);

  openModal('gameModal');
}

function renderFormFieldsEditor(fields) {
  const container = document.getElementById('formFieldsEditor');
  container.innerHTML = fields.map((f, i) => `
    <div class="form-field-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
      <input type="text" placeholder="Field name" value="${escapeHtml(f.name)}" data-idx="${i}" data-prop="name" style="flex:1;padding:6px 8px;font-size:13px;border:1.5px solid var(--gray-300);border-radius:4px">
      <input type="text" placeholder="Label" value="${escapeHtml(f.label)}" data-idx="${i}" data-prop="label" style="flex:1;padding:6px 8px;font-size:13px;border:1.5px solid var(--gray-300);border-radius:4px">
      <select data-idx="${i}" data-prop="type" style="padding:6px 4px;font-size:13px;border:1.5px solid var(--gray-300);border-radius:4px">
        <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
        <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email</option>
        <option value="tel" ${f.type === 'tel' ? 'selected' : ''}>Phone</option>
        <option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option>
      </select>
      <label style="font-size:12px;display:flex;align-items:center;gap:3px;white-space:nowrap">
        <input type="checkbox" data-idx="${i}" data-prop="required" ${f.required ? 'checked' : ''}> Req
      </label>
      <button type="button" onclick="removeFormField(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;padding:0 4px">&times;</button>
    </div>
  `).join('');
}

function addFormField() {
  const fields = getFormFieldsFromEditor();
  fields.push({ name: '', label: '', type: 'text', required: false });
  renderFormFieldsEditor(fields);
}

function removeFormField(idx) {
  const fields = getFormFieldsFromEditor();
  fields.splice(idx, 1);
  renderFormFieldsEditor(fields);
}

function getFormFieldsFromEditor() {
  const container = document.getElementById('formFieldsEditor');
  const rows = container.querySelectorAll('.form-field-row');
  const fields = [];

  rows.forEach(row => {
    const nameInput = row.querySelector('[data-prop="name"]');
    const labelInput = row.querySelector('[data-prop="label"]');
    const typeSelect = row.querySelector('[data-prop="type"]');
    const reqCheck = row.querySelector('[data-prop="required"]');

    fields.push({
      name: nameInput.value.trim(),
      label: labelInput.value.trim(),
      type: typeSelect.value,
      required: reqCheck.checked
    });
  });

  return fields;
}

async function saveGame() {
  const code = document.getElementById('gameCode').value.trim().toLowerCase();
  const name = document.getElementById('gameName').value.trim();
  const centerStr = document.getElementById('mapCenter').value.trim();
  const zoom = parseInt(document.getElementById('mapZoom').value) || 13;

  if (!code || !name) {
    showToast('Code and name are required', true);
    return;
  }

  if (!/^[a-z0-9-]+$/.test(code)) {
    showToast('Code must be lowercase letters, numbers, and hyphens only', true);
    return;
  }

  // Parse center
  const centerParts = centerStr.split(',').map(s => parseFloat(s.trim()));
  if (centerParts.length !== 2 || isNaN(centerParts[0]) || isNaN(centerParts[1])) {
    showToast('Invalid map center. Use format: lat, lng', true);
    return;
  }

  const formFields = getFormFieldsFromEditor().filter(f => f.name && f.label);

  const body = {
    code,
    name,
    map_config: { center: centerParts, zoom },
    form_fields: formFields
  };

  const btn = document.getElementById('saveGameBtn');
  btn.disabled = true;

  try {
    let res;
    if (editingGameId) {
      res = await apiRequest(`/api/games/${editingGameId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    } else {
      res = await apiRequest('/api/games', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }

    if (res.ok !== false && !res.error) {
      closeModal('gameModal');
      showToast(editingGameId ? 'Game updated' : 'Game created');

      if (editingGameId) {
        await openGameDetail(editingGameId);
      } else {
        // Open the newly created game
        const gameId = res.id;
        if (gameId) {
          await openGameDetail(gameId);
        } else {
          loadGamesList();
        }
      }
    } else {
      showToast(res.error || 'Failed to save game', true);
    }
  } catch (err) {
    showToast('Failed to save game', true);
  }

  btn.disabled = false;
}

// ============================================
// MODALS
// ============================================

function openModal(id) {
  document.getElementById(id).classList.add('visible');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
}

let confirmCallback = null;

function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;

  const okBtn = document.getElementById('confirmOkBtn');
  // Style danger for destructive actions
  if (title.toLowerCase().includes('delete')) {
    okBtn.className = 'btn btn-danger';
  } else {
    okBtn.className = 'btn btn-primary';
  }

  openModal('confirmModal');
}

document.getElementById('confirmOkBtn').addEventListener('click', () => {
  closeModal('confirmModal');
  if (confirmCallback) confirmCallback();
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('visible');
    }
  });
});

// ============================================
// HELPERS
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');
  requestAnimationFrame(() => {
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  });
}
