import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, CircularProgress, Box } from '@mui/material'

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
          label={t('auth.password') || '密码'}
          type="password"
          value={formValues.password}
          onChange={(e) => onChangeForm({ ...formValues, password: e.target.value })}
          fullWidth
        />
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
