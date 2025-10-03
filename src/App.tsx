/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Snackbar, Alert, Container, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material'
import TeamBuilder from './components/TeamBuilder'
import SingleJsonUpload, { AccountsPayload } from './components/SingleJsonUpload'
import AccountsAnalyzer from './components/AccountsAnalyzer'
import UnionRaidStats from './components/UnionRaidStats'
import type { Character, AttributeCoefficients } from './types'
import Header from './components/Header'
import { useI18n } from './i18n'

// 创建主题
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Microsoft YaHei", "PingFang SC", sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 4 },
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[4],
          border: 'none',
          // 避免被全局 Paper 的 outlined 覆盖
          ['&.MuiPaper-outlined' as any]: {
            border: 'none',
          },
          ['&.MuiPaper-elevation0' as any]: {
            boxShadow: theme.shadows[4],
          },
        }),
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
    },
    MuiButton: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderColor: '#e5e7eb',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
        },
      },
    },
  },
})

const App: React.FC = () => {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<any[]>([])
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const [currentPage, setCurrentPage] = useState<'analysis' | 'unionRaid'>('analysis')
  const [notification, setNotification] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'info'
  })

  const handleStatusChange = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    })
  }

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }))
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  <Header title={t('appTitle')} />
        <Container maxWidth={false} disableGutters sx={{ flex: 1, pt: 0, pb: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
            {/* 左侧固定侧栏 */}
            <Box
              sx={{
                width: { xs: '100%', md: 410 },
                flexShrink: 0,
                alignSelf: 'stretch',
                position: 'sticky',
                top: { xs: 56, sm: 56, md: 64 },
                height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' },
                bgcolor: 'background.paper',
                boxShadow: { md: 3 },
                borderRight: '1px solid #e5e7eb',
                px: 2,
                pb: 2,
                pt: 4,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                // 避免滚动条出现时，左侧内容区域的抖动
                scrollbarGutter: 'stable both-edges',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                {/* 页面切换 */}
                <Box>
                  <ToggleButtonGroup
                    value={currentPage}
                    exclusive
                    onChange={(_, val) => val && setCurrentPage(val)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="analysis">{t('page.analysis')}</ToggleButton>
                    <ToggleButton value="unionRaid">{t('page.unionRaid')}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                
                <SingleJsonUpload onAccountsLoaded={(p: AccountsPayload) => setAccounts(p.accounts)} />
              </Box>
              
              {/* TeamBuilder 占据剩余空间并内部滚动 */}
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexShrink: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('teamBuilder')}</Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <TeamBuilder
                    externalTeam={teamChars}
                    onTeamSelectionChange={(chars, coeffs) => {
                      setTeamChars(chars); setCoeffsMap(coeffs)
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* 右侧内容区域：角色分析面板或联盟突袭统计 */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                px: 2,
                pb: 3,
                pt: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {currentPage === 'analysis' ? (
                <AccountsAnalyzer accounts={accounts} teamCharacters={teamChars} coefficientsMap={coeffsMap} />
              ) : (
                <UnionRaidStats 
                  accounts={accounts} 
                  onCopyTeam={(characters) => {
                    // 将角色数组填充到5个位置
                    const teamArray: (Character | undefined)[] = Array(5).fill(undefined)
                    characters.forEach((char, idx) => {
                      if (idx < 5) teamArray[idx] = char
                    })
                    setTeamChars(teamArray)
                    handleStatusChange(t('unionRaid.teamCopied') || '队伍已复制到构建器', 'success')
                  }}
                />
              )}
            </Box>
          </Box>
        </Container>
        
        {/* 全局通知 */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}

export default App
