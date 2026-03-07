/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState } from 'react'
import { AppBar, Toolbar, Typography, Box, Button, Avatar, Menu, MenuItem, ListItemIcon, Divider, SvgIcon } from '@mui/material'
import type { SvgIconProps } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import { useI18n } from '../hooks/useI18n'

interface HeaderProps {
  title?: string
  username?: string
  avatarUrl?: string | null
  onLoginClick?: () => void
  onLogoutClick?: () => void
  onSettingsClick?: () => void
}

const AVATAR_URL = 'https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp'

const DiscordIcon = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.045-.32 13.579.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.062.077.077 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.223 13.223 0 0 1-1.872-.9.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.29a.074.074 0 0 1 .077-.01c3.927 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.196.372.29a.077.077 0 0 1-.006.128 12.354 12.354 0 0 1-1.873.9.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.88 19.88 0 0 0 6.002-3.062.077.077 0 0 0 .032-.056c.5-5.177-.838-9.673-3.548-13.661a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.184 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
  </SvgIcon>
)

const Header: React.FC<HeaderProps> = ({ title = 'ExiaAnalysis', username, avatarUrl, onLoginClick, onLogoutClick, onSettingsClick }) => {
  const { t } = useI18n()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSettings = () => {
    handleMenuClose()
    onSettingsClick?.()
  }

  const handleLogout = () => {
    handleMenuClose()
    onLogoutClick?.()
  }

  return (
    <AppBar position="sticky" color="primary" enableColorOnDark sx={{ top: 0, boxShadow: (t) => t.shadows[4], border: 'none' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 宸︿晶浜у搧 Logo */}
        <Box component="img" src="/icon-128.png" alt="logo" sx={{ width: 32, height: 32, borderRadius: 1 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>{t('appTitle') || title}</Typography>

        {/* 鍙充晶锛氱櫥褰曟€佹樉绀?*/}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {username ? (
            <>
              <Avatar
                src={avatarUrl || AVATAR_URL}
                alt={username}
                onClick={handleAvatarClick}
                sx={{
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.3)'
                  }
                }}
              />
              <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    elevation: 3,
                    sx: {
                      mt: 1,
                      minWidth: 180,
                      borderRadius: 2,
                      overflow: 'visible',
                      '&::before': {
                        content: '""',
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        right: 14,
                        width: 10,
                        height: 10,
                        bgcolor: 'background.paper',
                        transform: 'translateY(-50%) rotate(45deg)',
                        zIndex: 0,
                      },
                    },
                  }
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('auth.greeting') || 'Welcome'}</Typography>
                  <Typography variant="caption" color="text.secondary">{username}</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleSettings} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                    {t('settings.menu') || 'Settings'}
                </MenuItem>
                <MenuItem onClick={() => window.open('https://discord.gg/fRW7PbYZAB', '_blank')} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <DiscordIcon fontSize="small" />
                  </ListItemIcon>
                  {t('user.feedback') || 'Feedback'}
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  {t('auth.logout') || 'Logout'}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="outlined" color="inherit" onClick={onLoginClick}>
              {t('auth.login') || 'Login'}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header


