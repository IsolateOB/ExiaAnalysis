import React, { useState } from 'react'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Snackbar,
  Alert,
  Grid,
  Paper,
  Typography,
} from '@mui/material'
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
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
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
              <Paper sx={{ height: '100%', p: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>队伍构建</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <TeamBuilder 
                    baselineData={baselineData}
                    targetData={targetData}
                    onTeamStrengthChange={handleTeamStrengthChange}
                    baselineScore={baselineScore}
                    targetScore={targetScore}
                  />
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }} sx={{ height: { xs: 'auto', md: '100%' } }}>
              <Paper sx={{ height: '100%', p: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>伤害计算</Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <DamageCalculator 
                    onBaselineDataChange={setBaselineData}
                    onTargetDataChange={setTargetData}
                    baselineTeamStrength={baselineTeamStrength}
                    targetTeamStrength={targetTeamStrength}
                    onBaselineScoreChange={setBaselineScore}
                    onTargetScoreChange={setTargetScore}
                    onStatusChange={handleStatusChange}
                  />
                </Box>
              </Paper>
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
