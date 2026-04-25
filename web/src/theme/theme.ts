import { createTheme } from '@mui/material'

const fontDisplay = "'Plus Jakarta Sans', system-ui, sans-serif"
const fontMono = "'JetBrains Mono', monospace"

export function buildTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary:    { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB', contrastText: '#fff' },
      secondary:  { main: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED', contrastText: '#fff' },
      success:    { main: '#10B981', light: '#34D399', dark: '#059669', contrastText: '#fff' },
      warning:    { main: '#F59E0B', light: '#FCD34D', dark: '#D97706', contrastText: '#09090B' },
      error:      { main: '#EF4444', light: '#F87171', dark: '#DC2626', contrastText: '#fff' },
      info:       { main: '#60A5FA', contrastText: '#09090B' },
      background: {
        default: '#09090B',
        paper:   '#1C1C1E',
      },
      text: {
        primary:   '#F4F4F5',
        secondary: '#A1A1AA',
        disabled:  '#3F3F46',
      },
      divider: 'rgba(255,255,255,0.06)',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: fontDisplay,
      h1: { fontFamily: fontDisplay, fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1 },
      h2: { fontFamily: fontDisplay, fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em' },
      h3: { fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' },
      h4: { fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' },
      h5: { fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 },
      h6: { fontFamily: fontDisplay, fontSize: 15, fontWeight: 600 },
      body1: { fontFamily: fontDisplay, fontSize: 14, lineHeight: 1.6 },
      body2: { fontFamily: fontDisplay, fontSize: 13, lineHeight: 1.5 },
      caption: { fontFamily: fontDisplay, fontSize: 12, color: '#71717A' },
      button: { fontFamily: fontDisplay, fontWeight: 600, fontSize: 14, textTransform: 'none' },
      overline: { fontFamily: fontMono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: '#09090B',
            color: '#F4F4F5',
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: '#1C1C1E',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)',
            backgroundImage: 'none',
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: 'none',
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '0.01em',
            transition: 'opacity 150ms ease, transform 100ms ease, box-shadow 150ms ease',
            '&:active': { transform: 'scale(0.97)' },
          },
          contained: {
            background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
            '&:hover': {
              background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
              boxShadow: '0 6px 20px rgba(59,130,246,0.45)',
              opacity: 1,
            },
            '&:disabled': {
              background: 'rgba(255,255,255,0.06)',
              color: '#3F3F46',
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: 'rgba(255,255,255,0.10)',
            color: '#F4F4F5',
            backgroundColor: 'rgba(255,255,255,0.03)',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderColor: 'rgba(255,255,255,0.18)',
            },
          },
          text: {
            color: '#60A5FA',
            '&:hover': {
              backgroundColor: 'rgba(59,130,246,0.10)',
            },
          },
        },
      },

      MuiTextField: {
        defaultProps: { size: 'medium' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.03)',
              '& fieldset': {
                borderColor: 'rgba(255,255,255,0.08)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255,255,255,0.16)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#3B82F6',
                borderWidth: '1.5px',
                boxShadow: '0 0 0 3px rgba(59,130,246,0.20)',
              },
              '& input': {
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                color: '#F4F4F5',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#71717A',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: '#60A5FA',
            },
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#161618',
            borderColor: 'rgba(255,255,255,0.06)',
            backgroundImage: 'none',
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(9,9,11,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            margin: '2px 0',
            padding: '8px 12px',
            transition: 'all 140ms ease',
            color: '#A1A1AA',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#F4F4F5',
            },
            '&.Mui-selected': {
              backgroundColor: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: '#60A5FA',
              '&:hover': {
                backgroundColor: 'rgba(59,130,246,0.16)',
              },
              '& .MuiListItemIcon-root': {
                color: '#60A5FA',
              },
              '& .MuiListItemText-primary': {
                color: '#60A5FA',
                fontWeight: 600,
              },
            },
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: 'rgba(255,255,255,0.06)' },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.06)',
          },
          bar: { borderRadius: 999 },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 14,
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            color: '#71717A',
            '&.Mui-selected': { color: '#60A5FA', fontWeight: 600 },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: '#3B82F6',
            height: 2,
            borderRadius: 2,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 500,
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: '#1C1C1E',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            backgroundImage: 'none',
          },
        },
      },

      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 18,
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.03)',
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
            '&.Mui-selected': {
              backgroundColor: 'rgba(59,130,246,0.12)',
              '&:hover': { backgroundColor: 'rgba(59,130,246,0.16)' },
            },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: '#222226',
            border: '1px solid rgba(255,255,255,0.10)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 12,
          },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          track: {
            backgroundColor: 'rgba(255,255,255,0.12)',
          },
          switchBase: {
            '&.Mui-checked + .MuiSwitch-track': {
              backgroundColor: '#3B82F6',
            },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            color: '#71717A',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.07)',
              color: '#F4F4F5',
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: 'rgba(255,255,255,0.06)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          },
          head: {
            color: '#71717A',
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#1C1C1E',
          },
        },
      },

      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: '#1C1C1E',
            border: '1px solid rgba(255,255,255,0.10)',
          },
          option: {
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    },
  })
}
