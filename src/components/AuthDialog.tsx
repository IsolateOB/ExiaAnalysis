import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, CircularProgress, Box, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface AuthDialogProps {
  open: boolean
  mode: 'login' | 'register'
  title: string
  formValues: { username: string; password: string }
  isSubmitting: boolean
  onClose: () => void
  onChangeMode: (newMode: 'login' | 'register') => void
  onChangeForm: (values: { username: string; password: string }) => void
  onSubmit: () => void
  t: (key: string) => string
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  open,
  mode,
  title,
  formValues,
  isSubmitting,
  onClose,
  onChangeMode,
  onChangeForm,
  onSubmit,
  t
}) => {
  const passwordLabel = mode === 'login'
    ? (t('auth.passwordOptional') || '密码 (选填，不填进入受限模式)')
    : (t('auth.password') || '密码')

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3, overflow: 'visible' }}>
        <TextField
          label={t('auth.username') || '用户名'}
          value={formValues.username}
          onChange={(e) => onChangeForm({ ...formValues, username: e.target.value })}
          fullWidth
          autoFocus
        />
        <TextField
          label={passwordLabel}
          type="password"
          value={formValues.password}
          onChange={(e) => onChangeForm({ ...formValues, password: e.target.value })}
          fullWidth
          required={mode === 'register'}
        />
        {mode === 'login' && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: -0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'info.main', mt: '2px', flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {t('auth.restrictedModeHint') || '不填写密码将以受限模式登录，部分功能（如修改密码、上传数据等）不可用。'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {mode === 'login' ? (
          <Button onClick={() => onChangeMode('register')} disabled={isSubmitting}>
            {t('auth.switchToRegister') || '去注册'}
          </Button>
        ) : (
          <Button onClick={() => onChangeMode('login')} disabled={isSubmitting}>
            {t('auth.switchToLogin') || '去登录'}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={isSubmitting}>
          {t('auth.cancel') || '取消'}
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <CircularProgress size={18} color="inherit" />
          ) : mode === 'login' ? (
            t('auth.submitLogin') || '登录'
          ) : (
            t('auth.submitRegister') || '注册'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
