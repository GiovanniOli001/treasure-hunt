import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1863DC',
      dark: '#1453b8',
      light: '#e8f0fd',
    },
    secondary: {
      main: '#f57e20',
      dark: '#e06b10',
    },
    success: {
      main: '#16a34a',
    },
    error: {
      main: '#dc2626',
    },
    background: {
      default: '#0a1628',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
