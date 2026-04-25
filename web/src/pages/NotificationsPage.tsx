import { useMutation, useQuery } from '@tanstack/react-query'
import { Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material'
import toast from 'react-hot-toast'
import { AlertTriangle, Bell, CheckCircle, Info } from 'lucide-react'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { useNhost } from '../nhost/useNhost'
import type { Notification } from '../types/domain'
import { formatDate } from '../utils/format'

const kindIcons: Record<string, React.ReactNode> = {
  budget: <AlertTriangle size={18} />,
  recurring: <Info size={18} />,
  system: <CheckCircle size={18} />,
}

const severityColors: Record<string, string> = {
  warning: '#F59E0B',
  error: 'var(--color-expense)',
  info: 'var(--color-savings)',
}

export function NotificationsPage() {
  const { nhost, userId } = useNhost()

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ notifications: Notification[] }, { userId: string; limit: number; offset: number }>(
        nhost,
        Queries.notifications,
        { userId, limit: 200, offset: 0 },
      )
      return data.notifications
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.markNotificationRead, { id })
    },
    onSuccess: async () => {
      await notificationsQuery.refetch()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to mark read.'),
  })

  const markAllMutation = useMutation({
    mutationFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      await nhostGraphql(nhost, Queries.markAllNotificationsRead, { userId })
    },
    onSuccess: async () => {
      await notificationsQuery.refetch()
      toast.success('All marked as read.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to mark all read.'),
  })

  const items = notificationsQuery.data ?? []
  const unread = items.filter((n) => !n.is_read).length

  return (
    <Box className="page-enter">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, mb: 3 }}>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 22, flex: 1 }}>
          Notifications
        </Typography>
        <Button
          variant="outlined"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || items.length === 0}
          size="small"
        >
          Mark all read
        </Button>
      </Stack>

      {unread > 0 && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            mb: 2,
            borderRadius: 'var(--radius-lg)',
            bgcolor: 'var(--color-savings-bg)',
            border: '1px solid rgba(37,99,235,0.3)',
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--color-savings)' }}>
            {unread} unread notification{unread !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {notificationsQuery.isLoading ? (
            <Box sx={{ p: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>Loading...</Typography>
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Bell size={40} color="var(--color-text-muted)" />
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 18, mt: 2 }}>
                All clear!
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                We'll notify you when your budget needs attention
              </Typography>
            </Box>
          ) : (
            <Box>
              {items.map((n, idx) => {
                const accentColor = severityColors[n.severity] ?? 'var(--color-savings)'
                return (
                  <Box key={n.id}>
                    {idx > 0 && <Divider />}
                    <Box
                      sx={{
                        px: 2.5,
                        py: 2,
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                        bgcolor: n.is_read ? 'transparent' : 'var(--color-savings-bg)',
                        borderLeft: n.is_read ? 'none' : `3px solid var(--color-savings)`,
                        transition: 'background-color 150ms',
                        '&:hover': {
                          bgcolor: 'var(--color-bg-card-alt)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          bgcolor: `${accentColor}15`,
                          color: accentColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        {kindIcons[n.kind] ?? <Info size={18} />}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{n.title}</Typography>
                        {n.message && (
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: 'text.secondary',
                              mt: 0.25,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {n.message}
                          </Typography>
                        )}
                        <Typography sx={{ fontSize: 12, color: 'text.muted', mt: 0.5 }}>
                          {formatDate(n.created_at, 'relative')}
                        </Typography>
                      </Box>

                      {!n.is_read && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => markReadMutation.mutate(n.id)}
                          disabled={markReadMutation.isPending}
                          sx={{ fontSize: 12, flexShrink: 0 }}
                        >
                          Mark read
                        </Button>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
