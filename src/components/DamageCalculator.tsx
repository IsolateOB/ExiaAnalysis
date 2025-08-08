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
  Chip,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Calculate as CalculateIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material'
import * as XLSX from 'xlsx'
import { AccountData, FileUploadState } from '../types'
import { calculateCharacterStrength, createCharacterFromJsonData, calculateCharacterStrengthNoSync } from '../utils/teamUtils'

interface DamageCalculatorProps {
  onBaselineDataChange?: (data: any) => void
  onTargetDataChange?: (data: any) => void
  baselineTeamStrength?: number
  targetTeamStrength?: number
  onBaselineScoreChange?: (scores: Record<string, number>) => void
  onTargetScoreChange?: (scores: Record<string, number>) => void
  onStatusChange?: (status: string, severity?: 'success' | 'error' | 'info' | 'warning') => void
}

const DamageCalculator: React.FC<DamageCalculatorProps> = ({ 
  onBaselineDataChange, 
  onTargetDataChange,
  baselineTeamStrength = 0,
  targetTeamStrength = 0,
  onBaselineScoreChange,
  onTargetScoreChange,
  onStatusChange
}) => {
  const [baselineFile, setBaselineFile] = useState<FileUploadState>({
    isUploading: false,
  })
  const [targetFile, setTargetFile] = useState<FileUploadState>({
    isUploading: false,
  })
  const [batchFiles, setBatchFiles] = useState<{[key: string]: any}>({})
  const [batchProgress, setBatchProgress] = useState<{
    isProcessing: boolean,
    current?: number,
    total?: number,
    status?: string
  }>({ isProcessing: false })
  const [baselineDamage, setBaselineDamage] = useState<number>(0)
  const [calculatedDamage, setCalculatedDamage] = useState<number | null>(null)

  // 使用导入的工具函数，不需要重复定义

  // 计算整个账号的角色词条突破分数据
  const calculateAccountScores = async (accountData: any): Promise<{[characterId: string]: number}> => {
    const results: {[characterId: string]: number} = {};
    
    console.log('🏆 开始计算账号词条突破分，账号数据:', accountData);
    
    // 处理角色数据 - 从elements对象中获取
    if (accountData.elements) {
      for (const [elementType, characters] of Object.entries(accountData.elements)) {
        console.log(`🌟 处理元素类型: ${elementType}`);
        if (Array.isArray(characters)) {
          for (const character of characters) {
            console.log(`🔍 计算角色 ${character.id} (${character.name_cn || character.name}) 的词条突破分`);
            try {
              // 将JSON数据转换为Character对象
              const characterObj = createCharacterFromJsonData(character);
              // 计算词条突破分
              const score = await calculateCharacterStrengthNoSync(character, characterObj, accountData);
              results[character.id] = score;
              console.log(`✅ 角色 ${character.id} 词条突破分: ${score.toFixed(3)}`);
            } catch (error) {
              console.error(`❌ 计算角色 ${character.id} 词条突破分时出错:`, error);
              results[character.id] = 0;
            }
          }
        }
      }
    }
    
    console.log('📊 账号所有角色词条突破分结果:', results);
    return results;
  };

  // 计算整个账号的角色强度数据
  const calculateAccountStrengths = async (accountData: any): Promise<{[characterId: string]: number}> => {
    const results: {[characterId: string]: number} = {};
    
    console.log('🎮 开始计算账号强度，账号数据:', accountData);
    
    // 处理角色数据 - 从elements对象中获取
    if (accountData.elements) {
      for (const [elementType, characters] of Object.entries(accountData.elements)) {
        console.log(`🌟 处理元素类型: ${elementType}`);
        if (Array.isArray(characters)) {
          for (const character of characters) {
            console.log(`🔍 计算角色 ${character.id} (${character.name_cn || character.name}) 的强度`);
            try {
              // 将JSON数据转换为Character对象
              const characterObj = createCharacterFromJsonData(character);
              // 批量处理使用无同步器强度计算
              const strength = await calculateCharacterStrengthNoSync(character, characterObj, accountData);
              results[character.id] = strength;
              console.log(`✅ 角色 ${character.id} 词条突破分: ${strength.toFixed(3)}`);
            } catch (error) {
              console.error(`❌ 计算角色 ${character.id} 词条突破分时出错:`, error);
              results[character.id] = 0;
            }
          }
        }
      }
    }
    
    console.log('📊 账号所有角色强度结果:', results);
    return results;
  };

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
        
        // 计算词条突破分并传递给父组件
        if (type === 'baseline' && onBaselineScoreChange) {
          calculateAccountScores(jsonData).then(scores => {
            onBaselineScoreChange(scores);
          });
        } else if (type === 'target' && onTargetScoreChange) {
          calculateAccountScores(jsonData).then(scores => {
            onTargetScoreChange(scores);
          });
        }
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

  // 处理批量文件上传
  const handleBatchFileUpload = useCallback((files: FileList) => {
    const newBatchFiles: {[key: string]: any} = { ...batchFiles };
    
    Array.from(files).forEach((file) => {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const jsonData = JSON.parse(text);
            const accountName = jsonData.name || file.name.replace('.json', '');
            newBatchFiles[accountName] = jsonData;
            setBatchFiles({ ...newBatchFiles });
          } catch (error) {
            console.error(`解析文件 ${file.name} 失败:`, error);
          }
        };
        reader.readAsText(file);
      }
    });
  }, [batchFiles]);

  // 批量处理并导出Excel
  const handleBatchProcess = useCallback(async () => {
    console.clear(); // 清空控制台
    console.log('=== 开始批量处理 ===');
    
    const fileNames = Object.keys(batchFiles);
    console.log('批量文件列表:', fileNames);
    
    if (fileNames.length === 0) {
      console.log('没有文件需要处理');
      return;
    }

    setBatchProgress({
      isProcessing: true,
      current: 0,
      total: fileNames.length,
      status: '开始处理...'
    });

    try {
      const results: any[] = [];
      
      // 收集所有角色ID和名称
      const allCharacters = new Map<string, string>(); // ID -> 名称
      
      console.log('开始分析账号数据结构...');
      fileNames.forEach(accountName => {
        const accountData = batchFiles[accountName];
        console.log(`账号 ${accountName} 数据结构:`, accountData);
        
        if (accountData.elements) {
          Object.values(accountData.elements).forEach((characters: any) => {
            if (Array.isArray(characters)) {
              characters.forEach((character: any) => {
                console.log(`找到角色:`, character);
                // 直接从角色数据中获取名称
                const characterName = character.name || character.name_cn || character.id || '未知角色';
                allCharacters.set(character.id, characterName);
              });
            }
          });
        }
      });

      console.log('所有角色列表:', Array.from(allCharacters.entries()));

      // 处理每个账号
      for (let i = 0; i < fileNames.length; i++) {
        const accountName = fileNames[i];
        const accountData = batchFiles[accountName];
        
        setBatchProgress({
          isProcessing: true,
          current: i + 1,
          total: fileNames.length,
          status: `正在处理 ${accountName}...`
        });

        console.log(`开始计算账号 ${accountName} 的强度...`);
        const strengths = await calculateAccountStrengths(accountData);
        console.log(`账号 ${accountName} 强度结果:`, strengths);
        
        const row: any = { '账号名称': accountName };
        
        // 使用Map中的角色名称
        allCharacters.forEach((characterName, characterId) => {
          row[characterName] = strengths[characterId] || 0;
        });
        
        console.log(`账号 ${accountName} 最终行数据:`, row);
        results.push(row);
      }

      // 创建Excel工作簿时调整列顺序：账号名称在最左边
      const workbook = XLSX.utils.book_new();
      
      // 手动构建表头，确保账号名称在第一列
      const headers = ['账号名称'];
      allCharacters.forEach((characterName) => {
        headers.push(characterName);
      });
      
      // 创建工作表数据，第一行是表头
      const worksheetData = [headers];
      results.forEach(row => {
        const rowData = [row['账号名称']];
        headers.slice(1).forEach(header => {
          rowData.push(row[header] || 0);
        });
        worksheetData.push(rowData);
      });
      
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // 设置列宽
      const colWidths = [{ wch: 20 }]; // 账号名称列
      headers.slice(1).forEach(() => {
        colWidths.push({ wch: 15 });
      });
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, '角色强度统计');
      
      // 下载Excel文件
      const fileName = `角色强度统计_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setBatchProgress({
        isProcessing: false,
        status: '处理完成！'
      });
      
      // 通知App组件显示成功消息
      onStatusChange?.('Excel文件已成功导出！', 'success');
    } catch (error) {
      console.error('批量处理失败:', error);
      setBatchProgress({
        isProcessing: false,
        status: '处理失败: ' + (error as Error).message
      });
      
      // 通知App组件显示错误消息
      onStatusChange?.('批量处理失败: ' + (error as Error).message, 'error');
    }
  }, [batchFiles, calculateAccountStrengths]);

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((
    e: React.DragEvent,
    type: 'baseline' | 'target' | 'batch'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files.length > 0) {
      if (type === 'batch') {
        // 批量上传：支持多个文件
        const jsonFiles = Array.from(files).filter(file => 
          file.type === 'application/json' || file.name.endsWith('.json')
        );
        if (jsonFiles.length > 0) {
          const fileList = new DataTransfer();
          jsonFiles.forEach(file => fileList.items.add(file));
          handleBatchFileUpload(fileList.files);
        }
      } else {
        // 单文件上传
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
    }
  }, [handleFileUpload, handleBatchFileUpload])

  // 点击上传
  const handleClickUpload = useCallback((type: 'baseline' | 'target' | 'batch') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    if (type === 'batch') {
      input.multiple = true; // 批量上传支持多选
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files.length > 0) {
          handleBatchFileUpload(files)
        }
      }
    } else {
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          handleFileUpload(file, type)
        }
      }
    }
    
    input.click()
  }, [handleFileUpload, handleBatchFileUpload])

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

  // 清除批量文件
  const handleClearBatchFiles = useCallback(() => {
    setBatchFiles({});
    setBatchProgress({ isProcessing: false });
  }, []);

  // 计算伤害
  const handleCalculate = useCallback(() => {
    if (baselineDamage > 0 && baselineTeamStrength > 0 && targetTeamStrength > 0) {
      // 计算队伍强度比值
      const strengthRatio = targetTeamStrength / baselineTeamStrength
      // 使用对称幂函数缩小差异，保证A→B和B→A结果对称
      const adjustedRatio = Math.pow(strengthRatio, 0.7)
      // 根据调整后的比值计算目标伤害
      const calculatedTargetDamage = baselineDamage * adjustedRatio
      setCalculatedDamage(calculatedTargetDamage)
    }
  }, [baselineDamage, baselineTeamStrength, targetTeamStrength])

  // 单个文件上传区域组件
  const FileUploadArea: React.FC<{
    title: string
    type: 'baseline' | 'target'
    fileState: FileUploadState
  }> = ({ title, type, fileState }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontSize: '0.9rem', mb: 0.5 }}>
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
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                正在上传...
              </Typography>
            </Box>
          ) : fileState.error ? (
            <Box sx={{ textAlign: 'center' }}>
              <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>
                {fileState.error}
              </Alert>
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFile(type)
                }}
                sx={{ fontSize: '0.7rem' }}
              >
                重新上传
              </Button>
            </Box>
          ) : fileState.data ? (
            <Box sx={{ textAlign: 'center', width: '100%' }}>
              <Typography variant="body2" sx={{ mb: 1, color: '#1976d2', fontSize: '0.8rem' }}>
                ✓ {fileState.fileName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.7rem' }}>
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
                sx={{ fontSize: '0.7rem' }}
              >
                移除
              </Button>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <CloudUploadIcon sx={{ fontSize: 32, color: '#ccc', mb: 0.5 }} />
              <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.8rem' }}>
                点击或拖拽上传
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                JSON文件
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )

  // 批量上传区域组件
  const BatchUploadArea: React.FC = () => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
          批量处理区域
        </Typography>
        
        <Box
          sx={{
            border: '2px dashed #ccc',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flex: 1,
            mb: 1,
            bgcolor: Object.keys(batchFiles).length > 0 ? '#f0f8ff' : 'transparent',
            borderColor: Object.keys(batchFiles).length > 0 ? '#1976d2' : '#ccc',
            '&:hover': {
              bgcolor: '#fafafa',
            },
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'batch')}
          onClick={() => !batchProgress.isProcessing && handleClickUpload('batch')}
        >
          {batchProgress.isProcessing ? (
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {batchProgress.status}
              </Typography>
              {batchProgress.current && batchProgress.total && (
                <Typography variant="body2" color="text.secondary">
                  {batchProgress.current} / {batchProgress.total}
                </Typography>
              )}
            </Box>
          ) : Object.keys(batchFiles).length > 0 ? (
            <Box sx={{ textAlign: 'center', width: '100%' }}>
              <AssessmentIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
              <Typography variant="body1" sx={{ mb: 1, color: '#1976d2' }}>
                已上传 {Object.keys(batchFiles).length} 个账号
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 1 }}>
                {Object.keys(batchFiles).slice(0, 3).map(name => (
                  <Chip key={name} label={name} size="small" />
                ))}
                {Object.keys(batchFiles).length > 3 && (
                  <Chip label={`+${Object.keys(batchFiles).length - 3}`} size="small" />
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <CloudUploadIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                批量上传JSON文件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支持多选和拖拽上传
              </Typography>
            </Box>
          )}
        </Box>

        {/* 批量操作按钮 */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={handleBatchProcess}
            disabled={Object.keys(batchFiles).length === 0 || batchProgress.isProcessing}
            size="small"
          >
            计算并导出Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleClearBatchFiles}
            disabled={Object.keys(batchFiles).length === 0 || batchProgress.isProcessing}
            size="small"
          >
            清空
          </Button>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* 新布局：批量处理区域在上方 */}
        <Box sx={{ flex: 35 }}>
          <BatchUploadArea />
        </Box>

        {/* 单个文件上传区域 - 并排显示 */}
        <Box sx={{ flex: 30, display: 'flex', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <FileUploadArea
              title="基线账号"
              type="baseline"
              fileState={baselineFile}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <FileUploadArea
              title="目标账号"
              type="target"
              fileState={targetFile}
            />
          </Box>
        </Box>

        {/* 伤害输入和计算区域 - 始终显示以保持布局稳定 */}
        <Paper sx={{ p: 1, flex: 35, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', mb: 0.5 }}>
            伤害计算
          </Typography>
          
          {baselineFile.data ? (
            <>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 0.5 }}>
                <TextField
                  label="基线伤害"
                  type="number"
                  value={baselineDamage}
                  onChange={(e) => setBaselineDamage(Number(e.target.value))}
                  variant="outlined"
                  size="small"
                  sx={{ width: '150px' }}
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
                  size="small"
                >
                  计算伤害
                </Button>
              </Box>

              {calculatedDamage !== null && (
                <Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      基线强度: {baselineTeamStrength.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      目标强度: {targetTeamStrength.toFixed(1)}
                    </Typography>
                    <Typography variant="body2">
                      基线伤害: {baselineDamage.toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                      目标伤害: {calculatedDamage.toLocaleString()}
                    </Typography>
                    <Typography 
                      variant="body2" 
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
            </>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: 'text.secondary' 
            }}>
              <Typography variant="body2">
                请上传基线和目标账号文件以进行伤害计算
              </Typography>
            </Box>
          )}
        </Paper>

        {/* 移除原来的提示信息区域，因为现在伤害计算区域始终显示 */}
      </Box>
    </Box>
  )
}

export default DamageCalculator
