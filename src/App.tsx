import React, { useState } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Snackbar, Alert, Container, Typography } from '@mui/material'
import TeamBuilder from './components/TeamBuilder'
import SingleJsonUpload, { AccountsPayload } from './components/SingleJsonUpload'
import AccountsAnalyzer from './components/AccountsAnalyzer'
import type { Character, AttributeCoefficients } from './types'
import Header from './components/Header'

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
  const [accounts, setAccounts] = useState<any[]>([])
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
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
  <Header title="ExiaAnalysis" />
        <Container maxWidth={false} disableGutters sx={{ flex: 1, pt: 0, pb: 0 }}>
          <Box sx={{ display: 'flex', gap: 0, height: '100%' }}>
            {/* 左侧固定侧栏 */}
            <Box
              sx={{
                width: { xs: '100%', md: 380 },
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
                overflowY: 'auto',
                // 预留滚动条占位，避免内容被滚动条压住
                scrollbarGutter: 'stable both-edges',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SingleJsonUpload onAccountsLoaded={(p: AccountsPayload) => setAccounts(p.accounts)} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>队伍构建</Typography>
                  <TeamBuilder
                    onTeamSelectionChange={(chars, coeffs) => {
                      setTeamChars(chars); setCoeffsMap(coeffs)
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* 右侧主内容：账号分析占满剩余空间 */}
            <Box sx={{ flex: 1, minWidth: 0, px: 2, pb: 3, pt: 2, height: '100%' }}>
              <AccountsAnalyzer accounts={accounts} teamCharacters={teamChars} coefficientsMap={coeffsMap} />
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
