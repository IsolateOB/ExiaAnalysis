import React, { useState } from 'react'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Snackbar,
  Alert,
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
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* 左侧 - 角色队伍构建 */}
          <Box
            sx={{
              minWidth: '600px', // 增加最小宽度保证显示完整
              width: '60%', // 增加到60%宽度
              height: '100%',
              overflow: 'hidden',
              p: 1,
            }}
          >
            <TeamBuilder 
              baselineData={baselineData}
              targetData={targetData}
              onTeamStrengthChange={handleTeamStrengthChange}
            />
          </Box>

          {/* 右侧 - 伤害计算区域 */}
          <Box
            sx={{
              width: '40%', // 缩减到40%宽度
              minWidth: '250px', // 减少最小宽度给左侧更多空间
              height: '100%',
              overflow: 'hidden',
              p: 1,
            }}
          >
            <DamageCalculator 
              onBaselineDataChange={setBaselineData}
              onTargetDataChange={setTargetData}
              baselineTeamStrength={baselineTeamStrength}
              targetTeamStrength={targetTeamStrength}
              onStatusChange={handleStatusChange}
            />
          </Box>
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
