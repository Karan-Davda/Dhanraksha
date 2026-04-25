import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import {
  BarChart3,
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PiggyBank,
  Search,
  Settings,
  Tags,
  BookOpen,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { useNhost } from '../../nhost/useNhost'
import { nhostGraphql } from '../../api/nhostGraphql'
import { Queries } from '../../api/queries'
import { formatCurrency } from '../../utils/format'

const DRAWER_WIDTH = 228

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ledger': 'Ledger',
  '/savings': 'Savings',
  '/categories': 'Categories',
  '/budgets': 'Budgets',
  '/notifications': 'Notifications',
  '/calendar': 'Calendar',
  '/search': 'Search',
  '/settings': 'Settings',
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { nhost, session } = useNhost()
  const isDesktop = useMediaQuery('(min-width: 900px)')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [avatarAnchor, setAvatarAnchor] = useState<null | HTMLElement>(null)

  const userEmail = session?.user?.email ?? ''
  const userInitial = (userEmail[0] ?? 'U').toUpperCase()
  const pageTitle = PAGE_TITLES[location.pathname] ?? ''

  const navMain = useMemo(() => [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { to: '/ledger',    label: 'Ledger',    icon: <BookOpen size={16} /> },
  ], [])

  const navSecondary = useMemo(() => [
    { to: '/savings', label: 'Savings', icon: <PiggyBank size={16} /> },
  ], [])

  const navTertiary = useMemo(() => [
    { to: '/categories', label: 'Categories', icon: <Tags size={16} /> },
    { to: '/budgets',    label: 'Budgets',    icon: <BarChart3 size={16} /> },
  ], [])

  const unreadQuery = useQuery({
    queryKey: ['unread_notifications_nav', nhost ? 'configured' : 'not_configured'],
    enabled: Boolean(nhost),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!nhost) return 0
      const uid = nhost.getUserSession()?.user?.id
      if (!uid) return 0
      const data = await nhostGraphql<{ notifications_aggregate: { aggregate: { count: number } | null } }, { userId: string }>(
        nhost, Queries.unreadNotificationsCount, { userId: uid },
      )
      return data.notifications_aggregate.aggregate?.count ?? 0
    },
  })

  const balancesQuery = useQuery({
    queryKey: ['sidebar_balances', nhost ? 'configured' : 'not_configured'],
    enabled: Boolean(nhost),
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!nhost) return null
      const uid = nhost.getUserSession()?.user?.id
      if (!uid) return null
      const data = await nhostGraphql<{
        user_balances_by_pk: { cash_balance: number; online_balance: number; savings_balance: number; base_currency: string } | null
      }, { userId: string }>(nhost, Queries.userBalances, { userId: uid })
      return data.user_balances_by_pk
    },
  })

  const netWorth = balancesQuery.data
    ? Number(balancesQuery.data.cash_balance) + Number(balancesQuery.data.online_balance) + Number(balancesQuery.data.savings_balance)
    : 0
  const baseCurrency = balancesQuery.data?.base_currency ?? 'USD'
  const isPositive = netWorth >= 0

  async function handleLogout() {
    try {
      if (nhost) await nhost.auth.signOut({ refreshToken: session?.refreshTokenId })
    } catch { /* ignore */ } finally {
      try { nhost?.clearSession() } catch { /* ignore */ }
      navigate('/auth/login', { replace: true })
    }
  }

  const renderNavItem = (item: { to: string; label: string; icon: React.ReactNode }) => {
    const active = location.pathname === item.to
    return (
      <ListItemButton
        key={item.to}
        component={NavLink}
        to={item.to}
        selected={active}
        onClick={() => setMobileOpen(false)}
        sx={{
          height: 38,
          px: 1.5,
          mx: '8px',
          borderRadius: '10px',
          border: active ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
          bgcolor: active ? 'rgba(59,130,246,0.10)' : 'transparent',
          transition: 'all 140ms ease',
          '&:hover': {
            bgcolor: active ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)',
            border: active ? '1px solid rgba(59,130,246,0.30)' : '1px solid transparent',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: active ? '#60A5FA' : '#71717A' }}>
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 13.5,
            fontWeight: active ? 600 : 400,
            color: active ? '#60A5FA' : '#A1A1AA',
          }}
        />
      </ListItemButton>
    )
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar ambient glow */}
      <Box sx={{
        position: 'absolute',
        top: -60,
        left: -40,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Logo */}
      <Box sx={{ height: 60, display: 'flex', alignItems: 'center', px: '20px', gap: 1.5, flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 30,
          height: 30,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 15,
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
        }}>
          D
        </Box>
        <Typography sx={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 14.5,
          fontWeight: 700,
          color: '#F4F4F5',
          letterSpacing: '-0.01em',
        }}>
          Dhanraksha
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: 0.5, position: 'relative', zIndex: 1 }}>
        <Box sx={{ px: '12px', mb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#3F3F46', textTransform: 'uppercase', px: 1.5, py: 0.5 }}>
            Overview
          </Typography>
        </Box>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navMain.map(renderNavItem)}
        </List>

        <Box sx={{ px: '12px', mt: 2, mb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#3F3F46', textTransform: 'uppercase', px: 1.5, py: 0.5 }}>
            Money
          </Typography>
        </Box>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navSecondary.map(renderNavItem)}
        </List>

        <Box sx={{ px: '12px', mt: 2, mb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#3F3F46', textTransform: 'uppercase', px: 1.5, py: 0.5 }}>
            Planning
          </Typography>
        </Box>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navTertiary.map(renderNavItem)}
        </List>
      </Box>

      {/* Settings link */}
      <Box sx={{ px: '8px', pb: 1, position: 'relative', zIndex: 1 }}>
        {renderNavItem({ to: '/settings', label: 'Settings', icon: <Settings size={16} /> })}
      </Box>

      {/* Net Worth widget */}
      <Box sx={{
        mx: '12px',
        mb: '16px',
        p: '14px 16px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
      }}>
        {/* Card glow */}
        <Box sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${isPositive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <Typography sx={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#52525B',
          mb: 0.75,
        }}>
          Net Worth
        </Typography>
        <Typography sx={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 17,
          fontWeight: 600,
          color: isPositive ? '#10B981' : '#EF4444',
          letterSpacing: '-0.02em',
        }}>
          {balancesQuery.isLoading ? '—' : formatCurrency(netWorth, baseCurrency)}
        </Typography>
        <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#52525B', mt: 0.25 }}>
          {baseCurrency} • all accounts
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#09090B', position: 'relative' }}>
      {/* Fixed atmospheric background */}
      <Box sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-20%',
          right: '-5%',
          width: '50%',
          height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, transparent 65%)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-10%',
          left: '10%',
          width: '45%',
          height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 65%)',
        },
      }} />

      {/* App Bar */}
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ height: 52, minHeight: '52px !important', px: '24px !important' }}>
          {!isDesktop && (
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Open navigation" sx={{ mr: 1, color: '#71717A' }}>
              <MenuIcon size={18} />
            </IconButton>
          )}

          <Typography sx={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: '#F4F4F5',
            letterSpacing: '-0.01em',
          }}>
            {pageTitle}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Search & Calendar */}
          {[
            { icon: <Search size={16} />, label: 'Search',   action: () => navigate('/search') },
            { icon: <CalendarDays size={16} />, label: 'Calendar', action: () => navigate('/calendar') },
          ].map((btn) => (
            <IconButton
              key={btn.label}
              onClick={btn.action}
              aria-label={btn.label}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '9px',
                color: '#71717A',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#F4F4F5' },
              }}
            >
              {btn.icon}
            </IconButton>
          ))}

          {/* Bell with unread dot */}
          <IconButton
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              color: '#71717A',
              position: 'relative',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#F4F4F5' },
            }}
          >
            <Bell size={16} />
            {(unreadQuery.data ?? 0) > 0 && (
              <Box sx={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#EF4444',
                boxShadow: '0 0 6px rgba(239,68,68,0.7)',
              }} />
            )}
          </IconButton>

          {/* Avatar menu */}
          <IconButton
            onClick={(e) => setAvatarAnchor(e.currentTarget)}
            aria-label="User menu"
            sx={{ ml: 0.5 }}
          >
            <Avatar sx={{
              width: 28,
              height: 28,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
            }}>
              {userInitial}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={avatarAnchor}
            open={Boolean(avatarAnchor)}
            onClose={() => setAvatarAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: {
                  minWidth: 192,
                  mt: 1,
                  p: '4px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  bgcolor: '#1C1C1E',
                  backgroundImage: 'none',
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)', mb: 0.5 }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A', lineHeight: 1.3 }}>
                Signed in as
              </Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: '#A1A1AA', mt: 0.25 }}>
                {userEmail}
              </Typography>
            </Box>
            <MenuItem
              onClick={() => { setAvatarAnchor(null); navigate('/settings') }}
              sx={{ height: 36, px: 1.5, borderRadius: '8px', fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", gap: 1, color: '#D4D4D8' }}
            >
              <Settings size={14} />
              Settings
            </MenuItem>
            <Divider sx={{ my: '4px', borderColor: 'rgba(255,255,255,0.06)' }} />
            <MenuItem
              onClick={() => { setAvatarAnchor(null); handleLogout() }}
              sx={{ height: 36, px: 1.5, borderRadius: '8px', fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#EF4444', gap: 1 }}
            >
              <LogOut size={14} />
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            zIndex: 1,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              bgcolor: '#161618',
              backgroundImage: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: '#161618',
              backgroundImage: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          maxWidth: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Toolbar sx={{ height: 52, minHeight: '52px !important' }} />
        <Box className="page-enter">
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
