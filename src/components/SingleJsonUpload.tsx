/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useState } from 'react'
import { Box, Typography, Button, Alert, LinearProgress } from '@mui/material'
import { CloudUpload as CloudUploadIcon, HelpOutline as HelpOutlineIcon } from '@mui/icons-material'
import { useI18n } from '../i18n'

export interface AccountsPayload {
  accounts: any[]
  fileName?: string
}

interface SingleJsonUploadProps {
  onAccountsLoaded: (payload: AccountsPayload) => void
}

const SingleJsonUpload: React.FC<SingleJsonUploadProps> = ({ onAccountsLoaded }) => {
  const { t } = useI18n()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const loadFile = useCallback((file: File) => {
    setIsUploading(true)
    setError(undefined)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const json = JSON.parse(text)
        const accounts = Array.isArray(json)
          ? json
          : (json && Array.isArray(json.accounts))
            ? json.accounts
            : json && typeof json === 'object'
              ? [json]
              : []
        onAccountsLoaded({ accounts, fileName: file.name })
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
  }, [onAccountsLoaded, t])

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('upload.title')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudUploadIcon />}
            onClick={() => !isUploading && handleClickUpload()}
          >
            {t('upload.title')}
          </Button>
        </Box>
      </Box>
      {isUploading && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{t('upload.uploading')}</Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>
      )}
    </Box>
  )
}

export default SingleJsonUpload
