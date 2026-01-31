/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import { useI18n } from '../i18n'

const API_BASE_URL = 'https://exia-backend.tigertan1998.workers.dev'

interface SettingsPageProps {
  authToken: string | null
  username: string | null
  onLogout: () => void
  onUpdateUser: (newToken: string, newUsername: string) => void
  onNotify: (msg: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({ authToken, username, onLogout, onUpdateUser, onNotify }) => {
  const { t, lang, toggleLang } = useI18n()

  // 修改用户名状态
  const [newUsername, setNewUsername] = useState(username || '')
  const [usernameLoading, setUsernameLoading] = useState(false)

  // 修改密码状态
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)

  // 删除账号对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleUpdateUsername = async () => {
    if (!authToken) return
    if (!newUsername || newUsername.length < 3) {
        onNotify(t('settings.usernameTooShort') || '用户名至少需要3个字符', 'warning')
        return
    }
    setUsernameLoading(true)
    try {
        const res = await fetch(`${API_BASE_URL}/change-username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ new_username: newUsername })
        })
        const data = await res.json()
        if (!res.ok) {
            onNotify(data.error || (t('settings.changeUsernameFailed') || '修改用户名失败'), 'error')
        } else {
            onNotify(t('settings.changeUsernameSuccess') || '用户名修改成功', 'success')
            onUpdateUser(data.token, data.username)
        }
    } catch (error) {
        onNotify(t('settings.changeUsernameFailed') || '修改用户名失败', 'error')
    } finally {
        setUsernameLoading(false)
    }
  }

  const handlePwdChange = (key: 'current' | 'new' | 'confirm', val: string) => {
    setPwdForm(prev => ({ ...prev, [key]: val }))
  }

  const submitChangePassword = async () => {
    if (!authToken) {
      onNotify(t('auth.required') || '请先登录', 'error')
      return
    }
    if (!pwdForm.current || !pwdForm.new) {
      onNotify(t('settings.pwdRequired') || '请填写当前密码和新密码', 'warning')
      return
    }
    if (pwdForm.new !== pwdForm.confirm) {
      onNotify(t('settings.pwdMismatch') || '两次新密码输入不一致', 'error')
      return
    }
    if (pwdForm.new.length < 6) {
      onNotify(t('settings.pwdTooShort') || '新密码长度不能少于6位', 'warning')
      return
    }

    setPwdLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          current_password: pwdForm.current,
          new_password: pwdForm.new
        })
      })

      const data = await res.json()
      if (!res.ok) {
        onNotify(data.error || (t('settings.changePwdFailed') || '修改密码失败'), 'error')
      } else {
        onNotify(t('settings.changePwdSuccess') || '密码修改成功', 'success')
        setPwdForm({ current: '', new: '', confirm: '' })
      }
    } catch (error) {
      onNotify(t('settings.changePwdFailed') || '修改密码失败', 'error')
    } finally {
      setPwdLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!authToken) return
    setDeleteLoading(true)
    try {
        const res = await fetch(`${API_BASE_URL}/account`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        const data = await res.json()
        if (!res.ok) {
            onNotify(data.error || (t('settings.deleteAccountFailed') || '注销账号失败'), 'error')
        } else {
            onNotify(t('settings.deleteAccountSuccess') || '账号已注销', 'success')
            setDeleteDialogOpen(false)
            onLogout()
        }
    } catch (error) {
        onNotify(t('settings.deleteAccountFailed') || '注销账号失败', 'error')
    } finally {
        setDeleteLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>{t('settings.title') || '设置'}</Typography>

      {/* 语言设置 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{t('settings.language') || '语言'}</Typography>
        <ToggleButtonGroup
            value={lang}
            exclusive
            onChange={(_, newLang) => {
                if (newLang && newLang !== lang) toggleLang()
            }}
            aria-label="language"
            size="medium"
        >
            <ToggleButton value="zh" sx={{ px: 3 }}>
                中文
            </ToggleButton>
            <ToggleButton value="en" sx={{ px: 3 }}>
                English
            </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* 账号安全区域，仅登录后可见 */}
      {authToken ? (
        <>
            {/* 个人资料 (用户名) */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{t('settings.profile') || '个人资料'}</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: 'column', maxWidth: 400 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%' }}>
                        <TextField
                            label={t('settings.username') || '用户名'}
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            fullWidth
                            helperText={t('settings.usernameHelp') || '修改用户名会导致重新登录（或刷新 Token）'}
                        />
                        <Button
                            variant="contained"
                            onClick={handleUpdateUsername}
                            disabled={usernameLoading || newUsername === (username || '')}
                            sx={{ mt: -2.5 }} // align with input
                        >
                            {usernameLoading ? <CircularProgress size={24} /> : (t('common.save') || '保存')}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* 修改密码 */}
            <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('settings.security') || '账号安全'}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <TextField
                label={t('settings.currentPwd') || '当前密码'}
                type="password"
                value={pwdForm.current}
                onChange={(e) => handlePwdChange('current', e.target.value)}
                disabled={pwdLoading}
                />
                <TextField
                label={t('settings.newPwd') || '新密码'}
                type="password"
                value={pwdForm.new}
                onChange={(e) => handlePwdChange('new', e.target.value)}
                disabled={pwdLoading}
                />
                <TextField
                label={t('settings.confirmPwd') || '确认新密码'}
                type="password"
                value={pwdForm.confirm}
                onChange={(e) => handlePwdChange('confirm', e.target.value)}
                disabled={pwdLoading}
                />
                <Button 
                    variant="contained" 
                    onClick={submitChangePassword} 
                    disabled={pwdLoading}
                    sx={{ alignSelf: 'flex-start' }}
                >
                {pwdLoading ? <CircularProgress size={24} /> : (t('settings.updatePwd') || '修改密码')}
                </Button>
            </Box>
            </Paper>

            {/* 危险区域 */}
            <Paper sx={{ p: 3, borderColor: 'error.main' }}>
            <Typography variant="h6" color="error" gutterBottom>{t('settings.dangerZone') || '危险区域'}</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
                {t('settings.deleteDesc') || '注销账号将永久删除您的所有数据，此操作无法撤销。'}
            </Typography>
            <Button 
                variant="outlined" 
                color="error" 
                onClick={() => setDeleteDialogOpen(true)}
            >
                {t('settings.deleteAccount') || '注销账号'}
            </Button>
            </Paper>

            {/* 删除确认弹窗 */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
            >
                <DialogTitle>{t('settings.deleteConfirmTitle') || '确认注销账号？'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('settings.deleteConfirmContent') || '此操作无法撤销，您的所有数据将被永久删除。是否继续？'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                        {t('common.cancel') || '取消'}
                    </Button>
                    <Button onClick={handleDeleteAccount} color="error" autoFocus disabled={deleteLoading}>
                        {deleteLoading ? <CircularProgress size={20} /> : (t('common.confirm') || '确认')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
      ) : (
        <Alert severity="info">{t('settings.loginRequired') || '请登录以访问账号安全设置'}</Alert>
      )}
    </Box>
  )
}

export default SettingsPage
