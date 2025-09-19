import React from 'react'
import { AppBar, Toolbar, Typography, Box } from '@mui/material'

interface HeaderProps {
  title?: string
}

// 参考 ExiaInvasion 管理页：顶部 AppBar + Toolbar，左侧预留图标位，右侧可扩展操作位
const Header: React.FC<HeaderProps> = ({ title = 'ExiaAnalysis' }) => {
  return (
    <AppBar position="sticky" color="primary" enableColorOnDark sx={{ top: 0, boxShadow: (t) => t.shadows[4], border: 'none' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* 左侧产品 Logo */}
        <Box component="img" src={`${import.meta.env.BASE_URL}icon-128.png`} alt="logo" sx={{ width: 32, height: 32, borderRadius: 1 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>{title}</Typography>
        {/* 右侧操作预留位，可后续加按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} />
      </Toolbar>
    </AppBar>
  )
}

export default Header
