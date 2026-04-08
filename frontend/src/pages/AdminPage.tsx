import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  AppBar,
  Toolbar,
  Container,
  Grid,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest, getToken, clearToken } from '../lib/api';

interface Game {
  id: string;
  code: string;
  name: string;
  status: string;
  map_config: MapConfig;
  form_fields: FormField[];
  treasure_lat: number | null;
  treasure_lng: number | null;
  winner_entry_id: string | null;
  revealed_at: string | null;
  entry_count?: number;
}

interface MapConfig {
  center?: [number, number];
  zoom?: number;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

interface Entry {
  id: string;
  marker_lat: number;
  marker_lng: number;
  form_data: Record<string, string>;
  distance_m: number | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

type View = 'list' | 'detail' | 'users';

const DEFAULT_FIELDS: FormField[] = [
  { name: 'name', label: 'Full Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'company', label: 'Company', type: 'text', required: false },
  { name: 'phone', label: 'Phone', type: 'tel', required: false },
];

const statusColors: Record<string, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  active: 'success',
  ended: 'default',
};

function AdminMapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('list');
  const [games, setGames] = useState<Game[]>([]);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // Game modal
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [gmCode, setGmCode] = useState('');
  const [gmName, setGmName] = useState('');
  const [gmCenter, setGmCenter] = useState('-27.4698, 153.0251');
  const [gmZoom, setGmZoom] = useState(13);
  const [gmFields, setGmFields] = useState<FormField[]>(DEFAULT_FIELDS);

  // User modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [umName, setUmName] = useState('');
  const [umEmail, setUmEmail] = useState('');
  const [umPassword, setUmPassword] = useState('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  // Treasure placement mode
  const [placingTreasure, setPlacingTreasure] = useState(false);

  const showToast = (msg: string, severity: 'success' | 'error' = 'success') =>
    setToast({ msg, severity });

  // Auth check
  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await apiRequest('/api/auth/verify');
        if (!res.ok) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
      } catch {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      loadGamesList();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGamesList = async () => {
    setLoading(true);
    const res = await apiRequest<Game[]>('/api/games');
    if (Array.isArray(res)) setGames(res);
    setLoading(false);
  };

  const openGameDetail = useCallback(async (gameId: string) => {
    const res = await apiRequest<Game>('/api/games/' + gameId);
    if (res.ok) {
      setCurrentGame(res as unknown as Game);
      setView('detail');
      // Load entries
      const entriesRes = await apiRequest<Entry[]>('/api/games/' + gameId + '/entries');
      if (Array.isArray(entriesRes)) setEntries(entriesRes);
    } else {
      showToast('Failed to load game', 'error');
    }
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  // Game CRUD
  const openGameModal = (game?: Game) => {
    setEditingGame(game || null);
    setGmCode(game?.code || '');
    setGmName(game?.name || '');
    const config = game?.map_config || {};
    setGmCenter(config.center ? `${config.center[0]}, ${config.center[1]}` : '-27.4698, 153.0251');
    setGmZoom(config.zoom || 13);
    setGmFields(game?.form_fields?.length ? [...game.form_fields] : [...DEFAULT_FIELDS]);
    setGameModalOpen(true);
  };

  const saveGame = async () => {
    const code = gmCode.trim().toLowerCase();
    const name = gmName.trim();
    if (!code || !name) {
      showToast('Code and name are required', 'error');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(code)) {
      showToast('Code must be lowercase letters, numbers, and hyphens', 'error');
      return;
    }
    const centerParts = gmCenter.split(',').map((s) => parseFloat(s.trim()));
    if (centerParts.length !== 2 || isNaN(centerParts[0]) || isNaN(centerParts[1])) {
      showToast('Invalid map center', 'error');
      return;
    }

    const body = {
      code,
      name,
      map_config: { center: centerParts, zoom: gmZoom },
      form_fields: gmFields.filter((f) => f.name && f.label),
    };

    let res;
    if (editingGame) {
      res = await apiRequest('/api/games/' + editingGame.id, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } else {
      res = await apiRequest('/api/games', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    if (res.ok !== false && !(res as { error?: string }).error) {
      setGameModalOpen(false);
      showToast(editingGame ? 'Game updated' : 'Game created');
      if (editingGame) {
        await openGameDetail(editingGame.id);
      } else {
        const newId = (res as { id?: string }).id;
        if (newId) await openGameDetail(newId);
        else await loadGamesList();
      }
    } else {
      showToast((res as { error?: string }).error || 'Failed to save', 'error');
    }
  };

  const toggleStatus = () => {
    if (!currentGame) return;
    const newStatus = currentGame.status === 'draft' ? 'active' : 'ended';
    const label = newStatus === 'active' ? 'activate' : 'end';

    showConfirm(`${label.charAt(0).toUpperCase() + label.slice(1)} Game`, `Are you sure you want to ${label} this game?`, async () => {
      const res = await apiRequest('/api/games/' + currentGame.id + '/status', {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Game ${newStatus === 'active' ? 'activated' : 'ended'}`);
        await openGameDetail(currentGame.id);
      } else {
        showToast('Failed to update status', 'error');
      }
    });
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!placingTreasure || !currentGame) return;
    setPlacingTreasure(false);
    const res = await apiRequest('/api/games/' + currentGame.id + '/treasure', {
      method: 'PUT',
      body: JSON.stringify({ lat, lng }),
    });
    if (res.ok) {
      showToast('Treasure location saved');
      await openGameDetail(currentGame.id);
    } else {
      showToast('Failed to save', 'error');
    }
  };

  const revealWinner = () => {
    if (!currentGame?.treasure_lat) {
      showToast('Set the treasure location first', 'error');
      return;
    }
    showConfirm('Reveal Winner', 'This will calculate distances and determine the winner. Cannot be undone.', async () => {
      const res = await apiRequest('/api/games/' + currentGame!.id + '/reveal', { method: 'POST' });
      if (res.ok) {
        const r = res as unknown as { total_entries: number; closest_distance_m: number };
        showToast(`Winner found! ${r.total_entries} entries, closest: ${r.closest_distance_m.toFixed(1)}m`);
        await openGameDetail(currentGame!.id);
      } else {
        showToast('Failed to reveal', 'error');
      }
    });
  };

  const exportCSV = async () => {
    if (!currentGame) return;
    try {
      const res = await apiRequest('/api/games/' + currentGame.id + '/entries/export');
      const blob = (res as { blob?: Blob }).blob;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entries-${currentGame.code}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exported');
      }
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const deleteGame = () => {
    if (!currentGame) return;
    showConfirm('Delete Game', `Delete "${currentGame.name}"? All entries will be lost.`, async () => {
      const res = await apiRequest('/api/games/' + currentGame!.id, { method: 'DELETE' });
      if (res.ok) {
        showToast('Game deleted');
        setView('list');
        await loadGamesList();
      } else {
        showToast('Failed to delete', 'error');
      }
    });
  };

  // Users
  const loadUsers = async () => {
    const res = await apiRequest<AdminUser[]>('/api/auth/users');
    if (Array.isArray(res)) setUsers(res);
  };

  const saveUser = async () => {
    if (!umName || !umEmail || !umPassword) {
      showToast('All fields required', 'error');
      return;
    }
    if (umPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    const res = await apiRequest('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify({ name: umName, email: umEmail, password: umPassword }),
    });
    if (res.ok !== false && !(res as { error?: string }).error) {
      setUserModalOpen(false);
      setUmName('');
      setUmEmail('');
      setUmPassword('');
      showToast('User created');
      await loadUsers();
    } else {
      showToast((res as { error?: string }).error || 'Failed to create user', 'error');
    }
  };

  const deleteUser = (id: string, name: string) => {
    showConfirm('Delete User', `Remove "${name}" as admin?`, async () => {
      const res = await apiRequest('/api/auth/users/' + id, { method: 'DELETE' });
      if (res.ok !== false) {
        showToast('User removed');
        await loadUsers();
      } else {
        showToast('Failed to remove', 'error');
      }
    });
  };

  const showConfirm = (title: string, msg: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  // Sort entries by distance
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.distance_m == null && b.distance_m == null) return 0;
    if (a.distance_m == null) return 1;
    if (b.distance_m == null) return -1;
    return a.distance_m - b.distance_m;
  });

  const winner = currentGame?.winner_entry_id
    ? entries.find((e) => e.id === currentGame.winner_entry_id)
    : null;

  const mapCenter: [number, number] = currentGame?.map_config?.center || [-27.4698, 153.0251];
  const mapZoom = currentGame?.map_config?.zoom || 13;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#f4f4f4' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#0a1628' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/assets/Transportme UPLIFT LOGO 2025_no tag.svg"
              alt="Transportme"
              sx={{ height: 28 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18 }}>
              Treasure Hunt Admin
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<PersonIcon />}
              onClick={() => {
                setView('users');
                loadUsers();
              }}
              sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}
              size="small"
            >
              Users
            </Button>
            <Button
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}
              size="small"
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* GAMES LIST */}
        {view === 'list' && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Games
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openGameModal()} size="small">
                New Game
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : games.length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="h6">No games yet</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Create your first treasure hunt game to get started.
                </Typography>
              </Paper>
            ) : (
              games.map((g) => (
                <Paper
                  key={g.id}
                  onClick={() => openGameDetail(g.id)}
                  sx={{
                    p: 2.5,
                    mb: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'box-shadow 0.15s',
                    '&:hover': { boxShadow: 3 },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{g.name}</Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13, fontFamily: 'monospace' }}>
                      {g.code}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip label={g.status} color={statusColors[g.status] || 'default'} size="small" />
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                      {g.entry_count || 0} entries
                    </Typography>
                  </Box>
                </Paper>
              ))
            )}
          </>
        )}

        {/* GAME DETAIL */}
        {view === 'detail' && currentGame && (
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setView('list');
                loadGamesList();
              }}
              sx={{ mb: 1 }}
            >
              All Games
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {currentGame.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip label={currentGame.status} color={statusColors[currentGame.status] || 'default'} size="small" />
                  <Typography sx={{ color: 'text.secondary', fontSize: 13, fontFamily: 'monospace' }}>
                    {currentGame.code}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openGameModal(currentGame)}>
                  Edit
                </Button>
                {currentGame.status !== 'ended' && (
                  <Button size="small" variant="outlined" onClick={toggleStatus}>
                    {currentGame.status === 'draft' ? 'Activate' : 'End Game'}
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LocationOnIcon />}
                  onClick={() => {
                    setPlacingTreasure(true);
                    showToast('Click the map to place the treasure');
                  }}
                >
                  Set Treasure
                </Button>
                {currentGame.treasure_lat && !currentGame.winner_entry_id && (
                  <Button size="small" variant="contained" color="success" startIcon={<EmojiEventsIcon />} onClick={revealWinner}>
                    Reveal Winner
                  </Button>
                )}
                <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>
                  Export
                </Button>
                <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={deleteGame}>
                  Delete
                </Button>
              </Box>
            </Box>

            {/* Winner banner */}
            {winner && (
              <Paper
                sx={{
                  p: 2.5,
                  mb: 2,
                  background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)',
                  border: '2px solid #f59e0b',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 700, color: '#92400e', fontSize: 18, mb: 0.5 }}>
                  Winner!
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 22 }}>
                  {winner.form_data?.name || winner.form_data?.email || 'Unknown'}
                </Typography>
                {winner.distance_m != null && (
                  <Typography sx={{ color: '#92400e', fontSize: 14, mt: 0.5 }}>
                    {winner.distance_m.toFixed(1)} meters away
                  </Typography>
                )}
              </Paper>
            )}

            {/* Stats */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, color: 'primary.main' }}>
                    {entries.length}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Entries
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, color: 'primary.main' }}>
                    {currentGame.treasure_lat ? 'Yes' : 'No'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Treasure Set
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, color: 'primary.main' }}>
                    {currentGame.status.charAt(0).toUpperCase() + currentGame.status.slice(1)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Status
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Map */}
            <Paper sx={{ p: 2.5, mb: 2 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 15, mb: 1.5, color: 'text.secondary' }}>
                Map
              </Typography>
              <Box sx={{ height: 450, borderRadius: 1, overflow: 'hidden', border: '1.5px solid #d1d5db' }}>
                <MapContainer center={mapCenter} zoom={mapZoom} style={{ width: '100%', height: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <InvalidateSize />
                  {placingTreasure && <AdminMapClickHandler onClick={handleMapClick} />}

                  {/* Treasure marker */}
                  {currentGame.treasure_lat && currentGame.treasure_lng && (
                    <Marker
                      position={[currentGame.treasure_lat, currentGame.treasure_lng]}
                      icon={L.divIcon({
                        className: '',
                        html: '<div style="width:24px;height:24px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12],
                      })}
                    />
                  )}

                  {/* Entry markers */}
                  {entries.map((e) => (
                    <Marker
                      key={e.id}
                      position={[e.marker_lat, e.marker_lng]}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="width:14px;height:14px;background:#1863DC;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                      })}
                    />
                  ))}
                </MapContainer>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                Blue = entries. Red = treasure. Click map to set treasure (after clicking "Set Treasure").
              </Typography>
            </Paper>

            {/* Entries table */}
            <Paper sx={{ p: 2.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 15, mb: 1.5, color: 'text.secondary' }}>
                Entries
              </Typography>
              {entries.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>No entries yet</Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        {currentGame.form_fields.map((f) => (
                          <TableCell key={f.name}>{f.label}</TableCell>
                        ))}
                        <TableCell>Location</TableCell>
                        {currentGame.revealed_at && <TableCell>Distance</TableCell>}
                        <TableCell>Submitted</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedEntries.map((e, i) => (
                        <TableRow
                          key={e.id}
                          sx={e.id === currentGame.winner_entry_id ? { bgcolor: '#fef9c3' } : {}}
                        >
                          <TableCell>{i + 1}</TableCell>
                          {currentGame.form_fields.map((f) => (
                            <TableCell key={f.name}>{e.form_data?.[f.name] || ''}</TableCell>
                          ))}
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {e.marker_lat.toFixed(5)}, {e.marker_lng.toFixed(5)}
                          </TableCell>
                          {currentGame.revealed_at && (
                            <TableCell>
                              {e.distance_m != null ? `${e.distance_m.toFixed(1)}m` : '--'}
                            </TableCell>
                          )}
                          <TableCell sx={{ fontSize: 12 }}>
                            {new Date(e.created_at + 'Z').toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Paper>
          </>
        )}

        {/* USERS */}
        {view === 'users' && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Admin Users
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => {
                    setView('list');
                    loadGamesList();
                  }}
                  size="small"
                >
                  Games
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUserModalOpen(true)} size="small">
                  Add User
                </Button>
              </Box>
            </Box>

            {users.length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">No users found</Typography>
              </Paper>
            ) : (
              users.map((u) => (
                <Paper
                  key={u.id}
                  sx={{
                    p: 2.5,
                    mb: 1.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{u.email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                      {u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString() : ''}
                    </Typography>
                    <IconButton size="small" color="error" onClick={() => deleteUser(u.id, u.name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              ))
            )}
          </>
        )}
      </Container>

      {/* GAME MODAL */}
      <Dialog open={gameModalOpen} onClose={() => setGameModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGame ? 'Edit Game' : 'New Game'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Game Code"
            value={gmCode}
            onChange={(e) => setGmCode(e.target.value)}
            placeholder="e.g. brisbane-2026"
            disabled={!!editingGame}
            helperText="Lowercase letters, numbers, hyphens. Used in URL."
            size="small"
            fullWidth
          />
          <TextField
            label="Game Name"
            value={gmName}
            onChange={(e) => setGmName(e.target.value)}
            placeholder="e.g. Brisbane Transport Expo 2026"
            size="small"
            fullWidth
          />
          <TextField
            label="Map Center (lat, lng)"
            value={gmCenter}
            onChange={(e) => setGmCenter(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Map Zoom"
            type="number"
            value={gmZoom}
            onChange={(e) => setGmZoom(parseInt(e.target.value) || 13)}
            slotProps={{ htmlInput: { min: 5, max: 18 } }}
            size="small"
            fullWidth
          />

          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Form Fields</Typography>
          {gmFields.map((f, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                value={f.name}
                onChange={(e) => {
                  const newFields = [...gmFields];
                  newFields[i] = { ...newFields[i], name: e.target.value };
                  setGmFields(newFields);
                }}
                placeholder="Field name"
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                value={f.label}
                onChange={(e) => {
                  const newFields = [...gmFields];
                  newFields[i] = { ...newFields[i], label: e.target.value };
                  setGmFields(newFields);
                }}
                placeholder="Label"
                size="small"
                sx={{ flex: 1 }}
              />
              <Select
                value={f.type}
                onChange={(e) => {
                  const newFields = [...gmFields];
                  newFields[i] = { ...newFields[i], type: e.target.value };
                  setGmFields(newFields);
                }}
                size="small"
                sx={{ minWidth: 90 }}
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="tel">Phone</MenuItem>
                <MenuItem value="number">Number</MenuItem>
              </Select>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={f.required}
                    onChange={(e) => {
                      const newFields = [...gmFields];
                      newFields[i] = { ...newFields[i], required: e.target.checked };
                      setGmFields(newFields);
                    }}
                    size="small"
                  />
                }
                label="Req"
                sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => setGmFields(gmFields.filter((_, j) => j !== i))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() =>
              setGmFields([...gmFields, { name: '', label: '', type: 'text', required: false }])
            }
          >
            Add Field
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGameModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveGame}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* USER MODAL */}
      <Dialog open={userModalOpen} onClose={() => setUserModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Admin User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Full Name"
            value={umName}
            onChange={(e) => setUmName(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={umEmail}
            onChange={(e) => setUmEmail(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={umPassword}
            onChange={(e) => setUmPassword(e.target.value)}
            helperText="Min 6 characters"
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveUser}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* CONFIRM DIALOG */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{confirmMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmTitle.toLowerCase().includes('delete') ? 'error' : 'primary'}
            onClick={() => {
              setConfirmOpen(false);
              confirmAction();
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)}>
        <Alert severity={toast?.severity || 'success'} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
