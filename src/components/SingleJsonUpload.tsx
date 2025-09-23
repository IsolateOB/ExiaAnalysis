/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useState } from 'react'
import { Box, Typography, Button, Alert, LinearProgress } from '@mui/material'
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon, HelpOutline as HelpOutlineIcon } from '@mui/icons-material'
import { useI18n } from '../i18n'

export interface AccountsPayload {
  accounts: any[]
}

interface SingleJsonUploadProps {
  onAccountsLoaded: (payload: AccountsPayload) => void
}

const SingleJsonUpload: React.FC<SingleJsonUploadProps> = ({ onAccountsLoaded }) => {
  const { t } = useI18n()
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  const parseAccounts = (data: any): any[] => {
    // 支持三种形态：数组 / { accounts: [] } / 单一账号对象
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.accounts)) return data.accounts
    if (data && typeof data === 'object') return [data]
    return []
  }

  const loadFile = useCallback((file: File) => {
    setIsUploading(true)
    setError(undefined)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const json = JSON.parse(text)
        const accounts = parseAccounts(json)
        onAccountsLoaded({ accounts })
      } catch (e: any) {
        setError(t('upload.parseError') + ': ' + (e?.message || 'unknown'))
      } finally {
        setIsUploading(false)
      }
    }
    reader.onerror = () => {
      setError(t('upload.readError'))
      setIsUploading(false)
    }
    reader.readAsText(file)
  }, [onAccountsLoaded])

  const handleClickUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]
      if (file) loadFile(file)
    }
    input.click()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type === 'application/json' || f.name.endsWith('.json'))) {
      loadFile(f)
    } else {
      setError(t('upload.onlyJson'))
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }

  const clear = () => { setFileName(undefined); setError(undefined); onAccountsLoaded({ accounts: [] }) }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('upload.title')}</Typography>
        <Box
          component="a"
          href="https://github.com/IsolateOB/ExiaAnalysis?tab=readme-ov-file#exiaanalysis"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          <HelpOutlineIcon fontSize="small" />
          <Typography variant="caption" sx={{ color: 'inherit' }}>{t('upload.helpLink')}</Typography>
        </Box>
      </Box>
      <Box
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isUploading && handleClickUpload()}
        sx={{
          border: '2px dashed #ccc', borderRadius: 1, p: 2,
          // 保持上传前后尺寸一致
          width: '100%',
          height: 120,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          cursor: 'pointer', bgcolor: fileName ? '#f0f8ff' : 'transparent', borderColor: fileName ? '#1976d2' : '#ccc',
          '&:hover': { bgcolor: '#fafafa' }
        }}
      >
        {isUploading ? (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{t('upload.uploading')}</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>{error}</Alert>
            <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); clear() }} sx={{ fontSize: '0.7rem' }}>{t('upload.retry')}</Button>
          </Box>
        ) : fileName ? (
          <Box sx={{ textAlign: 'center', maxWidth: '100%' }}>
            <Typography variant="body2" noWrap sx={{ mb: 1, color: '#1976d2', fontSize: '0.8rem', maxWidth: '100%' }}>✓ {fileName}</Typography>
            <Button variant="outlined" size="small" startIcon={<DeleteIcon />} onClick={(e) => { e.stopPropagation(); clear() }} sx={{ fontSize: '0.7rem' }}>{t('common.remove')}</Button>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <CloudUploadIcon sx={{ fontSize: 32, color: '#ccc', mb: 0.5 }} />
            <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.8rem' }}>{t('upload.hint')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('upload.onlyOneJson')}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default SingleJsonUpload
