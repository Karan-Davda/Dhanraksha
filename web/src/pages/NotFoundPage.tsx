import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
      }}
    >
      <FileQuestion size={48} color="var(--text-muted)" />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 28, mt: 2 }}>
        Page not found
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1, mb: 3 }}>
        The page you're looking for doesn't exist.
      </Typography>
      <Button variant="contained" component={RouterLink} to="/dashboard">
        Go to dashboard
      </Button>
    </Box>
  )
}
