import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Divider,
  Paper,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material'
import { AccountData, FileUploadState } from '../types'

interface DamageCalculatorProps {
  onBaselineDataChange?: (data: any) => void
  onTargetDataChange?: (data: any) => void
  baselineTeamStrength?: number
  targetTeamStrength?: number
}

const DamageCalculator: React.FC<DamageCalculatorProps> = ({ 
  onBaselineDataChange, 
  onTargetDataChange,
  baselineTeamStrength = 0,
  targetTeamStrength = 0
}) => {
  const [baselineFile, setBaselineFile] = useState<FileUploadState>({
    isUploading: false,
  })
  const [targetFile, setTargetFile] = useState<FileUploadState>({
    isUploading: false,
  })
  const [baselineDamage, setBaselineDamage] = useState<number>(0)
  const [calculatedDamage, setCalculatedDamage] = useState<number | null>(null)

  // 处理文件上传
  const handleFileUpload = useCallback((
    file: File,
    type: 'baseline' | 'target'
  ) => {
    const setState = type === 'baseline' ? setBaselineFile : setTargetFile
    const onDataChange = type === 'baseline' ? onBaselineDataChange : onTargetDataChange

    setState({
      isUploading: true,
      fileName: file.name,
    })

    // 读取和解析JSON文件
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const jsonData = JSON.parse(text)
        
        // 创建账户数据对象
        const accountData: AccountData = {
          id: Math.random().toString(36).substring(7),
          name: file.name.replace('.json', ''),
          level: 100,
          characterData: [],
          equipmentData: [],
        }

        setState({
          isUploading: false,
          fileName: file.name,
          data: accountData,
        })

        // 调用回调函数，传递解析后的JSON数据
        onDataChange?.(jsonData)
      } catch (error) {
        setState({
          isUploading: false,
          fileName: file.name,
          error: '文件解析失败: ' + (error as Error).message,
        })
      }
    }
    
    reader.onerror = () => {
      setState({
        isUploading: false,
        fileName: file.name,
        error: '文件读取失败',
      })
    }

    reader.readAsText(file)
  }, [onBaselineDataChange, onTargetDataChange])

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((
    e: React.DragEvent,
    type: 'baseline' | 'target'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        handleFileUpload(file, type)
      } else {
        const setState = type === 'baseline' ? setBaselineFile : setTargetFile
        setState({
          isUploading: false,
          error: '请上传JSON文件',
        })
      }
    }
  }, [handleFileUpload])

  // 点击上传
  const handleClickUpload = useCallback((type: 'baseline' | 'target') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleFileUpload(file, type)
      }
    }
    input.click()
  }, [handleFileUpload])

  // 清除文件
  const handleClearFile = useCallback((type: 'baseline' | 'target') => {
    const setState = type === 'baseline' ? setBaselineFile : setTargetFile
    setState({
      isUploading: false,
    })
    
    if (type === 'baseline') {
      setBaselineDamage(0)
      setCalculatedDamage(null)
    }
  }, [])

  // 计算伤害
  const handleCalculate = useCallback(() => {
    if (baselineDamage > 0 && baselineTeamStrength > 0 && targetTeamStrength > 0) {
      // 计算队伍强度比值
      const strengthRatio = targetTeamStrength / baselineTeamStrength
      // 对比例进行调整以缩小差异 - 使用平方根来减少极端值的影响
      const adjustedRatio = strengthRatio > 1 
        ? 1 + (strengthRatio - 1) * 0.7  // 如果比例大于1，缩小70%的增益
        : 1 - (1 - strengthRatio) * 0.7  // 如果比例小于1，缩小70%的减益
      // 根据调整后的比值计算目标伤害
      const calculatedTargetDamage = baselineDamage * adjustedRatio
      setCalculatedDamage(calculatedTargetDamage)
    }
  }, [baselineDamage, baselineTeamStrength, targetTeamStrength])

  // 文件上传区域组件
  const FileUploadArea: React.FC<{
    title: string
    type: 'baseline' | 'target'
    fileState: FileUploadState
  }> = ({ title, type, fileState }) => (
    <Card sx={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        
        <Box
          sx={{
            flex: 1,
            border: '2px dashed #ccc',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            minHeight: '120px',
            bgcolor: fileState.data ? '#f0f8ff' : 'transparent',
            borderColor: fileState.data ? '#1976d2' : '#ccc',
            '&:hover': {
              bgcolor: '#fafafa',
            },
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, type)}
          onClick={() => !fileState.isUploading && handleClickUpload(type)}
        >
          {fileState.isUploading ? (
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                正在上传...
              </Typography>
            </Box>
          ) : fileState.error ? (
            <Box sx={{ textAlign: 'center' }}>
              <Alert severity="error" sx={{ mb: 1 }}>
                {fileState.error}
              </Alert>
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFile(type)
                }}
              >
                重新上传
              </Button>
            </Box>
          ) : fileState.data ? (
            <Box sx={{ textAlign: 'center', width: '100%' }}>
              <Typography variant="body1" sx={{ mb: 1, color: '#1976d2' }}>
                ✓ {fileState.fileName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                账号: {fileState.data.name}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFile(type)
                }}
              >
                移除
              </Button>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <CloudUploadIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                点击或拖拽上传JSON文件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支持拖拽上传
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* 文件上传区域 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ width: '100%' }}>
            <FileUploadArea
              title="基线账号"
              type="baseline"
              fileState={baselineFile}
            />
          </Box>
          <Box sx={{ width: '100%' }}>
            <FileUploadArea
              title="目标账号"
              type="target"
              fileState={targetFile}
            />
          </Box>
        </Box>

        {/* 伤害输入和计算区域 */}
        {baselineFile.data && (
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              伤害计算
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, mt: 3 }}>
              <TextField
                label="基线伤害"
                type="number"
                value={baselineDamage}
                onChange={(e) => setBaselineDamage(Number(e.target.value))}
                variant="outlined"
                size="small"
                sx={{ width: '200px' }}
                InputProps={{
                  inputProps: {
                    min: 0,
                    step: 1,
                  },
                }}
              />
              
              <Button
                variant="contained"
                startIcon={<CalculateIcon />}
                onClick={handleCalculate}
                disabled={!baselineDamage || !baselineTeamStrength || !targetTeamStrength}
              >
                计算伤害
              </Button>
            </Box>

            {calculatedDamage !== null && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  计算结果
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    基线队伍强度: {baselineTeamStrength.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    目标队伍强度: {targetTeamStrength.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    强度比值: {baselineTeamStrength > 0 ? (targetTeamStrength / baselineTeamStrength).toFixed(3) : '0.000'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body1">
                    基线伤害: {baselineDamage.toLocaleString()}
                  </Typography>
                  <Typography variant="body1">
                    目标伤害: {calculatedDamage.toLocaleString()}
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: calculatedDamage > baselineDamage ? 'success.main' : 'error.main',
                      fontWeight: 'bold'
                    }}
                  >
                    差值: {(calculatedDamage - baselineDamage).toLocaleString()}
                    ({(((calculatedDamage - baselineDamage) / baselineDamage) * 100).toFixed(1)}%)
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {/* 提示信息 */}
        {!baselineFile.data && !targetFile.data && (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f8f9fa' }}>
            <Typography variant="body1" color="text.secondary">
              请先上传基线账号和目标账号的JSON文件
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              基线账号上传后可以输入伤害值进行计算
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

export default DamageCalculator
