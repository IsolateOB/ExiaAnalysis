/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Avatar
} from '@mui/material'
import { useI18n } from '../hooks/useI18n'
import { AVATAR_URLS } from '../data/avatarUrls'

const API_BASE_URL = 'https://backend.nikke-exia.com'

interface SettingsPageProps {
  authToken: string | null
  username: string | null
  avatarUrl: string | null
  restricted?: boolean
  onLogout: () => void
  onUpdateUser: (newToken: string, newUsername: string) => void
  onUpdateAvatar: (newAvatarUrl: string) => void
  onNotify: (msg: string, severity: 'success' | 'error' | 'info' | 'warning') => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({ authToken, username, avatarUrl, restricted = false, onLogout, onUpdateUser, onUpdateAvatar, onNotify }) => {
  const { t, lang, toggleLang } = useI18n()

  // 淇敼鐢ㄦ埛鍚嶇姸鎬?
  const [newUsername, setNewUsername] = useState(username || '')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(avatarUrl || '')
  const [avatarLoading, setAvatarLoading] = useState(false)

  useEffect(() => {
    setSelectedAvatar(avatarUrl || '')
  }, [avatarUrl])

  // 淇敼瀵嗙爜鐘舵€?
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)

  // 鍒犻櫎璐﹀彿瀵硅瘽妗嗙姸鎬?
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 鍙楅檺妯″紡瀵嗙爜璁剧疆鐘舵€?
  const [restrictedPwdForm, setRestrictedPwdForm] = useState({ restricted: '', confirm: '' })
  const [restrictedPwdLoading, setRestrictedPwdLoading] = useState(false)

  const handleUpdateUsername = async () => {
    if (!authToken) return
    if (!newUsername || newUsername.length < 3) {
        onNotify(t('settings.usernameTooShort') || 'Username must be at least 3 characters.', 'warning')
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
            onNotify(data.error || (t('settings.changeUsernameFailed') || 'Failed to change username.'), 'error')
        } else {
            onNotify(t('settings.changeUsernameSuccess') || 'Username updated.', 'success')
            onUpdateUser(data.token, data.username)
        }
    } catch {
        onNotify(t('settings.changeUsernameFailed') || 'Failed to change username.', 'error')
    } finally {
        setUsernameLoading(false)
    }
  }

  const handlePwdChange = (key: 'current' | 'new' | 'confirm', val: string) => {
    setPwdForm(prev => ({ ...prev, [key]: val }))
  }

  const submitChangePassword = async () => {
    if (!authToken) {
      onNotify(t('auth.required') || '璇峰厛鐧诲綍', 'error')
      return
    }
    if (!pwdForm.current || !pwdForm.new) {
      onNotify(t('settings.pwdRequired') || 'Please enter the current and new password.', 'warning')
      return
    }
    if (pwdForm.new !== pwdForm.confirm) {
      onNotify(t('settings.pwdMismatch') || 'The new passwords do not match.', 'error')
      return
    }
    if (pwdForm.new.length < 6) {
      onNotify(t('settings.pwdTooShort') || 'The new password must be at least 6 characters.', 'warning')
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
        onNotify(data.error || (t('settings.changePwdFailed') || '淇敼瀵嗙爜澶辫触'), 'error')
      } else {
        onNotify(t('settings.changePwdSuccess') || '瀵嗙爜淇敼鎴愬姛', 'success')
        setPwdForm({ current: '', new: '', confirm: '' })
      }
    } catch {
      onNotify(t('settings.changePwdFailed') || '淇敼瀵嗙爜澶辫触', 'error')
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
            onNotify(data.error || (t('settings.deleteAccountFailed') || '娉ㄩ攢璐﹀彿澶辫触'), 'error')
        } else {
            onNotify(t('settings.deleteAccountSuccess') || '璐﹀彿宸叉敞閿€', 'success')
            setDeleteDialogOpen(false)
            onLogout()
        }
    } catch {
        onNotify(t('settings.deleteAccountFailed') || '娉ㄩ攢璐﹀彿澶辫触', 'error')
    } finally {
        setDeleteLoading(false)
    }
  }

  const submitSetRestrictedPassword = async () => {
    if (!authToken) return
    const isDisabling = !restrictedPwdForm.restricted && !restrictedPwdForm.confirm
    if (!isDisabling) {
      if (!restrictedPwdForm.restricted) {
        onNotify(t('settings.restrictedPwdRequired') || 'Please enter a restricted password.', 'warning')
        return
      }
      if (restrictedPwdForm.restricted !== restrictedPwdForm.confirm) {
        onNotify(t('settings.pwdMismatch') || 'The passwords do not match.', 'error')
        return
      }
      if (restrictedPwdForm.restricted.length < 6) {
        onNotify(t('settings.pwdTooShort') || 'The password must be at least 6 characters.', 'warning')
        return
      }
    }
    setRestrictedPwdLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/set-restricted-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restricted_password: restrictedPwdForm.restricted
        })
      })
      const data = await res.json()
      if (!res.ok) {
        onNotify(data.error || (t('settings.setRestrictedPwdFailed') || '璁剧疆鍙楅檺瀵嗙爜澶辫触'), 'error')
      } else {
        const msg = isDisabling
          ? (t('settings.restrictedPwdDisabled') || 'Restricted mode disabled.')
          : (t('settings.restrictedPwdSet') || '鍙楅檺瀵嗙爜璁剧疆鎴愬姛')
        onNotify(msg, 'success')
        setRestrictedPwdForm({ restricted: '', confirm: '' })
      }
    } catch {
      onNotify(t('settings.setRestrictedPwdFailed') || '璁剧疆鍙楅檺瀵嗙爜澶辫触', 'error')
    } finally {
      setRestrictedPwdLoading(false)
    }
  }

  const handleUpdateAvatar = async () => {
    if (!authToken) return
    if (!selectedAvatar) {
      onNotify(t('settings.avatarRequired') || '璇烽€夋嫨澶村儚', 'warning')
      return
    }
    setAvatarLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/change-avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ avatar_url: selectedAvatar })
      })
      const data = await res.json()
      if (!res.ok) {
        onNotify(data.error || (t('settings.changeAvatarFailed') || '澶村儚淇敼澶辫触'), 'error')
      } else {
        onNotify(t('settings.changeAvatarSuccess') || '澶村儚淇敼鎴愬姛', 'success')
        onUpdateAvatar(selectedAvatar)
      }
    } catch {
      onNotify(t('settings.changeAvatarFailed') || '澶村儚淇敼澶辫触', 'error')
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>{t('settings.title') || '璁剧疆'}</Typography>

      {/* 璇█璁剧疆 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{t('settings.language') || '璇█'}</Typography>
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
                涓枃
            </ToggleButton>
            <ToggleButton value="en" sx={{ px: 3 }}>
                English
            </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* 璐﹀彿瀹夊叏鍖哄煙锛屼粎闈炲彈闄愭ā寮忕櫥褰曞悗鍙 */}
      {authToken && !restricted ? (
        <>
            {/* 涓汉璧勬枡 (鐢ㄦ埛鍚? */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{t('settings.profile') || '涓汉璧勬枡'}</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: 'column', maxWidth: 400 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%' }}>
                        <TextField
                            label={t('settings.username') || 'Username'}
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            fullWidth
                            helperText={t('settings.usernameHelp') || 'Changing your username may require signing in again.'}
                        />
                        <Button
                            variant="contained"
                            onClick={handleUpdateUsername}
                            disabled={usernameLoading || newUsername === (username || '')}
                            sx={{ mt: -2.5 }} // align with input
                        >
                            {usernameLoading ? <CircularProgress size={24} /> : (t('common.save') || '淇濆瓨')}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* 澶村儚璁剧疆 */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>{t('settings.avatar') || '澶村儚'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('settings.avatarHelp') || '閫夋嫨涓€涓ご鍍忓苟淇濆瓨'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <Avatar src={selectedAvatar || avatarUrl || ''} sx={{ width: 56, height: 56 }} />
                <Button
                  variant="contained"
                  onClick={handleUpdateAvatar}
                  disabled={avatarLoading || !selectedAvatar || selectedAvatar === (avatarUrl || '')}
                >
                  {avatarLoading ? <CircularProgress size={24} /> : (t('common.save') || '淇濆瓨')}
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 1 }}>
                {AVATAR_URLS.map((url) => (
                  <Box
                    key={url}
                    onClick={() => setSelectedAvatar(url)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: '50%',
                      border: url === selectedAvatar ? '2px solid #1976d2' : '2px solid transparent',
                      p: 0.25,
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                  >
                    <Avatar src={url} sx={{ width: 48, height: 48 }} />
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* 淇敼瀵嗙爜 */}
            <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('settings.security') || '璐﹀彿瀹夊叏'}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <TextField
                label={t('settings.currentPwd') || '褰撳墠瀵嗙爜'}
                type="password"
                value={pwdForm.current}
                onChange={(e) => handlePwdChange('current', e.target.value)}
                disabled={pwdLoading}
                />
                <TextField
                label={t('settings.newPwd') || 'New password'}
                type="password"
                value={pwdForm.new}
                onChange={(e) => handlePwdChange('new', e.target.value)}
                disabled={pwdLoading}
                />
                <TextField
                label={t('settings.confirmPwd') || 'Confirm new password'}
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
                {pwdLoading ? <CircularProgress size={24} /> : (t('settings.updatePwd') || '淇敼瀵嗙爜')}
                </Button>
            </Box>
            </Paper>

            {/* 鍙楅檺妯″紡瀵嗙爜 */}
            <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>{t('settings.restrictedMode') || '鍙楅檺妯″紡'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.restrictedModeDesc') || 'Set a separate restricted password so others can sign in to view data without changing sensitive settings.'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <TextField
                label={t('settings.restrictedPwd') || 'Restricted password (leave blank to disable)'}
                type="password"
                value={restrictedPwdForm.restricted}
                onChange={(e) => setRestrictedPwdForm(prev => ({ ...prev, restricted: e.target.value }))}
                disabled={restrictedPwdLoading}
                />
                <TextField
                label={t('settings.confirmPwd') || '纭鍙楅檺瀵嗙爜'}
                type="password"
                value={restrictedPwdForm.confirm}
                onChange={(e) => setRestrictedPwdForm(prev => ({ ...prev, confirm: e.target.value }))}
                disabled={restrictedPwdLoading || !restrictedPwdForm.restricted}
                helperText={!restrictedPwdForm.restricted ? (t('settings.restrictedDisableHint') || 'Leave the restricted password empty to disable restricted mode.') : ''}
                />
                <Button
                  variant="contained"
                  onClick={submitSetRestrictedPassword}
                  disabled={restrictedPwdLoading}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {restrictedPwdLoading ? <CircularProgress size={24} /> : (t('common.save') || '淇濆瓨')}
                </Button>
            </Box>
            </Paper>

            {/* 鍗遍櫓鍖哄煙 */}
            <Paper sx={{ p: 3, borderColor: 'error.main' }}>
            <Typography variant="h6" color="error" gutterBottom>{t('settings.dangerZone') || '鍗遍櫓鍖哄煙'}</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
                {t('settings.deleteDesc') || 'Deleting the account will permanently remove all associated data.'}
            </Typography>
            <Button 
                variant="outlined" 
                color="error" 
                onClick={() => setDeleteDialogOpen(true)}
            >
                {t('settings.deleteAccount') || '娉ㄩ攢璐﹀彿'}
            </Button>
            </Paper>

            {/* 鍒犻櫎纭寮圭獥 */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
            >
                <DialogTitle>{t('settings.deleteConfirmTitle') || 'Confirm account deletion'}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('settings.deleteConfirmContent') || '姝ゆ搷浣滄棤娉曟挙閿€锛屾偍鐨勬墍鏈夋暟鎹皢琚案涔呭垹闄ゃ€傛槸鍚︾户缁紵'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                        {t('common.cancel') || '鍙栨秷'}
                    </Button>
                    <Button onClick={handleDeleteAccount} color="error" autoFocus disabled={deleteLoading}>
                        {deleteLoading ? <CircularProgress size={20} /> : (t('common.confirm') || '纭')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
      ) : authToken && restricted ? (
        <Alert severity="info">{t('settings.restrictedNoEdit') || 'Restricted mode cannot edit account settings.'}</Alert>
      ) : (
        <Alert severity="info">{t('settings.loginRequired') || '璇风櫥褰曚互璁块棶璐﹀彿瀹夊叏璁剧疆'}</Alert>
      )}
    </Box>
  )
}

export default SettingsPage


