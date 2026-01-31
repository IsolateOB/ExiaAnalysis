/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState } from 'react'
import { AppBar, Toolbar, Typography, Box, Button, Avatar, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import { useI18n } from '../i18n'

interface HeaderProps {
  title?: string
  username?: string
  onLoginClick?: () => void
  onLogoutClick?: () => void
  onSettingsClick?: () => void
}

const AVATAR_URL = 'https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp'

const Header: React.FC<HeaderProps> = ({ title = 'ExiaAnalysis', username, onLoginClick, onLogoutClick, onSettingsClick }) => {
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
        {/* 左侧产品 Logo */}
        <Box component="img" src="/icon-128.png" alt="logo" sx={{ width: 32, height: 32, borderRadius: 1 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>{t('appTitle') || title}</Typography>

        {/* 右侧：登录态显示 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {username ? (
            <>
              <Avatar
                src={AVATAR_URL}
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('auth.greeting') || '出刀吧！'}</Typography>
                  <Typography variant="caption" color="text.secondary">{username}</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleSettings} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                    {t('settings.menu') || '设置'}
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  {t('auth.logout') || '退出'}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="outlined" color="inherit" onClick={onLoginClick}>
              {t('auth.login') || '登录'}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
