/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useEffect, useState } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Snackbar, Alert, Container, Typography, ToggleButtonGroup, ToggleButton, Button, Slide } from '@mui/material'
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
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

const ACCOUNTS_STORAGE_KEY = 'exia-analysis-accounts'
const SIDEBAR_WIDTH_MD = 400
const SIDEBAR_TOGGLE_SIZE = 44

const App: React.FC = () => {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<any[]>([])
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined)
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const [currentPage, setCurrentPage] = useState<'analysis' | 'unionRaid'>('analysis')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.accounts)) return
      setAccounts(parsed.accounts)
      if (typeof parsed.fileName === 'string') {
        setUploadedFileName(parsed.fileName)
      }
    } catch (error) {
      console.error('Failed to load accounts from storage:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!accounts || accounts.length === 0) {
      window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY)
      return
    }
    try {
      window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify({
        accounts,
        fileName: uploadedFileName ?? null
      }))
    } catch (error) {
      console.error('Failed to persist accounts:', error)
    }
  }, [accounts, uploadedFileName])

  const handleAccountsLoaded = (payload: AccountsPayload) => {
    setAccounts(payload.accounts)
    setUploadedFileName(payload.fileName || undefined)
    if (!payload.accounts.length) {
      setTeamChars([])
      setCoeffsMap({})
    }
  }

  const collapseSidebar = () => setSidebarCollapsed(true)
  const expandSidebar = () => setSidebarCollapsed(false)
  const collapseLabel = t('layout.collapseSidebar') || '收起侧栏'
  const expandLabel = t('layout.expandSidebar') || '展开侧栏'

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  <Header title={t('appTitle')} />
        <Container maxWidth={false} disableGutters sx={{ flex: 1, pt: 0, pb: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, position: 'relative' }}>
            <Box
              sx={{
                position: 'relative',
                flexShrink: 0,
                width: { xs: sidebarCollapsed ? 0 : '100%', md: sidebarCollapsed ? 0 : SIDEBAR_WIDTH_MD },
                minWidth: { md: sidebarCollapsed ? 0 : SIDEBAR_WIDTH_MD },
                transition: { md: 'width 0.3s ease' },
                overflow: 'visible'
              }}
            >
              <Slide direction="right" in={!sidebarCollapsed} mountOnEnter unmountOnExit timeout={300}>
                <Box
                  sx={{
                    width: { xs: '100%', md: SIDEBAR_WIDTH_MD },
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
                    pt: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                    scrollbarGutter: 'stable both-edges',
                    zIndex: 5
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={collapseSidebar}
                    aria-label={collapseLabel}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      right: -SIDEBAR_TOGGLE_SIZE / 2,
                      width: SIDEBAR_TOGGLE_SIZE,
                      height: SIDEBAR_TOGGLE_SIZE,
                      transform: 'translateY(-50%)',
                      border: 'none',
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      borderRadius: '50%',
                      boxShadow: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    }}
                  >
                    <KeyboardDoubleArrowLeftIcon fontSize="small" />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
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

                    <SingleJsonUpload
                      onAccountsLoaded={handleAccountsLoaded}
                      persistedFileName={uploadedFileName}
                    />
                  </Box>

                  <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mt: 2 }}>
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
              </Slide>
            </Box>

            {sidebarCollapsed && (
              <Box
                component="button"
                type="button"
                onClick={expandSidebar}
                aria-label={expandLabel}
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  width: SIDEBAR_TOGGLE_SIZE,
                  height: SIDEBAR_TOGGLE_SIZE,
                  transform: 'translate(-50%, -50%)',
                  border: 'none',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: '50%',
                  boxShadow: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 6,
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                }}
              >
                <KeyboardDoubleArrowRightIcon fontSize="small" />
              </Box>
            )}

            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                px: { xs: 1.5, md: 2 },
                pb: 3,
                pt: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* 始终渲染两个组件，通过 display 控制显示 */}
              <Box sx={{ display: currentPage === 'analysis' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                <AccountsAnalyzer accounts={accounts} teamCharacters={teamChars} coefficientsMap={coeffsMap} />
              </Box>
              <Box sx={{ display: currentPage === 'unionRaid' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                <UnionRaidStats 
                  accounts={accounts} 
                  uploadedFileName={uploadedFileName}
                  teamBuilderTeam={teamChars}
                  onCopyTeam={(characters) => {
                    // 将角色数组填充到5个位置
                    const teamArray: (Character | undefined)[] = Array(5).fill(undefined)
                    characters.forEach((char, idx) => {
                      if (idx < 5) teamArray[idx] = char
                    })
                    setTeamChars(teamArray)
                    handleStatusChange(t('unionRaid.teamCopied') || '队伍已复制到构建器', 'success')
                  }}
                  onNotify={handleStatusChange}
                />
              </Box>
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
