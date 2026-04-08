import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  CircularProgress,
  Container,
  Snackbar,
  Alert,
  Fade,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../lib/api';
import { launchConfetti } from '../lib/confetti';

// Fix leaflet default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PIN_ICON = new L.Icon({
  iconUrl: '/assets/Transportme UPLIFT LOGO 2025_pin.svg',
  iconSize: [44, 56],
  iconAnchor: [22, 56],
});

interface GameData {
  id: string;
  code: string;
  name: string;
  status: string;
  map_config: { center?: [number, number]; zoom?: number; bounds?: [[number, number], [number, number]] };
  form_fields: FormField[];
  treasure_lat: number | null;
  treasure_lng: number | null;
  revealed_at: string | null;
  winner_entry_id: string | null;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

type Screen = 'loading' | 'error' | 'form' | 'success';

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function PlayPage() {
  const { code } = useParams<{ code: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; severity: 'error' | 'success' } | null>(null);
  const myEntryIdRef = useRef<string | null>(null);

  // Load game
  useEffect(() => {
    if (!code) {
      setErrorMsg('No game code provided.');
      setScreen('error');
      return;
    }

    (async () => {
      try {
        const res = await apiRequest<GameData>('/api/games/' + code);
        if (!res.ok) {
          setErrorMsg((res as unknown as { error?: string }).error || 'Game not found');
          setScreen('error');
          return;
        }

        const gd = res as unknown as GameData;
        setGameData(gd);

        if (gd.status !== 'active') {
          setErrorMsg(
            gd.status === 'draft'
              ? "This game hasn't started yet. Check back soon!"
              : 'This game has ended. Thanks for playing!',
          );
          setScreen('error');
          return;
        }

        setScreen('form');
      } catch {
        setErrorMsg('Failed to load game. Please try again.');
        setScreen('error');
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleMapClick = (lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
  };

  const canSubmit = () => {
    if (!markerPos || !gameData) return false;
    return gameData.form_fields.every(
      (f) => !f.required || formValues[f.name]?.trim(),
    );
  };

  const handleSubmit = async () => {
    if (!gameData || !markerPos || submitting) return;
    setSubmitting(true);

    try {
      const res = await apiRequest('/api/games/' + gameData.code + '/entries', {
        method: 'POST',
        body: JSON.stringify({
          marker_lat: markerPos[0],
          marker_lng: markerPos[1],
          form_data: formValues,
        }),
      });

      if (!res.ok) {
        setToast({ msg: (res as { error?: string }).error || 'Failed to submit', severity: 'error' });
        setSubmitting(false);
        return;
      }

      myEntryIdRef.current = (res as unknown as { id: string }).id;
      localStorage.setItem('th_entry_' + gameData.code, myEntryIdRef.current!);
      setScreen('success');
      launchConfetti();

      // Kiosk mode: show success briefly, then reset for next player
      setTimeout(() => {
        setScreen('form');
        setMarkerPos(null);
        setFormValues({});
        setSubmitting(false);
      }, 5000);
    } catch {
      setToast({ msg: 'Failed to submit. Please try again.', severity: 'error' });
      setSubmitting(false);
    }
  };

  const mapCenter: [number, number] = gameData?.map_config?.center || [-27.4698, 153.0251];
  const mapZoom = gameData?.map_config?.zoom || 13;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0a1628 0%, #0f2847 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Box
            component="img"
            src="/assets/Transportme UPLIFT LOGO 2025_no tag.svg"
            alt="Transportme"
            sx={{ height: 56, mb: 1.5 }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #3aa9e0 0%, #f57e20 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            TREASURE HUNT
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            Drop your pin. Win the prize!
          </Typography>
        </Box>

        {/* LOADING */}
        {screen === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            <CircularProgress sx={{ color: '#3aa9e0' }} />
          </Box>
        )}

        {/* ERROR */}
        {screen === 'error' && (
          <Box sx={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Game Not Found</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{errorMsg}</Typography>
          </Box>
        )}

        {/* ENTRY FORM */}
        {screen === 'form' && gameData && (
          <Fade in>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                  {gameData.name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, mt: 0.5 }}>
                  Where do you think the treasure is hidden?
                </Typography>
              </Box>

              {/* Map */}
              <Box
                sx={{
                  height: 340,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative',
                }}
              >
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <MapClickHandler onMapClick={handleMapClick} />
                  {markerPos && <Marker position={markerPos} icon={PIN_ICON} draggable eventHandlers={{ dragend: (e) => { const m = e.target; setMarkerPos([m.getLatLng().lat, m.getLatLng().lng]); } }} />}
                </MapContainer>
                {!markerPos && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: 'rgba(245, 126, 32, 0.95)',
                      color: '#fff',
                      px: 2,
                      py: 0.75,
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      zIndex: 1000,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      animation: 'hintBounce 2s ease-in-out infinite',
                    }}
                  >
                    Tap the map to drop your pin
                  </Box>
                )}
              </Box>

              {markerPos && (
                <Typography
                  sx={{ textAlign: 'center', color: '#16a34a', fontWeight: 600, fontSize: 13 }}
                >
                  Pin placed! Drag it to adjust position.
                </Typography>
              )}

              {/* Form Fields */}
              {gameData.form_fields.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                    Your Details
                  </Typography>
                  {gameData.form_fields.map((field) =>
                    field.type === 'select' && field.options ? (
                      <Select
                        key={field.name}
                        value={formValues[field.name] || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        displayEmpty
                        fullWidth
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          '.MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.15)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.3)',
                          },
                          '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                        }}
                      >
                        <MenuItem value="" disabled>
                          Select {field.label}
                        </MenuItem>
                        {field.options.map((opt) => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                    ) : (
                      <TextField
                        key={field.name}
                        label={field.label + (field.required ? ' *' : '')}
                        type={field.type || 'text'}
                        value={formValues[field.name] || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        placeholder={field.placeholder || ''}
                        fullWidth
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                            '&.Mui-focused fieldset': { borderColor: '#3aa9e0' },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                          '& .MuiInputLabel-root.Mui-focused': { color: '#3aa9e0' },
                        }}
                      />
                    ),
                  )}
                </Box>
              )}

              {/* Submit */}
              <Button
                variant="contained"
                fullWidth
                disabled={!canSubmit() || submitting}
                onClick={handleSubmit}
                sx={{
                  background: 'linear-gradient(135deg, #f57e20 0%, #e06b10 100%)',
                  py: 1.75,
                  fontSize: 17,
                  fontWeight: 700,
                  borderRadius: '12px',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e06b10 0%, #cc5a00 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(245, 126, 32, 0.4)',
                  },
                  '&:disabled': { opacity: 0.4 },
                }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Lock In My Guess'}
              </Button>
            </Box>
          </Fade>
        )}

        {/* SUCCESS / WAITING */}
        {screen === 'success' && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                bgcolor: 'rgba(22, 163, 74, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'successPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              <CheckIcon sx={{ color: '#16a34a', fontSize: 44 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #3aa9e0 0%, #f57e20 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              You're In!
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, maxWidth: 340 }}>
              Your guess has been locked in!
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, maxWidth: 340 }}>
              We'll contact you via email and text message if you win.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, mt: 1 }}>
              Good luck!
            </Typography>
          </Box>
        )}

        {/* Footer */}
        <Box
          sx={{
            textAlign: 'center',
            py: 2,
            mt: 'auto',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 12,
          }}
        >
          Powered by Transportme
        </Box>
      </Container>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)}>
        <Alert severity={toast?.severity || 'error'} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      <style>{`
        @keyframes hintBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
        @keyframes successPop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
      `}</style>
    </Box>
  );
}
