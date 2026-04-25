import { Box, Button, Card, CardContent, Container, Typography } from '@mui/material'
import { Settings } from 'lucide-react'

export function SetupRequiredPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--color-bg)',
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Settings size={48} color="var(--color-text-muted)" />
        </Box>
        <Card sx={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, mb: 1 }}>
              Setup required
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'var(--color-text-secondary)', mb: 3 }}>
              Add your project details to <code>web/.env.local</code>.
            </Typography>

            <Box
              component="pre"
              sx={{
                p: 2.5,
                borderRadius: 'var(--radius-md)',
                bgcolor: 'var(--color-bg-card-alt)',
                border: '1px solid var(--color-border)',
                overflowX: 'auto',
                mb: 3,
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
              }}
            >
              {`VITE_NHOST_SUBDOMAIN=your-project-subdomain
VITE_NHOST_REGION=your-region (e.g. eu-central-1)`}
            </Box>

            <Typography sx={{ fontSize: 14, color: 'var(--color-text-secondary)', mb: 3 }}>
              Then restart the dev server.
            </Typography>

            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              fullWidth
              sx={{ height: 44 }}
            >
              Reload
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
