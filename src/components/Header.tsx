/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from 'react'
import { AppBar, Toolbar, Typography, Box, Switch } from '@mui/material'
import { useI18n } from '../i18n'

interface HeaderProps {
  title?: string
}

const Header: React.FC<HeaderProps> = ({ title = 'ExiaAnalysis' }) => {
  const { lang, toggleLang, t } = useI18n()
  return (
    <AppBar position="sticky" color="primary" enableColorOnDark sx={{ top: 0, boxShadow: (t) => t.shadows[4], border: 'none' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 左侧产品 Logo */}
        <Box component="img" src="/icon-128.png" alt="logo" sx={{ width: 32, height: 32, borderRadius: 1 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>{t('appTitle') || title}</Typography>

        {/* 右侧：语言切换开关（左中文，右英文） */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ fontSize: 12, color: 'inherit', opacity: 0.9 }}>中文</Box>
          <Switch
            checked={lang === 'en'}
            onChange={toggleLang}
            color="default"
            inputProps={{ 'aria-label': 'language switch' }}
          />
          <Box sx={{ fontSize: 12, color: 'inherit', opacity: 0.9 }}>EN</Box>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Header
