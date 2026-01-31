/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useEffect, useMemo, useState } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Snackbar, Alert, Container, Typography, ToggleButtonGroup, ToggleButton, Button, Slide, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, CircularProgress, IconButton, Popover } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import TeamBuilder from './components/TeamBuilder'
import SingleJsonUpload, { AccountsPayload } from './components/SingleJsonUpload'
import AccountsAnalyzer from './components/AccountsAnalyzer'
import UnionRaidStats from './components/UnionRaidStats'
import type { Character, AttributeCoefficients } from './types'
import Header from './components/Header'
import SettingsPage from './components/SettingsPage'
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
const AUTH_STORAGE_KEY = 'exia-analysis-auth'
const API_BASE_URL = 'https://exia-backend.tigertan1998.workers.dev'
const SIDEBAR_WIDTH_MD = 400
const SIDEBAR_TOGGLE_SIZE = 44

const App: React.FC = () => {
  const { t, lang, toggleLang } = useI18n()
  const [accounts, setAccounts] = useState<any[]>([])
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined)
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const [currentPage, setCurrentPage] = useState<'analysis' | 'unionRaid' | 'settings'>('analysis')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null)
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
      const authRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
      if (authRaw) {
        const parsedAuth = JSON.parse(authRaw)
        if (parsedAuth?.token && parsedAuth?.username) {
          setAuthToken(parsedAuth.token)
          setAuthUsername(parsedAuth.username)
        }
      }

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!authToken || !authUsername) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token: authToken,
        username: authUsername
      }))
    } catch (error) {
      console.error('Failed to persist auth:', error)
    }
  }, [authToken, authUsername])
  
  // Cloud Sync: Fetch Accounts
  useEffect(() => {
    if (!authToken) return
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/accounts`, {
           headers: { 'Authorization': `Bearer ${authToken}` }
        })
        if (res.ok) {
           const json = await res.json()
           if (json && json.account_data && Array.isArray(json.account_data)) {
               setAccounts(json.account_data)
               setUploadedFileName('云端数据')
           }
        }
      } catch (e) { console.error('Failed to fetch cloud accounts', e) }
    }
    fetchAccounts()
  }, [authToken])

  const handleAccountsLoaded = async (payload: AccountsPayload) => {
    setAccounts(payload.accounts)
    setUploadedFileName(payload.fileName || undefined)
    if (!payload.accounts.length) {
      setTeamChars([])
      setCoeffsMap({})
    }
    
    if (authToken && payload.accounts.length > 0) {
        try {
            await fetch(`${API_BASE_URL}/accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ account_data: payload.accounts })
            })
            handleStatusChange('账号数据已同步至云端', 'success')
        } catch (e) {
            console.error(e)
            handleStatusChange('同步账号数据失败', 'error')
        }
    }
  }

  const collapseSidebar = () => setSidebarCollapsed(true)
  const expandSidebar = () => setSidebarCollapsed(false)
  const collapseLabel = t('layout.collapseSidebar') || '收起侧栏'
  const expandLabel = t('layout.expandSidebar') || '展开侧栏'

  const authTitle = useMemo(() => {
    return authMode === 'login' ? (t('auth.titleLogin') || '登录') : (t('auth.titleRegister') || '注册')
  }, [authMode, t])

  const openLoginDialog = () => {
    setAuthMode('login')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }

  const openRegisterDialog = () => {
    setAuthMode('register')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }

  const closeAuthDialog = () => {
    if (authSubmitting) return
    setAuthDialogOpen(false)
  }

  const handleAuthSubmit = async () => {
    if (!authForm.username.trim() || !authForm.password.trim()) {
      handleStatusChange(t('auth.required') || '请填写用户名和密码', 'warning')
      return
    }
    setAuthSubmitting(true)
    try {
      const endpoint = authMode === 'login' ? '/login' : '/register'
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password
        })
      })

      if (!res.ok) {
        const msg = authMode === 'login' ? (t('auth.failedLogin') || '登录失败') : (t('auth.failedRegister') || '注册失败')
        handleStatusChange(msg, 'error')
        return
      }

      if (authMode === 'register') {
        handleStatusChange(t('auth.successRegister') || '注册成功，请登录', 'success')
        setAuthMode('login')
        setAuthForm(prev => ({ ...prev, password: '' }))
        return
      }

      const data = await res.json()
      if (data?.token) {
        setAuthToken(data.token)
        setAuthUsername(authForm.username.trim())
        setAuthDialogOpen(false)
        handleStatusChange(t('auth.successLogin') || '登录成功', 'success')
      } else {
        handleStatusChange(t('auth.failedLogin') || '登录失败', 'error')
      }
    } catch (error) {
      const msg = authMode === 'login' ? (t('auth.failedLogin') || '登录失败') : (t('auth.failedRegister') || '注册失败')
      handleStatusChange(msg, 'error')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    setAuthToken(null)
    setAuthUsername(null)
    handleStatusChange(t('auth.logoutSuccess') || '已退出', 'success')
  }

  const handleUpdateUser = (newToken: string, newUsername: string) => {
    setAuthToken(newToken)
    setAuthUsername(newUsername)
    sessionStorage.setItem(AUTH_STORAGE_KEY, newToken)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  <Header
    title={t('appTitle')}
    username={authUsername ?? undefined}
    onLoginClick={openLoginDialog}
    onLogoutClick={handleLogout}
    onSettingsClick={() => setCurrentPage('settings')}
  />
        <Container maxWidth={false} disableGutters sx={{ flex: 1, pt: 0, pb: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, position: 'relative' }}>
            {/* Sidebar always visible */}
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
                        authToken={authToken}
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
                overflow: currentPage === 'settings' ? 'auto' : 'hidden',
              }}
            >
              {currentPage === 'settings' ? (
                <Box sx={{ mt: 2, maxWidth: 800, mx: 'auto', width: '100%' }}>
                  <SettingsPage 
                    authToken={authToken} 
                    username={authUsername}
                    onLogout={handleLogout}
                    onUpdateUser={handleUpdateUser}
                    onNotify={handleStatusChange}
                  />
                </Box>
              ) : (
                <>
                  <Box sx={{ display: currentPage === 'analysis' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                    <AccountsAnalyzer accounts={accounts} teamCharacters={teamChars} coefficientsMap={coeffsMap} />
                  </Box>
                  <Box sx={{ display: currentPage === 'unionRaid' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                    <UnionRaidStats 
                      accounts={accounts} 
                      uploadedFileName={uploadedFileName}
                      teamBuilderTeam={teamChars}
                      authToken={authToken}
                      onCopyTeam={(characters) => {
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
                </>
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

        <Dialog open={authDialogOpen} onClose={closeAuthDialog} maxWidth="xs" fullWidth>
          <DialogTitle>{authTitle}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label={t('auth.username') || '用户名'}
              value={authForm.username}
              onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
              fullWidth
              autoFocus
              InputLabelProps={{ sx: { bgcolor: 'background.paper', px: 0.5 } }}
            />
            <TextField
              label={t('auth.password') || '密码'}
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              fullWidth
              InputLabelProps={{ sx: { bgcolor: 'background.paper', px: 0.5 } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            {authMode === 'login' ? (
              <Button onClick={() => setAuthMode('register')} disabled={authSubmitting}>
                {t('auth.switchToRegister') || '去注册'}
              </Button>
            ) : (
              <Button onClick={() => setAuthMode('login')} disabled={authSubmitting}>
                {t('auth.switchToLogin') || '去登录'}
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={closeAuthDialog} disabled={authSubmitting}>
              {t('auth.cancel') || '取消'}
            </Button>
            <Button variant="contained" onClick={handleAuthSubmit} disabled={authSubmitting}>
              {authSubmitting ? <CircularProgress size={18} color="inherit" /> : (authMode === 'login' ? (t('auth.submitLogin') || '登录') : (t('auth.submitRegister') || '注册'))}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}

export default App
