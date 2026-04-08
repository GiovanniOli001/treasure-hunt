import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Container,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import { apiRequest } from '../lib/api';

interface Game {
  code: string;
  name: string;
  entry_count: number;
}

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Game[]>('/api/games/active');
        setGames(Array.isArray(res) ? res : []);
      } catch {
        setError('Could not load games. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0a1628 0%, #0f2847 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 3 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/assets/Transportme UPLIFT LOGO 2025_no tag.svg"
            alt="Transportme"
            sx={{ height: 36, mb: 1 }}
          />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #3aa9e0 0%, #f57e20 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            TREASURE HUNT
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, mt: 0.5 }}>
            Drop your pin. Win the prize!
          </Typography>
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'center' }}>
            <CircularProgress sx={{ color: '#3aa9e0' }} />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <Box sx={{ animation: 'fadeIn 0.4s ease' }}>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                mb: 2,
              }}
            >
              Active Games
            </Typography>

            {games.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <SentimentDissatisfiedIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }} />
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 18, mb: 0.5 }}>
                  No Active Games
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  Check back soon - a treasure hunt will be starting!
                </Typography>
              </Box>
            ) : (
              games.map((g) => (
                <Paper
                  key={g.code}
                  onClick={() => navigate(`/play/${g.code}`)}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '14px',
                    p: 2.5,
                    mb: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                      borderColor: 'rgba(245, 126, 32, 0.4)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    },
                  }}
                >
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                      {g.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      {g.entry_count === 1 ? '1 player' : `${g.entry_count || 0} players`} entered
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      background: 'linear-gradient(135deg, #f57e20 0%, #e06b10 100%)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ChevronRightIcon sx={{ color: '#fff', fontSize: 20 }} />
                  </Box>
                </Paper>
              ))
            )}
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

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Box>
  );
}
