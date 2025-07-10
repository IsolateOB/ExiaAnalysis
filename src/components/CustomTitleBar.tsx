import React from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
} from '@mui/material'
import {
  Minimize,
  CropSquare,
  Close,
} from '@mui/icons-material'

interface CustomTitleBarProps {
  title: string
}

const CustomTitleBar: React.FC<CustomTitleBarProps> = ({ title }) => {
  const handleMinimize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.minimizeWindow()
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximizeWindow()
    }
  }

  const handleClose = async () => {
    if (window.electronAPI) {
      await window.electronAPI.closeWindow()
    }
  }

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: '#1976d2',
        height: 32,
        minHeight: 32,
        WebkitAppRegion: 'drag', // 允许拖拽窗口
      }}
    >
      <Toolbar
        variant="dense"
        sx={{
          minHeight: 32,
          height: 32,
          paddingLeft: 2,
          paddingRight: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            userSelect: 'none',
          }}
        >
          {title}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            WebkitAppRegion: 'no-drag', // 窗口控制按钮不响应拖拽
          }}
        >
          <IconButton
            size="small"
            onClick={handleMinimize}
            sx={{
              color: 'white',
              width: 32,
              height: 32,
              borderRadius: 0,
              WebkitAppRegion: 'no-drag',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <Minimize fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleMaximize}
            sx={{
              color: 'white',
              width: 32,
              height: 32,
              borderRadius: 0,
              WebkitAppRegion: 'no-drag',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CropSquare fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{
              color: 'white',
              width: 32,
              height: 32,
              borderRadius: 0,
              WebkitAppRegion: 'no-drag',
              '&:hover': {
                backgroundColor: '#e81123',
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default CustomTitleBar
