import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { apiRequest, setToken, getToken } from '../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  if (getToken()) {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError((res as { error?: string }).error || 'Login failed');
        setLoading(false);
        return;
      }

      setToken((res as unknown as { token: string }).token);
      navigate('/admin', { replace: true });
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: 'linear-gradient(160deg, #0a1628 0%, #0f2847 50%, #122d52 100%)',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <Paper
          elevation={8}
          sx={{
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Brand header */}
          <Box
            sx={{
              bgcolor: '#0a1628',
              p: 4,
              pb: 3.5,
              textAlign: 'center',
              borderBottom: '3px solid #f57e20',
            }}
          >
            <Box
              component="img"
              src="/assets/Transportme UPLIFT LOGO 2025_no tag.svg"
              alt="Transportme"
              sx={{ height: 64, mb: 2 }}
            />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              Treasure Hunt
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, mt: 0.5 }}>
              Administration Portal
            </Typography>
          </Box>

          {/* Form */}
          <Box sx={{ p: 4 }}>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  fullWidth
                  size="small"
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    fontSize: 15,
                    fontWeight: 600,
                    mt: 0.5,
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
                </Button>
              </Box>
            </form>
          </Box>
        </Paper>

        <Typography sx={{ textAlign: 'center', mt: 3, color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          Powered by Transportme
        </Typography>
      </Box>
    </Box>
  );
}
