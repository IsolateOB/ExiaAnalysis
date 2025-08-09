import React, { useState } from 'react'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Snackbar,
  Alert,
  Paper,
  Typography,
} from '@mui/material'
import { Grid } from '@mui/material'
import CustomTitleBar from './components/CustomTitleBar'
import TeamBuilder from './components/TeamBuilder'
import DamageCalculator from './components/DamageCalculator'

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
  const [baselineData, setBaselineData] = useState<any>(null)
  const [targetData, setTargetData] = useState<any>(null)
  const [baselineTeamStrength, setBaselineTeamStrength] = useState<number>(0)
  const [targetTeamStrength, setTargetTeamStrength] = useState<number>(0)
  const [teamScale, setTeamScale] = useState<number>(1)
  const [ratioLabel, setRatioLabel] = useState<string>('—')
  const [baselineScore, setBaselineScore] = useState<Record<string, number>>({})
  const [targetScore, setTargetScore] = useState<Record<string, number>>({})
  const [notification, setNotification] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'info'
  })

  const handleTeamStrengthChange = (baselineStrength: number, targetStrength: number) => {
    setBaselineTeamStrength(baselineStrength)
    setTargetTeamStrength(targetStrength)
  }
  const handleTeamRatioChange = (scale: number, label: string) => {
    setTeamScale(scale)
    setRatioLabel(label)
  }

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
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 自定义标题栏 */}
        <CustomTitleBar title="Nikke 伤害估算器" />

        {/* 主内容区域 */}
        <Box sx={{ flex: 1, overflow: 'hidden', p: 1 }}>
          <Grid container spacing={1} sx={{ height: '100%' }}>
            <Grid size={{ xs: 12, md: 7 }} sx={{ height: { xs: 'auto', md: '100%' } }}>
              <Box sx={{ height: '100%', p: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 560 }}>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <TeamBuilder 
                    baselineData={baselineData}
                    targetData={targetData}
                    onTeamStrengthChange={handleTeamStrengthChange}
                    baselineScore={baselineScore}
                    targetScore={targetScore}
                    onTeamRatioChange={handleTeamRatioChange}
                  />
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }} sx={{ height: { xs: 'auto', md: '100%' } }}>
              <Box sx={{ height: '100%', p: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <DamageCalculator 
                    onBaselineDataChange={setBaselineData}
                    onTargetDataChange={setTargetData}
                    baselineTeamStrength={baselineTeamStrength}
                    targetTeamStrength={targetTeamStrength}
                    teamScale={teamScale}
                    ratioLabel={ratioLabel}
                    onBaselineScoreChange={setBaselineScore}
                    onTargetScoreChange={setTargetScore}
                    onStatusChange={handleStatusChange}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
        
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
